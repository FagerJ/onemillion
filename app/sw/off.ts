/// <reference lib="webworker" />
// The kill switch (D49). VITE_SW_OFF=1 ships this instead of sw.ts: it replaces the real worker
// on every phone, clears every cache, unregisters, and reloads open windows from the network.
declare const self: ServiceWorkerGlobalScope

self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) void client.navigate(client.url)
    })(),
  )
})
