import { notifyManager, useQueryClient } from '@tanstack/react-query'
import { createContext, createElement, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import i18n from '@/i18n'
import { useOnline } from '@/lib/pwa'
import { mergeTally } from '@/lib/queue/core'
import { createRunner } from '@/lib/queue/runner'
import { createSlate, idbBackend, memoryBackend } from '@/lib/queue/store'
import { uuid } from '@/lib/uuid'
import { findBeers, sendBeers, useLiveBeers, usableSession, voidBeer, type LiveBeer, type Session } from './queries'

// The offline queue (C8, D70–D75): every +, + ROUND and − goes on the slate first and is
// sent from there, in order, as soon as there's signal. One runner per tab; Web Locks make it
// one flusher per phone.

function slate() {
  try {
    if (typeof indexedDB !== 'undefined') return createSlate(idbBackend())
  } catch {
    // reading `indexedDB` throws where site data is blocked
  }
  return createSlate(memoryBackend(), undefined, { durable: false }) // the warning shows
}

const webLock = (fn: () => Promise<void>) =>
  navigator.locks?.request ? (navigator.locks.request('omb-queue', fn) as Promise<void>) : fn()

export const queue = createRunner({
  slate: slate(),
  api: { usableSession, sendBeers, voidBeer, findBeers },
  uuid,
  lock: webLock,
  online: () => navigator.onLine,
})

if (import.meta.env.DEV) (window as unknown as { __omb_queue: typeof queue }).__omb_queue = queue

type SlateUi = { open: boolean; setOpen(open: boolean): void }
const SlateContext = createContext<SlateUi>({ open: false, setOpen: () => {} })

export function QueueProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    let refresh: ReturnType<typeof setTimeout> | undefined
    let waited = 0 // taps that had to wait, over the passes until the slate is clear
    const stop = queue.start(user.id, {
      // Into the night's cache before it leaves the slate, so the count never dips (D75).
      landed: (e) =>
        notifyManager.batch(() => {
          const key = ['session', e.session_id, 'beers']
          if (e.kind === 'beers')
            queryClient.setQueryData<LiveBeer[]>(
              key,
              (old) =>
                old && [
                  ...old.filter((b) => !e.rows.some((r) => r.client_uuid === b.id)),
                  ...e.rows.map((r) => ({
                    id: r.client_uuid,
                    profile_id: r.profile_id,
                    added_by: e.user_id,
                    round_id: r.round_id,
                    logged_at: new Date(e.tapped_at).toISOString(),
                    is_alcohol_free: r.is_alcohol_free,
                  })),
                ],
            )
          else queryClient.setQueryData<LiveBeer[]>(key, (old) => old?.filter((b) => b.id !== e.target))
          // a refetch already on its way read the night before this tap: drop it, keep the patch
          void queryClient.cancelQueries({ queryKey: key, exact: true })
          clearTimeout(refresh)
          refresh = setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: ['session', e.session_id] })
            void queryClient.invalidateQueries({ queryKey: ['crew', e.crew_id] })
            void queryClient.invalidateQueries({ queryKey: ['global'] })
            void queryClient.invalidateQueries({ queryKey: ['profile'] })
            // a Golden Goal reaches the tapper's own phone even when Realtime is slow (D59)
            void queryClient.invalidateQueries({ queryKey: ['milestones', 'global'] })
          }, 300)
        }),
      settled: ({ landed, failed, done }) => {
        if (done && !landed.length && !failed.length) {
          waited = 0 // another window sent the rest
          return
        }
        waited += landed.filter((e) => Date.now() - e.tapped_at > 10_000).length
        if (failed.length) {
          waited = 0
          toast.error(i18n.t('sync.notSavedToast', { count: failed.length }), {
            action: { label: i18n.t('sync.see'), onClick: () => setOpen(true) },
          })
          if (failed.some((f) => f.failed?.reason === 'closed')) void queryClient.invalidateQueries({ queryKey: ['crew'] })
        } else if (done && waited) {
          toast.success(i18n.t('sync.allIn', { count: waited }))
          waited = 0
        }
      },
    })
    const onOnline = () => void queue.kick(true)
    const onVisible = () => document.visibilityState === 'visible' && void queue.kick()
    const onShow = (ev: PageTransitionEvent) => ev.persisted && void queue.kick()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onShow)
    return () => {
      stop()
      clearTimeout(refresh)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onShow)
    }
  }, [user, queryClient])

  // Storage that stops saving is said once: the taps still go in, but only while the app is open.
  const durable = useSyncExternalStore(queue.subscribe, () => queue.snapshot().durable)
  const signedIn = !!user
  useEffect(() => {
    if (signedIn && !durable) toast.warning(i18n.t('sync.notDurable'), { duration: 10_000 })
  }, [durable, signedIn])

  // A refreshed token is the moment a stalled queue can go again.
  const token = session?.access_token
  useEffect(() => {
    if (token) void queue.kick(true)
  }, [token])

  const ui = useMemo(() => ({ open, setOpen }), [open])
  return createElement(SlateContext.Provider, { value: ui }, children)
}

export function useQueue() {
  const snap = useSyncExternalStore(queue.subscribe, queue.snapshot)
  const ui = useContext(SlateContext)
  return useMemo(
    () => ({
      ...snap,
      waiting: snap.entries.filter((e) => !e.failed),
      failed: snap.entries.filter((e) => e.failed),
      openSlate: () => ui.setOpen(true),
      pour: queue.pour,
      takeBack: queue.takeBack,
      sendNow: () => void queue.kick(true),
      dismissFailed: queue.dismissFailed,
      settle: queue.settle,
    }),
    [snap, ui],
  )
}

export const useSlateSheet = () => useContext(SlateContext)

/** The night's beers as this phone should show them: the server's, plus the slate (D75). */
export function useNightTally(night: Session | null | undefined) {
  const { data: server = [] } = useLiveBeers(night?.id)
  const { entries, ready } = useQueue()
  return useMemo(() => {
    const beers = night ? mergeTally(server, entries, night.id) : []
    const waitingFor = new Map<string, number>()
    for (const b of beers) if (b.pending) waitingFor.set(b.profile_id, (waitingFor.get(b.profile_id) ?? 0) + 1)
    return { beers, waitingFor, ready }
  }, [server, entries, night, ready])
}

/** Whether the sync chip and the row dots show: offline, something refused, or a tap that
 *  has been waiting 2,5 s. An online tap lands in about 150 ms and should never flash. */
export function useSlate() {
  const online = useOnline()
  const q = useQueue()
  const oldest = q.waiting.reduce((m, e) => Math.min(m, e.tapped_at), Infinity)
  const [lateAt, setLateAt] = useState<number | null>(null)
  useEffect(() => {
    if (!Number.isFinite(oldest)) return
    const wait = Math.max(0, oldest + 2_500 - Date.now())
    const id = window.setTimeout(() => setLateAt(oldest), wait)
    return () => window.clearTimeout(id)
  }, [oldest])
  const late = Number.isFinite(oldest) && lateAt === oldest
  const visible = !online || q.failed.length > 0 || late
  return { visible, online, waiting: q.waiting.length, failed: q.failed.length, sending: q.phase === 'sending' }
}
