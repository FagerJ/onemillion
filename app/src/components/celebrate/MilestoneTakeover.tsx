import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Dialog } from 'radix-ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/AuthProvider'
import { Cap } from '@/components/brand/Cap'
import { CapBurst } from '@/components/brand/CapBurst'
import { FlapNumber } from '@/components/brand/Flaps'
import { Button } from '@/components/ui/button'
import { useCrewMilestones, useGlobalMilestones, useOpenNight } from '@/data/queries'
import { fmt, matchMinute, nightLabel } from '@/lib/format'
import { buzz } from '@/lib/haptics'
import { loadSeen, pickCelebrations, rungName, saveSeen, type MilestoneEvent } from '@/lib/milestones'
import { TakeoverOpen } from './takeover-open'

// G5: when the crew or the Million lands on a rung, every phone in the crew gets the
// scoreboard ticking over and the Golden Goal's scorer (D57, D59). Shown on each device
// until it is dismissed, within a day of the crossing; replayed history never celebrates.

export function CelebrationHost({ crewId, crewName, children }: { crewId: string; crewName: string; children: ReactNode }) {
  const { user } = useAuth()
  const userId = user!.id
  const { data: crew = [] } = useCrewMilestones(crewId)
  const { data: global = [] } = useGlobalMilestones()
  const [seen, setSeen] = useState(() => loadSeen(userId))
  const now = useMinute()
  const head = useMemo(() => pickCelebrations([...global, ...crew], seen, now)[0] ?? null, [crew, global, seen, now])

  // Seen once dismissed: a phone that reloads before anyone tapped "Back to it" shows it again.
  function dismiss() {
    if (!head) return
    const next = new Set(seen)
    head.ids.forEach((id) => next.add(id))
    saveSeen(userId, next)
    setSeen(next)
  }

  return (
    <TakeoverOpen.Provider value={!!head}>
      {children}
      <MilestoneTakeover event={head?.event ?? null} crewName={crewName} crewId={crewId} onClose={dismiss} />
    </TakeoverOpen.Provider>
  )
}

/** The time, a minute at a time: enough for a 24-hour window. A crossing newer than the last
 *  tick counts as now. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

const BURST = { bronze: 10, silver: 16, gold: 24, legendary: 40 } as const

// Fits 343px (375 less two 16px gutters): a tile is 0.86em plus a 0.08em gap, and every
// third digit adds a separator of about 0.2em.
const flapSize = (w: number) =>
  w <= 3
    ? 'text-[clamp(64px,24vw,104px)]'
    : w === 4
      ? 'text-[clamp(52px,18vw,84px)]'
      : w <= 6
        ? 'text-[clamp(38px,12vw,60px)]'
        : 'text-[clamp(28px,9.6vw,48px)]'

function MilestoneTakeover({
  event,
  crewName,
  crewId,
  onClose,
}: {
  event: MilestoneEvent | null
  crewName: string
  crewId: string
  onClose: () => void
}) {
  return (
    <Dialog.Root open={!!event} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {event && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[90] bg-cellar/92 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[91] flex flex-col items-center justify-center overflow-hidden px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)] text-center outline-none"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* keyed, so the next rung in the queue starts its own tick-over */}
                <TakeoverBody key={event.id} event={event} crewName={crewName} crewId={crewId} onClose={onClose} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function TakeoverBody({
  event,
  crewName,
  crewId,
  onClose,
}: {
  event: MilestoneEvent
  crewName: string
  crewId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const { data: night } = useOpenNight(crewId)
  // 0.000.999 ticks over to 0.001.000; with reduced motion it is simply there
  const [ticked, setTicked] = useState(!!reduce)
  const [late] = useState(() => Date.now() - Date.parse(event.crossed_at) > 15 * 60_000)

  useEffect(() => {
    if (reduce) {
      buzz(40)
      return
    }
    const tick = window.setTimeout(() => {
      setTicked(true)
      buzz([30, 50, 30, 50, 140])
    }, 650)
    return () => window.clearTimeout(tick)
  }, [reduce])

  const shown = ticked ? event.threshold : event.threshold - 1
  const global = event.scope === 'global'
  // the global board is always seven tiles, like the Million on Home
  const width = global ? 7 : String(event.threshold).length
  const name = rungName(t, event.threshold)
  const minute = night && event.session_id === night.id ? matchMinute(night.started_at, Date.parse(event.crossed_at)) : null

  return (
    <>
      {/* the pub lamp, turned up */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_32%,rgb(245_178_58/0.30),transparent_70%)]" />
      {!reduce && shown === event.threshold && <CapBurst count={BURST[event.rung?.tier ?? 'bronze']} />}

      <Dialog.Title className="sr-only">
        {global
          ? t('milestones.takeover.srGlobal', { rung: fmt(event.threshold) })
          : t('milestones.takeover.srCrew', { crew: crewName, rung: fmt(event.threshold) })}
      </Dialog.Title>
      <Dialog.Description className="sr-only">
        {event.scorer
          ? t('milestones.scoredBy', { name: event.scorer.display_name })
          : t('milestones.takeover.otherCrew')}
      </Dialog.Description>

      <p className="kicker relative text-gold/80">
        {global ? t('milestones.takeover.global') : t('milestones.takeover.crew', { crew: crewName })}
      </p>
      <div className="relative mt-4">
        <FlapNumber value={shown} width={width} className={flapSize(width)} />
      </div>
      {name && <p className="display relative mt-4 text-[clamp(30px,9vw,44px)] text-gold">{name}</p>}

      <GoldenGoal event={event} minute={minute} />

      {late && (
        <p className="relative mt-3 text-[12px] font-semibold text-foam/40">
          {t('milestones.takeover.when', { when: nightLabel(event.crossed_at) })}
        </p>
      )}
      <Button size="xl" className="relative mt-8 w-full max-w-[320px]" onClick={onClose} autoFocus>
        {t('milestones.takeover.dismiss')}
      </Button>
    </>
  )
}

/** The scorer on a beer mat, and whoever tapped it in. */
function GoldenGoal({ event, minute }: { event: MilestoneEvent; minute: string | null }) {
  const { t } = useTranslation()
  if (!event.scorer) {
    return <p className="kicker relative mt-6 text-foam/50">{t('milestones.takeover.otherCrew')}</p>
  }
  const assisted = event.added_by !== event.profile_id && event.assist
  return (
    <div className="mat relative mt-6 flex w-full max-w-[340px] flex-col items-center px-5 pt-4 pb-5">
      <p className="kicker text-gold/80">
        {minute ? t('milestones.takeover.goldenGoalAt', { minute }) : t('milestones.takeover.goldenGoal')}
      </p>
      <motion.div
        className="mt-3"
        initial={{ rotate: -120, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.8 }}
      >
        <Cap initials={event.scorer.initials} color={event.scorer.avatar_color} size="xl" ring />
      </motion.div>
      <p className="display mt-3 max-w-full truncate text-[40px] text-foam">{event.scorer.display_name}</p>
      {assisted && event.assist && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-foam/55">
          <Cap initials={event.assist.initials} color={event.assist.avatar_color} size="xs" />
          {event.round_id
            ? t('milestones.takeover.round', { name: event.assist.display_name })
            : t('milestones.takeover.assist', { name: event.assist.display_name })}
        </p>
      )}
    </div>
  )
}
