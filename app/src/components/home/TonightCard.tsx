import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CapStack } from '@/components/brand/Cap'
import { LiveBadge } from '@/components/brand/LiveBadge'
import { Button } from '@/components/ui/button'
import { useAttendees, useLiveBeers, type Session } from '@/data/queries'
import { fmt } from '@/lib/format'

export function TonightCard({ night }: { night: Session | null | undefined }) {
  const { t } = useTranslation()
  if (!night) {
    return (
      <section className="mat flex items-center justify-between gap-4 p-4">
        <div>
          <h2 className="display text-[24px] text-foam/90">{t('home.noNight')}</h2>
          <p className="mt-1 text-[13px] text-foam/45">{t('home.noNightHint')}</p>
        </div>
        <Button asChild size="sm">
          <Link to="/night">{t('home.kickOff')}</Link>
        </Button>
      </section>
    )
  }
  return <LiveNightCard night={night} />
}

function LiveNightCard({ night }: { night: Session }) {
  const { t } = useTranslation()
  const { data: attendees = [] } = useAttendees(night.id)
  const { data: beers = [] } = useLiveBeers(night.id)
  return (
    <Link
      to="/night"
      className="group relative block overflow-hidden rounded-[22px] border border-fire/30 bg-[linear-gradient(135deg,rgb(255_91_53/0.16),rgb(29_22_13/0.9)_55%)] p-4 shadow-[0_20px_40px_-20px_rgb(255_91_53/0.45)]"
    >
      <div className="flex items-center justify-between">
        <LiveBadge startedAt={night.started_at} />
        <span className="flex items-center gap-1 text-[13px] font-semibold text-foam/70 transition-transform group-hover:translate-x-0.5">
          {t('home.openNight')} <ArrowRight className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="kicker">{t('home.tonight')}</p>
          <p className="display mt-1 text-[52px] text-foam tabular">{fmt(beers.length)}</p>
        </div>
        <CapStack people={attendees.map((a) => a.profile)} max={5} />
      </div>
    </Link>
  )
}
