import { Copy, LogOut, RefreshCw, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { Cap } from '@/components/brand/Cap'
import { FlapWord } from '@/components/brand/Flaps'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
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
import { Button } from '@/components/ui/button'
import { useLeaveParty, useMembers, useMyParty, useRegenerateCode } from '@/data/queries'

export function PartyPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: mine } = useMyParty()
  const party = mine!.party
  const captain = mine!.role === 'captain'
  const { data: members = [] } = useMembers(party.id)
  const regenerate = useRegenerateCode(party.id)
  const leave = useLeaveParty()

  const shareText = t('party.shareText', { party: party.name, code: party.invite_code })

  async function copy() {
    try {
      await navigator.clipboard.writeText(party.invite_code)
      toast.success(t('common.copied'))
    } catch {
      // clipboard needs a secure context; over plain http on a phone, show it instead
      toast(party.invite_code)
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ text: shareText }).catch(() => undefined)
    } else {
      await copy()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader kicker={t('party.title')} title={party.name} />

      <section className="mat relative overflow-hidden p-5 text-center">
        <div className="pointer-events-none absolute -top-20 left-1/2 size-72 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <p className="kicker relative">{t('party.invite')}</p>
        <div className="relative mt-3 flex justify-center">
          <FlapWord key={party.invite_code} word={party.invite_code} className="text-[clamp(30px,10vw,40px)]" />
        </div>
        <p className="relative mx-auto mt-3 max-w-[30ch] text-[13px] leading-relaxed text-foam/45">{t('party.inviteHint')}</p>
        <div className="relative mt-4 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={copy}>
            <Copy /> {t('common.copy')}
          </Button>
          <Button onClick={share}>
            <Share2 /> {t('common.share')}
          </Button>
        </div>
        {captain && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="relative mt-2">
                <RefreshCw /> {t('party.newCode')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('party.newCodeTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('party.newCodeBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => regenerate.mutate()}>{t('party.newCodeConfirm')}</AlertDialogAction>
                <AlertDialogCancel variant="ghost">{t('common.cancel')}</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </section>

      <section className="mat p-4">
        <h2 className="display mb-2 text-[24px] text-foam">{t('party.members')}</h2>
        <ul className="flex flex-col">
          {members.map((m) => (
            <li key={m.profile.id} className="flex items-center gap-3 py-2">
              <Cap initials={m.profile.initials} color={m.profile.avatar_color} size="md" ring={m.profile.id === user!.id} />
              <span className="flex-1 truncate text-[15px] font-semibold text-foam/90">{m.profile.display_name}</span>
              {m.role === 'captain' && (
                // the captain's armband
                <span className="rounded-[6px] bg-gold px-1.5 py-0.5 font-display text-[13px] leading-none text-stout" title={t('party.captain')}>
                  C
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="self-center text-foam/40">
            <LogOut /> {t('party.leave')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('party.leaveTitle', { party: party.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('party.leaveBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => leave.mutate(party.id, { onSuccess: () => navigate('/setup/party', { replace: true }) })}
            >
              {t('party.leaveConfirm')}
            </AlertDialogAction>
            <AlertDialogCancel variant="ghost">{t('common.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
