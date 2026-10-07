import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { matchMinute } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Re-renders every `ms` so clocks keep running. */
export function useNow(ms = 20_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

/** Broadcast-style LIVE bug with the match clock: ● LIVE 73' */
export function LiveBadge({ startedAt, className }: { startedAt?: string; className?: string }) {
  const { t } = useTranslation()
  const now = useNow()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-fire/14 py-1 pr-2.5 pl-2 ring-1 ring-fire/35',
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span className="absolute size-2 animate-live rounded-full bg-fire" />
        <span className="absolute size-3.5 animate-ping rounded-full bg-fire/30" />
      </span>
      <span className="font-display text-[13px] leading-none tracking-[0.14em] text-fire uppercase">{t('nav.live')}</span>
      {startedAt && (
        <span className="font-display text-[13px] leading-none text-foam/85 tabular">{matchMinute(startedAt, now)}</span>
      )}
    </span>
  )
}
