/** Local-timezone date/time helpers. All timestamps are epoch milliseconds. */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const HHMM_RE = /^(\d{1,2}):(\d{2})$/

/** Local calendar day key, e.g. "2026-07-08". */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isDayKey(value: string): boolean {
  return DAY_RE.test(value)
}

/** Midnight (local) at the start of the given day key. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/** Exclusive end of the given day (start of the next day). */
export function dayEnd(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime()
}

/** Day key for N days before the given day key. */
export function shiftDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + deltaDays, 12, 0, 0).getTime())
}

/** "HH:MM" (24h, local) for a timestamp. */
export function formatHHMM(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Convert an "HH:MM" string reported by the model into a timestamp on the
 * given day. Returns null on malformed input.
 */
export function parseHHMM(day: string, hhmm: string): number | null {
  const m = HHMM_RE.exec(hhmm.trim())
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return null
  return dayStart(day) + (hours * 60 + minutes) * 60_000
}

export function minutesBetween(startTs: number, endTs: number): number {
  return Math.max(0, Math.round((endTs - startTs) / 60_000))
}

/** "1h 25m" / "45m" style duration label. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`
}

/** Human date like "Tuesday, Jul 8" for headers. */
export function formatDayLabel(day: string): string {
  const d = new Date(dayStart(day))
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
}
