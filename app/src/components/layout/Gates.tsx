import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useMyCrew, useProfile } from '@/data/queries'
import { Splash } from './Splash'

// The way in: signed in → has a profile → is in a crew → the app. Each gate sends
// you to the step you're missing. Data `undefined` means we couldn't ask yet (no
// signal, or the request failed); only `null` means "asked, and there's none" (D51).
// Opening the installed app offline must land on the splash, never on setup.

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/welcome" replace />
  return <Outlet />
}

export function RequireProfile() {
  const { data: profile, isError, refetch } = useProfile()
  if (profile === undefined) return <Splash onRetry={isError ? () => void refetch() : undefined} />
  if (!profile) return <Navigate to="/setup/profile" replace />
  return <Outlet />
}

export function RequireCrew() {
  const { data: mine, isError, refetch } = useMyCrew()
  if (mine === undefined) return <Splash onRetry={isError ? () => void refetch() : undefined} />
  if (!mine) return <Navigate to="/setup/crew" replace />
  return <Outlet />
}

export function RedirectIfSignedIn() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
