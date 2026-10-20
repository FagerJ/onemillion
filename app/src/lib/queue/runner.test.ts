import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, BeerInsert, Entry, Found } from './core'
import { mergeTally } from './core'
import { createRunner, type QueueApi, type Report } from './runner'
import { createSlate, memoryBackend, type QueueBackend } from './store'

const NIGHT = { id: 'night-1', crew_id: 'crew' }
const T0 = Date.parse('2026-10-20T20:00:00Z')

type Call = { kind: 'beers'; rows: BeerInsert[] } | { kind: 'void'; id: string } | { kind: 'find'; ids: string[] }

function setup(api: Partial<QueueApi> = {}, opts: { user?: string; backend?: QueueBackend } = {}) {
  let clock = T0
  let n = 0
  const calls: Call[] = []
  const server = new Map<string, { voided: boolean; logged_at: string }>()
  const slate = createSlate(opts.backend ?? memoryBackend(), null)
  const full: QueueApi = {
    usableSession: async () => ({ userId: opts.user ?? 'me' }),
    sendBeers: async (rows) => {
      calls.push({ kind: 'beers', rows })
      rows.forEach((r) => server.set(r.id, { voided: false, logged_at: r.logged_at ?? new Date(clock).toISOString() }))
      return null
    },
    voidBeer: async (id) => {
      calls.push({ kind: 'void', id })
      const b = server.get(id)
      if (!b || b.voided) return { error: null, count: 0 }
      b.voided = true
      return { error: null, count: 1 }
    },
    findBeers: async (ids) => {
      calls.push({ kind: 'find', ids })
      const rows: Found[] = ids.flatMap((id) => {
        const b = server.get(id)
        const voided_at = b?.voided ? new Date(clock).toISOString() : null
        return b ? [{ id, voided_at, logged_at: b.logged_at, created_at: b.logged_at }] : []
      })
      return { error: null, rows }
    },
    ...api,
  }
  const runner = createRunner({ slate, api: full, uuid: () => `u${++n}`, now: () => clock, random: () => 0.5 })
  const reports: Report[] = []
  const landed: Entry[] = []
  const stop = runner.start('me', { landed: (e) => landed.push(e), settled: (r) => reports.push(r) })
  return {
    runner,
    slate,
    calls,
    server,
    reports,
    landed,
    stop,
    tick: (ms: number) => (clock += ms),
    entries: () => slate.list('me'),
  }
}

const serverBeer = (id: string, profile_id: string) => ({
  id,
  profile_id,
  added_by: 'me',
  round_id: null,
  logged_at: new Date(T0).toISOString(),
  is_alcohol_free: false,
  pending: false,
})

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the runner', () => {
  it('crosses off a never-sent + without sending it, and sends the rest in one request', async () => {
    // hold the first pass back, so the taps pile up the way they do offline
    let open = false
    const t = setup({ usableSession: async () => (open ? { userId: 'me' } : null) })
    await flush()
    t.runner.pour(NIGHT, ['anna'], false)
    t.runner.pour(NIGHT, ['anna', 'bjorn'], true)
    await flush()
    const tally = mergeTally([], t.entries(), NIGHT.id)
    expect(t.runner.takeBack(NIGHT, tally.slice(0, 1), 'anna')).toBe(true) // the + on its own
    open = true
    await t.runner.kick(true)
    await flush()
    const sends = t.calls.filter((c) => c.kind === 'beers')
    expect(sends).toHaveLength(1)
    expect(sends[0].kind === 'beers' && sends[0].rows.map((r) => r.profile_id)).toEqual(['anna', 'bjorn'])
    expect(t.calls.some((c) => c.kind === 'void')).toBe(false)
    expect(t.entries()).toHaveLength(0)
  })

  it('keeps taps through a network error, backs off, and then sends them with their own time', async () => {
    let down = true
    const t = setup({
      sendBeers: async (rows) => {
        t.calls.push({ kind: 'beers', rows })
        return down ? ({ status: 0 } as ApiError) : null
      },
    })
    await flush()
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.entries()).toHaveLength(1)
    expect(t.entries()[0].attempts).toBe(1)
    expect(t.runner.snapshot().phase).toBe('offline')
    down = false
    t.tick(2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await flush()
    const last = t.calls.filter((c) => c.kind === 'beers').at(-1)
    expect(last?.kind === 'beers' && last.rows[0].logged_at).toBe(new Date(T0).toISOString())
    expect(t.entries()).toHaveLength(0)
  })

  it('sends nothing without a usable session, and goes again when kicked', async () => {
    let ok = false
    const t = setup({ usableSession: async () => (ok ? { userId: 'me' } : null) })
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.calls).toHaveLength(0)
    expect(t.runner.snapshot().phase).toBe('no-auth')
    ok = true
    await t.runner.kick(true)
    await flush()
    expect(t.calls.filter((c) => c.kind === 'beers')).toHaveLength(1)
  })

  it('finds the one refused tap in a batch, and lands the others', async () => {
    let bad = ''
    let first = true
    const t = setup({
      sendBeers: async (rows) => {
        t.calls.push({ kind: 'beers', rows })
        if (first || rows.some((r) => r.profile_id === bad)) {
          first = false
          return { status: 400, code: '23514', message: 'Session night-1 is not open', hint: 'session_closed' }
        }
        rows.forEach((r) => t.server.set(r.id, { voided: false, logged_at: new Date(T0).toISOString() }))
        return null
      },
      usableSession: async () => (held ? null : { userId: 'me' }),
    })
    let held = true
    await flush()
    t.runner.pour(NIGHT, ['anna'], false)
    t.runner.pour(NIGHT, ['bjorn'], false)
    t.runner.pour(NIGHT, ['cilla'], false)
    t.tick(60_000) // not fresh any more, so "closed" is final
    bad = 'bjorn'
    held = false
    await t.runner.kick(true)
    await flush()
    const left = t.entries()
    expect(left).toHaveLength(1)
    expect(left[0].kind === 'beers' && left[0].rows[0].profile_id).toBe('bjorn')
    expect(left[0].failed?.reason).toBe('closed')
    expect(t.landed).toHaveLength(2)
  })

  it('treats a refusal for a tap the server already has as landed', async () => {
    const t = setup({
      sendBeers: async (rows) => {
        t.calls.push({ kind: 'beers', rows })
        rows.forEach((r) => t.server.set(r.id, { voided: false, logged_at: new Date(T0).toISOString() }))
        return { status: 403, code: '42501', message: 'new row violates row-level security policy' }
      },
    })
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.entries()).toHaveLength(0)
    expect(t.landed).toHaveLength(1)
  })

  it('resends a fresh tap refused as closed once, with its own time', async () => {
    let tries = 0
    const t = setup({
      sendBeers: async (rows) => {
        t.calls.push({ kind: 'beers', rows })
        tries++
        if (!rows[0].logged_at) return { status: 400, code: '23514', message: 'is not open', hint: 'session_closed' }
        return null
      },
    })
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(tries).toBe(2)
    expect(t.entries()).toHaveLength(0)
  })

  it('settles voids: never landed or already voided is done; past 24 hours is too late', async () => {
    const DAY = 24 * 3600_000
    const t = setup({
      // the policy refuses a void after 24 hours, which PostgREST reports as no rows
      voidBeer: async (id) => {
        t.calls.push({ kind: 'void', id })
        const b = t.server.get(id)
        if (!b || b.voided || T0 - Date.parse(b.logged_at) >= DAY) return { error: null, count: 0 }
        b.voided = true
        return { error: null, count: 1 }
      },
    })
    t.server.set('gone', { voided: true, logged_at: new Date(T0 - 60_000).toISOString() })
    t.server.set('old', { voided: false, logged_at: new Date(T0 - DAY - 60_000).toISOString() })
    const beer = (id: string) => ({
      id,
      profile_id: 'anna',
      added_by: 'me',
      round_id: null,
      logged_at: new Date(T0 - 1000).toISOString(),
      is_alcohol_free: false,
      pending: false,
    })
    t.runner.takeBack(NIGHT, [beer('missing')], 'anna')
    t.runner.takeBack(NIGHT, [beer('gone')], 'anna')
    await flush()
    expect(t.entries()).toHaveLength(0)
    t.runner.takeBack(NIGHT, [beer('old')], 'anna')
    await flush()
    const [left] = t.entries()
    expect(left?.kind).toBe('void')
    expect(left?.failed?.reason).toBe('too-late')
  })

  it('stops and keeps the entry when the check after a refusal fails', async () => {
    const t = setup({
      sendBeers: async () => ({ status: 409, code: '23503' }),
      findBeers: async () => ({ error: { status: 0 }, rows: [] }),
    })
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.entries()).toHaveLength(1)
    expect(t.entries()[0].failed).toBeUndefined()
  })

  it("never sends another account's taps", async () => {
    const t = setup()
    await t.slate.put({
      kind: 'beers',
      id: 'theirs',
      seq: 1,
      user_id: 'someone-else',
      crew_id: 'crew',
      session_id: NIGHT.id,
      tapped_at: T0,
      attempts: 0,
      rows: [{ client_uuid: 'theirs', profile_id: 'x', round_id: null, is_alcohol_free: false }],
    })
    await t.runner.kick(true)
    await flush()
    expect(t.calls).toHaveLength(0)
  })

  it('holds back when the session belongs to a different account than the slate', async () => {
    const t = setup({}, { user: 'someone-else' }) // bound to 'me', signed in as someone else
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.calls).toHaveLength(0)
    expect(t.runner.snapshot().phase).toBe('no-auth')
  })

  it('writes a landed tap into the cache before it leaves the slate, and reports once per pass', async () => {
    const order: string[] = []
    const t = setup()
    t.stop()
    t.runner.start('me', {
      landed: () => order.push(`landed:${t.entries().length}`),
      settled: (r) => order.push(`settled:${r.landed.length}:${r.done}`),
    })
    await flush()
    order.length = 0 // the pass on start found nothing to send
    t.runner.pour(NIGHT, ['anna', 'bjorn'], true)
    await flush()
    expect(order).toEqual(['landed:1', 'settled:1:true'])
  })

  it('says a pass is done only when nothing is left waiting', async () => {
    let open = false
    let dropped = false
    const t = setup({
      usableSession: async () => (open ? { userId: 'me' } : null),
      sendBeers: async (rows) => {
        t.calls.push({ kind: 'beers', rows })
        if (dropped) return { status: 0 } as ApiError
        rows.forEach((r) => t.server.set(r.id, { voided: false, logged_at: new Date(T0).toISOString() }))
        return null
      },
      voidBeer: async (id) => {
        t.calls.push({ kind: 'void', id })
        dropped = true // the signal goes again right after the void
        return { error: null, count: 1 }
      },
    })
    await flush()
    // offline: a +, a − of a beer the server already has, and another +
    t.server.set('earlier', { voided: false, logged_at: new Date(T0).toISOString() })
    t.runner.pour(NIGHT, ['anna'], false)
    t.runner.takeBack(NIGHT, [serverBeer('earlier', 'anna')], 'anna')
    t.runner.pour(NIGHT, ['bjorn'], false)
    open = true
    await t.runner.kick(true)
    await flush()
    const last = t.reports.at(-1)
    expect(last?.landed).toHaveLength(2)
    expect(last?.done).toBe(false) // break: report.done = true on every exit
    expect(t.entries()).toHaveLength(1)
  })

  it('reports a pass that finds the slate already cleared, so a stale count can be dropped', async () => {
    const t = setup()
    await flush()
    t.reports.length = 0
    await t.runner.kick(true)
    await flush()
    expect(t.reports).toEqual([{ landed: [], failed: [], done: true }]) // break: report only what moved
  })

  it('turns a − on a tap that is being sent into a void, sent after it', async () => {
    let release!: () => void
    const t = setup({
      sendBeers: async (rows) => {
        t.calls.push({ kind: 'beers', rows })
        await new Promise<void>((r) => (release = r))
        rows.forEach((r) => t.server.set(r.id, { voided: false, logged_at: new Date(T0).toISOString() }))
        return null
      },
    })
    await flush()
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.calls.filter((c) => c.kind === 'beers')).toHaveLength(1) // in flight
    expect(t.runner.takeBack(NIGHT, mergeTally([], t.entries(), NIGHT.id), 'anna')).toBe(true)
    expect(t.entries().map((e) => e.kind)).toEqual(['beers', 'void']) // break: stamp sent_at after the await
    release()
    await flush()
    expect(t.calls.map((c) => c.kind)).toEqual(['beers', 'void'])
    expect(t.entries()).toHaveLength(0)
  })

  it('crosses off a + taken back while the session was being checked, without sending it', async () => {
    let release!: (v: { userId: string }) => void
    let first = true
    const t = setup({
      usableSession: () => {
        if (!first) return Promise.resolve({ userId: 'me' })
        first = false
        return new Promise((r) => (release = r))
      },
    })
    await flush()
    t.runner.pour(NIGHT, ['anna'], false)
    await flush()
    expect(t.runner.takeBack(NIGHT, mergeTally([], t.entries(), NIGHT.id), 'anna')).toBe(true)
    expect(t.entries()).toHaveLength(0)
    release({ userId: 'me' })
    await flush()
    expect(t.calls).toHaveLength(0) // break: send the batch read before the session check
  })

  it('keeps sending taps when the phone cannot save them', async () => {
    const full = () => Promise.reject(new DOMException('full', 'QuotaExceededError'))
    const broken: QueueBackend = { all: async () => [], put: full, del: full }
    let open = false
    const t = setup({ usableSession: async () => (open ? { userId: 'me' } : null) }, { backend: broken })
    await flush()
    expect(t.runner.pour(NIGHT, ['anna'], false)).toBe(true)
    await flush()
    expect(t.entries()).toHaveLength(1) // break: withdraw a tap whose write failed
    expect(t.runner.snapshot().durable).toBe(false)
    open = true
    await t.runner.kick(true)
    await flush()
    expect(t.calls.filter((c) => c.kind === 'beers')).toHaveLength(1)
    expect(t.entries()).toHaveLength(0)
  })
})
