import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { attendeesQuery, catalogueQuery, type Attendee, type Member, type UnlockRow } from '@/data/queries'
import { onCelebration, type Incoming } from './bus'
import { ComboBanner, type ComboItem } from './ComboBanner'
import { useTakeoverOpen } from './takeover-open'
import { UnlockSlip, type SlipItem } from './UnlockSlip'

// G4: combos and badges as they happen. Realtime hands every live row to the bus; this
// gathers a beat's worth, works out who should see what, and shows them one at a time.
// A milestone takeover always goes first: a crew rung and a combo can land on the same
// beer, and nothing shows until the Golden Goal has been waved off.

type Shown = ComboItem | SlipItem

// A + ROUND crossing 10 at a table of 8 is one combo row and up to 8 unlocks: one moment.
const BATCH_MS = 600
const QUEUE_MAX = 6

export function Celebrations({ crewId, crewName }: { crewId: string; crewName: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user!.id
  const { pathname } = useLocation()
  const held = useTakeoverOpen()
  const [queue, setQueue] = useState<Shown[]>([])

  // Read when a batch lands rather than when the listener subscribes, so walking onto
  // /night (or a rename) never drops a batch in flight.
  const latest = useRef({ onNight: false, crewName })
  useEffect(() => {
    latest.current = { onNight: pathname === '/night', crewName }
  })

  useEffect(() => {
    let batch: Incoming[] = []
    let timer = 0
    let live = true
    // British lists, like the dates in lib/format: "You, Anna and Björn".
    const lang = i18n.language === 'en' ? 'en-GB' : i18n.language
    const and = new Intl.ListFormat(lang, { type: 'conjunction' })
    const comma = new Intl.ListFormat(lang, { type: 'unit', style: 'short' })

    async function present(items: Incoming[]): Promise<Shown[]> {
      const { onNight, crewName } = latest.current
      // The unlock invalidated it, so this refetches: a secret may have a name now (D66).
      const catalogue = await queryClient.fetchQuery(catalogueQuery)
      const badge = (code: string) => catalogue.find((b) => b.code === code && b.title)
      const table = (sessionId: string | null) =>
        sessionId ? queryClient.fetchQuery(attendeesQuery(sessionId)) : Promise.resolve<Attendee[]>([])
      const members = queryClient.getQueryData<Member[]>(['crew', crewId, 'members']) ?? []

      const nameOf = (id: string, at: Attendee[]) =>
        id === userId
          ? t('celebrate.you')
          : (at.find((a) => a.profile_id === id)?.profile.display_name ??
            members.find((m) => m.profile.id === id)?.profile.display_name)
      // The viewer leads: "You and Anna"; past three, "Anna, Björn and 3 more".
      const names = (rows: UnlockRow[], at: Attendee[]) => {
        const ids = [...new Set(rows.flatMap((u) => (u.profile_id ? [u.profile_id] : [])))]
        ids.sort((a, b) => Number(b === userId) - Number(a === userId))
        const all = ids.flatMap((id) => nameOf(id, at) ?? [])
        if (all.length === 0) return null
        return all.length <= 3
          ? and.format(all)
          : t('celebrate.andMore', { names: comma.format(all.slice(0, 2)), count: all.length - 2 })
      }
      const sitsAt = (at: Attendee[]) => at.some((a) => a.profile_id === userId)

      const combos = items.flatMap((i) => (i.kind === 'combo' ? [i.row] : []))
      const unlocks = items.flatMap((i) => (i.kind === 'unlock' ? [i.row] : []))
      const folded = new Set<string>()

      // The banner is for the table, and for whoever is on /night watching it. The rung's
      // badge unlocking for the first time rides along on it.
      const banners: ComboItem[] = []
      for (const c of combos) {
        const b = badge(c.achievement_code)
        const at = await table(c.session_id)
        if (!b || !(onNight || sitsAt(at))) continue
        const first = unlocks.filter((u) => u.achievement_code === c.achievement_code && u.session_id === c.session_id)
        first.forEach((u) => folded.add(u.id))
        banners.push({
          id: `combo:${c.session_id}:${c.achievement_code}`,
          kind: 'combo',
          badge: b,
          firstTimers: names(first, at),
        })
      }
      banners.sort((x, y) => (x.badge.target ?? 0) - (y.badge.target ?? 0))

      // A crew badge is for everyone in the crew with the app open.
      const crewSlips: SlipItem[] = unlocks.flatMap((u) => {
        const b = u.tier === 'crew' ? badge(u.achievement_code) : undefined
        return b ? [{ id: `unlock:${u.id}`, kind: 'unlock' as const, badge: b, names: null, crewName }] : []
      })

      // A person's badge is for the holder, and for whoever was at that night with them;
      // several holders of one badge share a slip. A combo badge with no banner is a late
      // arrival collecting the night's rungs: that one is theirs alone.
      const groups = new Map<string, UnlockRow[]>()
      for (const u of unlocks) {
        if (u.tier !== 'person' || !u.profile_id || folded.has(u.id)) continue
        const key = `${u.achievement_code}:${u.session_id ?? ''}`
        groups.set(key, [...(groups.get(key) ?? []), u])
      }
      const personSlips: SlipItem[] = []
      for (const rows of groups.values()) {
        const b = badge(rows[0].achievement_code)
        if (!b) continue
        const at = await table(rows[0].session_id)
        const here = sitsAt(at) && b.category !== 'combo'
        const holders = rows.filter((u) => u.profile_id === userId || here)
        const who = holders.length ? names(holders, at) : null
        if (who) personSlips.push({ id: `unlock:${rows[0].id}`, kind: 'unlock', badge: b, names: who })
      }
      personSlips.sort((x, y) => x.badge.sort - y.badge.sort)

      return [...banners, ...crewSlips, ...personSlips]
    }

    const off = onCelebration((c) => {
      batch.push(c)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const items = batch
        batch = []
        void present(items)
          .catch(() => [] as Shown[])
          .then((shown) => {
            if (!live || shown.length === 0) return
            setQueue((q) => [...q, ...shown.filter((s) => !q.some((x) => x.id === s.id))].slice(0, QUEUE_MAX))
          })
      }, BATCH_MS)
    })
    return () => {
      live = false
      off()
      window.clearTimeout(timer)
    }
  }, [queryClient, userId, crewId, t, i18n.language])

  // Held while the takeover is up; whatever was showing comes back after with full time.
  const head = held ? undefined : queue[0]
  const headId = head?.id
  const done = useCallback(() => setQueue((q) => q.filter((s) => s.id !== headId)), [headId])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-50 flex justify-center px-4"
    >
      <AnimatePresence mode="wait">
        {head?.kind === 'combo' && <ComboBanner key={head.id} item={head} onDone={done} />}
        {head?.kind === 'unlock' && <UnlockSlip key={head.id} item={head} onDone={done} />}
      </AnimatePresence>
    </div>
  )
}
