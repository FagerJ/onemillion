import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'
import { createStore, del, get, set } from 'idb-keyval'

// What the app last saw, kept on the phone so it opens with no signal on your crew's
// screens (D76). Only answers that came from the server, nothing about auth. Bump BUSTER
// when a persisted query's data changes shape.
const BUSTER = 'q1'

const db = createStore('omb-cache', 'queries')

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key, db).then((v) => v ?? null),
    setItem: (key, value) => set(key, value, db),
    removeItem: (key) => del(key, db),
  },
  key: 'omb:rq',
  throttleTime: 1_000,
})

export const persistOptions = {
  persister,
  maxAge: 36 * 60 * 60_000,
  buster: BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: Query) => q.state.status === 'success' && q.queryKey[0] !== 'auth',
  },
}
