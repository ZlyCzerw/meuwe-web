import { haversineKm } from './geo'
import type { EventWithMeta } from './types'

/**
 * Lista wydarzeń pod przyciskiem na mapie: te same filtry co mapa i kolejność
 * od najbliższego.
 */
export function listEvents(
  events: EventWithMeta[],
  { filters, from }: {
    filters: string[]
    /** Skąd liczyć odległość. Null — zostaje ta, którą policzyło zapytanie. */
    from: { lat: number; lng: number } | null
  },
): EventWithMeta[] {
  return events
    // Dopasowanie filtra tak samo jak na mapie: kategoria albo tag.
    .filter(e => !filters.length || filters.some(f => e.category === f || (e.tags?.includes(f) ?? false)))
    .map(e => from ? { ...e, distKm: haversineKm(from.lat, from.lng, e.lat, e.lng) } : e)
    .sort((a, b) => a.distKm - b.distKm || a.start_time.localeCompare(b.start_time))
}

/** „230 m”, „1,3 km”, „13 km” — z przecinkiem tam, gdzie język go używa. */
export function formatDistance(km: number, locale: string): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`
  const digits = km < 10 ? 1 : 0
  return `${km.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`
}
