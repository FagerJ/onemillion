import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { persister } from '@/data/persist'
import { savedSession, supabase } from '@/lib/supabase'

type AuthState = { session: Session | null; user: User | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true })

  useEffect(() => {
    // Offline, or on one bar, with an expired access token: the session is still saved on
    // this phone, it just can't be refreshed yet, and auth-js keeps retrying for ~25 s. Open
    // on it, so the cached night and the slate know who you are (D76, amends D51): at once
    // offline, after 1,5 s otherwise. Requests can't go out as a stranger (lib/supabase.ts),
    // and the auto-refresh fires TOKEN_REFRESHED once there's signal. Anything else — no
    // session, a revoked one — goes to Welcome when getSession() says so.
    const openSaved = () => {
      const saved = savedSession()
      if (saved) setState({ session: saved, user: saved.user, loading: false })
      return !!saved
    }
    const early = setTimeout(openSaved, navigator.onLine ? 1_500 : 0)
    supabase.auth.getSession().then(({ data, error }) => {
      clearTimeout(early)
      if (!data.session && isAuthRetryableFetchError(error) && openSaved()) return
      setState({ session: data.session, user: data.session?.user ?? null, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return // getSession() above settles the first state
      clearTimeout(early)
      // Someone else's cached crew must never flash up after a sign-out.
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        void persister.removeClient()
      }
      setState({ session, user: session?.user ?? null, loading: false })
    })
    return () => {
      clearTimeout(early)
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
