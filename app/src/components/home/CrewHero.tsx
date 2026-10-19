import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Cap } from '@/components/brand/Cap'
import { CountUp } from '@/components/brand/CountUp'
import { PintGauge } from '@/components/brand/PintGauge'
import { useCrewMilestones, useCrewRungs } from '@/data/queries'
import { fmt } from '@/lib/format'
import { rungFor } from '@/lib/milestones'
import { cn } from '@/lib/utils'

/** The crew's total, the pint filling toward the next rung, and the ladder around it.
 *  The ladder comes from the database (D60); until it has loaded the pint waits empty. */
export function CrewHero({ total, crewId }: { total: number; crewId: string }) {
  const { t } = useTranslation()
  const { data: rungs = [] } = useCrewRungs()
  const { data: events = [] } = useCrewMilestones(crewId)
  const rung = rungFor(total, rungs)
  const after = rung ? rungs[rungs.indexOf(rung.next) + 1] : undefined
  const last = events.find((e) => e.scope === 'crew')

  return (
    <section className="mat relative overflow-hidden px-4 pt-5 pb-4">
      {/* lamp light behind the glass */}
      <div className="pointer-events-none absolute -top-16 -left-10 size-64 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative grid grid-cols-[auto_1fr] items-end gap-4">
        <PintGauge
          progress={rung?.progress ?? 0}
          className="h-[218px]"
          label={rung ? `${fmt(total)} / ${fmt(rung.next)}` : fmt(total)}
        />
        <div className="min-w-0 pb-2">
          <CountUp value={total} className="display block text-[clamp(56px,17vw,76px)] text-foam tabular" />
          <p className="kicker mt-1.5">{t('home.asACrew')}</p>

          {rung && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* the last rung the crew crossed, and who scored it */}
      {last && (
        <div className="relative mt-3 flex items-center gap-2 border-t border-foam/8 pt-3">
          <span className="kicker text-[10px] text-hop/80">{t('milestones.lastRung')}</span>
          <span className="flex items-center gap-1 font-display text-[16px] leading-none text-hop tabular">
            <Check className="size-3.5" strokeWidth={3.5} />
            {fmt(last.threshold)}
          </span>
          {last.scorer && (
            <span className="ml-auto flex min-w-0 items-center gap-1.5">
              <Cap initials={last.scorer.initials} color={last.scorer.avatar_color} size="xs" />
              <span className="truncate text-[12px] font-semibold text-foam/60">
                {t('milestones.scoredBy', { name: last.scorer.display_name })}
              </span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
