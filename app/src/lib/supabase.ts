import { createClient, type Session } from '@supabase/supabase-js'
import type { Database } from './database.types'

// In development the API runs on this PC. A phone on the same Wi-Fi opens the app at
// the PC's LAN address, where 127.0.0.1 would mean the phone itself — so point the API
// at whichever host served the page.
function apiUrl(): string {
  const url = new URL(import.meta.env.VITE_SUPABASE_URL)
  if (import.meta.env.DEV && ['127.0.0.1', 'localhost'].includes(url.hostname)) {
    url.hostname = window.location.hostname
  }
  return url.origin
}

export const apiOrigin = apiUrl()
export const publishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// An email link that failed — expired, or already used — comes back with the reason in
// the URL hash. Read it now: the router redirects to /welcome and the hash is lost.
export const linkError: string | null = new URLSearchParams(window.location.hash.slice(1)).get('error_code')

// A phone holding a session never asks the API as a stranger (D76). supabase-js falls back
// to the publishable key when a token can't be refreshed; RLS answers that with empty lists,
// which the gates would read as "no crew" and the queue as a refusal. Such a request fails
// like a dropped connection instead, and goes again once the token is fresh.
const storageKey = `sb-${new URL(apiOrigin).hostname.split('.')[0]}-auth-token`

/** Signs out on this phone only: what auth-js can't do while an expired token can't be
 *  refreshed (it refreshes before it signs out). The caller reloads. */
export function forgetSession() {
  for (const k of [storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`]) localStorage.removeItem(k)
}

/** The session saved on this phone, whether or not its token has expired. */
export function savedSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return s?.user?.id && s.refresh_token ? (s as Session) : null
  } catch {
    return null
  }
}

const guarded: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const bearer = new Headers(init?.headers).get('Authorization')
  if (url.includes('/rest/v1/') && bearer === `Bearer ${publishableKey}` && savedSession())
    return Promise.reject(new TypeError('Failed to fetch: session not refreshed yet'))
  return fetch(input, init)
}

export const supabase = createClient<Database>(apiOrigin, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey },
  global: { fetch: guarded },
})
