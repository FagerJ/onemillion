import { describe, expect, it } from 'vitest'
import {
  BATCH_ENTRIES,
  BATCH_ROWS,
  backoff,
  beerEntry,
  classify,
  forgetRow,
  mergeTally,
  nextBatch,
  nextSeq,
  settleRefusal,
  settleVoid,
  takeBackStep,
  toRows,
  type BeerEntry,
  type Ctx,
  type Entry,
  type ServerBeer,
  type VoidEntry,
} from './core'

const NIGHT = 'night-1'
const T0 = Date.parse('2026-10-20T20:00:00Z')

let n = 0
const uuid = () => `u${++n}`

function ctx(over: Partial<Ctx> = {}): Ctx {
  return { userId: 'me', crewId: 'crew', sessionId: NIGHT, now: T0, seq: T0 * 1000 + n, uuid, ...over }
}

function beers(profileIds: string[], over: Partial<BeerEntry> & { round?: boolean; seq?: number } = {}): BeerEntry {
  const { round = false, ...rest } = over
  return { ...beerEntry({ ...ctx({ seq: over.seq ?? ++n }), profileIds, round }), ...rest }
}

function voidOf(target: string, over: Partial<VoidEntry> = {}): VoidEntry {
  return {
    kind: 'void',
    id: uuid(),
    seq: ++n,
    user_id: 'me',
    crew_id: 'crew',
    session_id: NIGHT,
    tapped_at: T0,
    attempts: 0,
    target,
    profile_id: 'anna',
    ...over,
  }
}

const server = (id: string, profile_id = 'anna', at = T0 - 60_000): ServerBeer => ({
  id,
  profile_id,
  added_by: 'me',
  round_id: null,
  logged_at: new Date(at).toISOString(),
  is_alcohol_free: false,
})

describe('mergeTally', () => {
  it('adds queued taps to the server rows', () => {
    const e = beers(['anna', 'bjorn'], { round: true })
    const t = mergeTally([server('s1')], [e], NIGHT)
    expect(t.map((b) => b.id)).toEqual(['s1', ...e.rows.map((r) => r.client_uuid)])
    expect(t.filter((b) => b.pending)).toHaveLength(2)
  })

  it('counts a queued row the server already has once', () => {
    const e = beers(['anna'])
    const id = e.rows[0].client_uuid
    expect(mergeTally([server(id)], [e], NIGHT)).toHaveLength(1)
  })

  it('hides server rows and queued rows that a queued void names', () => {
    const e = beers(['anna'])
    const t = mergeTally([server('s1')], [e, voidOf('s1'), voidOf(e.rows[0].client_uuid)], NIGHT)
    expect(t).toHaveLength(0)
  })

  it('leaves out refused taps, and refused voids hide nothing', () => {
    const failed = { reason: 'closed' as const, at: T0 }
    const t = mergeTally([server('s1')], [beers(['anna'], { failed }), voidOf('s1', { failed })], NIGHT)
    expect(t.map((b) => b.id)).toEqual(['s1'])
  })

  it('shows only the given night', () => {
    expect(mergeTally([], [beers(['anna'], { session_id: 'other' })], NIGHT)).toHaveLength(0)
  })

  it('sorts by time across ISO formats', () => {
    const a = { ...server('a'), logged_at: '2026-10-20T19:59:00+00:00' }
    const b = { ...server('b'), logged_at: '2026-10-20T19:58:00Z' }
    expect(mergeTally([a, b], [], NIGHT).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('takeBackStep', () => {
  it('cancels a + that never left the phone', () => {
    const e = beers(['anna'])
    const tally = mergeTally([], [e], NIGHT)
    expect(takeBackStep(tally, [e], 'anna', ctx())).toEqual({ kind: 'cancel', remove: e.id })
  })

  it('takes one row off a round that never left, keeping its round', () => {
    const e = beers(['anna', 'bjorn'], { round: true })
    const step = takeBackStep(mergeTally([], [e], NIGHT), [e], 'anna', ctx())
    expect(step.kind).toBe('cancel')
    if (step.kind !== 'cancel') return
    expect(step.put?.rows.map((r) => r.profile_id)).toEqual(['bjorn'])
    expect(step.put?.rows[0].round_id).toBe(e.rows[0].round_id)
  })

  it('voids a tap that may have reached the server', () => {
    for (const e of [beers(['anna'], { sent_at: T0 }), beers(['anna'], { attempts: 1 })]) {
      const step = takeBackStep(mergeTally([], [e], NIGHT), [e], 'anna', ctx())
      expect(step.kind).toBe('void')
      if (step.kind === 'void') expect(step.put.target).toBe(e.rows[0].client_uuid)
    }
  })

  it('voids a server row by its id', () => {
    const step = takeBackStep(mergeTally([server('s1')], [], NIGHT), [], 'anna', ctx())
    expect(step.kind === 'void' && step.put.target).toBe('s1')
  })

  it("picks that person's latest beer across the server and the slate", () => {
    const e = beers(['anna'], { tapped_at: T0 })
    const tally = mergeTally([server('s1', 'anna', T0 - 60_000)], [e], NIGHT)
    expect(takeBackStep(tally, [e], 'anna', ctx())).toEqual({ kind: 'cancel', remove: e.id })
  })

  it('does nothing for someone with no beers', () => {
    expect(takeBackStep(mergeTally([server('s1')], [], NIGHT), [], 'bjorn', ctx())).toEqual({ kind: 'none' })
  })

  it('picks a different beer each time on a rebuilt tally', () => {
    const rows = [server('s1', 'anna', T0 - 3000), server('s2', 'anna', T0 - 2000), server('s3', 'anna', T0 - 1000)]
    let entries: Entry[] = []
    const targets: string[] = []
    for (let i = 0; i < 3; i++) {
      const step = takeBackStep(mergeTally(rows, entries, NIGHT), entries, 'anna', ctx())
      if (step.kind !== 'void') throw new Error('expected a void')
      targets.push(step.put.target)
      entries = [...entries, step.put]
    }
    expect(targets).toEqual(['s3', 's2', 's1'])
  })
})

describe('nextBatch', () => {
  it('goes strictly in order and sends a void alone, first', () => {
    const v = voidOf('s1', { seq: 1 })
    const e = beers(['anna'], { seq: 2 })
    expect(nextBatch([v, e])).toEqual({ kind: 'void', entry: v })
  })

  it('stops a batch at a void, another night, 25 entries or 100 rows', () => {
    const a = beers(['anna'], { seq: 1 })
    const b = beers(['anna'], { seq: 2 })
    const v = voidOf('x', { seq: 3 })
    expect(nextBatch([a, b, v])).toEqual({ kind: 'beers', entries: [a, b] })
    const other = beers(['anna'], { seq: 3, session_id: 'other' })
    expect(nextBatch([a, other])).toEqual({ kind: 'beers', entries: [a] })
    const many = Array.from({ length: BATCH_ENTRIES + 3 }, (_, i) => beers(['anna'], { seq: i + 1 }))
    expect((nextBatch(many) as { entries: unknown[] }).entries).toHaveLength(BATCH_ENTRIES)
    const big = Array.from({ length: 3 }, (_, i) => beers(Array(40).fill('anna'), { seq: i + 1, round: true }))
    const batch = nextBatch(big) as { entries: BeerEntry[] }
    expect(batch.entries.reduce((s, e) => s + e.rows.length, 0)).toBeLessThanOrEqual(BATCH_ROWS)
    expect(batch.entries).toHaveLength(2)
  })

  it('skips refused entries', () => {
    const a = beers(['anna'], { seq: 1, failed: { reason: 'refused', at: T0 } })
    const b = beers(['anna'], { seq: 2 })
    expect(nextBatch([a, b])).toEqual({ kind: 'beers', entries: [b] })
    expect(nextBatch([a])).toBeNull()
  })
})

describe('toRows', () => {
  it('uses the client uuid as the id, and leaves the time to the server when fresh', () => {
    const e = beers(['anna'], { tapped_at: T0 })
    const [row] = toRows([e], T0 + 1000)
    expect(row.id).toBe(row.client_uuid)
    expect(row).not.toHaveProperty('logged_at')
    expect(row.is_alcohol_free).toBe(false)
  })

  it('carries the tap time once it has waited, and can mix both in one batch', () => {
    const waited = beers(['anna'], { tapped_at: T0, attempts: 1 })
    const old = beers(['anna'], { tapped_at: T0 - 31_000 })
    const fresh = beers(['anna'], { tapped_at: T0 })
    const rows = toRows([waited, old, fresh], T0 + 500)
    expect(rows[0].logged_at).toBe(new Date(T0).toISOString())
    expect(rows[1].logged_at).toBe(new Date(T0 - 31_000).toISOString())
    expect(rows[2]).not.toHaveProperty('logged_at')
  })
})

describe('classify', () => {
  it.each([
    [{ status: 0 }, { kind: 'network' }],
    [{ status: 401, code: 'PGRST303' }, { kind: 'auth' }],
    [{ status: 401, code: '42501' }, { kind: 'auth' }],
    [{ status: 403, code: '42501', message: 'permission denied for table beers' }, { kind: 'retry' }],
    [{ status: 503, code: 'PGRST002' }, { kind: 'retry' }],
    [{ status: 429 }, { kind: 'retry' }],
    [{ status: 409, code: '40001' }, { kind: 'retry' }],
    [{ status: 400, code: '23514', message: 'Session x is not open', hint: 'session_closed' }, { kind: 'refused', reason: 'closed' }],
    [{ status: 400, code: '23514', message: 'Session x is not open' }, { kind: 'refused', reason: 'closed' }],
    [{ status: 403, code: '42501', message: 'new row violates row-level security policy' }, { kind: 'refused', reason: 'refused' }],
    [{ status: 409, code: '23503' }, { kind: 'refused', reason: 'refused' }],
  ])('%j → %j', (err, out) => {
    expect(classify(err)).toEqual(out)
  })
})

describe('settleRefusal and settleVoid', () => {
  it('lands what the server already has, and fails only what is missing', () => {
    const e = beers(['anna', 'bjorn', 'cilla'], { round: true })
    const ids = e.rows.map((r) => r.client_uuid)
    expect(settleRefusal(e, new Set(ids), 'closed', T0)).toBeNull()
    expect(settleRefusal(e, new Set(), 'closed', T0)?.rows).toHaveLength(3)
    const partial = settleRefusal(e, new Set([ids[0]]), 'closed', T0)
    expect(partial?.rows.map((r) => r.client_uuid)).toEqual(ids.slice(1))
    expect(partial?.failed).toEqual({ reason: 'closed', at: T0 })
  })

  it('reads a void that changed nothing', () => {
    expect(settleVoid(null, T0)).toBeNull()
    expect(settleVoid({ id: 'x', voided_at: '2026-10-20T19:00:00Z', logged_at: '2026-10-20T18:00:00Z' }, T0)).toBeNull()
    expect(settleVoid({ id: 'x', voided_at: null, logged_at: new Date(T0 - 25 * 3600_000).toISOString() }, T0)).toBe('too-late')
    expect(settleVoid({ id: 'x', voided_at: null, logged_at: new Date(T0 - 3600_000).toISOString() }, T0)).toBe('refused')
  })
})

describe('backoff, nextSeq and forgetRow', () => {
  it('doubles from 2 s up to a minute, within ±20%', () => {
    const mid = () => 0.5
    expect([1, 2, 3, 4, 5, 6, 7, 10].map((f) => backoff(f, mid))).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000])
    expect(backoff(1, () => 0)).toBe(1600)
    expect(backoff(1, () => 1)).toBe(2400)
  })

  it('never goes backwards when the clock does', () => {
    const e = beers(['anna'], { seq: T0 * 1000 })
    expect(nextSeq([e], T0 - 60_000)).toBe(T0 * 1000 + 1)
    expect(nextSeq([], T0)).toBe(T0 * 1000)
  })

  it('crosses a row off a refused round, and drops an emptied entry', () => {
    const failed = { reason: 'closed' as const, at: T0 }
    const round = beers(['anna', 'bjorn'], { round: true, failed })
    const single = beers(['cilla'], { failed })
    const a = forgetRow([round, single], round.rows[0].client_uuid)
    expect(a.put[0].rows.map((r) => r.profile_id)).toEqual(['bjorn'])
    expect(forgetRow([round, single], single.rows[0].client_uuid)).toEqual({ put: [], remove: [single.id] })
  })
})
