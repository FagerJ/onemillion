import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import i18n from '@/i18n'

// The installed app (D48–D52): the service worker's registration and updates, the install
// offer, and whether there's signal. Imported by main.tsx before React mounts, so the
// install prompt Chrome fires early is never missed.

// ── the service worker (D49, D50) ─────────────────────────────

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // VITE_SW_OFF (every phone) or /?sw-reset (this phone): drop the worker and its caches.
  if (import.meta.env.VITE_SW_OFF === '1' || location.search.includes('sw-reset')) return void retire()

  // The first worker taking over a fresh page isn't an update; every later takeover is.
  let hadWorker = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadWorker)
      toast(i18n.t('pwa.updated'), {
        id: 'sw-update',
        duration: Infinity,
        action: { label: i18n.t('pwa.reload'), onClick: () => location.reload() },
      })
    hadWorker = true
  })

  const start = async () => {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    // An installed app can stay open for days without a navigation, which is when browsers look
    // for a new worker. Ask on every return to the app (at most every 10 min), hourly on screen.
    let last = Date.now()
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 10 * 60_000) return
      last = Date.now()
      reg.update().catch(() => {}) // no signal: next time
    }
    document.addEventListener('visibilitychange', check)
    window.setInterval(check, 60 * 60_000)
    // Installed apps keep their storage: the session now, the offline queue (C8) later.
    if (isStandalone()) void navigator.storage?.persist?.()
  }
  if (document.readyState === 'complete') void start()
  else window.addEventListener('load', () => void start(), { once: true })
}

async function retire() {
  for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister()
  if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('omb-shell-')) await caches.delete(key)
  if (location.search.includes('sw-reset')) location.replace('/') // fresh from the network
}

// ── installing (D52) ──────────────────────────────────────────

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null
let installedNow = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// Chrome offers the install once, often before React mounts, so listen from the start.
// preventDefault keeps Chrome's own mini-bar away; the banner and the Me card offer it instead.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPrompt
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  installedNow = true
  emit()
  toast.success(i18n.t('pwa.installed'))
})

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

// iPadOS says "Macintosh"; the touch points give it away.
export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

/** installed: opened from the home screen (or just added) · prompt: one-tap install (Chrome,
 *  Edge, Samsung) · ios: only by hand, through Share · none: no way to install from here */
export type InstallState = 'installed' | 'prompt' | 'ios' | 'none'

const installState = (): InstallState =>
  installedNow || isStandalone() ? 'installed' : deferred ? 'prompt' : isIOS() ? 'ios' : 'none'

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

export function useInstall() {
  const state = useSyncExternalStore(subscribe, installState)
  async function install() {
    const prompt = deferred
    if (!prompt) return
    deferred = null // a prompt can be shown once
    emit()
    await prompt.prompt()
    await prompt.userChoice // accepted → 'appinstalled' follows
  }
  return { state, install }
}

// ── signal ────────────────────────────────────────────────────

const onLine = (l: () => void) => {
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  return () => {
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
  }
}

export function useOnline() {
  return useSyncExternalStore(onLine, () => navigator.onLine)
}
