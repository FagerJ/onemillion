import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { fmt } from '@/lib/format'

/** A number that counts to its new value instead of jumping. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => fmt(Math.round(v)))
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [mv, value])
  return <motion.span className={className}>{text}</motion.span>
}
