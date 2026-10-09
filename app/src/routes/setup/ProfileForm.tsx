import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CAP_COLOURS, Cap } from '@/components/brand/Cap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSaveProfile, type Profile } from '@/data/queries'

/** "Anna Lind" → "AL", "Björn" → "BJ" */
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? '').slice(0, 2).toUpperCase()
}

export function ProfileForm({
  profile,
  suggestedName,
  onDone,
}: {
  profile?: Profile | null
  suggestedName?: string
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveProfile()
  const [name, setName] = useState(profile?.display_name ?? suggestedName ?? '')
  const [initials, setInitials] = useState(profile?.initials ?? '')
  const [initialsTouched, setInitialsTouched] = useState(!!profile)
  const [colour, setColour] = useState<string>(
    () => profile?.avatar_color ?? CAP_COLOURS[Math.floor(Math.random() * CAP_COLOURS.length)],
  )

  const shownInitials = (initialsTouched ? initials : initialsFor(name)) || '?'

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      { display_name: name.trim(), initials: shownInitials, avatar_color: colour, isNew: !profile },
      { onSuccess: () => onDone?.(), onError: () => toast.error(t('common.somethingWrong')) },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid place-items-center py-2">
        <motion.div key={colour + shownInitials} initial={{ scale: 0.85, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>
          <Cap initials={shownInitials} color={colour} size="xl" />
        </motion.div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name" className="kicker">
          {t('profile.name')}
        </Label>
        <Input
          id="name"
          required
          maxLength={40}
          autoComplete="nickname"
          placeholder={t('profile.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="initials" className="kicker">
            {t('profile.initials')}
          </Label>
          <Input
            id="initials"
            maxLength={3}
            value={shownInitials === '?' ? '' : shownInitials}
            onChange={(e) => {
              setInitialsTouched(true)
              setInitials(e.target.value.toUpperCase().replace(/[^\p{L}\p{N}]/gu, ''))
            }}
            className="font-display text-xl tracking-[0.2em] uppercase"
          />
        </div>
      </div>

      <div className="grid gap-3">
        <span className="kicker">{t('profile.colour')}</span>
        <div className="flex flex-wrap gap-2.5">
          {CAP_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={colour === c}
              onClick={() => setColour(c)}
              className="rounded-full transition-transform active:scale-90"
            >
              <Cap initials="" color={c} size="md" ring={colour === c} dim={colour !== c} />
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" disabled={save.isPending || !name.trim()} className="w-full">
        {profile ? t('common.save') : t('profile.submit')}
      </Button>
    </form>
  )
}
