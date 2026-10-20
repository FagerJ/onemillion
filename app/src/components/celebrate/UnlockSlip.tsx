import { X } from 'lucide-react'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeArt } from '@/components/brand/BadgeArt'
import type { Badge } from '@/data/queries'
import { buzz } from '@/lib/haptics'

/** A badge unlocking: who got it ("You", "Anna, Björn and 3 more"), or the crew's name for a
 *  crew badge. */
export type SlipItem = { id: string; kind: 'unlock'; badge: Badge; names: string | null; crewName?: string }

const SHOWN_MS = 3200

// hop green for looking after each other, fire for streaks and combos, gold otherwise
const ACCENT = { gold: 'text-gold', fire: 'text-fire', hop: 'text-hop' } as const

/** G4: a small slip under the notch, with the cap or the mat, who and what. */
export function UnlockSlip({ item, onDone }: { item: SlipItem; onDone: () => void }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const present = useIsPresent()
  const { badge, names, crewName } = item

  useEffect(() => {
    buzz([12, 40, 12])
  }, [])

  // as on the combo banner: a takeover cutting in stops the clock
  useEffect(() => {
    if (!present) return
    const id = window.setTimeout(onDone, SHOWN_MS)
    return () => window.clearTimeout(id)
  }, [present, onDone])

  return (
    <motion.div
      className="pointer-events-auto flex max-w-full items-center gap-3 rounded-[20px] border border-gold/18 bg-popover/95 py-2 pr-1.5 pl-2.5 shadow-[0_20px_40px_-16px_rgb(0_0_0/0.85)] backdrop-blur"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -48, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduce ? 0 : -24, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
      transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 380, damping: 26 }}
    >
      <BadgeArt tier={badge.tier} art={badge.art} size={44} />
      <div className="min-w-0 py-0.5">
        <p className="kicker text-[10px]">
          {crewName ? t('celebrate.crewUnlocked', { crew: crewName }) : t('celebrate.unlocked')}
        </p>
        <p className="display mt-1 line-clamp-2 text-[20px] text-foam">
          {names && (
            <>
              {names}
              <span className="text-foam/35">{' · '}</span>
            </>
          )}
          <span className={ACCENT[badge.art.accent ?? 'gold'] ?? ACCENT.gold}>{badge.title}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onDone}
        aria-label={t('celebrate.dismiss')}
        className="grid size-10 shrink-0 place-items-center rounded-full text-foam/45 transition-colors hover:text-foam"
      >
        <X className="size-4" strokeWidth={2.4} />
      </button>
    </motion.div>
  )
}
