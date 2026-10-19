import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

type AuthState = { session: Session | null; user: User | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // Offline with an expired access token: the session is still in storage, it just can't
      // be refreshed yet. Stay on the splash; the auto-refresh fires TOKEN_REFRESHED once
      // there's signal (D51). Anything else — no session, a revoked one — goes to Welcome.
      if (!data.session && isAuthRetryableFetchError(error)) return
      setState({ session: data.session, user: data.session?.user ?? null, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return // getSession() above settles the first state
      // Someone else's cached crew must never flash up after a sign-out.
      if (event === 'SIGNED_OUT') queryClient.clear()
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
