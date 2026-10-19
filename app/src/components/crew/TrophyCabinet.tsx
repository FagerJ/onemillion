import { useTranslation } from 'react-i18next'
import { Cap } from '@/components/brand/Cap'
import { FlapNumber } from '@/components/brand/Flaps'
import { useCrewMilestones } from '@/data/queries'
import { fmt, nightLabel } from '@/lib/format'
import { rungName } from '@/lib/milestones'
import { cn } from '@/lib/utils'

/** Every rung the crew has crossed, newest first, with who scored it (C12). Global rungs
 *  the crew scored sit here too, with a gold ring. */
export function TrophyCabinet({ crewId }: { crewId: string }) {
  const { t } = useTranslation()
  const { data: events = [], isLoading } = useCrewMilestones(crewId)
  if (isLoading) return null

  return (
    <section className="mat p-4">
      <h2 className="display mb-2 text-[24px] text-foam">{t('milestones.cabinet.title')}</h2>
      {events.length === 0 ? (
        <p className="py-2 text-[14px] text-foam/45">{t('milestones.cabinet.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foam/6">
          {events.map((e) => {
            const global = e.scope === 'global'
            return (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <FlapNumber
                  value={e.threshold}
                  width={String(e.threshold).length}
                  className={cn('shrink-0 text-[18px]', global && 'rounded-[9px] ring-2 ring-gold/60 ring-offset-2 ring-offset-cask')}
                />
                <div className="min-w-0 flex-1">
                  {global && <p className="kicker text-[10px] text-gold">{t('milestones.cabinet.global')}</p>}
                  <p className="display truncate text-[18px] text-gold">{rungName(t, e.threshold) ?? fmt(e.threshold)}</p>
                  <p className="truncate text-[12px] text-foam/45">
                    {nightLabel(e.crossed_at)}
                    {e.scorer && ` · ${t('milestones.scoredBy', { name: e.scorer.display_name })}`}
                  </p>
                </div>
                {e.scorer && <Cap initials={e.scorer.initials} color={e.scorer.avatar_color} size="sm" />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
