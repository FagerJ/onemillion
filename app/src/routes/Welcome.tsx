import { MailCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FlapNumber } from '@/components/brand/Flaps'
import { PintGauge } from '@/components/brand/PintGauge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthSettings } from '@/data/queries'
import { linkError, supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Mode = 'signIn' | 'signUp'

/** What we just emailed, so the inbox panel can say so — and send it again. */
type Sent = 'link' | 'confirm' | 'reset'

// Supabase's error codes we can say something useful about. Anything else gets the
// general "that didn't work".
const ERRORS = {
  invalid_credentials: 'welcome.wrongPassword',
  email_not_confirmed: 'welcome.unconfirmed',
  user_already_exists: 'welcome.exists',
  email_exists: 'welcome.exists',
  over_email_send_rate_limit: 'welcome.rateLimited',
  over_request_rate_limit: 'welcome.rateLimited',
  signup_disabled: 'welcome.signupClosed',
  email_address_invalid: 'welcome.badEmail',
  weak_password: 'welcome.passwordHint',
} as const

function errorKey(code: string | undefined) {
  return code && code in ERRORS ? ERRORS[code as keyof typeof ERRORS] : 'welcome.failed'
}

function throwIf({ error }: { error: unknown }) {
  if (error) throw error
}

export function Welcome() {
  const { t } = useTranslation()
  const settings = useAuthSettings()
  const emailInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('signIn')
  const [magic, setMagic] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const [resent, setResent] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    linkError ? t(linkError === 'otp_expired' ? 'welcome.linkExpired' : 'welcome.linkFailed') : null,
  )
  const [target, setTarget] = useState(0)
  const [pour, setPour] = useState(0)

  useEffect(() => {
    const a = window.setTimeout(() => setPour(0.78), 250)
    const b = window.setTimeout(() => setTarget(1_000_000), 500)
    return () => [a, b].forEach(window.clearTimeout)
  }, [])

  // Every link comes back to wherever it was asked for: the live site, a preview
  // deployment, or this PC. Supabase only honours addresses on its redirect list.
  const origin = window.location.origin

  function send(kind: Sent) {
    switch (kind) {
      case 'link':
        return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin } })
      case 'confirm':
        return supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: origin } })
      case 'reset':
        return supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/new-password` })
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setUnconfirmed(false)
    try {
      await action()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'user_already_exists' || code === 'email_exists') setMode('signIn')
      setUnconfirmed(code === 'email_not_confirmed')
      setError(t(errorKey(code)))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      if (magic) {
        throwIf(await send('link'))
        setSent('link')
      } else if (mode === 'signIn') {
        throwIf(await supabase.auth.signInWithPassword({ email, password }))
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: origin } })
        if (error) throw error
        if (data.session) return // no confirmation needed: the gates take it from here
        // An address that already has an account is refused outright, or — where
        // Supabase hides which emails exist — comes back as a user with no identities
        // and nothing sent. Either way, say so rather than "check your inbox".
        if (data.user?.identities?.length === 0) {
          throw Object.assign(new Error('exists'), { code: 'user_already_exists' })
        }
        setSent('confirm')
      }
    })
  }

  function forgot() {
    if (!emailInput.current?.checkValidity()) {
      setError(t('welcome.needEmail'))
      emailInput.current?.focus()
      return
    }
    void run(async () => {
      throwIf(await send('reset'))
      setSent('reset')
    })
  }

  function resendConfirmation() {
    void run(async () => {
      throwIf(await send('confirm'))
      setSent('confirm')
    })
  }

  function sendAgain() {
    if (!sent) return
    void run(async () => {
      throwIf(await send(sent))
      setResent(true)
    })
  }

  function google() {
    void run(async () => {
      throwIf(await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin } }))
    })
  }

  function startOver() {
    setSent(null)
    setResent(false)
    setError(null)
  }

  const mailpit = `${window.location.protocol}//${window.location.hostname}:54324`
  const sentText = { link: 'welcome.sentLink', confirm: 'welcome.sentConfirm', reset: 'welcome.sentReset' } as const

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
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-hop/15 text-hop">
              <MailCheck className="size-7" />
            </span>
            <h2 className="display text-[30px] text-foam">{t('welcome.sentTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-pretty text-foam/75">{t(sentText[sent], { email })}</p>
            {error ? (
              <p role="alert" className="rounded-xl bg-fire/10 px-3 py-2 text-[14px] text-fire">
                {error}
              </p>
            ) : (
              resent && <p className="text-[14px] text-hop">{t('welcome.sentAgain')}</p>
            )}
            <Button variant="secondary" className="mt-2" disabled={busy || resent} onClick={sendAgain}>
              {t('welcome.sendAgain')}
            </Button>
            <button
              type="button"
              onClick={startOver}
              className="text-[14px] font-medium text-foam/55 underline-offset-4 hover:text-gold hover:underline"
            >
              {t('welcome.otherEmail')}
            </button>
            {import.meta.env.DEV && (
              <a href={mailpit} target="_blank" rel="noreferrer" className="text-sm text-gold underline underline-offset-4">
                {t('welcome.devMailpit')}
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {settings.data?.external.google && (
              <>
                <GoogleButton onClick={google} disabled={busy} />
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-foam/10" />
                  <span className="kicker">{t('welcome.or')}</span>
                  <span className="h-px flex-1 bg-foam/10" />
                </div>
              </>
            )}

            {!magic && (
              <ModeSwitch
                mode={mode}
                onChange={(m) => {
                  setMode(m)
                  setError(null)
                  setUnconfirmed(false)
                }}
              />
            )}

            <div className="grid gap-2">
              <Label htmlFor="email" className="kicker">
                {t('welcome.email')}
              </Label>
              <Input
                ref={emailInput}
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
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="password" className="kicker">
                    {t('welcome.password')}
                  </Label>
                  {mode === 'signIn' && (
                    <button
                      type="button"
                      onClick={forgot}
                      disabled={busy}
                      className="text-[13px] font-medium text-foam/55 underline-offset-4 hover:text-gold hover:underline"
                    >
                      {t('welcome.forgot')}
                    </button>
                  )}
                </div>
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
              <div role="alert" className="rounded-xl bg-fire/10 px-3 py-2 text-[14px] text-fire">
                <p>{error}</p>
                {unconfirmed && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={busy}
                    className="mt-1 font-semibold underline underline-offset-4"
                  >
                    {t('welcome.resendConfirm')}
                  </button>
                )}
              </div>
            )}

            <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
              {magic ? t('welcome.sendLink') : mode === 'signIn' ? t('welcome.submitSignIn') : t('welcome.submitSignUp')}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMagic((m) => !m)
                setError(null)
                setUnconfirmed(false)
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

// Google's own dark button — their colours and their "G" — so it reads as theirs, not
// ours. The gold stays for our own actions.
function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="w-full border border-[#8e918f] bg-[#131314] text-[#e3e3e3] hover:bg-[#1f1f20]"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      {t('welcome.google')}
    </Button>
  )
}
