import { haversineKm, DEFAULT_RADIUS_KM, MAX_RADIUS_KM } from './audience.ts'
import type { Lang } from './notif-i18n.ts'

// The weekly digest: one push, Friday 17:00, "there are X events around you".
//
// The number is the whole product. The user will open the map and count for
// themselves, so every rule here exists to keep the promise checkable:
//
// - "Today" is the user's day, not the server's. A UTC midnight counts Friday's
//   late parties as Saturday for a Pole, and the title would say the wrong day.
//   The cron therefore fires hourly and this module answers "is it Friday 17:00
//   where this user lives" per user.
// - The count uses the same radius the fan-out uses (radius_km capped at 50),
//   from the same place (last_lat/lng) the map link points at.
// - Events about to end are not counted: whoever taps at 17:20 should still
//   find what was promised, so anything ending within the hour is out.
// - Zero events means no push at all. A notification about nothing teaches
//   people to swipe the app away.

/** Friday, as Intl's en-US short weekday spells it. */
export const DIGEST_WEEKDAY = 'Fri'
export const DIGEST_HOUR = 17
/** Events must still be running this far past "now" to be counted. */
export const DIGEST_LEAD_MS = 60 * 60_000
/** A digest is due when the last one is at least this old (or never happened). */
export const DIGEST_MIN_GAP_MS = 6 * 24 * 60 * 60_000

/**
 * The zone a profile's location lives in. A lookup, not a geodetic library:
 * the app serves two regions today and both fit in a box. Extend this when a
 * region outside CET/Canary time appears — event-sync's region list is the cue.
 */
export function timezoneFor(lat: number, lng: number): string {
  // Canary Islands — the one region an hour behind the mainland.
  if (lat >= 27 && lat <= 29.5 && lng >= -18.5 && lng <= -13) return 'Atlantic/Canary'
  return 'Europe/Warsaw'
}

export interface DigestClock {
  /** en-US short weekday of the zone's wall clock: 'Fri', 'Sat', … */
  weekday: string
  hour: number
  /** The instant this user's "today" ends (their next local midnight, in UTC). */
  dayEndUtc: Date
}

/** What the wall clock in `tz` shows at the instant `now`. */
export function localClock(now: Date, tz: string): DigestClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const [y, mo, d, h, mi, s] = ['year', 'month', 'day', 'hour', 'minute', 'second']
    .map((t) => parseInt(get(t), 10))
  // The wall time read back as UTC differs from the instant by the zone offset.
  // A DST switch at 02:00 can put the next midnight off by an hour; the digest
  // counts evening events, so nothing rides on that hour.
  const offsetMs = Date.UTC(y, mo - 1, d, h, mi, s) - now.getTime()
  return {
    weekday: get('weekday'),
    hour: h,
    dayEndUtc: new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0) - offsetMs),
  }
}

export function isDigestSlot(clock: DigestClock): boolean {
  return clock.weekday === DIGEST_WEEKDAY && clock.hour === DIGEST_HOUR
}

export interface DigestCandidate {
  id: string
  radius_km: number | null
  last_lat: number
  last_lng: number
  language: string | null
}

export interface DigestEvent {
  lat: number
  lng: number
  start_time: string
  end_time: string
}

export interface Digest {
  count: number
  nearestKm: number
}

/**
 * What this user's digest would say, or null when it should say nothing.
 *
 * Counts today's still-running events within the user's notification radius —
 * the same min(radius_km, 50) the fan-out uses, so the push and the map that
 * opens from it describe the same circle.
 */
export function digestFor(
  c: DigestCandidate,
  events: DigestEvent[],
  ctx: { now: Date; dayEndUtc: Date },
): Digest | null {
  const radius = Math.min(c.radius_km ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
  const stillOnAt = ctx.now.getTime() + DIGEST_LEAD_MS
  let count = 0
  let nearestKm = Infinity
  for (const e of events) {
    if (new Date(e.start_time) >= ctx.dayEndUtc) continue // tomorrow's, in their zone
    if (new Date(e.end_time).getTime() < stillOnAt) continue // over before they arrive
    const km = haversineKm(c.last_lat, c.last_lng, e.lat, e.lng)
    if (km > radius) continue
    count++
    if (km < nearestKm) nearestKm = km
  }
  return count === 0 ? null : { count, nearestKm }
}

/**
 * How much map the link should show: the nearest event and the same distance
 * again — the startupZoom rule, so a digest tap and a cold start frame alike.
 * The client turns this into a zoom with kmToZoom, which knows the screen size.
 */
export function spanKm(nearestKm: number): number {
  return Math.min(Math.round(nearestKm * 2 * 10) / 10, MAX_RADIUS_KM)
}

export function digestUrl(lat: number, lng: number, km: number): string {
  return `https://meuwe.eu/?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&km=${km}&src=digest`
}

const LOCALE: Record<Lang, string> = { pl: 'pl', en: 'en', es: 'es', de: 'de', sl: 'sl' }

const TITLE_TAIL: Record<Lang, string> = {
  pl: '. Wychodzisz gdzieś?',
  en: '. Going out?',
  es: '. ¿Sales por ahí?',
  de: '. Gehst du aus?',
  sl: '. Greš ven?',
}

/**
 * "Piątek. Wychodzisz gdzieś?" — the weekday comes from Intl for the user's
 * zone and language, so a future per-user send day changes the title by itself.
 */
export function digestTitle(lang: Lang, now: Date, tz: string): string {
  const day = new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', timeZone: tz }).format(now)
  return day.charAt(0).toLocaleUpperCase(LOCALE[lang]) + day.slice(1) + TITLE_TAIL[lang]
}

// One sentence per plural drawer, not one noun: Polish bends the verb along
// with the noun (jest 1 / są 3 / jest 7) and Slovenian has four forms. The
// whole sentence is the translation unit.
const BODY: Record<Lang, { [k in Intl.LDMLPluralRule]?: string } & { other: string }> = {
  pl: {
    one: 'Wokół Ciebie jest 1 wydarzenie.',
    few: 'Wokół Ciebie są {n} wydarzenia.',
    other: 'Wokół Ciebie jest {n} wydarzeń.',
  },
  en: { one: 'There is 1 event around you.', other: 'There are {n} events around you.' },
  es: { one: 'Hay 1 evento cerca de ti.', other: 'Hay {n} eventos cerca de ti.' },
  de: { one: 'In deiner Nähe ist 1 Event.', other: 'In deiner Nähe sind {n} Events.' },
  sl: {
    one: 'V tvoji bližini je 1 dogodek.',
    two: 'V tvoji bližini sta {n} dogodka.',
    few: 'V tvoji bližini so {n} dogodki.',
    other: 'V tvoji bližini je {n} dogodkov.',
  },
}

export function digestBody(lang: Lang, count: number): string {
  const rule = new Intl.PluralRules(LOCALE[lang]).select(count)
  const template = BODY[lang][rule] ?? BODY[lang].other
  return template.replace('{n}', String(count))
}
