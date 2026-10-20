import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeArt } from '@/components/brand/BadgeArt'
import type { Badge, BadgeProgress, BadgeTier, Unlock } from '@/data/queries'
import { isCategory, markSeen, progressPercent, seenAt } from '@/lib/badges'
import { fmt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BadgeSheet, type BadgeTile } from './BadgeSheet'

type Props = {
  tier: BadgeTier
  /** whose grid, for the NEW chips: one viewer, one grid */
  scope: string
  /** the whole catalogue; the grid keeps its own tier */
  catalogue: Badge[] | undefined
  /** undefined while loading: the grid waits rather than flash everything locked */
  unlocks: Unlock[] | undefined
  progress: BadgeProgress[]
}

/** G1–G4: every badge of a tier, held or not, by category. A person's are caps (Me),
 *  a crew's are mats (the crew page). Tap one for the sheet. */
export function BadgeGrid(props: Props) {
  // a new scope is a new grid: its own "seen at", its own sheet
  return <Grid key={props.scope} {...props} />
}

function Grid({ tier, scope, catalogue, unlocks, progress }: Props) {
  const { t } = useTranslation()
  // read once: what was new when the grid opened stays new until it's left
  const [seen] = useState(() => seenAt(scope))
  const [picked, setPicked] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const tiles = useMemo(() => {
    if (!catalogue || !unlocks) return []
    const held = new Map(unlocks.map((u) => [u.achievement_code, u]))
    const toward = new Map(progress.map((p) => [p.code, p]))
    return catalogue
      .filter((b) => b.tier === tier)
      .sort((a, b) => a.sort - b.sort)
      .flatMap((badge): BadgeTile[] => {
        const unlock = held.get(badge.code)
        if (badge.is_retired && !unlock) return [] // retired: only for those who hold it
        return [
          {
            badge,
            unlock,
            progress: unlock ? undefined : toward.get(badge.code),
            // your own grid shows a secret only once you hold it, even if a mate's
            // unlock has told the catalogue its name (D66)
            secret: badge.is_secret && !unlock,
            fresh: !!unlock && Date.parse(unlock.created_at) > seen,
          },
        ]
      })
  }, [catalogue, unlocks, progress, tier, seen])

  // categories in the order of their first badge
  const groups = useMemo(() => {
    const m = new Map<string, BadgeTile[]>()
    for (const tile of tiles) m.set(tile.badge.category, [...(m.get(tile.badge.category) ?? []), tile])
    return [...m]
  }, [tiles])

  const ready = tiles.length > 0
  // leaving the grid is what clears its chips, and only once it has shown them
  useEffect(() => {
    if (!ready) return
    return () => markSeen(scope)
  }, [ready, scope])

  if (!ready) return null

  const held = tiles.filter((x) => x.unlock)
  const points = held.reduce((sum, x) => sum + x.badge.points, 0)
  const current = tiles.find((x) => x.badge.code === picked) ?? null

  return (
    <section className="mat p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="display text-[24px] text-foam">{t(tier === 'crew' ? 'badges.crewTitle' : 'badges.title')}</h2>
        <p className="kicker shrink-0 text-[10px] tabular">
          <span className="text-gold">{t('badges.tally', { unlocked: fmt(held.length), total: fmt(tiles.length) })}</span>
          {' · '}
          {t('badges.points', { count: points })}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map(([category, row]) => (
          <div key={category}>
            {isCategory(category) && <h3 className="kicker mb-2.5 text-[10px] text-gold/70">{t(`badges.category.${category}`)}</h3>}
            <ul className="grid grid-cols-3 items-start gap-x-2 gap-y-4 sm:grid-cols-4">
              {row.map((tile) => (
                <Tile
                  key={tile.badge.code}
                  tier={tier}
                  tile={tile}
                  onOpen={() => {
                    setPicked(tile.badge.code)
                    setOpen(true)
                  }}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* one sheet for the grid; it keeps its badge while it slides away */}
      <BadgeSheet tier={tier} tile={current} open={open} onOpenChange={setOpen} />
    </section>
  )
}

function Tile({ tier, tile, onOpen }: { tier: BadgeTier; tile: BadgeTile; onOpen: () => void }) {
  const { t } = useTranslation()
  const { badge, unlock, progress, secret, fresh } = tile
  const title = secret ? t('badges.secret') : (badge.title ?? t('badges.secret'))

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={secret ? t('badges.secretTile') : t('badges.open', { title })}
        className="flex w-full flex-col items-center gap-2 rounded-[14px] px-0.5 pt-1 pb-0.5 text-center transition-transform active:scale-95"
      >
        <span className="relative">
          <BadgeArt tier={tier} art={badge.art} locked={!unlock} secret={secret} size={60} />
          {fresh && (
            <span className="absolute -top-1 -right-2.5 rounded-full bg-gold px-1.5 py-[3px] font-display text-[10px] leading-none tracking-[0.08em] text-stout uppercase shadow-[0_2px_6px_rgb(0_0_0/0.5)]">
              {t('badges.new')}
            </span>
          )}
        </span>
        <span
          className={cn(
            'line-clamp-2 font-display text-[13px] leading-[1.08] tracking-[0.02em] uppercase',
            unlock ? 'text-foam' : 'text-foam/35',
          )}
        >
          {title}
        </span>
        {progress && (
          // a hairline only; the sheet has the numbers
          <span aria-hidden className="-mt-0.5 h-[2px] w-8 overflow-hidden rounded-full bg-foam/10">
            <span className="block h-full rounded-full bg-gold" style={{ width: `${progressPercent(progress)}%` }} />
          </span>
        )}
      </button>
    </li>
  )
}
