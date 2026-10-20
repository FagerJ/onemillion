import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { BeerEntry } from './core'
import { createSlate, idbBackend, memoryBackend, type QueueBackend } from './store'

const entry = (id: string, seq: number, user = 'me'): BeerEntry => ({
  kind: 'beers',
  id,
  seq,
  user_id: user,
  crew_id: 'crew',
  session_id: 'night',
  tapped_at: 1,
  attempts: 0,
  rows: [{ client_uuid: id, profile_id: 'anna', round_id: null, is_alcohol_free: false }],
})

function fakeChannel() {
  const listeners: (() => void)[] = []
  return {
    postMessage: () => {},
    addEventListener: (_: string, l: () => void) => void listeners.push(l),
    fire: () => listeners.forEach((l) => l()),
  }
}

describe('the slate', () => {
  it('answers puts and removes at once, in seq order', async () => {
    const slate = createSlate(memoryBackend(), null)
    await slate.ready
    void slate.put(entry('b', 2))
    void slate.put(entry('a', 1))
    expect(slate.list('me').map((e) => e.id)).toEqual(['a', 'b'])
    void slate.remove('a')
    expect(slate.list('me').map((e) => e.id)).toEqual(['b'])
  })

  it('returns the same array until something changes', async () => {
    const slate = createSlate(memoryBackend([entry('a', 1)]), null)
    await slate.ready
    const first = slate.list('me')
    expect(slate.list('me')).toBe(first)
    void slate.put(entry('b', 2))
    expect(slate.list('me')).not.toBe(first)
  })

  it('keeps each account to itself', async () => {
    const slate = createSlate(memoryBackend([entry('a', 1), entry('b', 2, 'other')]), null)
    await slate.ready
    expect(slate.list('me').map((e) => e.id)).toEqual(['a'])
    expect(slate.list('other').map((e) => e.id)).toEqual(['b'])
  })

  it('keeps a local write that lands while it is still loading', async () => {
    let release!: () => void
    let reads = 0
    const backend = memoryBackend([entry('a', 1)])
    // the first read is slow: a write lands before it answers, so the slate must read again
    const slow: QueueBackend = {
      ...backend,
      all: () =>
        reads++ === 0 ? new Promise((res) => (release = () => void backend.all().then(res))) : backend.all(),
    }
    const slate = createSlate(slow, null)
    void slate.put(entry('b', 2))
    release()
    await slate.ready
    expect(slate.list('me').map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('reloads when another tab says it changed something', async () => {
    const backend = memoryBackend()
    const channel = fakeChannel()
    const slate = createSlate(backend, channel)
    await slate.ready
    await backend.put(entry('from-the-other-tab', 1))
    channel.fire()
    await new Promise((r) => setTimeout(r, 0))
    expect(slate.list('me').map((e) => e.id)).toEqual(['from-the-other-tab'])
  })

  it('ignores records it does not recognise', async () => {
    const backend = memoryBackend()
    await backend.put({ id: 'junk' } as unknown as BeerEntry)
    await backend.put(entry('ok', 1))
    const slate = createSlate(backend, null)
    await slate.ready
    expect(slate.list('me').map((e) => e.id)).toEqual(['ok'])
  })

  it('survives a reopen through IndexedDB', async () => {
    const one = createSlate(idbBackend(), null)
    await one.ready
    await one.put(entry('kept', 1))
    const two = createSlate(idbBackend(), null)
    await two.ready
    expect(two.list('me').map((e) => e.id)).toEqual(['kept'])
  })
})
