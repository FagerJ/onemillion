import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { RedirectIfSignedIn, RequireAuth, RequireParty, RequireProfile } from '@/components/layout/Gates'
import { Toaster } from '@/components/ui/sonner'
import '@/i18n'
import { Home } from '@/routes/Home'
import { Me } from '@/routes/Me'
import { NewPassword } from '@/routes/NewPassword'
import { Night } from '@/routes/Night'
import { Nights } from '@/routes/Nights'
import { PartyPage } from '@/routes/PartyPage'
import { PartySetup } from '@/routes/setup/PartySetup'
import { ProfileSetup } from '@/routes/setup/ProfileSetup'
import { Welcome } from '@/routes/Welcome'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    // realtime marks things stale when they change; no need to poll on top
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
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
          { path: '/setup/party', element: <PartySetup /> },
          {
            element: <RequireParty />,
            children: [
              {
                path: '/',
                element: <AppShell />,
                children: [
                  { index: true, element: <Home /> },
                  { path: 'night', element: <Night /> },
                  { path: 'nights', element: <Nights /> },
                  { path: 'party', element: <PartyPage /> },
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
          <Toaster />
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
