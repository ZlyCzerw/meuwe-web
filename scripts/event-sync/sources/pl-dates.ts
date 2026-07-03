/** Shared Polish date helpers for Rzeszów-region sources. */

const PAST_GRACE_DAYS = 45

/**
 * Infer the year for a day+month with no year: assume the nearest upcoming
 * occurrence, tolerating dates up to 45 days in the past (already-running
 * events); anything older is next year's date.
 */
export function inferYear(day: number, month: number, now: Date): number {
  const y = now.getUTCFullYear()
  const candidate = Date.UTC(y, month - 1, day)
  return candidate < now.getTime() - PAST_GRACE_DAYS * 86_400_000 ? y + 1 : y
}

/** First 'dd.mm[.yyyy]' in the text → 'YYYY-MM-DD', or null. */
export function parsePlDate(text: string, now: Date): string | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/)
  if (!m) return null
  const day = Number(m[1]), month = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const year = m[3] ? Number(m[3]) : inferYear(day, month, now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
