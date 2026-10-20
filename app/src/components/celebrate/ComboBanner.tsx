import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FlapWord } from '@/components/brand/Flaps'
import type { Badge } from '@/data/queries'
import { buzz } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/** A rung the night reached, and who it was a first for ("Anna and Björn"), already named. */
export type ComboItem = { id: string; kind: 'combo'; badge: Badge; firstTimers: string | null }

const SHOWN_MS = 5200

// A flap is 1.1em wide with a 0.12em gap, and the title fills the mat (448px at most, less
// its padding) up to 24px a tile: BOOMSHAKALAKA's 13 tiles come to about 19px on a 375px
// phone. A longer title only gets smaller tiles.
const flapSize = (n: number) =>
  `clamp(10px, calc((min(100vw - 32px, 448px) - 40px) / ${(1.22 * n - 0.12).toFixed(2)}), 24px)`

/** G4: the night's beer mat set alight, the rung on gold flaps. A tap waves it off. */
export function ComboBanner({ item, onDone }: { item: ComboItem; onDone: () => void }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const present = useIsPresent()
  const { badge, firstTimers } = item

  useEffect(() => {
    buzz([40, 60, 40, 60, 120])
  }, [])

  // The clock stops once it starts to leave: a takeover that cuts in brings it back after,
  // with its full time.
  useEffect(() => {
    if (!present) return
    const id = window.setTimeout(onDone, SHOWN_MS)
    return () => window.clearTimeout(id)
  }, [present, onDone])

  return (
    <motion.div
      className={cn(
        'pointer-events-auto relative w-full max-w-[448px] rounded-[24px] border border-fire/40 px-5 pt-4 pb-5 text-center',
        'bg-[linear-gradient(135deg,rgb(255_91_53/0.32),var(--cask)_60%)]',
        'shadow-[0_24px_48px_-12px_rgb(255_91_53/0.55),inset_0_1px_0_rgb(251_244_228/0.06)]',
      )}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -140 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -60, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 22 }}
    >
      {/* ● COMBO, cut from the same cloth as the LIVE bug */}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-fire/14 py-1 pr-2.5 pl-2 ring-1 ring-fire/35">
        <span className="relative grid size-2 place-items-center">
          <span className="absolute size-2 animate-live rounded-full bg-fire" />
          {!reduce && <span className="absolute size-3.5 animate-ping rounded-full bg-fire/30" />}
        </span>
        <span className="font-display text-[13px] leading-none tracking-[0.14em] text-fire uppercase">
          {t('celebrate.combo')}
        </span>
      </span>

      <div className="relative mt-3 flex justify-center">
        {!reduce && <Sparks />}
        <span style={{ fontSize: flapSize(badge.title.length) }}>
          <FlapWord word={badge.title} className="uppercase" />
        </span>
      </div>

      {badge.flavor && <p className="display mt-3 text-[22px] text-foam">{badge.flavor}</p>}
      <p className="mt-2 text-[13px] font-semibold text-foam/60">{t('celebrate.tonight', { count: badge.target })}</p>
      {firstTimers && (
        <p className="mt-1 text-[12px] font-semibold tracking-[0.12em] text-gold/80 uppercase">
          {t('celebrate.firstTime', { names: firstTimers })}
        </p>
      )}

      {/* the whole mat is the tap target; the words above are what gets read out */}
      <button
        type="button"
        onClick={onDone}
        aria-label={t('celebrate.dismiss')}
        className="absolute inset-0 rounded-[24px]"
      />
    </motion.div>
  )
}

/** The + button's spray, as a full burst of fire and gold from behind the flaps. */
function Sparks() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {Array.from({ length: 9 }, (_, i) => {
        const angle = ((-90 + i * 40) * Math.PI) / 180
        const dist = 90 + (i % 3) * 22
        return (
          <motion.span
            key={i}
            className={cn(
              'absolute -mt-1 -ml-1 size-2 rounded-full',
              i % 2 ? 'bg-gold shadow-[0_0_10px_var(--gold)]' : 'bg-fire shadow-[0_0_10px_var(--fire)]',
            )}
            initial={{ x: 0, y: 0, opacity: 0.95, scale: 0.5 }}
            // flattened: the mat is wider than it is tall
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.55 - 8, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0.8, 0.3, 1] }}
          />
        )
      })}
    </span>
  )
}
