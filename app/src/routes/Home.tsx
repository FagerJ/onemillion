import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/AuthProvider'
import { Cap } from '@/components/brand/Cap'
import { CountUp } from '@/components/brand/CountUp'
import { LeagueTable } from '@/components/home/LeagueTable'
import { MillionBoard } from '@/components/home/MillionBoard'
import { PartyHero } from '@/components/home/PartyHero'
import { TonightCard } from '@/components/home/TonightCard'
import {
  useGlobalTotal,
  useLeaderboard,
  useMembers,
  useMyParty,
  useOpenNight,
  usePartySummary,
  useProfile,
  useProfileSummary,
} from '@/data/queries'

const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
})

export function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: mine } = useMyParty()
  const party = mine!.party
  const { data: profile } = useProfile()
  const { data: members = [] } = useMembers(party.id)
  const { data: summary } = usePartySummary(party.id)
  const { data: personal } = useProfileSummary(user?.id)
  const { data: global = 0 } = useGlobalTotal()
  const { data: night } = useOpenNight(party.id)
  const { data: board } = useLeaderboard(party.id)

  return (
    <div className="flex flex-col gap-4">
      <motion.header {...rise(0)} className="mb-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">{t('home.members', { count: members.length })}</p>
          <h1 className="display mt-1.5 truncate text-[clamp(40px,12vw,52px)] text-foam">{party.name}</h1>
        </div>
        {profile && (
          <Link to="/me" aria-label={t('nav.me')} className="mb-1 transition-transform active:scale-90">
            <Cap initials={profile.initials} color={profile.avatar_color} size="md" />
          </Link>
        )}
      </motion.header>

      <motion.div {...rise(1)}>
        <MillionBoard total={global} />
      </motion.div>

      <motion.div {...rise(2)}>
        <PartyHero total={summary?.total_beers ?? 0} />
      </motion.div>

      <motion.div {...rise(3)} className="grid grid-cols-3 gap-3">
        <Stat label={t('home.thisWeek')} value={summary?.beers_this_week ?? 0} prefix="+" />
        <Stat label={t('home.streak')} value={summary?.current_streak_weeks ?? 0} suffix={t('home.weeks')} hot />
        <Stat label={t('home.mine')} value={personal?.total_beers ?? 0} />
      </motion.div>

      <motion.div {...rise(4)}>
        <TonightCard night={night} />
      </motion.div>

      {/* mounted once the rows are in, so it can pick its opening tab from them */}
      {board && (
        <motion.div {...rise(5)}>
          <LeagueTable rows={board} meId={user!.id} />
        </motion.div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  prefix,
  suffix,
  hot,
}: {
  label: string
  value: number
  prefix?: string
  suffix?: string
  hot?: boolean
}) {
  return (
    <div className="mat px-3 pt-3.5 pb-3 text-center">
      <p className="flex items-baseline justify-center gap-0.5 font-display text-[28px] leading-none text-foam tabular">
        {prefix && value > 0 && <span className="text-gold/70">{prefix}</span>}
        <CountUp value={value} />
        {suffix && <span className={hot && value > 0 ? 'text-[16px] text-fire' : 'text-[16px] text-foam/40'}>{suffix}</span>}
      </p>
      <p className="kicker mt-2 text-[10px] tracking-[0.16em]">{label}</p>
    </div>
  )
}
