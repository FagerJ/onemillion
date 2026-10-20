import type { ComboRow, UnlockRow } from '@/data/queries'

// Realtime pushes, the celebration host shows. Kept out of React so the per-crew channel
// never re-subscribes when the host re-renders.
export type Incoming = { kind: 'combo'; row: ComboRow } | { kind: 'unlock'; row: UnlockRow }

const listeners = new Set<(c: Incoming) => void>()

export const celebrate = (c: Incoming) => listeners.forEach((l) => l(c))

export function onCelebration(l: (c: Incoming) => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}
