import {
  backoff,
  beerEntry,
  classify,
  forgetRow,
  isFresh,
  nextBatch,
  nextSeq,
  settleRefusal,
  settleVoid,
  takeBackStep,
  toRows,
  type ApiError,
  type BeerEntry,
  type BeerInsert,
  type Entry,
  type Found,
  type TallyBeer,
  type VoidEntry,
} from './core'
import type { Slate } from './store'

// The flush loop (D72): strictly in order, one flusher per phone, batched, and a refusal is
// checked before it's believed. The API, lock, clock and timers are injected, so vitest can
// drive it without a browser or a server.

export type QueueApi = {
  usableSession(): Promise<{ userId: string } | null>
  sendBeers(rows: BeerInsert[]): Promise<ApiError | null>
  voidBeer(id: string, at: string, by: string): Promise<{ error: ApiError | null; count: number }>
  findBeers(ids: string[]): Promise<{ error: ApiError | null; rows: Found[] }>
}
export type Phase = 'idle' | 'sending' | 'waiting' | 'offline' | 'no-auth'
/** One pass of the flusher, reported when it moved something or found nothing left to send
 *  (`done`). */
export type Report = { landed: Entry[]; failed: Entry[]; done: boolean }
export type Hooks = { landed?(e: Entry): void; settled?(r: Report): void }
type Step = 'next' | 'network' | 'auth' | 'retry'
type Night = { id: string; crew_id: string }

const WEEK = 7 * 24 * 60 * 60_000

export function createRunner(d: {
  slate: Slate
  api: QueueApi
  uuid: () => string
  lock?: (fn: () => Promise<void>) => Promise<void>
  now?: () => number
  random?: () => number
  online?: () => boolean
}) {
  const now = d.now ?? Date.now
  const lock = d.lock ?? ((fn) => fn())
  let userId: string | null = null
  let hooks: Hooks = {}
  let phase: Phase = 'idle'
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let again = false
  const listeners = new Set<() => void>()
  let snap: { entries: Entry[]; phase: Phase; ready: boolean; durable: boolean } | null = null
  const notify = () => {
    snap = null
    listeners.forEach((l) => l())
  }
  const setPhase = (p: Phase) => {
    if (p === phase) return
    phase = p
    notify()
  }

  async function kick(reset = false) {
    if (reset) failures = 0
    if (running) {
      again = true
      return
    }
    running = true
    try {
      await d.slate.ready
      await lock(drain)
    } finally {
      running = false
      if (again) {
        again = false
        void kick()
      }
    }
  }

  async function drain() {
    clearTimeout(timer)
    if (!userId) return
    if (d.online && !d.online()) return setPhase('offline') // the 'online' event kicks us
    const report: Report = { landed: [], failed: [], done: false }
    try {
      for (;;) {
        if (!nextBatch(d.slate.list(userId))) {
          failures = 0
          report.done = true
          return setPhase('idle')
        }
        const me = await d.api.usableSession()
        if (!me || me.userId !== userId) return wait('auth')
        const batch = nextBatch(d.slate.list(userId)) // read again: a "−" may have crossed one off
        if (!batch) continue
        setPhase('sending')
        const step = batch.kind === 'void' ? await sendVoid(batch.entry, report) : await sendBeers(batch.entries, report)
        if (step !== 'next') return wait(step)
      }
    } finally {
      if (report.landed.length || report.failed.length || report.done) hooks.settled?.(report)
    }
  }

  function wait(why: Exclude<Step, 'next'>) {
    failures++
    setPhase(why === 'network' ? 'offline' : why === 'auth' ? 'no-auth' : 'waiting')
    timer = setTimeout(() => void kick(), backoff(failures, d.random))
  }

  function land(e: Entry, r: Report) {
    hooks.landed?.(e) // into the query cache first, so the count never dips (D75)
    void d.slate.remove(e.id)
    r.landed.push(e)
  }
  const bump = (es: Entry[]) => es.forEach((e) => void d.slate.put({ ...e, attempts: e.attempts + 1 }))

  async function sendBeers(batch: BeerEntry[], r: Report): Promise<Step> {
    const t = now()
    const sent = batch.map((e) => ({ ...e, sent_at: e.sent_at ?? t }))
    sent.forEach((e) => void d.slate.put(e)) // synchronous in the copy: "−" now voids instead of cancelling
    const err = await d.api.sendBeers(toRows(sent, t))
    if (!err) {
      sent.forEach((e) => land(e, r))
      return 'next'
    }
    const o = classify(err)
    if (o.kind !== 'refused') {
      bump(sent)
      return o.kind
    }
    if (sent.length > 1) {
      // find the one it was about
      for (const e of sent) {
        const s = await sendBeers([e], r)
        if (s !== 'next') return s
      }
      return 'next'
    }
    const [e] = sent
    if (o.reason === 'closed' && isFresh(e, t)) {
      // stamped by the server after the whistle: send again with the tap's own time (D73)
      const retry = { ...e, attempts: e.attempts + 1 }
      void d.slate.put(retry)
      return sendBeers([retry], r)
    }
    const found = await d.api.findBeers(e.rows.map((x) => x.client_uuid))
    if (found.error) {
      bump([e])
      const k = classify(found.error).kind
      return k === 'refused' ? 'retry' : k
    }
    const rest = settleRefusal(e, new Set(found.rows.map((x) => x.id)), o.reason, now())
    if (!rest) land(e, r)
    else {
      void d.slate.put(rest)
      r.failed.push(rest)
    }
    return 'next'
  }

  async function sendVoid(e: VoidEntry, r: Report): Promise<Step> {
    const sent = { ...e, sent_at: e.sent_at ?? now() }
    void d.slate.put(sent)
    const res = await d.api.voidBeer(e.target, new Date(e.tapped_at).toISOString(), e.user_id)
    if (res.error) {
      const o = classify(res.error)
      if (o.kind !== 'refused') {
        bump([sent])
        return o.kind
      }
    } else if (res.count > 0) {
      land(sent, r)
      return 'next'
    }
    const found = await d.api.findBeers([e.target])
    if (found.error) {
      bump([sent])
      const k = classify(found.error).kind
      return k === 'refused' ? 'retry' : k
    }
    const reason = settleVoid(found.rows[0] ?? null, now())
    if (!reason) {
      if (!found.rows[0]) {
        const f = forgetRow(d.slate.list(e.user_id), e.target)
        f.put.forEach((x) => void d.slate.put(x))
        f.remove.forEach((id) => void d.slate.remove(id))
      }
      land(sent, r)
    } else {
      const failed = { ...sent, failed: { reason, at: now() } }
      void d.slate.put(failed)
      r.failed.push(failed)
    }
    return 'next'
  }

  d.slate.subscribe(notify)

  return {
    /** Bind the signed-in account; returns the cleanup. */
    start(id: string, h: Hooks) {
      userId = id
      hooks = h
      notify()
      void d.slate.ready.then(() => {
        // refused taps are shown for a week, then let go
        if (userId !== id) return
        for (const e of d.slate.list(id)) if (e.failed && now() - e.failed.at > WEEK) void d.slate.remove(e.id)
      })
      void kick(true)
      return () => {
        if (userId === id) userId = null
        clearTimeout(timer)
        notify()
      }
    },
    kick,
    /** A tap: on the slate at once, sent when it can be. */
    pour(night: Night, profileIds: string[], round: boolean, alcoholFree = false): boolean {
      if (!userId) return false
      const t = now()
      const e = beerEntry({
        userId,
        crewId: night.crew_id,
        sessionId: night.id,
        profileIds,
        round,
        alcoholFree,
        now: t,
        seq: nextSeq(d.slate.list(userId), t),
        uuid: d.uuid,
      })
      void d.slate.put(e)
      void kick()
      return true
    },
    takeBack(night: Night, tally: TallyBeer[], profileId: string): boolean {
      if (!userId) return false
      const t = now()
      const entries = d.slate.list(userId)
      const step = takeBackStep(tally, entries, profileId, {
        userId,
        crewId: night.crew_id,
        sessionId: night.id,
        now: t,
        seq: nextSeq(entries, t),
        uuid: d.uuid,
      })
      if (step.kind === 'none') return false
      if (step.put) void d.slate.put(step.put)
      if (step.kind === 'cancel' && step.remove) void d.slate.remove(step.remove)
      if (step.kind === 'void') void kick()
      return true
    },
    dismissFailed() {
      if (userId) d.slate.list(userId).filter((e) => e.failed).forEach((e) => void d.slate.remove(e.id))
    },
    /** Full time: let this night's taps go in first (at most `ms`). */
    async settle(sessionId: string, ms: number) {
      void kick(true)
      const until = now() + ms
      while (userId && now() < until && d.slate.list(userId).some((e) => e.session_id === sessionId && !e.failed))
        await new Promise((res) => setTimeout(res, 150))
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    snapshot() {
      return (snap ??= {
        entries: userId ? d.slate.list(userId) : [],
        phase,
        ready: d.slate.isReady(),
        durable: d.slate.isDurable(),
      })
    },
  }
}
export type Runner = ReturnType<typeof createRunner>
