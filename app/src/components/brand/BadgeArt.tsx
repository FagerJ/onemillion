import {
  Calendar,
  Car,
  Flame,
  Globe,
  HandPlatter,
  House,
  KeyRound,
  Layers,
  Megaphone,
  Moon,
  Star,
  Ticket,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { useId } from 'react'
import type { BadgeArt as Art, BadgeTier } from '@/data/queries'
import { cn } from '@/lib/utils'
import { CRIMP } from './Cap'

// Badges in the design language (D42): a person's badge is a bottle cap, a crew's is a
// beer mat (ACHIEVEMENT-TIERS). The catalogue says how to draw each one (`art`), so a new
// badge needs no release; an unknown glyph falls back to a star.

const GLYPHS = {
  flame: Flame,
  zap: Zap,
  globe: Globe,
  megaphone: Megaphone,
  star: Star,
  calendar: Calendar,
  tray: HandPlatter,
  car: Car,
  key: KeyRound,
  moon: Moon,
  ticket: Ticket,
  users: Users,
  house: House,
  layers: Layers,
  trophy: Trophy,
} as const

const ACCENT = { gold: 'var(--gold)', fire: 'var(--fire)', hop: 'var(--hop)' } as const

// Rarity is the metal.
const METAL = {
  tin: ['color-mix(in oklab, var(--foam), var(--oak) 40%)', 'color-mix(in oklab, var(--foam), var(--oak) 72%)'],
  brass: ['#ffd27a', 'var(--gold-deep)'],
  gold: ['#ffe3a3', 'var(--gold)'],
  foil: ['#ffe3a3', 'var(--gold)'],
} as const

type Props = {
  art: Art
  /** not held: dimmed and grey */
  locked?: boolean
  /** not held and secret: a question mark instead of the art */
  secret?: boolean
  size?: number
  className?: string
}

function Mark({ art, color, size }: { art: Art; color: string; size: number }) {
  if (art.text) {
    return (
      <span className="font-display leading-none tabular" style={{ color, fontSize: size * 0.3 }}>
        {art.text}
      </span>
    )
  }
  const Icon = GLYPHS[art.glyph as keyof typeof GLYPHS] ?? Star
  return <Icon aria-hidden style={{ color, width: size * 0.38, height: size * 0.38 }} strokeWidth={2.4} />
}

/** A person's badge: a bottle cap with a metal crimp, a dark enamel face and the mark in its accent. */
export function CapBadge({ art, locked, secret, size = 60, className }: Props) {
  const id = useId()
  const metal = METAL[art.metal ?? 'tin'] ?? METAL.tin
  const accent = locked ? 'rgb(251 244 228 / 0.2)' : ACCENT[art.accent ?? 'gold'] ?? ACCENT.gold
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full drop-shadow-[0_3px_4px_rgb(0_0_0/0.45)]" aria-hidden>
        <defs>
          <radialGradient id={`${id}-metal`} cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor={locked ? 'var(--oak)' : metal[0]} />
            <stop offset="100%" stopColor={locked ? 'var(--oak)' : metal[1]} />
          </radialGradient>
          <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--gold)" />
            <stop offset="0.5" stopColor="var(--fire)" />
            <stop offset="0.75" stopColor="var(--hop)" />
            <stop offset="1" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        <path
          d={CRIMP}
          fill={`url(#${id}-metal)`}
          stroke={locked ? 'rgb(251 244 228 / 0.08)' : 'rgb(0 0 0 / 0.25)'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {art.metal === 'foil' && !locked && (
          <path d={CRIMP} fill={`url(#${id}-foil)`} opacity="0.35" style={{ mixBlendMode: 'overlay' }} />
        )}
        <circle cx="50" cy="50" r="36" fill="var(--stout)" />
        <circle cx="50" cy="50" r="36" fill="none" stroke={accent} strokeWidth="2.5" />
      </svg>
      <span className="relative grid place-items-center">
        {secret ? (
          <span className="font-display leading-none text-foam/30" style={{ fontSize: size * 0.34 }}>
            ?
          </span>
        ) : (
          <Mark art={art} color={accent} size={size} />
        )}
      </span>
    </span>
  )
}

const FINISH = {
  print: { card: 'var(--cask)', ink: 'var(--gold)' },
  emboss: { card: 'var(--oak)', ink: 'var(--foam)' },
  foil: { card: 'var(--gold)', ink: 'var(--stout)' }, // drawn as a gold gradient below
  framed: { card: 'var(--cask)', ink: 'var(--gold)' },
} as const

/** A crew's badge: a beer mat dropped slightly askew, with a printed border. */
export function MatBadge({ art, locked, secret, size = 60, className }: Props) {
  const id = useId()
  const finish = (art.finish && FINISH[art.finish]) || FINISH.print
  const card = locked ? 'var(--cellar)' : art.finish === 'foil' ? `url(#${id}-foil)` : finish.card
  const ink = locked ? 'rgb(251 244 228 / 0.18)' : finish.ink
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-[4deg] drop-shadow-[0_4px_5px_rgb(0_0_0/0.5)]" aria-hidden>
        <defs>
          <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--gold)" />
            <stop offset="1" stopColor="var(--gold-deep)" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="88" height="88" rx="14" fill={card} />
        {locked ? (
          <rect x="6" y="6" width="88" height="88" rx="14" fill="none" stroke="rgb(251 244 228 / 0.12)" strokeWidth="2" strokeDasharray="5 4" />
        ) : (
          <>
            {art.finish === 'emboss' && (
              <>
                <rect x="6" y="6" width="88" height="88" rx="14" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" />
                <path d="M20 94 H80 Q94 94 94 80 V20" fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="3" />
              </>
            )}
            {art.finish !== 'emboss' && art.finish !== 'foil' && (
              <rect x="13" y="13" width="74" height="74" rx="9" fill="none" stroke="var(--gold)" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="4 3" />
            )}
            {art.finish === 'framed' && (
              <>
                <rect x="6" y="6" width="88" height="88" rx="14" fill="none" stroke="var(--gold)" strokeWidth="4" />
                <path d="M10 10 L46 10 L10 46 Z" fill="rgb(255 255 255 / 0.07)" />
              </>
            )}
          </>
        )}
      </svg>
      <span className="relative grid -rotate-[4deg] place-items-center">
        {secret ? (
          <span className="font-display leading-none text-foam/30" style={{ fontSize: size * 0.34 }}>
            ?
          </span>
        ) : (
          <Mark art={art} color={ink} size={size} />
        )}
      </span>
    </span>
  )
}

export function BadgeArt({ tier, ...props }: Props & { tier: BadgeTier }) {
  return tier === 'crew' ? <MatBadge {...props} /> : <CapBadge {...props} />
}
