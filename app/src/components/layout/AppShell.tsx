import { CircleUser, House, Plus, ScrollText, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMyParty, useOpenNight } from '@/data/queries'
import { usePartyRealtime } from '@/data/realtime'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { data: mine } = useMyParty()
  const partyId = mine?.party.id
  usePartyRealtime(partyId)
  const { data: night } = useOpenNight(partyId)
  const { pathname } = useLocation()

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[480px] px-4 pt-[max(env(safe-area-inset-top),22px)] pb-40">
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        <Outlet />
      </motion.main>
      <Dock live={!!night} />
    </div>
  )
}

function Dock({ live }: { live: boolean }) {
  const { t } = useTranslation()
  const items = [
    { to: '/', icon: House, label: t('nav.home') },
    { to: '/nights', icon: ScrollText, label: t('nav.nights') },
    null,
    { to: '/party', icon: Users, label: t('nav.party') },
    { to: '/me', icon: CircleUser, label: t('nav.me') },
  ]
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div
        className={cn(
          'pointer-events-auto mx-auto grid max-w-[456px] grid-cols-5 items-end rounded-[30px] px-2 pt-2 pb-2',
          'border border-gold/14 bg-[#1a130b]/80 backdrop-blur-xl',
          'shadow-[0_24px_48px_-12px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(251_244_228/0.06)]',
        )}
      >
        {items.map((item, i) =>
          item ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors',
                  isActive ? 'text-gold' : 'text-foam/45 hover:text-foam/75',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                  <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="dock-dot"
                      className="absolute -bottom-1 h-[3px] w-5 rounded-full bg-gold shadow-[0_0_10px_var(--gold)]"
                    />
                  )}
                </>
              )}
            </NavLink>
          ) : (
            <NightButton key={i} live={live} />
          ),
        )}
      </div>
    </nav>
  )
}

function NightButton({ live }: { live: boolean }) {
  const { t } = useTranslation()
  return (
    <NavLink to="/night" className="relative -mt-9 flex flex-col items-center gap-1" aria-label={t('nav.night')}>
      {({ isActive }) => (
        <>
          <motion.span
            whileTap={{ scale: 0.88 }}
            className={cn(
              'grid size-[64px] place-items-center rounded-full ring-4 ring-cellar',
              live
                ? 'bg-[radial-gradient(circle_at_35%_30%,#ff8a63,#ff5b35_55%,#c23a1a)] text-foam'
                : 'animate-fizz bg-[radial-gradient(circle_at_35%_30%,#ffd27a,#f5b23a_55%,#c6821a)] text-stout',
            )}
          >
            {live ? <BeerGlyph /> : <Plus className="size-8" strokeWidth={2.8} />}
          </motion.span>
          <span
            className={cn(
              'text-[10px] font-semibold tracking-[0.12em] uppercase',
              live ? 'text-fire' : isActive ? 'text-gold' : 'text-foam/45',
            )}
          >
            {live ? t('nav.live') : t('nav.night')}
          </span>
          {live && <span className="absolute top-0 right-1 size-3 animate-live rounded-full bg-foam ring-2 ring-fire" />}
        </>
      )}
    </NavLink>
  )
}

function BeerGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
      <path d="M6 7h10l-1 14H7L6 7Z" fill="currentColor" opacity="0.95" />
      <path d="M16 10h2.2a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2H15.6" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 7.5c0-2 1.6-3.5 3.5-3.5.6-1.1 1.8-1.8 3-1.8 1.7 0 3.1 1.2 3.4 2.8 1.2.2 2.1 1.2 2.1 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
