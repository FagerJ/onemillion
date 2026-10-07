import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cap } from '@/components/brand/Cap'
import { fmt } from '@/lib/format'
import { cn } from '@/lib/utils'

type Row = {
  profile_id: string
  display_name: string
  initials: string
  avatar_color: string
  total_beers: number
  beers_this_week: number
  is_current: boolean
}

/** The party leaderboard (C6), laid out like a football league table. */
export function LeagueTable({ rows, meId }: { rows: Row[]; meId: string }) {
  const { t } = useTranslation()
  // open on this week once anyone has drunk in it; before that, all time is the story
  const [tab, setTab] = useState<'week' | 'all'>(() => (rows.some((r) => r.beers_this_week > 0) ? 'week' : 'all'))
  const metric = (r: Row) => (tab === 'week' ? r.beers_this_week : r.total_beers)
  const shown = rows
    .filter((r) => r.is_current || tab === 'all')
    .sort((a, b) => metric(b) - metric(a) || a.display_name.localeCompare(b.display_name))

  return (
    <section className="mat p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display text-[26px] text-foam">{t('home.table')}</h2>
        <div className="grid grid-cols-2 rounded-full bg-cellar/80 p-0.5 text-[11px] font-bold tracking-[0.08em] uppercase">
          {(['week', 'all'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn('relative rounded-full px-3 py-1.5', tab === k ? 'text-stout' : 'text-foam/45')}
            >
              {tab === k && <motion.span layoutId="table-tab" className="absolute inset-0 rounded-full bg-gold" />}
              <span className="relative">{t(k === 'week' ? 'home.tableThisWeek' : 'home.tableAllTime')}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-foam/40">{t('home.tableEmpty')}</p>
      ) : (
        <ol className="flex flex-col">
          {shown.map((r, i) => {
            const me = r.profile_id === meId
            return (
              <motion.li
                key={r.profile_id}
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-2 py-2',
                  me && 'bg-gold/8 ring-1 ring-gold/20',
                  !r.is_current && 'opacity-50',
                )}
              >
                <span
                  className={cn(
                    'w-6 text-center font-display text-[18px] leading-none tabular',
                    i === 0 && metric(r) > 0 ? 'text-gold' : 'text-foam/30',
                  )}
                >
                  {i + 1}
                </span>
                <Cap initials={r.initials} color={r.avatar_color} size="sm" />
                <span className={cn('flex-1 truncate text-[15px] font-semibold', me ? 'text-gold' : 'text-foam/90')}>
                  {me ? `${r.display_name} · ${t('common.you')}` : r.display_name}
                </span>
                <span className={cn('font-display text-[22px] leading-none tabular', metric(r) > 0 ? 'text-foam' : 'text-foam/20')}>
                  {fmt(metric(r))}
                </span>
              </motion.li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
