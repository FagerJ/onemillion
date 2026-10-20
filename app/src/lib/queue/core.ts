// The offline queue's rules (C8, D70–D75): pure functions — no browser, no Supabase — so
// vitest can pin each one. lib/queue/runner.ts does the I/O around them.

export type Row = { client_uuid: string; profile_id: string; round_id: string | null; is_alcohol_free: boolean }

type Base = {
  id: string
  /** enqueue order on this phone; never goes backwards, even when the clock does */
  seq: number
  user_id: string
  crew_id: string
  session_id: string
  /** when it was tapped, by this phone's clock (ms) */
  tapped_at: number
  /** transient failures so far; > 0 means it waited, so it carries its own time (D73) */
  attempts: number
  /** set just before a request leaves; from then on the server may have it */
  sent_at?: number
  failed?: Failure
}
export type BeerEntry = Base & { kind: 'beers'; rows: Row[] }
export type VoidEntry = Base & { kind: 'void'; target: string; profile_id: string }
export type Entry = BeerEntry | VoidEntry

export type Reason = 'closed' | 'too-late' | 'refused'
export type Failure = { reason: Reason; at: number }

export type ServerBeer = {
  id: string
  profile_id: string
  added_by: string
  round_id: string | null
  logged_at: string
  is_alcohol_free: boolean
}
export type TallyBeer = ServerBeer & { pending: boolean }

export type BeerInsert = {
  id: string
  client_uuid: string
  session_id: string
  profile_id: string
  added_by: string
  round_id: string | null
  is_alcohol_free: boolean
  logged_at?: string
}
export type ApiError = { status: number; code?: string; message?: string; hint?: string | null }
export type Outcome = { kind: 'network' | 'auth' | 'retry' } | { kind: 'refused'; reason: Reason }

export const FRESH_MS = 30_000
export const BATCH_ENTRIES = 25
export const BATCH_ROWS = 100
const DAY = 24 * 60 * 60_000

export type Ctx = { userId: string; crewId: string; sessionId: string; now: number; seq: number; uuid: () => string }

export function nextSeq(entries: Entry[], now: number): number {
  return Math.max(now * 1000, entries.reduce((m, e) => Math.max(m, e.seq), 0) + 1)
}

/** `+` is one row; `+ ROUND` is a row each, sharing a round_id, as one entry (all-or-nothing). */
export function beerEntry(c: Ctx & { profileIds: string[]; round: boolean; alcoholFree?: boolean }): BeerEntry {
  const round_id = c.round ? c.uuid() : null
  const rows = c.profileIds.map((profile_id) => ({
    client_uuid: c.uuid(),
    profile_id,
    round_id,
    is_alcohol_free: !!c.alcoholFree,
  }))
  return {
    kind: 'beers',
    id: round_id ?? rows[0].client_uuid,
    seq: c.seq,
    user_id: c.userId,
    crew_id: c.crewId,
    session_id: c.sessionId,
    tapped_at: c.now,
    attempts: 0,
    rows,
  }
}

const at = (iso: string) => Date.parse(iso)

/** The night as this phone shows it: the server's beers, plus taps still on the slate,
 *  minus taps taken back that the server hasn't heard about. Each beer once (D75). */
export function mergeTally(server: ServerBeer[], entries: Entry[], sessionId: string): TallyBeer[] {
  const live = entries.filter((e) => e.session_id === sessionId && !e.failed)
  const voided = new Set(live.flatMap((e) => (e.kind === 'void' ? [e.target] : [])))
  const known = new Set(server.map((b) => b.id))
  const out: TallyBeer[] = server.filter((b) => !voided.has(b.id)).map((b) => ({ ...b, pending: false }))
  for (const e of live) {
    if (e.kind !== 'beers') continue
    for (const r of e.rows) {
      if (known.has(r.client_uuid) || voided.has(r.client_uuid)) continue
      out.push({
        id: r.client_uuid,
        profile_id: r.profile_id,
        added_by: e.user_id,
        round_id: r.round_id,
        logged_at: new Date(e.tapped_at).toISOString(),
        is_alcohol_free: r.is_alcohol_free,
        pending: true,
      })
    }
  }
  return out.sort((a, b) => at(a.logged_at) - at(b.logged_at))
}

export type TakeBack =
  | { kind: 'none' }
  | { kind: 'cancel'; put?: BeerEntry; remove?: string } // never left the phone: just cross it off
  | { kind: 'void'; put: VoidEntry } // the server may have it: void it, in order

/** "−": that person's latest beer tonight, counting the slate. */
export function takeBackStep(tally: TallyBeer[], entries: Entry[], profileId: string, c: Ctx): TakeBack {
  const beer = [...tally].reverse().find((b) => b.profile_id === profileId)
  if (!beer) return { kind: 'none' }
  const owner = entries.find(
    (e): e is BeerEntry => e.kind === 'beers' && !e.failed && e.rows.some((r) => r.client_uuid === beer.id),
  )
  if (owner && owner.attempts === 0 && owner.sent_at === undefined) {
    const rows = owner.rows.filter((r) => r.client_uuid !== beer.id)
    return rows.length ? { kind: 'cancel', put: { ...owner, rows } } : { kind: 'cancel', remove: owner.id }
  }
  return {
    kind: 'void',
    put: {
      kind: 'void',
      id: c.uuid(),
      seq: c.seq,
      user_id: c.userId,
      crew_id: c.crewId,
      session_id: c.sessionId,
      tapped_at: c.now,
      attempts: 0,
      target: beer.id,
      profile_id: profileId,
    },
  }
}

export type Batch = { kind: 'beers'; entries: BeerEntry[] } | { kind: 'void'; entry: VoidEntry }

/** What to send next: the oldest entry, plus following taps for the same night. */
export function nextBatch(entries: Entry[]): Batch | null {
  const todo = entries.filter((e) => !e.failed)
  const first = todo[0]
  if (!first) return null
  if (first.kind === 'void') return { kind: 'void', entry: first }
  const batch: BeerEntry[] = []
  let rows = 0
  for (const e of todo) {
    if (e.kind !== 'beers' || e.session_id !== first.session_id) break
    if (batch.length === BATCH_ENTRIES || (batch.length > 0 && rows + e.rows.length > BATCH_ROWS)) break
    batch.push(e)
    rows += e.rows.length
  }
  return { kind: 'beers', entries: batch }
}

export const isFresh = (e: Entry, now: number) => e.attempts === 0 && now - e.tapped_at < FRESH_MS

/** The rows as PostgREST gets them. id = client_uuid, so the phone knows the server id. A
 *  tap sent at once leaves logged_at out and gets the server's now(); one that waited
 *  carries the time it was tapped (D73). */
export function toRows(batch: BeerEntry[], now: number): BeerInsert[] {
  return batch.flatMap((e) =>
    e.rows.map((r) => ({
      id: r.client_uuid,
      client_uuid: r.client_uuid,
      session_id: e.session_id,
      profile_id: r.profile_id,
      added_by: e.user_id,
      round_id: r.round_id,
      is_alcohol_free: r.is_alcohol_free,
      ...(isFresh(e, now) ? {} : { logged_at: new Date(e.tapped_at).toISOString() }),
    })),
  )
}

/** Only an answer that names the tap is final. Anything else: keep it and try again (D72). */
export function classify(e: ApiError): Outcome {
  if (e.status === 0) return { kind: 'network' } // no answer, abort or timeout
  if (e.status === 401) return { kind: 'auth' } // expired token, or sent as anon
  if (/permission denied/i.test(e.message ?? '')) return { kind: 'retry' } // a grant problem is ours, not the tap's
  if (e.status === 408 || e.status === 429 || e.status >= 500) return { kind: 'retry' }
  if (['40001', '40P01', '57014'].includes(e.code ?? '')) return { kind: 'retry' }
  if (e.hint === 'session_closed' || /is not open/.test(e.message ?? '')) return { kind: 'refused', reason: 'closed' }
  return { kind: 'refused', reason: 'refused' }
}

/** After a refusal: rows the server already has came from an attempt whose answer was lost.
 *  Returns null when all of them are in, else the entry, failed, with what's missing. */
export function settleRefusal(e: BeerEntry, found: Set<string>, reason: Reason, now: number): BeerEntry | null {
  const missing = e.rows.filter((r) => !found.has(r.client_uuid))
  return missing.length === 0 ? null : { ...e, rows: missing, failed: { reason, at: now } }
}

export type Found = { id: string; voided_at: string | null; logged_at: string }

/** A void that changed nothing: the beer never landed or is already voided (both fine),
 *  or it's too old, or it isn't ours to void. */
export function settleVoid(found: Found | null, now: number): Reason | null {
  if (!found || found.voided_at) return null
  return now - at(found.logged_at) >= DAY ? 'too-late' : 'refused'
}

export function backoff(failures: number, random: () => number = Math.random): number {
  const base = Math.min(60_000, 2_000 * 2 ** Math.max(0, failures - 1))
  return Math.round(base * (0.8 + 0.4 * random()))
}

/** A void that found nothing also crosses the beer off a refused entry, so the
 *  "not saved" list doesn't show a beer you'd taken back anyway. */
export function forgetRow(entries: Entry[], clientUuid: string): { put: BeerEntry[]; remove: string[] } {
  const put: BeerEntry[] = []
  const remove: string[] = []
  for (const e of entries) {
    if (e.kind !== 'beers' || !e.failed || !e.rows.some((r) => r.client_uuid === clientUuid)) continue
    const rows = e.rows.filter((r) => r.client_uuid !== clientUuid)
    if (rows.length) put.push({ ...e, rows })
    else remove.push(e.id)
  }
  return { put, remove }
}
