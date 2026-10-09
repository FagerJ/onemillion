import { createClient } from '@supabase/supabase-js'
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

export const supabase = createClient<Database>(apiOrigin, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
