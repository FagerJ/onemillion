import { MailCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FlapNumber } from '@/components/brand/Flaps'
import { PintGauge } from '@/components/brand/PintGauge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Mode = 'signIn' | 'signUp'

export function Welcome() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('signIn')
  const [magic, setMagic] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState(0)
  const [pour, setPour] = useState(0)

  useEffect(() => {
    const a = window.setTimeout(() => setPour(0.78), 250)
    const b = window.setTimeout(() => setTarget(1_000_000), 500)
    return () => [a, b].forEach(window.clearTimeout)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const redirect = window.location.origin
    try {
      if (magic) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        if (error) throw error
        setSent(true)
      } else if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
        if (error) throw error
      }
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === 'weak_password' ? t('welcome.passwordHint') : t('welcome.failed'))
    } finally {
      setBusy(false)
    }
  }

  const mailpit = `${window.location.protocol}//${window.location.hostname}:54324`

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-[max(env(safe-area-inset-top),28px)] pb-10">
      <section className="grid grid-cols-[1fr_auto] items-end gap-2">
        <motion.h1
          className="display"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="block text-[clamp(52px,16vw,68px)] text-foam">{t('welcome.one')}</span>
          <span className="block text-[clamp(52px,16vw,68px)] text-gold [text-shadow:0_0_42px_rgb(245_178_58/0.35)]">
            {t('welcome.million')}
          </span>
          <span className="block text-[clamp(52px,16vw,68px)] text-foam">{t('welcome.beers')}</span>
        </motion.h1>
        <PintGauge progress={pour} className="h-[clamp(150px,46vw,200px)] -rotate-[4deg]" label="" />
      </section>

      <motion.div
        className="mat mt-7 flex items-center justify-between gap-3 px-4 py-3.5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <span className="kicker max-w-[4.5em] leading-tight">{t('welcome.target')}</span>
        <FlapNumber value={target} className="text-[clamp(22px,7vw,30px)]" />
      </motion.div>

      <p className="mt-5 text-[17px] leading-relaxed text-pretty text-foam/65">{t('welcome.tagline')}</p>

      <motion.div
        className="mat mt-7 p-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-hop/15 text-hop">
              <MailCheck className="size-7" />
            </span>
            <p className="text-[15px] text-foam/80">{t('welcome.linkSent')}</p>
            {import.meta.env.DEV && (
              <a href={mailpit} target="_blank" rel="noreferrer" className="text-sm text-gold underline underline-offset-4">
                {t('welcome.devMailpit')}
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {!magic && <ModeSwitch mode={mode} onChange={setMode} />}

            <div className="grid gap-2">
              <Label htmlFor="email" className="kicker">
                {t('welcome.email')}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('welcome.emailPlaceholder')}
              />
            </div>

            {!magic && (
              <div className="grid gap-2">
                <Label htmlFor="password" className="kicker">
                  {t('welcome.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'signUp' && <p className="text-[13px] text-foam/40">{t('welcome.passwordHint')}</p>}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-fire/10 px-3 py-2 text-[14px] text-fire">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
              {magic ? t('welcome.sendLink') : mode === 'signIn' ? t('welcome.submitSignIn') : t('welcome.submitSignUp')}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMagic((m) => !m)
                setError(null)
              }}
              className="text-[14px] font-medium text-foam/55 underline-offset-4 hover:text-gold hover:underline"
            >
              {magic ? t('welcome.usePassword') : t('welcome.useMagicLink')}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 rounded-full bg-cellar/80 p-1 shadow-[inset_0_2px_6px_rgb(0_0_0/0.5)]">
      {(['signIn', 'signUp'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'relative h-10 rounded-full text-[14px] font-semibold transition-colors',
            mode === m ? 'text-stout' : 'text-foam/55 hover:text-foam/80',
          )}
        >
          {mode === m && (
            <motion.span
              layoutId="auth-mode"
              className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,#ffc95f,#f5b23a)]"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative">{t(m === 'signIn' ? 'welcome.signIn' : 'welcome.signUp')}</span>
        </button>
      ))}
    </div>
  )
}
