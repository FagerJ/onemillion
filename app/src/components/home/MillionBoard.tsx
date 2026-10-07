import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { FlapNumber } from '@/components/brand/Flaps'
import { fmt, percent } from '@/lib/format'
import { MILLION } from '@/lib/milestones'

/** The global counter (D1): every shared beer, everywhere, against the million. */
export function MillionBoard({ total }: { total: number }) {
  const { t } = useTranslation()
  const share = total / MILLION
  return (
    <section className="mat overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker text-gold/80">{t('home.million')}</p>
          <p className="mt-1 text-[12px] text-foam/40">{t('home.millionSub')}</p>
        </div>
        <span className="font-display text-[20px] leading-none text-gold tabular">{percent(share, share < 0.01 ? 3 : 1)}</span>
      </div>
      <div className="mt-3.5 flex justify-center">
        <FlapNumber value={total} className="text-[clamp(26px,8.6vw,36px)]" />
      </div>
      <div className="mt-4">
        <div className="relative h-[5px] overflow-hidden rounded-full bg-foam/8">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#c6821a,#f5b23a,#ffd27a)] shadow-[0_0_12px_rgb(245_178_58/0.7)]"
            initial={{ width: 0 }}
            animate={{ width: `max(${share * 100}%, 6px)` }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-foam/30 tabular">
          <span>0</span>
          <span>{fmt(MILLION)}</span>
        </div>
      </div>
    </section>
  )
}
