import { TriangleAlert, WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useQueue, useSlate } from '@/data/queue'
import { cn } from '@/lib/utils'

/** The slate at a glance, in the LIVE bug's shape: NO SIGNAL · 3 WAITING, or 2 NOT SAVED.
 *  Hidden when there's nothing to say; tapping it opens the slate (C8). */
export function SyncChip({ className }: { className?: string }) {
  const { t } = useTranslation()
  const slate = useSlate()
  const { openSlate } = useQueue()

  const parts: string[] = []
  if (!slate.online) parts.push(t('sync.offline'))
  if (slate.failed > 0) parts.push(t('sync.notSaved', { count: slate.failed }))
  else if (slate.waiting > 0) parts.push(t('sync.waiting', { count: slate.waiting }))
  const tone = slate.failed > 0 ? 'fail' : slate.waiting > 0 ? 'wait' : 'off'

  return (
    <AnimatePresence>
      {slate.visible && parts.length > 0 && (
        <motion.button
          type="button"
          onClick={openSlate}
          aria-label={parts.join(' · ')}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 font-display text-[13px] leading-none tracking-[0.14em] uppercase ring-1 tabular',
            tone === 'fail' && 'bg-fire/14 text-fire ring-fire/35',
            tone === 'wait' && 'bg-gold/12 text-gold ring-gold/35',
            tone === 'off' && 'bg-foam/6 text-foam/70 ring-foam/15',
            className,
          )}
        >
          {!slate.online && (
            <>
              <WifiOff className="size-3.5" aria-hidden />
              <span>{t('sync.offline')}</span>
            </>
          )}
          {!slate.online && (slate.failed > 0 || slate.waiting > 0) && (
            <span aria-hidden className="h-3 w-px bg-current/30" />
          )}
          {slate.failed > 0 ? (
            <>
              <TriangleAlert className="size-3.5" aria-hidden />
              <span>{t('sync.notSaved', { count: slate.failed })}</span>
            </>
          ) : (
            slate.waiting > 0 && (
              <>
                <span aria-hidden className={cn('size-2 rounded-full bg-gold', slate.sending && 'animate-live')} />
                <span>{t('sync.waiting', { count: slate.waiting })}</span>
              </>
            )
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
