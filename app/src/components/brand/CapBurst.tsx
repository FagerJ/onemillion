import { motion } from 'motion/react'
import { useMemo } from 'react'
import { CAP_COLOURS, CRIMP } from './Cap'

/** A crate's worth of bottle caps flying out from the middle and fading: the confetti of
 *  a milestone takeover. Decorative only; skipped when motion is reduced. */
export function CapBurst({ count }: { count: number }) {
  const caps = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 3) * 0.35
        const d = 140 + ((i * 53) % 120)
        return {
          x: Math.cos(a) * d,
          y: Math.sin(a) * d + 60,
          rotate: 360 + i * 40,
          size: 18 + ((i * 7) % 14),
          color: CAP_COLOURS[i % CAP_COLOURS.length],
          delay: (i % 5) * 0.03,
        }
      }),
    [count],
  )
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center">
      {caps.map((c, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 100 100"
          width={c.size}
          height={c.size}
          className="absolute drop-shadow-[0_3px_4px_rgb(0_0_0/0.5)]"
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
          animate={{ x: c.x, y: c.y, scale: 1, opacity: 0, rotate: c.rotate }}
          transition={{ duration: 1.6, delay: c.delay, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <path d={CRIMP} fill={c.color} stroke="rgb(0 0 0 / 0.25)" strokeWidth="2" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="rgb(0 0 0 / 0.18)" strokeWidth="2" />
        </motion.svg>
      ))}
    </div>
  )
}
