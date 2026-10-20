import { useTranslation } from 'react-i18next'
import { Cap, CapStack } from '@/components/brand/Cap'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMembers } from '@/data/queries'
import { useQueue, useSlate, useSlateSheet } from '@/data/queue'
import type { Entry, Reason } from '@/lib/queue/core'

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

const REASON = { closed: 'sync.reasonClosed', 'too-late': 'sync.reasonTooLate', refused: 'sync.reasonRefused' } as const

/** "On the slate": every tap this phone is holding, and why any didn't go in (C8). Names
 *  come from the crew's members, which are kept on the phone, so this works offline. */
export function Slate({ crewId }: { crewId: string }) {
  const { t } = useTranslation()
  const { open, setOpen } = useSlateSheet()
  const q = useQueue()
  const slate = useSlate()
  const { data: members = [] } = useMembers(crewId)
  const who = (id: string) => members.find((m) => m.profile.id === id)?.profile

  const entries = q.entries
  const onlyFailed = entries.length > 0 && entries.every((e) => e.failed)

  function label(e: Entry) {
    if (e.kind === 'void') return t('sync.kindTakeBack', { name: who(e.profile_id)?.display_name ?? '?' })
    if (e.rows.length > 1 || e.rows[0].round_id) return t('sync.kindRound', { count: e.rows.length })
    const name = who(e.rows[0].profile_id)?.display_name ?? '?'
    return e.rows[0].is_alcohol_free ? t('sync.kindAlcoholFree', { name }) : t('sync.kindOne', { name })
  }

  function caps(e: Entry) {
    const ids = e.kind === 'void' ? [e.profile_id] : e.rows.map((r) => r.profile_id)
    const people = ids.flatMap((id) => {
      const p = who(id)
      return p ? [{ initials: p.initials, avatar_color: p.avatar_color, display_name: p.display_name }] : []
    })
    if (people.length === 1) return <Cap initials={people[0].initials} color={people[0].avatar_color} size="sm" />
    return <CapStack people={people} size="xs" max={4} />
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="mx-auto max-w-[480px] rounded-t-[28px] border-gold/14 bg-popover px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <DrawerHeader className="px-0 text-left">
          <p className="kicker text-gold/80">{t('sync.sheetKicker')}</p>
          <DrawerTitle className="display text-[30px] text-foam">
            {onlyFailed ? t('sync.failedTitle') : t('sync.sheetTitle')}
          </DrawerTitle>
          <DrawerDescription className="text-[14px] text-foam/55">
            {entries.length === 0 && !slate.online
              ? t('sync.offlineEmpty')
              : onlyFailed
                ? t('sync.failedBody')
                : t('sync.sheetBody')}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto pb-2">
          {entries.length > 0 && (
            <ul className="mat divide-y divide-foam/6">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3.5 py-3">
                  {caps(e)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foam/90">{label(e)}</p>
                    {e.failed && (
                      <p className="mt-0.5 text-[12px] text-fire/90">{t(REASON[e.failed.reason as Reason])}</p>
                    )}
                  </div>
                  <span className="font-display text-[14px] text-foam/45 tabular">{time.format(e.tapped_at)}</span>
                  {!e.failed &&
                    (slate.sending ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-gold uppercase">
                        <span className="size-2 animate-live rounded-full bg-gold" aria-hidden />
                        {t('sync.stateSending')}
                      </span>
                    ) : (
                      <span className="kicker text-[10px] text-gold">{t('sync.stateWaiting')}</span>
                    ))}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 grid gap-2.5">
            {q.waiting.length > 0 && (
              <Button size="lg" disabled={!slate.online} onClick={q.sendNow}>
                {t('sync.sendNow')}
              </Button>
            )}
            {q.failed.length > 0 && (
              <Button variant="ghost" size="lg" onClick={q.dismissFailed}>
                {t('sync.dismiss')}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
