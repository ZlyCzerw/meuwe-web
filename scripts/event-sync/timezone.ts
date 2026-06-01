/**
 * Timezone helpers for the Atlantic/Canary zone.
 * Winter (WET) = UTC+0, summer DST (WEST) = UTC+1.
 */

/** Offset in whole hours of Atlantic/Canary from UTC for the given instant. */
export function canaryOffsetHours(date: Date): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Atlantic/Canary',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
  // part looks like 'GMT', 'GMT+1', 'GMT-1'
  const m = part.match(/GMT([+-]\d{1,2})?/)
  return m && m[1] ? parseInt(m[1], 10) : 0
}

/**
 * Convert a local Canary date+time ('YYYY-MM-DD', 'HH:MM') to a UTC Date,
 * accounting for the correct DST offset on that calendar day.
 */
export function localCanaryToUtc(date: string, hour: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, min] = hour.split(':').map(Number)
  const offset = canaryOffsetHours(new Date(Date.UTC(y, mo - 1, d, 12)))
  return new Date(Date.UTC(y, mo - 1, d, h - offset, min))
}
