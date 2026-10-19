import { CircleCheck, Download, Share, SquarePlus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useInstall } from '@/lib/pwa'

// The ways to put the app on a home screen (D52): a one-time banner on Home, a card on Me
// that stays while it isn't installed, and the steps for iPhone, which has no install button.

const DISMISSED = 'omb:install-banner-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

/** Home, under the header. Once dismissed, gone for good in this browser. */
export function InstallBanner() {
  const { t } = useTranslation()
  const { state, install } = useInstall()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [howTo, setHowTo] = useState(false)
  const show = !dismissed && (state === 'prompt' || state === 'ios')

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      /* private mode: it shows again next time */
    }
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {show && (
          <motion.section
            key="install"
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mat relative flex gap-3.5 p-3.5 pr-11">
              <img src="/icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-[13px] ring-1 ring-gold/20" />
              <div className="min-w-0 flex-1">
                <p className="kicker text-[10px] text-gold/80">{t('pwa.bannerKicker')}</p>
                <p className="mt-1 text-[14px] leading-snug text-foam/75">{t('pwa.bannerBody')}</p>
                <Button
                  size="sm"
                  className="mt-2.5"
                  onClick={state === 'ios' ? () => setHowTo(true) : () => void install()}
                >
                  {state === 'ios' ? t('pwa.howTo') : t('pwa.install')}
                </Button>
              </div>
              <button
                type="button"
                aria-label={t('pwa.notNow')}
                onClick={dismiss}
                className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-foam/40 transition-colors hover:text-foam"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <IosInstallSheet open={howTo} onOpenChange={setHowTo} />
    </>
  )
}

/** Me: offered for as long as the app isn't installed and can be. */
export function InstallCard() {
  const { t } = useTranslation()
  const { state, install } = useInstall()
  const [howTo, setHowTo] = useState(false)
  if (state !== 'prompt' && state !== 'ios') return null

  return (
    <section className="mat p-4">
      <div className="flex items-center gap-3.5">
        <img src="/icons/icon-192.png" alt="" className="size-14 shrink-0 rounded-[15px] ring-1 ring-gold/20" />
        <div className="min-w-0">
          <h2 className="display text-[24px] text-foam">{t('pwa.meTitle')}</h2>
          <p className="mt-1 text-[13px] leading-snug text-foam/55">{t('pwa.meBody')}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        onClick={state === 'ios' ? () => setHowTo(true) : () => void install()}
      >
        <Download /> {state === 'ios' ? t('pwa.howTo') : t('pwa.install')}
      </Button>
      <IosInstallSheet open={howTo} onOpenChange={setHowTo} />
    </section>
  )
}

const STEPS = [
  { icon: Share, text: 'pwa.iosStep1' },
  { icon: SquarePlus, text: 'pwa.iosStep2' },
  { icon: CircleCheck, text: 'pwa.iosStep3' },
] as const

/** iPhone and iPad can only add a page to the home screen by hand, from Safari's Share menu. */
export function IosInstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[480px] rounded-t-[28px] border-gold/14 bg-popover px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <DrawerHeader className="px-0 text-left">
          <p className="kicker text-gold/80">{t('pwa.iosKicker')}</p>
          <DrawerTitle className="display text-[30px] text-foam">{t('pwa.iosTitle')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('pwa.meBody')}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto pb-2">
          <ol className="grid gap-2.5">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <li key={text} className="mat flex items-center gap-3.5 px-4 py-3">
                <span className="w-6 shrink-0 text-center font-display text-[34px] leading-none text-gold tabular">
                  {i + 1}
                </span>
                <Icon className="size-5 shrink-0 text-gold" aria-hidden="true" />
                <span className="text-[15px] leading-snug text-foam/85">{t(text)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[13px] leading-relaxed text-foam/45">{t('pwa.iosSignIn')}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-foam/45">{t('pwa.iosSafari')}</p>
          <Button variant="secondary" size="lg" className="mt-5 w-full" onClick={() => onOpenChange(false)}>
            {t('pwa.gotIt')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
