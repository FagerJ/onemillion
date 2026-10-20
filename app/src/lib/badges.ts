import type { BadgeProgress } from '@/data/queries'
import { en } from '@/i18n/en'

// The catalogue's categories (D62) are checked by the database; the labels live in en.ts,
// so a category the app has no label for yet still shows its badges, just unheaded.
export type BadgeCategory = keyof typeof en.badges.category

export const isCategory = (c: string): c is BadgeCategory => Object.hasOwn(en.badges.category, c)

// The NEW chip: per viewer and per grid, on this device. Storage can be missing (private
// mode); then there are no chips, which is better than chips that never go away.
const seenKey = (scope: string) => `omb:badges-seen:${scope}`

/** When this grid was last left, in ms; 0 if never. */
export function seenAt(scope: string): number {
  try {
    return Number(localStorage.getItem(seenKey(scope))) || 0
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export function markSeen(scope: string): void {
  try {
    localStorage.setItem(seenKey(scope), String(Date.now()))
  } catch {
    /* private mode: no chips, see above */
  }
}

/** How full a progress bar is, 0–100. */
export const progressPercent = (p: BadgeProgress) => (p.target > 0 ? Math.min(100, (p.progress / p.target) * 100) : 0)
