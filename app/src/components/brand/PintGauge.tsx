import { motion } from 'motion/react'
import { useId, useMemo } from 'react'
import { cn } from '@/lib/utils'

// The milestone gauge: a nonic pint that fills toward the next rung. Everything is
// drawn in a 160×230 box. The liquid group is drawn with its surface at y=0 and slid
// down to the level, inside a clip of the glass's inner wall.
const OUTER =
  'M20 6 L140 6 C145 18 149 30 147 44 L124 216 C123.4 220 121 222 117 222 L43 222 C39 222 36.6 220 36 216 L13 44 C11 30 15 18 20 6 Z'
const INNER = 'M25 11 L135 11 C139 21 142.5 31 141 44 L119.5 208 L40.5 208 L19 44 C17.5 31 21 21 25 11 Z'
const EMPTY = 208
const FULL = 30

// one period of the foam line is 40 wide; two copies of the 160-wide glass let it
// slide left by half its length forever
const WAVE = (() => {
  let d = 'M0 6'
  for (let x = 0; x < 320; x += 40) d += ` Q${x + 10} 1 ${x + 20} 6 T${x + 40} 6`
  return `${d} L320 0 L0 0 Z`
})()

type Props = {
  /** 0–1 */
  progress: number
  className?: string
  label?: string
  /** fewer bubbles and no glow, for small sizes */
  quiet?: boolean
}

export function PintGauge({ progress, className, label, quiet }: Props) {
  const id = useId()
  const p = Math.min(1, Math.max(0, progress))
  const level = EMPTY - p * (EMPTY - FULL)

  const bubbles = useMemo(
    () =>
      Array.from({ length: quiet ? 6 : 14 }, (_, i) => {
        const seed = (i * 9301 + 49297) % 233280
        const r = seed / 233280
        return {
          x: 44 + ((i * 37) % 72) + r * 6,
          r: 0.9 + ((i * 7) % 5) * 0.35,
          duration: 2.6 + ((i * 13) % 9) * 0.32,
          delay: -((i * 17) % 11) * 0.41,
          drift: ((i % 3) - 1) * 3,
        }
      }),
    [quiet],
  )

  return (
    <svg viewBox="0 0 160 236" className={cn('overflow-visible', className)} role="img" aria-label={label}>
      <defs>
        <clipPath id={`${id}-glass`}>
          <path d={INNER} />
        </clipPath>
        <linearGradient id={`${id}-beer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.18" stopColor="#f5b23a" />
          <stop offset="0.7" stopColor="#d48d1e" />
          <stop offset="1" stopColor="#9a5a0b" />
        </linearGradient>
        <linearGradient id={`${id}-round`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.28" stopColor="#000" stopOpacity="0" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={`${id}-foam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#f1e3c2" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f5b23a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#f5b23a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* light pooling on the table */}
      {!quiet && <ellipse cx="80" cy="224" rx="78" ry="14" fill={`url(#${id}-glow)`} opacity={0.4 + p * 0.6} />}

      {/* the glass itself, faintly there even when empty */}
      <path d={OUTER} fill="rgb(251 244 228 / 0.035)" />

      <g clipPath={`url(#${id}-glass)`}>
        <motion.g
          initial={{ y: EMPTY + 24 }}
          animate={{ y: p > 0 ? level : EMPTY + 24 }}
          transition={{ type: 'spring', stiffness: 38, damping: 14, mass: 1.2 }}
        >
          <rect x="0" y="0" width="160" height="240" fill={`url(#${id}-beer)`} />
          <rect x="0" y="0" width="160" height="240" fill={`url(#${id}-round)`} />
          {/* foam head: bumpy top, a slowly moving line where it meets the beer */}
          <rect x="0" y="-11" width="160" height="13" fill={`url(#${id}-foam)`} />
          {[8, 22, 37, 51, 66, 80, 95, 109, 124, 138, 152].map((x, i) => (
            <circle key={x} cx={x} cy={-11 + (i % 3)} r={6 + ((i * 5) % 3)} fill="#fffaf0" />
          ))}
          {/* fill-box: the -50% slide is half the wave's own 320 width, not the viewBox */}
          <g className="animate-wave [--wave-duration:3.4s] [transform-box:fill-box]">
            <path d={WAVE} transform="translate(0 1)" fill="#f1e3c2" />
          </g>
        </motion.g>

        {p > 0 &&
          bubbles.map((b, i) => (
            <circle
              key={i}
              cx={b.x}
              cy={EMPTY - 4}
              r={b.r}
              fill="#fff6dd"
              className="animate-rise [transform-box:fill-box]"
              style={
                {
                  '--rise-height': `${-(EMPTY - level - 14)}px`,
                  '--rise-duration': `${b.duration}s`,
                  '--rise-delay': `${b.delay}s`,
                  '--rise-drift': `${b.drift}px`,
                  opacity: 0,
                } as React.CSSProperties
              }
            />
          ))}
      </g>

      {/* glass: rim line, the nonic bulge, highlights, a thick base */}
      <path d={OUTER} fill="none" stroke="rgb(251 244 228 / 0.32)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 44 C60 49 100 49 141 44" fill="none" stroke="rgb(251 244 228 / 0.12)" strokeWidth="1.5" />
      <path d="M27 18 C24 40 30 120 44 200" fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M131 30 C130 70 126 110 121 150" fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="2" strokeLinecap="round" />
      <path d="M40.5 208 L119.5 208 L117.2 219.5 L42.8 219.5 Z" fill="rgb(251 244 228 / 0.07)" />
    </svg>
  )
}
