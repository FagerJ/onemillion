import { onlineManager, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { RedirectIfSignedIn, RequireAuth, RequireCrew, RequireProfile } from '@/components/layout/Gates'
import { Toaster } from '@/components/ui/sonner'
import { persistOptions } from '@/data/persist'
import { QueueProvider } from '@/data/queue'
import '@/i18n'
import { registerServiceWorker } from '@/lib/pwa'
import { CrewPage } from '@/routes/CrewPage'
import { Home } from '@/routes/Home'
import { Me } from '@/routes/Me'
import { NewPassword } from '@/routes/NewPassword'
import { Night } from '@/routes/Night'
import { Nights } from '@/routes/Nights'
import { CrewSetup } from '@/routes/setup/CrewSetup'
import { ProfileSetup } from '@/routes/setup/ProfileSetup'
import { Welcome } from '@/routes/Welcome'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    // realtime marks things stale when they change; no need to poll on top. Kept for 36
    // hours, so what the phone last saw can be put back when it opens offline (D76).
    queries: { staleTime: 30_000, gcTime: 36 * 60 * 60_000, refetchOnWindowFocus: true, retry: 1 },
    // a write tried with no signal fails now, with a toast — never quietly an hour later.
    // Taps don't use mutations: they go on the slate (D70).
    mutations: { networkMode: 'always' },
  },
})

// TanStack assumes it's online until an event says otherwise; a launch with no signal fires none.
onlineManager.setOnline(navigator.onLine)

// Opened with no signal, the first requests fail rather than wait: TanStack only pauses
// queries after an `offline` event, and a launch without signal never fires one. When the
// signal comes back, ask again for whatever failed, so the splash moves on by itself (D51).
window.addEventListener('online', () => {
  void queryClient.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' })
})

const router = createBrowserRouter([
  {
    element: <RedirectIfSignedIn />,
    children: [{ path: '/welcome', element: <Welcome /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/new-password', element: <NewPassword /> },
      { path: '/setup/profile', element: <ProfileSetup /> },
      {
        element: <RequireProfile />,
        children: [
          { path: '/setup/crew', element: <CrewSetup /> },
          {
            element: <RequireCrew />,
            children: [
              {
                path: '/',
                element: <AppShell />,
                children: [
                  { index: true, element: <Home /> },
                  { path: 'night', element: <Night /> },
                  { path: 'nights', element: <Nights /> },
                  { path: 'crew', element: <CrewPage /> },
                  { path: 'me', element: <Me /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <QueueProvider>
          <MotionConfig reducedMotion="user">
            <RouterProvider router={router} />
            <Toaster />
          </MotionConfig>
        </QueueProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)

registerServiceWorker()
