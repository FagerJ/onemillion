import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CountUp } from '@/components/brand/CountUp'
import { PintGauge } from '@/components/brand/PintGauge'
import { fmt } from '@/lib/format'
import { LADDER, rungFor } from '@/lib/milestones'
import { cn } from '@/lib/utils'

/** The party's total, the pint filling toward the next rung, and the ladder around it. */
export function PartyHero({ total }: { total: number }) {
  const { t } = useTranslation()
  const rung = rungFor(total)
  const i = LADDER.indexOf(rung.next as (typeof LADDER)[number])
  const after = LADDER[i + 1]

  return (
    <section className="mat relative overflow-hidden px-4 pt-5 pb-4">
      {/* lamp light behind the glass */}
      <div className="pointer-events-none absolute -top-16 -left-10 size-64 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative grid grid-cols-[auto_1fr] items-end gap-4">
        <PintGauge
          progress={rung.progress}
          className="h-[218px]"
          label={`${fmt(total)} / ${fmt(rung.next)}`}
        />
        <div className="min-w-0 pb-2">
          <CountUp value={total} className="display block text-[clamp(56px,17vw,76px)] text-foam tabular" />
          <p className="kicker mt-1.5">{t('home.asAParty')}</p>

          <div className="mt-5 border-t border-foam/8 pt-4">
            <p className="kicker text-gold/70">{t('home.nextRung')}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="display text-[34px] text-gold">{fmt(rung.next)}</span>
              <span className="text-[13px] font-semibold text-foam/55">{t('home.toGo', { count: rung.toGo })}</span>
            </div>
          </div>

          <ol className="mt-3 flex items-center gap-1.5">
            {rung.previous > 0 && (
              <li className="flex items-center gap-1 rounded-full bg-hop/12 px-2 py-1 text-[11px] font-bold text-hop">
                <Check className="size-3" strokeWidth={3.5} />
                {fmt(rung.previous)}
              </li>
            )}
            <li className="rounded-full bg-gold/16 px-2 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/40">
              {fmt(rung.next)}
            </li>
            {after && (
              <li className={cn('rounded-full bg-foam/6 px-2 py-1 text-[11px] font-bold text-foam/35')}>{fmt(after)}</li>
            )}
          </ol>
        </div>
      </div>
    </section>
  )
}
