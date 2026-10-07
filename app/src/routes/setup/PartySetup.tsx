import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Splash } from '@/components/layout/Splash'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateParty, useJoinParty, useMyParty } from '@/data/queries'

export function PartySetup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: mine, isLoading } = useMyParty()
  const join = useJoinParty()
  const create = useCreateParty()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  if (isLoading) return <Splash />
  if (mine) return <Navigate to="/" replace />

  function onJoin(e: FormEvent) {
    e.preventDefault()
    setJoinError(null)
    join.mutate(code, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (err) => {
        const c = (err as { code?: string }).code
        setJoinError(c === 'P0002' ? t('gate.notFound') : c === '23514' ? t('gate.full') : t('common.somethingWrong'))
      },
    })
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    create.mutate(name.trim(), { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] px-5 pt-[max(env(safe-area-inset-top),28px)] pb-10">
      <p className="kicker">{t('gate.step')}</p>
      <h1 className="display mt-2 text-[56px] text-foam">{t('gate.title')}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-foam/60">{t('gate.subtitle')}</p>

      <motion.form
        onSubmit={onJoin}
        className="mat mt-7 flex flex-col gap-4 p-5"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 className="display text-[26px] text-gold">{t('gate.joinTitle')}</h2>
          <p className="mt-1 text-[14px] text-foam/50">{t('gate.joinHint')}</p>
        </div>
        <Input
          aria-label={t('gate.joinTitle')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="••••••"
          className="h-18 pl-[calc(1rem+0.42em)] text-center font-display text-[36px] tracking-[0.42em] text-gold placeholder:text-foam/15"
        />
        {joinError && (
          <p role="alert" className="rounded-xl bg-fire/10 px-3 py-2 text-[14px] text-fire">
            {joinError}
          </p>
        )}
        <Button type="submit" size="lg" disabled={code.length !== 6 || join.isPending}>
          {t('gate.join')}
        </Button>
      </motion.form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-foam/10" />
        <span className="kicker">{t('gate.or')}</span>
        <span className="h-px flex-1 bg-foam/10" />
      </div>

      <motion.form
        onSubmit={onCreate}
        className="mat flex flex-col gap-4 p-5"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <h2 className="display text-[26px] text-foam">{t('gate.createTitle')}</h2>
        <div className="grid gap-2">
          <Label htmlFor="party-name" className="kicker">
            {t('gate.createName')}
          </Label>
          <Input
            id="party-name"
            maxLength={60}
            value={name}
            placeholder={t('gate.createPlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" size="lg" disabled={!name.trim() || create.isPending}>
          {t('gate.create')}
        </Button>
      </motion.form>
    </div>
  )
}
