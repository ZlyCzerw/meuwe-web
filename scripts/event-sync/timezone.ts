/**
 * Timezone helpers. Works for any IANA zone whose offset is a whole number
 * of hours (Atlantic/Canary: UTC+0/+1, Europe/Warsaw: UTC+1/+2).
 */

/** Offset in whole hours of `timeZone` from UTC for the given instant. */
export function tzOffsetHours(date: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
  // part looks like 'GMT', 'GMT+1', 'GMT-1'
  const m = part.match(/GMT([+-]\d{1,2})?/)
  return m && m[1] ? parseInt(m[1], 10) : 0
}

/**
 * Convert a local date+time ('YYYY-MM-DD', 'HH:MM') in `timeZone` to a UTC
 * Date, accounting for the correct DST offset on that calendar day.
 */
export function localToUtc(date: string, hour: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, min] = hour.split(':').map(Number)
  const offset = tzOffsetHours(new Date(Date.UTC(y, mo - 1, d, 12)), timeZone)
  return new Date(Date.UTC(y, mo - 1, d, h - offset, min))
}

export function canaryOffsetHours(date: Date): number {
  return tzOffsetHours(date, 'Atlantic/Canary')
}

export function localCanaryToUtc(date: string, hour: string): Date {
  return localToUtc(date, hour, 'Atlantic/Canary')
}
