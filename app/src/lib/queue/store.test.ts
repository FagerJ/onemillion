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

  it('carries on in memory when IndexedDB refuses a write, and stops reloading from it', async () => {
    const backend = memoryBackend()
    const channel = fakeChannel()
    let refuse = false
    const flaky: QueueBackend = { ...backend, put: (e) => (refuse ? Promise.reject(new Error('full')) : backend.put(e)) }
    const slate = createSlate(flaky, channel)
    await slate.ready
    expect(slate.isDurable()).toBe(true)
    refuse = true
    await slate.put(entry('only-in-memory', 1)) // settles, refused
    expect(slate.isDurable()).toBe(false)
    channel.fire() // another tab: a reload now would drop the tap that never got saved
    await new Promise((r) => setTimeout(r, 0))
    expect(slate.list('me').map((e) => e.id)).toEqual(['only-in-memory'])
  })

  it('keeps a refused tap when a reload was already on its way', async () => {
    const backend = memoryBackend()
    let reads = 0
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const slow: QueueBackend = {
      ...backend,
      all: () => (reads++ === 0 ? backend.all() : gate.then(() => backend.all())),
      put: () => Promise.reject(new Error('full')),
    }
    const channel = fakeChannel()
    const slate = createSlate(slow, channel)
    await slate.ready
    channel.fire() // another tab: a reload starts, and takes its time
    await slate.put(entry('tap', 1)) // refused: the copy is on its own now
    open()
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
    expect(slate.list('me').map((e) => e.id)).toEqual(['tap']) // break: adopt the read anyway
  })

  it('treats storage that throws like storage that refuses', async () => {
    const denied = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    const slate = createSlate({ all: async () => [], put: denied, del: denied }, null)
    await slate.ready
    await slate.put(entry('tap', 1)) // break: call the backend outside the promise
    expect(slate.isDurable()).toBe(false)
    expect(slate.list('me').map((e) => e.id)).toEqual(['tap'])
  })

  it('says so when it starts with nowhere to keep taps', async () => {
    const slate = createSlate(memoryBackend(), null, { durable: false })
    await slate.ready
    expect(slate.isDurable()).toBe(false)
  })

  it('starts in memory when IndexedDB cannot be read', async () => {
    const slate = createSlate({ ...memoryBackend(), all: () => Promise.reject(new Error('blocked')) }, null)
    await slate.ready
    expect(slate.isReady()).toBe(true)
    expect(slate.isDurable()).toBe(false)
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
