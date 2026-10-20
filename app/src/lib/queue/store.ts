import { createStore, del, set, values } from 'idb-keyval'
import type { Entry } from './core'

// Where the slate lives (D71): one IndexedDB record per tap, mirrored in memory so the tally
// and "−" answer at once. A committed IndexedDB write survives the app being killed a moment
// later, which a localStorage write doesn't reliably do.

export interface QueueBackend {
  all(): Promise<Entry[]>
  put(e: Entry): Promise<void>
  del(id: string): Promise<void>
}

export function idbBackend(): QueueBackend {
  const db = createStore('omb-queue', 'entries') // one database per store: an idb-keyval rule
  return {
    all: () => values<Entry>(db),
    put: (e) => set(e.id, e, db),
    del: (id) => del(id, db),
  }
}

/** For tests, and for a phone where IndexedDB is unavailable: the slate then lasts as long
 *  as the page. */
export function memoryBackend(seed: Entry[] = []): QueueBackend {
  const map = new Map(seed.map((e) => [e.id, e]))
  return {
    all: async () => [...map.values()],
    put: async (e) => void map.set(e.id, e),
    del: async (id) => void map.delete(id),
  }
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A record from an older or broken build is ignored rather than sent. */
export function valid(e: unknown): e is Entry {
  if (!e || typeof e !== 'object') return false
  const x = e as Record<string, unknown>
  if (!isString(x.id) || !isString(x.user_id) || !isString(x.crew_id) || !isString(x.session_id)) return false
  if (!isNumber(x.seq) || !isNumber(x.tapped_at) || !isNumber(x.attempts)) return false
  if (x.kind === 'void') return isString(x.target) && isString(x.profile_id)
  if (x.kind !== 'beers' || !Array.isArray(x.rows) || x.rows.length === 0) return false
  return x.rows.every(
    (r) =>
      r &&
      typeof r === 'object' &&
      isString((r as Record<string, unknown>).client_uuid) &&
      isString((r as Record<string, unknown>).profile_id) &&
      typeof (r as Record<string, unknown>).is_alcohol_free === 'boolean',
  )
}

const bySeq = (a: Entry, b: Entry) => a.seq - b.seq || a.id.localeCompare(b.id)

type Channel = { postMessage(message: unknown): void; addEventListener(type: 'message', listener: () => void): void }

function makeChannel(): Channel | null {
  try {
    return typeof BroadcastChannel === 'function' ? new BroadcastChannel('omb-queue') : null
  } catch {
    return null
  }
}

/** The slate as this tab sees it: an in-memory copy that answers at once, written through
 *  to IndexedDB, reloaded when another tab says it changed something. */
export function createSlate(backend: QueueBackend, channel: Channel | null = makeChannel()) {
  let entries: Entry[] = []
  let version = 0 // bumps on every local write
  let isReady = false
  const byUser = new Map<string, Entry[]>() // stable arrays for useSyncExternalStore
  const listeners = new Set<() => void>()
  const changed = () => {
    byUser.clear()
    listeners.forEach((l) => l())
  }

  async function reload(): Promise<void> {
    const v = version
    const fromDb = (await backend.all()).filter(valid).sort(bySeq)
    if (v !== version) return reload() // a local write went in meanwhile: read again
    entries = fromDb
    changed()
  }
  // Blocked storage: start empty; taps still work in memory for this session.
  const ready = reload()
    .catch(() => {})
    .then(() => {
      isReady = true
      changed()
    })
  channel?.addEventListener('message', () => void reload().catch(() => {}))

  const write = (op: Promise<void>) => op.then(() => channel?.postMessage('changed'))

  return {
    ready,
    isReady: () => isReady,
    list(userId: string): Entry[] {
      let hit = byUser.get(userId)
      if (!hit) byUser.set(userId, (hit = entries.filter((e) => e.user_id === userId)))
      return hit
    },
    /** Updates the copy now; the promise settles when IndexedDB has it. */
    put(e: Entry): Promise<void> {
      version++
      entries = [...entries.filter((x) => x.id !== e.id), e].sort(bySeq)
      changed()
      return write(backend.put(e))
    },
    remove(id: string): Promise<void> {
      version++
      entries = entries.filter((x) => x.id !== id)
      changed()
      return write(backend.del(id))
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}
export type Slate = ReturnType<typeof createSlate>
