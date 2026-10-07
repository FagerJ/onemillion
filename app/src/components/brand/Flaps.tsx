import { motion } from 'motion/react'
import { fmt } from '@/lib/format'
import { cn } from '@/lib/utils'

// Scoreboard tiles. Each character sits on its own split flap; digits roll on a
// spring when the number changes. Used for the global million and invite codes.

const DIGITS = '0123456789'

function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-grid place-items-center overflow-hidden rounded-[7px]',
        'bg-[linear-gradient(180deg,#2b2116_0%,#1a130b_49%,#120c06_51%,#1d150c_100%)]',
        'shadow-[inset_0_1px_0_rgb(251_244_228/0.08),inset_0_-1px_0_rgb(0_0_0/0.6),0_2px_0_rgb(0_0_0/0.55)]',
        'ring-1 ring-black/70',
        className,
      )}
    >
      {children}
      {/* the split, and the two hinge pins either side of it */}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-px bg-black/75" />
      <span className="pointer-events-none absolute top-1/2 left-0 h-[3px] w-[2px] -translate-y-1/2 rounded-r-full bg-black/80" />
      <span className="pointer-events-none absolute top-1/2 right-0 h-[3px] w-[2px] -translate-y-1/2 rounded-l-full bg-black/80" />
    </span>
  )
}

function RollingDigit({ digit, dim }: { digit: number; dim?: boolean }) {
  return (
    <span className="relative block h-[1em] w-[0.58em] overflow-hidden leading-none">
      <motion.span
        className={cn('absolute inset-x-0 top-0 flex flex-col items-center', dim ? 'text-foam/16' : 'text-foam')}
        initial={false}
        animate={{ y: `${-digit}em` }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        {DIGITS.split('').map((d) => (
          <span key={d} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

/**
 * A number on flaps, European grouping: 0.000.191. `width` pads with leading zeros
 * (dimmed) so the board never changes size as the count grows.
 */
export function FlapNumber({ value, width = 7, className }: { value: number; width?: number; className?: string }) {
  const s = Math.max(0, Math.floor(value)).toString().padStart(width, '0')
  const firstSignificant = s.search(/[1-9]/)
  const cells: React.ReactNode[] = []
  s.split('').forEach((ch, i) => {
    const fromRight = s.length - i
    cells.push(
      <Tile key={`d${i}`} className="h-[1.42em] w-[0.86em]">
        <RollingDigit digit={Number(ch)} dim={firstSignificant === -1 || i < firstSignificant} />
      </Tile>,
    )
    if (fromRight > 1 && (fromRight - 1) % 3 === 0) {
      cells.push(
        <span key={`s${i}`} className="mx-[0.06em] self-end pb-[0.1em] text-gold/45">
          .
        </span>,
      )
    }
  })
  // the reels hold every digit; screen readers get the number once instead
  return (
    <span className={cn('inline-flex font-display leading-none tabular', className)}>
      <span className="sr-only">{fmt(value)}</span>
      {/* not display:contents — some browsers drop aria-hidden from those */}
      <span aria-hidden className="inline-flex items-center gap-[0.08em]">
        {cells}
      </span>
    </span>
  )
}

/** Letters on flaps — the invite code. */
export function FlapWord({ word, className }: { word: string; className?: string }) {
  return (
    <span className={cn('inline-flex gap-[0.12em] font-display leading-none', className)} aria-label={word} role="img">
      {word.split('').map((ch, i) => (
        <Tile key={i} className="h-[1.5em] w-[1.1em] text-gold">
          <motion.span
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 220, damping: 18 }}
          >
            {ch}
          </motion.span>
        </Tile>
      ))}
    </span>
  )
}
