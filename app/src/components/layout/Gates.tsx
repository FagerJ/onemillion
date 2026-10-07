import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useMyParty, useProfile } from '@/data/queries'
import { Splash } from './Splash'

// The way in: signed in → has a profile → is in a party → the app. Each gate sends
// you to the step you're missing.

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/welcome" replace />
  return <Outlet />
}

export function RequireProfile() {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <Splash />
  if (!profile) return <Navigate to="/setup/profile" replace />
  return <Outlet />
}

export function RequireParty() {
  const { data: mine, isLoading } = useMyParty()
  if (isLoading) return <Splash />
  if (!mine) return <Navigate to="/setup/party" replace />
  return <Outlet />
}

export function RedirectIfSignedIn() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
