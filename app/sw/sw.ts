/// <reference lib="webworker" />
// The service worker (D49–D51). Three jobs, nothing else:
//  1. precache this build, so the app opens with no signal;
//  2. answer every navigation with the cached index.html (the app is one page);
//  3. step aside for everything else — Supabase's API, Auth and Realtime above all.
// vite.config.ts compiles this to dist/sw.js and defines BUILD on its first line. It must stay
// a classic script: no import or export, or register() fails on every phone.
declare const self: ServiceWorkerGlobalScope
declare const BUILD: { version: string; files: string[] }

const PREFIX = 'omb-shell-'
const SHELL = PREFIX + BUILD.version
const PRECACHED = new Set(BUILD.files)

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const fetched = await Promise.all(
          BUILD.files.map(async (path) => {
            // past the HTTP cache: index.html must be this deploy's, not one the browser kept
            const res = await fetch(path, { cache: 'reload' })
            if (!res.ok || res.redirected) throw new Error(`precache ${path}: ${res.status}`)
            return [path, res] as const
          }),
        )
        // A deploy landing mid-install serves a newer index.html naming assets this list
        // lacks. Give up; the next update check installs the newer worker instead.
        const html = await fetched.find(([p]) => p === '/index.html')![1].clone().text()
        for (const [, asset] of html.matchAll(/["'](\/assets\/[^"']+)["']/g))
          if (!PRECACHED.has(asset)) throw new Error(`precache: index.html names ${asset}, from another deploy`)
        const cache = await caches.open(SHELL)
        await Promise.all(fetched.map(([path, res]) => cache.put(path, res)))
      } catch (err) {
        await caches.delete(SHELL)
        throw err
      }
      await self.skipWaiting() // D50: take over at once; the page asks before reloading
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== SHELL) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Supabase (REST, Auth, Storage), Google, anything not ours: untouched, as if there were no
  // worker. Realtime is a WebSocket and never comes here. Nothing is cached at runtime (D51).
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    // Every page is index.html. The router reads the path; Supabase reads the #hash (which
    // never reaches a worker) or a ?code. A path that looks like a file isn't a page.
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return
    // /?sw-reset comes from the network, so a cached build that breaks can't stop its own reset
    if (url.searchParams.has('sw-reset')) return
    event.respondWith(fromShell('/index.html', request))
  } else if (PRECACHED.has(url.pathname)) {
    event.respondWith(fromShell(url.pathname, request))
  }
})

async function fromShell(path: string, request: Request): Promise<Response> {
  return (await caches.match(path, { cacheName: SHELL })) ?? fetch(request)
}
