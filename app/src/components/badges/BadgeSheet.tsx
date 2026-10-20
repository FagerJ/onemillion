import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { BadgeArt } from '@/components/brand/BadgeArt'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import type { Badge, BadgeProgress, BadgeTier, Unlock } from '@/data/queries'
import { isCategory, progressPercent } from '@/lib/badges'
import { nightLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** One tile of a badge grid, as the grid worked it out. */
export type BadgeTile = {
  badge: Badge
  unlock?: Unlock
  /** only while locked, and only for what may show progress (D68) */
  progress?: BadgeProgress
  /** not held and secret: a question mark, whatever the catalogue lets this viewer know (D66) */
  secret: boolean
  /** held, and written since this viewer last left the grid */
  fresh: boolean
}

/** A badge up close: what it is, what it's worth, and where you stand. */
export function BadgeSheet({
  tier,
  tile,
  open,
  onOpenChange,
}: {
  tier: BadgeTier
  tile: BadgeTile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[480px] rounded-t-[28px] border-gold/14 bg-popover px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        {tile && <Body tier={tier} tile={tile} />}
      </DrawerContent>
    </Drawer>
  )
}

function Body({ tier, tile }: { tier: BadgeTier; tile: BadgeTile }) {
  const { t } = useTranslation()
  const { badge, unlock, secret } = tile
  const category = badge.category

  return (
    <div className="overflow-y-auto pb-2">
      <DrawerHeader className="items-center px-0 pt-6 text-center md:text-center">
        {/* a fresh look at a held badge drops it on the table; a locked one just sits there */}
        <motion.div
          key={badge.code}
          initial={unlock ? { rotate: -90, scale: 0.6 } : false}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 170, damping: 14 }}
        >
          <BadgeArt tier={tier} art={badge.art} locked={!unlock} secret={secret} size={128} />
        </motion.div>
        {isCategory(category) && <p className="kicker mt-5 text-[10px] text-gold/70">{t(`badges.category.${category}`)}</p>}
        <DrawerTitle className={cn('display mt-1.5 text-[36px]', unlock ? 'text-foam' : 'text-foam/60')}>
          {secret ? t('badges.secret') : (badge.title ?? t('badges.secret'))}
        </DrawerTitle>
        <span
          className={cn(
            'mt-2.5 rounded-full px-2.5 py-1 font-display text-[13px] leading-none tracking-[0.08em] uppercase ring-1',
            unlock ? 'bg-gold/14 text-gold ring-gold/35' : 'bg-foam/6 text-foam/50 ring-foam/12',
          )}
        >
          {t('badges.points', { count: badge.points })}
        </span>
      </DrawerHeader>

      <div className="flex flex-col items-center gap-3 text-center">
        <Status tile={tile} />
        <DrawerDescription className="max-w-[34ch] text-[15px] leading-relaxed text-foam/70">
          {secret ? t('badges.secretHint') : badge.description}
        </DrawerDescription>
        {!secret && badge.flavor && <p className="max-w-[34ch] text-[14px] text-foam/50 italic">{badge.flavor}</p>}
      </div>
    </div>
  )
}

function Status({ tile: { unlock, progress, secret } }: { tile: BadgeTile }) {
  const { t } = useTranslation()
  if (unlock) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-hop">
        <Check className="size-3.5" strokeWidth={3.5} />
        {t('badges.unlockedOn', { date: nightLabel(unlock.unlocked_at) })}
      </p>
    )
  }
  // a secret's hint is its description; nothing to add up here
  if (secret) return null
  if (progress) {
    return (
      <div className="w-full max-w-[240px]">
        <p className="kicker text-[10px] text-gold/80 tabular">
          {t('badges.progress', { count: progress.progress, target: progress.target })}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foam/8">
          <motion.div
            className="h-full rounded-full bg-gold"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent(progress)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>
    )
  }
  return <p className="kicker text-[10px]">{t('badges.locked')}</p>
}
