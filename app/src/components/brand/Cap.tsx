import { useId } from 'react'
import { cn } from '@/lib/utils'

// Everyone is a bottle cap: a crimped disc in their colour with their initials
// pressed into it. The crimp is computed once — 21 teeth around a 100-unit circle.
const TEETH = 21
const CRIMP = (() => {
  const points: string[] = []
  for (let i = 0; i < TEETH * 2; i++) {
    const a = (Math.PI * i) / TEETH - Math.PI / 2
    const r = i % 2 === 0 ? 49 : 44.5
    points.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
})()

const SIZES = {
  xs: 'size-6 text-[9px]',
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-[13px]',
  lg: 'size-14 text-[17px]',
  xl: 'size-24 text-[28px]',
} as const

type Props = {
  initials: string
  color: string
  size?: keyof typeof SIZES
  /** a gold ring: selected, or "this is you" */
  ring?: boolean
  dim?: boolean
  className?: string
  title?: string
}

export function Cap({ initials, color, size = 'md', ring, dim, className, title }: Props) {
  const id = useId()
  return (
    <span
      title={title}
      className={cn(
        'relative inline-grid shrink-0 place-items-center select-none transition-[opacity,filter] duration-300',
        SIZES[size],
        dim && 'opacity-35 grayscale-[0.6]',
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full drop-shadow-[0_3px_4px_rgb(0_0_0/0.45)]" aria-hidden>
        <defs>
          <radialGradient id={`${id}-face`} cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor={`color-mix(in oklab, ${color}, white 32%)`} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={`color-mix(in oklab, ${color}, black 30%)`} />
          </radialGradient>
        </defs>
        {/* selected: the cap steps back inside a gold ring with a dark gap, so it reads on gold caps too */}
        {ring && <circle cx="50" cy="50" r="48" fill="none" stroke="var(--gold)" strokeWidth="4" />}
        <g transform={ring ? 'translate(50 50) scale(0.8) translate(-50 -50)' : undefined}>
          {ring && <circle cx="50" cy="50" r="52" fill="var(--cellar)" />}
          <path d={CRIMP} fill={`url(#${id}-face)`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          {/* the pressed rim just inside the crimp */}
          <circle cx="50" cy="50" r="37" fill="none" stroke="rgb(0 0 0 / 0.18)" strokeWidth="2" />
          <circle cx="50" cy="50" r="35.5" fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="1.2" />
        </g>
      </svg>
      <span className={cn('relative font-bold tracking-tight text-stout/90 [text-shadow:0_1px_0_rgb(255_255_255/0.25)]', ring && 'scale-[0.84]')}>
        {initials}
      </span>
    </span>
  )
}

const OVERLAP = { xs: '-ml-1.5', sm: '-ml-2.5', md: '-ml-3', lg: '-ml-4', xl: '-ml-6' } as const

/** Overlapping caps for "who was there". */
export function CapStack({
  people,
  size = 'sm',
  max = 5,
}: {
  people: { initials: string; avatar_color: string; display_name?: string }[]
  size?: keyof typeof SIZES
  max?: number
}) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <Cap
          key={i}
          initials={p.initials}
          color={p.avatar_color}
          size={size}
          title={p.display_name}
          className={cn(i > 0 && OVERLAP[size])}
        />
      ))}
      {extra > 0 && (
        <span className="-ml-1.5 grid size-8 place-items-center rounded-full bg-oak text-[11px] font-bold text-foam/70 ring-2 ring-cask">
          +{extra}
        </span>
      )}
    </span>
  )
}

export const CAP_COLOURS = ['#F5B23A', '#FF5B35', '#8BD450', '#E08D2C', '#F28FAD', '#5BC0EB', '#D9A05B', '#B9A7FF'] as const
