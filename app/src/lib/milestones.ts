import type { TFunction } from 'i18next'
import { en } from '@/i18n/en'

// The ladder lives in the database (`milestones`, D54); this only does the arithmetic
// and decides which crossings still deserve a takeover (D59). No React here.

export const MILLION = 1_000_000

export type Rung = {
  /** the last rung passed, 0 before the first */
  previous: number
  /** the rung being chased */
  next: number
  /** 0–1 between previous and next — what the pint fills to */
  progress: number
  toGo: number
}

/** Where `total` sits on `rungs` (ascending). Past the top rung, the pint stays full. */
export function rungFor(total: number, rungs: readonly number[]): Rung | null {
  if (rungs.length === 0) return null
  const next = rungs.find((r) => r > total) ?? rungs[rungs.length - 1]
  const index = rungs.indexOf(next)
  const previous = index > 0 ? rungs[index - 1] : 0
  const span = next - previous
  return {
    previous,
    next,
    progress: span > 0 ? Math.min(1, Math.max(0, (total - previous) / span)) : 1,
    toGo: Math.max(0, next - total),
  }
}

export type Scope = 'global' | 'crew' | 'profile'
export type Tier = 'bronze' | 'silver' | 'gold' | 'legendary'
type Person = { display_name: string; initials: string; avatar_color: string }

export type MilestoneEvent = {
  id: string
  scope: Scope
  scope_id: string | null
  threshold: number
  crew_id: string
  session_id: string | null
  round_id: string | null
  profile_id: string
  added_by: string
  crossed_at: string
  backfilled: boolean
  rung: { tier: Tier } | null
  /** null when the scorer isn't a crew-mate: profiles are only visible inside a crew (D61) */
  scorer: Person | null
  assist: Person | null
}

/** One takeover: the rung to show, and every event it stands for. */
export type Celebration = { event: MilestoneEvent; ids: string[] }

export const CELEBRATE_WITHIN_MS = 24 * 60 * 60 * 1000

/** What still deserves a takeover, oldest first; global before crew at the same moment.
 *  One transaction that crossed two rungs of one scope (a huge round) shows the top one. */
export function pickCelebrations(events: MilestoneEvent[], seen: Set<string>, now: number): Celebration[] {
  const bursts = new Map<string, Celebration>()
  // the crew and global lists overlap when the crew scored a global rung
  for (const e of new Map(events.map((x) => [x.id, x])).values()) {
    if (e.backfilled || e.scope === 'profile' || seen.has(e.id)) continue
    const at = Date.parse(e.crossed_at)
    if (!(now - at <= CELEBRATE_WITHIN_MS)) continue
    const key = `${e.scope}|${at}`
    const b = bursts.get(key)
    if (!b) bursts.set(key, { event: e, ids: [e.id] })
    else {
      b.ids.push(e.id)
      if (e.threshold > b.event.threshold) b.event = e
    }
  }
  return [...bursts.values()].sort(
    (a, b) =>
      Date.parse(a.event.crossed_at) - Date.parse(b.event.crossed_at) ||
      (a.event.scope === b.event.scope ? 0 : a.event.scope === 'global' ? -1 : 1),
  )
}

// Seen per user and per device, so a shared phone doesn't swallow a second account's
// takeovers. Anything older than the window can never celebrate again, so 200 is plenty.
const seenKey = (userId: string) => `omb:milestones-seen:${userId}`

export function loadSeen(userId: string): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(seenKey(userId)) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveSeen(userId: string, seen: Set<string>): void {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify([...seen].slice(-200)))
  } catch {
    /* private mode: the 24-hour window bounds the repeats */
  }
}

type NamedRung = keyof typeof en.milestones.names

/** A rung's name ("Century"), or null for a rung the app doesn't know by name yet. */
export function rungName(t: TFunction, threshold: number): string | null {
  const key = String(threshold)
  return key in en.milestones.names ? t(`milestones.names.${key as NamedRung}`) : null
}
