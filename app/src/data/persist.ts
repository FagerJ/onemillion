import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import { createStore, del, get, set } from 'idb-keyval'
import { savedSession } from '@/lib/supabase'

// What the app last saw, kept on the phone so it opens with no signal on your crew's
// screens (D76). Only answers that came from the server, nothing about auth. A query keeps
// its last answer when a refetch fails, and so does the phone: on one bar, refetches fail
// all night. Bump BUSTER when a persisted query's data changes shape.
const BUSTER = 'q1'

const db = createStore('omb-cache', 'queries')

const stored = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key, db).then((v) => v ?? null),
    setItem: (key, value) => set(key, value, db),
    removeItem: (key) => del(key, db),
  },
  key: 'omb:rq',
  throttleTime: 1_000,
})

export const persister: Persister = {
  ...stored,
  // Nobody signed in, nothing to open on: what's there is whoever signed out, perhaps a save
  // that landed after the sign-out cleared it.
  restoreClient: async () => {
    if (savedSession()) return stored.restoreClient()
    await stored.removeClient()
    return undefined
  },
}

export const persistOptions = {
  persister,
  maxAge: 36 * 60 * 60_000,
  buster: BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: Query) => q.state.data !== undefined && q.queryKey[0] !== 'auth',
  },
}
