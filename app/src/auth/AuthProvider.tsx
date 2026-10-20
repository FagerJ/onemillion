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
    supabase.auth.getSession().then(({ data, error }) => {
      // Offline with an expired access token: the session is still saved on this phone, it
      // just can't be refreshed yet. Open on it, so the cached night and the slate know who
      // you are (D76, amends D51); requests can't go out as a stranger (lib/supabase.ts), and
      // the auto-refresh fires TOKEN_REFRESHED once there's signal. Anything else — no
      // session, a revoked one — goes to Welcome.
      if (!data.session && isAuthRetryableFetchError(error)) {
        const saved = savedSession()
        if (saved) setState({ session: saved, user: saved.user, loading: false })
        return
      }
      setState({ session: data.session, user: data.session?.user ?? null, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return // getSession() above settles the first state
      // Someone else's cached crew must never flash up after a sign-out.
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        void persister.removeClient()
      }
      setState({ session, user: session?.user ?? null, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
