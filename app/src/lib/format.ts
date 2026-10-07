// European number formatting everywhere (CLAUDE.md): 428.391 and 42,8%.
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

export function fmt(n: number | null | undefined): string {
  return whole.format(n ?? 0)
}

export function percent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits).replace('.', ',')}%`
}

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

/** "WED 30 SEP" — how a night is named in the feed. */
export function nightLabel(iso: string): string {
  const d = new Date(iso)
  return `${weekday.format(d)} ${dayMonth.format(d)}`.toUpperCase()
}

/** Minutes since kick-off, as a football clock: 73'. */
export function matchMinute(startedAt: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000))
  return `${minutes}'`
}

/** "4h 12m" for a finished night. */
export function duration(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
