import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Cap } from '@/components/brand/Cap'
import { LiveBadge, useNow } from '@/components/brand/LiveBadge'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeed, useMyParty } from '@/data/queries'
import { duration, fmt, nightLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** C7: every night the party has had, newest first, the live one on top. */
export function Nights() {
  const { t } = useTranslation()
  const { data: mine } = useMyParty()
  const { data: nights, isLoading } = useFeed(mine?.party.id)
  const now = useNow()

  return (
    <div>
      <ScreenHeader kicker={t('feed.kicker')} title={t('feed.title')} />
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-[22px]" />
          ))}
        </div>
      ) : !nights?.length ? (
        <p className="mat px-6 py-14 text-center text-foam/50">{t('feed.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {nights.map((n, i) => {
            const live = n.status === 'open' && new Date(n.closes_at).getTime() > now
            const drinkers = [...n.attendees].sort((a, b) => b.beers - a.beers)
            const card = (
              <motion.article
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'mat p-4',
                  live && 'border-fire/35 bg-[linear-gradient(135deg,rgb(255_91_53/0.14),var(--cask)_55%)]',
                )}
              >
                <header className="flex items-start justify-between gap-3">
                  <div>
                    {live ? (
                      <LiveBadge startedAt={n.started_at} />
                    ) : (
                      <h2 className="display text-[24px] text-foam">{nightLabel(n.started_at)}</h2>
                    )}
                    {!live && n.closed_at && (
                      <p className="mt-1 text-[12px] font-semibold text-foam/40">{duration(n.started_at, n.closed_at)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="display text-[44px] text-gold tabular">{fmt(n.total_beers)}</p>
                    <p className="kicker -mt-0.5 text-[10px]">{t('common.beerWord', { count: n.total_beers })}</p>
                  </div>
                </header>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {drinkers.map((a) => (
                    <li
                      key={a.profile_id}
                      className="flex items-center gap-1.5 rounded-full bg-cellar/70 py-1 pr-2.5 pl-1 ring-1 ring-foam/6"
                    >
                      <Cap initials={a.initials} color={a.avatar_color} size="xs" />
                      <span className="text-[12px] font-semibold text-foam/70">{a.display_name}</span>
                      <span className={cn('font-display text-[14px] leading-none tabular', a.beers ? 'text-gold' : 'text-foam/25')}>
                        {a.beers}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            )
            return (
              <li key={n.session_id}>
                {live ? (
                  <Link to="/night" className="block">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
