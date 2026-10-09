import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// Where a "Forgot it?" email lands. The link has already signed you in; this sets the
// password for next time.
export function NewPassword() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      const key =
        error.code === 'same_password'
          ? 'newPassword.same'
          : error.code === 'weak_password'
            ? 'welcome.passwordHint'
            : 'welcome.failed'
      setError(t(key))
      return
    }
    toast.success(t('newPassword.done'))
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] px-5 pt-[max(env(safe-area-inset-top),28px)] pb-10">
      <p className="kicker">{t('newPassword.kicker')}</p>
      <h1 className="display mt-2 text-[56px] text-foam">{t('newPassword.title')}</h1>
      <form onSubmit={submit} className="mat mt-6 flex flex-col gap-4 p-5">
        {/* tells a password manager which account the new password belongs to */}
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <div className="grid gap-2">
          <Label htmlFor="new-password" className="kicker">
            {t('newPassword.label')}
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-[13px] text-foam/40">{t('welcome.passwordHint')}</p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-fire/10 px-3 py-2 text-[14px] text-fire">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {t('newPassword.submit')}
        </Button>
      </form>
    </div>
  )
}
