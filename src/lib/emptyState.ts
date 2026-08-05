import { haversineKm, MAX_MAP_KM } from './geo'

// What to say when the map has nothing on it.
//
// "Tu jeszcze cisza… bądź pierwszy!" was the only answer, and it was usually
// wrong: it said the same thing to someone standing next to a festival that
// starts tomorrow as to someone in an empty valley. It was also what showed
// when the query had simply failed.
//
// So: one cheap query answers three questions — is anything still on today
// further out, is anything on a later day, and how far is the nearest thing at
// all — and the card offers whichever way out actually exists.

/** How many days ahead the probe looks. A week is as far as the day strip goes. */
export const PROBE_DAYS = 7

/** The columns the probe query selects. Deliberately not the whole event. */
export interface ProbeEvent {
  lat: number
  lng: number
  start_time: string
  end_time: string
}

export interface NearbyProbe {
  /** Distance to the nearest event still on today, within MAX_MAP_KM. */
  nearestKm: number | null
  /** Today's events inside MAX_MAP_KM but outside the current view. */
  widerToday: number
  /** First later day with anything inside the current view. */
  nextDay: { dayOffset: number; count: number } | null
}

export type EmptyVariant =
  /** Nothing today, but a later day has some — one tap away. */
  | { kind: 'nextDay'; dayOffset: number; count: number }
  /** Nothing in view, but today has something further out. */
  | { kind: 'wider'; nearestKm: number }
  /** Genuinely nothing, all week, as far as the fan-out reaches. */
  | { kind: 'nothing' }
  /** The probe failed. Say the old neutral line and promise nothing. */
  | { kind: 'unknown' }

function startOfDay(now: Date, dayOffset: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Reduces a bag of events to the three facts the empty card needs.
 *
 * Kept apart from the query on purpose: the query is a bounding box, this is
 * the part with the judgement in it, and only this part needs testing.
 */
export function summariseProbe(
  events: ProbeEvent[],
  ctx: { lat: number; lng: number; viewKm: number; now: Date },
): NearbyProbe {
  const withDist = events
    .map(e => ({
      km: haversineKm(ctx.lat, ctx.lng, e.lat, e.lng),
      start: new Date(e.start_time),
      end: new Date(e.end_time),
    }))
    .filter(e => e.km <= MAX_MAP_KM)

  const todayEnd = startOfDay(ctx.now, 1)
  // Today means: starts before midnight and has not finished yet. Something
  // that began at noon and runs till late is still today's event at three.
  const today = withDist.filter(e => e.start < todayEnd && e.end >= ctx.now)

  const nearestKm = today.length > 0 ? Math.min(...today.map(e => e.km)) : null
  const widerToday = today.filter(e => e.km > ctx.viewKm).length

  let nextDay: NearbyProbe['nextDay'] = null
  for (let offset = 1; offset <= PROBE_DAYS; offset++) {
    const from = startOfDay(ctx.now, offset)
    const to = startOfDay(ctx.now, offset + 1)
    // Counted inside the view the user already has, because the sentence
    // promises what they will see after tapping through.
    const count = withDist.filter(e => e.km <= ctx.viewKm && e.start < to && e.end >= from).length
    if (count > 0) { nextDay = { dayOffset: offset, count }; break }
  }

  return { nearestKm, widerToday, nextDay }
}

/**
 * Whether the empty map deserves a card at all.
 *
 * The card answers one question: "I opened this and there is nothing here."
 * Someone who has already watched pins appear while panning has answered it for
 * themselves — telling them again each time they cross a field is noise, not
 * help. And once said, it is said: one card per visit.
 */
export function shouldOfferWayOut(ctx: { seenAnyEvent: boolean; alreadyOffered: boolean }): boolean {
  return !ctx.seenAnyEvent && !ctx.alreadyOffered
}

/**
 * Which way out to offer, cheapest first: another day is one tap and the map has
 * content; a wider look is one tap and a longer trip; being the first is work.
 * `null` means the probe failed, which is not the same as nothing being there.
 */
export function pickEmptyStateVariant(probe: NearbyProbe | null): EmptyVariant {
  if (!probe) return { kind: 'unknown' }
  if (probe.nextDay) return { kind: 'nextDay', ...probe.nextDay }
  if (probe.widerToday > 0 && probe.nearestKm !== null) return { kind: 'wider', nearestKm: probe.nearestKm }
  return { kind: 'nothing' }
}
