import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PintGauge } from '@/components/brand/PintGauge'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/lib/pwa'

/** While anything is loading: a pint being poured. With no signal it says so and waits
 *  (D51); `onRetry` adds a button for when the asking failed rather than stalled. */
export function Splash({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [p, setP] = useState(0)
  const [slow, setSlow] = useState(false) // lie-fi: on Wi-Fi, but nothing comes back
  useEffect(() => {
    const pour = window.setTimeout(() => setP(0.82), 60)
    return () => window.clearTimeout(pour)
  }, [])
  // Counted from the last time the signal came back, so a reconnect clears "No signal".
  useEffect(() => {
    if (!online) return
    const wait = window.setTimeout(() => setSlow(true), 8000)
    return () => {
      window.clearTimeout(wait)
      setSlow(false)
    }
  }, [online])
  const label = !online || slow ? t('pwa.offline') : onRetry ? t('pwa.cantReach') : t('common.loading')
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <PintGauge progress={p} quiet className="h-36" />
        <p className="kicker" role="status">
          {label}
        </p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('common.tryAgain')}
          </Button>
        )}
      </div>
    </div>
  )
}
