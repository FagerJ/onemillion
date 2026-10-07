// A short buzz on Android for every tap that logs something. iOS Safari has no
// Vibration API, so this quietly does nothing there.
export function buzz(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // some browsers throw when vibration is blocked by permissions; never fatal
  }
}
