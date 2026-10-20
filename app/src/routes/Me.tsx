import { Check, LogOut, Pencil, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/AuthProvider'
import { BadgeGrid } from '@/components/badges/BadgeGrid'
import { Cap } from '@/components/brand/Cap'
import { CountUp } from '@/components/brand/CountUp'
import { Button } from '@/components/ui/button'
import { InstallCard } from '@/components/layout/InstallOffer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import {
  useBadgeCatalogue,
  useMyMilestones,
  useProfile,
  useProfileBadgeProgress,
  useProfileBadges,
  useProfileSummary,
} from '@/data/queries'
import { fmt } from '@/lib/format'
import { canReset, resetApp } from '@/lib/pwa'
import { useQueue } from '@/data/queue'
import { rungName } from '@/lib/milestones'
import { supabase } from '@/lib/supabase'
import { ProfileForm } from './setup/ProfileForm'

export function Me() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: s } = useProfileSummary(user?.id)
  const { data: mine = [] } = useMyMilestones(user?.id)
  const { data: catalogue } = useBadgeCatalogue()
  const { data: badges } = useProfileBadges(user?.id)
  const { data: progress = [] } = useProfileBadgeProgress(user?.id)
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

      {user && <BadgeGrid tier="person" scope={`person:${user.id}`} catalogue={catalogue} unlocks={badges} progress={progress} />}

      {/* personal rungs never take over the screen (D59); they collect here */}
      <section className="mat p-4">
        <h2 className="kicker text-gold/80">{t('milestones.mine.title')}</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-[14px] text-foam/45">{t('milestones.mine.empty')}</p>
        ) : (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {mine.map((e) => (
              <li key={e.id} className="flex items-center gap-1 rounded-full bg-hop/12 px-2.5 py-1 text-[12px] font-bold text-hop">
                <Check className="size-3" strokeWidth={3.5} />
                {fmt(e.threshold)}
                {rungName(t, e.threshold) && <span className="font-semibold text-hop/75">· {rungName(t, e.threshold)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <InstallCard />

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
        <SignOut />
      </div>

      {/* which deploy this phone runs: how an update is checked on a real device */}
      <p className="kicker mt-6 text-center text-[10px] text-foam/25">{t('me.build', { id: import.meta.env.VITE_APP_BUILD })}</p>
      {/* the way out of a stuck build for a home-screen app (D49) */}
      {canReset() && (
        <Button variant="ghost" size="sm" className="self-center text-foam/35" onClick={() => void resetApp()}>
          <RotateCcw /> {t('me.resetApp')}
        </Button>
      )}
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

/** Taps still on the slate stay on this phone, keyed to the account, and go in at its next
 *  sign-in, so signing out with some waiting asks first (C8). */
function SignOut() {
  const { t } = useTranslation()
  const { waiting } = useQueue()
  const signOut = () => void supabase.auth.signOut()
  if (waiting.length === 0) {
    return (
      <Button variant="ghost" size="lg" onClick={signOut}>
        <LogOut /> {t('me.signOut')}
      </Button>
    )
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="lg">
          <LogOut /> {t('me.signOut')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sync.signOutTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('sync.signOutBody', { count: waiting.length })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction variant="destructive" onClick={signOut}>
            {t('sync.signOutAnyway')}
          </AlertDialogAction>
          <AlertDialogCancel variant="ghost">{t('common.cancel')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
