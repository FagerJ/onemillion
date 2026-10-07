// The ladder from ARCHITECTURE §4, which the owner's "10, 100, 500, 1.000, 2.500 —
// the ones that feel right" (A4) also lands on. One ladder for every scope.
//
// Client-side until the milestone tables (C9/C12) exist; then the database owns it
// and this only renders.
export const LADDER = [
  10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
  250_000, 500_000, 1_000_000,
] as const

export type Rung = {
  /** the last rung passed, 0 before the first */
  previous: number
  /** the rung being chased */
  next: number
  /** 0–1 between previous and next — what the pint fills to */
  progress: number
  toGo: number
}

export function rungFor(total: number): Rung {
  const next = LADDER.find((r) => r > total) ?? LADDER[LADDER.length - 1]
  const index = LADDER.indexOf(next)
  const previous = index > 0 ? LADDER[index - 1] : 0
  const span = next - previous
  return {
    previous,
    next,
    progress: span > 0 ? Math.min(1, Math.max(0, (total - previous) / span)) : 1,
    toGo: Math.max(0, next - total),
  }
}

export const MILLION = 1_000_000
