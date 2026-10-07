import { LogOut, Pencil } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/AuthProvider'
import { Cap } from '@/components/brand/Cap'
import { CountUp } from '@/components/brand/CountUp'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useProfile, useProfileSummary } from '@/data/queries'
import { supabase } from '@/lib/supabase'
import { ProfileForm } from './setup/ProfileForm'

export function Me() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: s } = useProfileSummary(user?.id)
  const [editing, setEditing] = useState(false)
  if (!profile) return null

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center pt-4 text-center">
        <motion.div initial={{ rotate: -120, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}>
          <Cap initials={profile.initials} color={profile.avatar_color} size="xl" />
        </motion.div>
        <h1 className="display mt-4 text-[48px] text-foam">{profile.display_name}</h1>
        <p className="mt-1 text-[13px] text-foam/40">{user?.email}</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Big label={t('me.total')} value={s?.total_beers ?? 0} gold />
        <Big label={t('me.thisWeek')} value={s?.beers_this_week ?? 0} />
        <Big label={t('me.streak')} value={s?.current_streak_weeks ?? 0} unit={t('home.weeks')} hot />
        <Big label={t('me.best')} value={s?.best_streak_weeks ?? 0} unit={t('home.weeks')} />
      </section>

      <div className="mt-2 grid gap-2.5">
        <Drawer open={editing} onOpenChange={setEditing}>
          <DrawerTrigger asChild>
            <Button variant="secondary" size="lg">
              <Pencil /> {t('me.edit')}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="mx-auto max-w-[480px] rounded-t-[28px] border-gold/14 bg-popover px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="display text-[30px] text-foam">{t('profile.editTitle')}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto pb-2">
              <ProfileForm profile={profile} onDone={() => setEditing(false)} />
            </div>
          </DrawerContent>
        </Drawer>
        <Button variant="ghost" size="lg" onClick={() => supabase.auth.signOut()}>
          <LogOut /> {t('me.signOut')}
        </Button>
      </div>
    </div>
  )
}

function Big({ label, value, unit, gold, hot }: { label: string; value: number; unit?: string; gold?: boolean; hot?: boolean }) {
  return (
    <div className="mat px-4 pt-4 pb-3.5">
      <p className="kicker text-[10px]">{label}</p>
      <p className="mt-2 flex items-baseline gap-1 font-display text-[44px] leading-none tabular">
        <CountUp value={value} className={gold ? 'text-gold' : 'text-foam'} />
        {unit && <span className={hot && value > 0 ? 'text-[18px] text-fire' : 'text-[18px] text-foam/35'}>{unit}</span>}
      </p>
    </div>
  )
}
