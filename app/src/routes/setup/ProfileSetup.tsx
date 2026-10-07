import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Splash } from '@/components/layout/Splash'
import { useProfile } from '@/data/queries'
import { ProfileForm } from './ProfileForm'

export function ProfileSetup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <Splash />
  if (profile) return <Navigate to="/" replace />

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] px-5 pt-[max(env(safe-area-inset-top),28px)] pb-10">
      <p className="kicker">{t('profile.step')}</p>
      <h1 className="display mt-2 text-[56px] text-foam">{t('profile.title')}</h1>
      <div className="mat mt-6 p-5">
        <ProfileForm onDone={() => navigate('/setup/party', { replace: true })} />
      </div>
    </div>
  )
}
