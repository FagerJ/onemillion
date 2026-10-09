import { Car, Eye, Flag, Minus, Plus, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { Cap, CapStack } from '@/components/brand/Cap'
import { CountUp } from '@/components/brand/CountUp'
import { LiveBadge } from '@/components/brand/LiveBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  makeBeers,
  useAddAttendees,
  useAttendees,
  useCloseNight,
  useKickOff,
  useLiveBeers,
  useLogBeers,
  useMembers,
  useMyParty,
  useOpenNight,
  useSetInRounds,
  useTakeBack,
  type Attendee,
  type Member,
  type Session,
} from '@/data/queries'
import { buzz } from '@/lib/haptics'
import { cn } from '@/lib/utils'

export function Night() {
  const { data: mine } = useMyParty()
  const party = mine!.party
  const { data: night, isLoading } = useOpenNight(party.id)
  if (isLoading) return <Skeleton className="h-[70dvh] rounded-[28px]" />
  return night ? <LiveNight night={night} partyId={party.id} /> : <KickOff partyId={party.id} />
}

// ── before the night: who's at the table ──────────────────────

function KickOff({ partyId }: { partyId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: members = [] } = useMembers(partyId)
  const kickOff = useKickOff(partyId)
  const [picked, setPicked] = useState<Set<string>>(() => new Set([user!.id]))

  const toggle = (id: string) => {
    if (id === user!.id) return // whoever starts the night is at it
    buzz(8)
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="pb-24">
      <p className="kicker text-gold/80">{t('night.kickOff')}</p>
      <h1 className="display mt-1.5 text-[clamp(40px,12vw,52px)] text-foam">{t('night.whoTitle')}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foam/55">{t('night.whoHint')}</p>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {members.map((m, i) => {
          const on = picked.has(m.profile.id)
          return (
            <motion.button
              key={m.profile.id}
              type="button"
              onClick={() => toggle(m.profile.id)}
              aria-pressed={on}
              aria-label={m.profile.display_name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.92 }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-[20px] border px-2 py-4 transition-colors',
                on ? 'border-gold/45 bg-gold/10' : 'border-foam/6 bg-cask/60',
              )}
            >
              <Cap initials={m.profile.initials} color={m.profile.avatar_color} size="lg" ring={on} dim={!on} />
              <span className={cn('max-w-full truncate text-[13px] font-semibold', on ? 'text-foam' : 'text-foam/40')}>
                {m.profile.display_name}
              </span>
            </motion.button>
          )
        })}
      </div>

      <StickyAction>
        <Button
          size="xl"
          className="w-full"
          disabled={kickOff.isPending}
          onClick={() => {
            buzz([10, 40, 10])
            kickOff.mutate([...picked], { onError: () => toast.error(t('common.somethingWrong')) })
          }}
        >
          {t('night.start', { count: picked.size })}
        </Button>
      </StickyAction>
    </div>
  )
}

// ── the night itself ──────────────────────────────────────────

function LiveNight({ night, partyId }: { night: Session; partyId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: attendees = [] } = useAttendees(night.id)
  const { data: beers = [] } = useLiveBeers(night.id)
  const log = useLogBeers(night.id)
  const takeBack = useTakeBack(night.id)
  const checkIn = useAddAttendees(night.id)
  const [pours, setPours] = useState(0)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of beers) m.set(b.profile_id, (m.get(b.profile_id) ?? 0) + 1)
    return m
  }, [beers])

  const inRounds = attendees.filter((a) => a.in_rounds)
  const alone = attendees.length < 2
  // Only people at the table may log (D39). Someone else may have started the night,
  // so a party member who isn't here yet watches until they check in.
  const here = attendees.some((a) => a.profile_id === user!.id)
  const refused = (e: unknown) => (e as { code?: string } | null)?.code === '42501'
  const failed = (e: unknown) => toast.error(t(refused(e) ? 'night.notAtTable' : 'night.failed'))
  const closes = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(night.closes_at))

  const pour = (ids: string[], round = false) => {
    if (ids.length === 0 || alone || !here) return
    buzz(round ? [12, 30, 12, 30, 12] : 12)
    log.mutate(
      { profileIds: ids, rows: makeBeers(ids, user!.id, round) },
      { onError: failed },
    )
  }

  const undo = (profileId: string) => {
    const latest = [...beers].reverse().find((b) => b.profile_id === profileId)
    if (!latest) return
    buzz(6)
    takeBack.mutate(latest, { onError: failed })
  }

  return (
    <div className="pb-32">
      <div className="flex items-center justify-between">
        <LiveBadge startedAt={night.started_at} />
        {here && <FullTime partyId={partyId} sessionId={night.id} />}
      </div>

      <section className="relative mt-5 text-center">
        <p className="kicker">{t('night.tonight')}</p>
        <CountUp value={beers.length} className="display mt-1 block text-[clamp(96px,32vw,132px)] text-foam tabular [text-shadow:0_0_60px_rgb(245_178_58/0.25)]" />
        <div className="mt-2 flex items-center justify-center gap-3">
          <CapStack people={attendees.map((a) => a.profile)} size="xs" max={8} />
          <span className="text-[12px] font-semibold text-foam/40">{t('night.closesAt', { time: closes })}</span>
        </div>
      </section>

      {!here ? (
        <p className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-foam/10 bg-foam/5 px-4 py-3 text-center text-[14px] text-foam/70">
          <Eye className="size-4 shrink-0" /> {t('night.watching')}
        </p>
      ) : (
        alone && (
          <p className="mt-5 rounded-2xl border border-gold/25 bg-gold/8 px-4 py-3 text-center text-[14px] text-gold">
            {t('night.alone')}
          </p>
        )
      )}

      <ul className="mat mt-6 divide-y divide-foam/6 overflow-hidden">
        {attendees.map((a) => (
          <DrinkerRow
            key={a.profile_id}
            attendee={a}
            sessionId={night.id}
            count={counts.get(a.profile_id) ?? 0}
            me={a.profile_id === user!.id}
            disabled={alone || !here}
            canEdit={here}
            onPlus={() => pour([a.profile_id])}
            onMinus={() => undo(a.profile_id)}
          />
        ))}
      </ul>

      {here && (
        <div className="mt-4 flex justify-center">
          <AddSomeone partyId={partyId} sessionId={night.id} present={attendees} />
        </div>
      )}

      <StickyAction>
        {!here ? (
          <Button
            size="xl"
            className="w-full"
            disabled={checkIn.isPending}
            onClick={() => {
              buzz([10, 40, 10])
              checkIn.mutate([user!.id], { onError: () => toast.error(t('common.somethingWrong')) })
            }}
          >
            {t('night.joinTable')}
          </Button>
        ) : (
          <button
            type="button"
            disabled={alone || inRounds.length === 0}
            onClick={() => {
              setPours((p) => p + 1)
              pour(
                inRounds.map((a) => a.profile_id),
                true,
              )
            }}
            className={cn(
              'relative flex h-[68px] w-full items-center justify-between overflow-hidden rounded-full px-7',
              'bg-[linear-gradient(180deg,#ffc95f_0%,#f5b23a_45%,#d98f1c_100%)] text-stout',
              'shadow-[inset_0_1px_0_rgb(255_255_255/0.5),inset_0_-3px_0_rgb(0_0_0/0.2),0_18px_36px_-12px_rgb(245_178_58/0.6)]',
              'transition-transform active:scale-[0.97] disabled:opacity-40',
            )}
          >
            <span key={pours} className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-pour bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.55),transparent)]" />
            <span className="relative flex items-center gap-2 font-display text-[30px] leading-none tracking-[0.03em] uppercase">
              <Plus className="size-7" strokeWidth={3.4} />
              {t('night.round')}
            </span>
            <span className="relative rounded-full bg-stout/15 px-3 py-1 text-[13px] font-bold">
              {t('night.roundIn', { count: inRounds.length })}
            </span>
          </button>
        )}
      </StickyAction>
    </div>
  )
}

function DrinkerRow({
  attendee,
  sessionId,
  count,
  me,
  disabled,
  canEdit,
  onPlus,
  onMinus,
}: {
  attendee: Attendee
  sessionId: string
  count: number
  me: boolean
  disabled: boolean
  /** at the table: may void beers and mark drivers */
  canEdit: boolean
  onPlus: () => void
  onMinus: () => void
}) {
  const { t } = useTranslation()
  const setInRounds = useSetInRounds(sessionId)
  const p = attendee.profile
  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <Cap initials={p.initials} color={p.avatar_color} size="md" ring={me} />
      <DropdownMenu>
        <DropdownMenuTrigger disabled={!canEdit} className="min-w-0 flex-1 text-left outline-none">
          <span className="block truncate text-[16px] font-semibold text-foam">{p.display_name}</span>
          {!attendee.in_rounds && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.1em] text-hop uppercase">
              <Car className="size-3" /> {t('night.driving')}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => setInRounds.mutate({ profileId: attendee.profile_id, inRounds: !attendee.in_rounds })}
          >
            <Car /> {attendee.in_rounds ? t('night.skipRounds') : t('night.backInRounds')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={onMinus}
        disabled={count === 0 || !canEdit}
        aria-label={t('night.takeBack', { name: p.display_name })}
        className="grid size-10 place-items-center rounded-full border border-foam/12 text-foam/60 transition-transform active:scale-90 disabled:opacity-25"
      >
        <Minus className="size-4" strokeWidth={3} />
      </button>

      <span className="relative w-11 overflow-hidden text-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={{ y: -22, opacity: 0, scale: 1.4 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 22, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className={cn('block font-display text-[34px] leading-none tabular', count > 0 ? 'text-gold' : 'text-foam/25')}
          >
            {count}
          </motion.span>
        </AnimatePresence>
      </span>

      <PlusButton onTap={onPlus} disabled={disabled} label={t('night.oneMore', { name: p.display_name })} />
    </li>
  )
}

/** The gold tap. Every press throws a little spray of foam. */
function PlusButton({ onTap, disabled, label }: { onTap: () => void; disabled: boolean; label: string }) {
  const [bursts, setBursts] = useState<number[]>([])
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      whileTap={{ scale: 0.84 }}
      onClick={() => {
        onTap()
        const id = performance.now()
        setBursts((b) => [...b, id])
        window.setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 700)
      }}
      className="relative grid size-14 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffd27a,#f5b23a_55%,#c6821a)] text-stout shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_8px_18px_-6px_rgb(245_178_58/0.7)] disabled:opacity-35"
    >
      <Plus className="size-7" strokeWidth={3} />
      {bursts.map((id) => (
        <Spray key={id} />
      ))}
    </motion.button>
  )
}

function Spray() {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const angle = ((-90 + (i - 3) * 24) * Math.PI) / 180
        const dist = 30 + (i % 3) * 8
        return (
          <motion.span
            key={i}
            className="pointer-events-none absolute size-2 rounded-full bg-foam"
            initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.5 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 8, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.3, 1] }}
          />
        )
      })}
    </>
  )
}

function AddSomeone({ partyId, sessionId, present }: { partyId: string; sessionId: string; present: Attendee[] }) {
  const { t } = useTranslation()
  const { data: members = [] } = useMembers(partyId)
  const add = useAddAttendees(sessionId)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const here = new Set(present.map((a) => a.profile_id))
  const missing: Member[] = members.filter((m) => !here.has(m.profile.id))

  return (
    <Drawer open={open} onOpenChange={(o) => (setOpen(o), setPicked(new Set()))}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus /> {t('night.addSomeone')}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-[480px] rounded-t-[28px] border-gold/14 bg-popover px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle className="display text-[30px] text-foam">{t('night.addTitle')}</DrawerTitle>
        </DrawerHeader>
        {missing.length === 0 ? (
          <p className="py-8 text-center text-foam/50">{t('night.everyoneHere')}</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 py-2">
              {missing.map((m) => {
                const on = picked.has(m.profile.id)
                return (
                  <button
                    key={m.profile.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={m.profile.display_name}
                    onClick={() =>
                      setPicked((s) => {
                        const n = new Set(s)
                        if (n.has(m.profile.id)) n.delete(m.profile.id)
                        else n.add(m.profile.id)
                        return n
                      })
                    }
                    className="flex flex-col items-center gap-1.5"
                  >
                    <Cap initials={m.profile.initials} color={m.profile.avatar_color} size="lg" ring={on} dim={!on} />
                    <span className="max-w-full truncate text-[12px] font-semibold text-foam/70">{m.profile.display_name}</span>
                  </button>
                )
              })}
            </div>
            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={picked.size === 0 || add.isPending}
              onClick={() =>
                add.mutate([...picked], {
                  onSuccess: () => setOpen(false),
                  onError: () => toast.error(t('common.somethingWrong')),
                })
              }
            >
              {t('night.add')}
            </Button>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function FullTime({ partyId, sessionId }: { partyId: string; sessionId: string }) {
  const { t } = useTranslation()
  const close = useCloseNight(partyId)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Flag /> {t('night.fullTime')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('night.fullTimeTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('night.fullTimeBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            onClick={() => close.mutate(sessionId, { onError: () => toast.error(t('common.somethingWrong')) })}
          >
            {t('night.fullTimeConfirm')}
          </AlertDialogAction>
          <AlertDialogCancel variant="ghost">{t('common.cancel')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Pinned above the dock, with the page fading out underneath it. */
function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+92px)] z-30">
      <div className="pointer-events-auto mx-auto max-w-[480px] bg-[linear-gradient(to_top,var(--cellar)_40%,transparent)] px-4 pt-6 pb-2">
        {children}
      </div>
    </div>
  )
}
