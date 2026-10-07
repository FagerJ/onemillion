import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PintGauge } from '@/components/brand/PintGauge'

/** While anything is loading: a pint being poured. */
export function Splash() {
  const { t } = useTranslation()
  const [p, setP] = useState(0)
  useEffect(() => {
    const id = window.setTimeout(() => setP(0.82), 60)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-5">
        <PintGauge progress={p} quiet className="h-36" />
        <p className="kicker">{t('common.loading')}</p>
      </div>
    </div>
  )
}
