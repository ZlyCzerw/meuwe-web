// src/lib/placeSearch.ts
//
// Wyszukiwanie miejsc przez Photon (komoot). Wyjęte z SearchBar, bo to samo
// pytanie zadaje pole „Miejscowość” w Moich danych - z jedną różnicą: tam lista
// ma zawierać wyłącznie miejscowości, nigdy ulicę ani adres.

import { haversineKm } from './geo'

export interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id: number
    name: string
    city?: string
    state?: string
    country?: string
  }
}

export interface PlaceResult {
  id: string
  primary: string
  secondary: string
  lat: number
  lng: number
}

type LatLng = { lat: number; lng: number }

export const PLACE_RESULT_LIMIT = 5
const PHOTON_FETCH_LIMIT = 8
/** Filtr „tylko miejscowości”: miasto, miasteczko, wieś. */
export const SETTLEMENT_TAGS = ['place:city', 'place:town', 'place:village'] as const

/** Photon zna tylko kilka języków; reszta UI dostaje angielskie nazwy. */
export function photonLang(uiLang: string): string {
  return ['de', 'en', 'fr', 'it'].includes(uiLang) ? uiLang : 'en'
}

export function photonUrl(query: string, opts: { lang: string; near: LatLng | null; settlementsOnly: boolean }): string {
  const params = new URLSearchParams({ q: query, limit: String(PHOTON_FETCH_LIMIT), lang: opts.lang })
  if (opts.near) {
    params.set('lat', String(opts.near.lat))
    params.set('lon', String(opts.near.lng))
  }
  if (opts.settlementsOnly) for (const tag of SETTLEMENT_TAGS) params.append('osm_tag', tag)
  return `https://photon.komoot.io/api/?${params}`
}

export function parsePhoton(features: PhotonFeature[], near: LatLng | null): PlaceResult[] {
  const seen = new Set<string>()
  const results: PlaceResult[] = []

  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const { name, city, state, country } = f.properties
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const parts = [city, state, country].filter(Boolean)
    results.push({
      id: `${f.properties.osm_id}-${lat}-${lng}`,
      primary: name,
      secondary: parts.slice(0, 2).join(', '),
      lat,
      lng,
    })
  }

  if (near) {
    results.sort((a, b) =>
      haversineKm(near.lat, near.lng, a.lat, a.lng) -
      haversineKm(near.lat, near.lng, b.lat, b.lng)
    )
  }

  return results.slice(0, PLACE_RESULT_LIMIT)
}

export async function searchPlaces(
  query: string,
  opts: { lang: string; near: LatLng | null; settlementsOnly?: boolean; signal?: AbortSignal },
): Promise<PlaceResult[]> {
  const res = await fetch(
    photonUrl(query, { lang: opts.lang, near: opts.near, settlementsOnly: opts.settlementsOnly ?? false }),
    { signal: opts.signal },
  )
  const data = await res.json()
  return parsePhoton(data.features ?? [], opts.near)
}

type ReverseProps = {
  name?: string; osm_key?: string; street?: string; housenumber?: string
  district?: string; locality?: string; city?: string
}

/** Obiekty, których nazwa opisuje okolicę; reszta (sklep, lokal) to przypadek. */
const AREA_KEYS = ['place', 'highway', 'boundary']

/**
 * Nazwa okolicy punktu dla człowieka: „Rynek, Rzeszów”, „Marszałkowska,
 * Warszawa”, „Śródmieście, Warszawa”. Środek mapy to nie adres, więc bez numeru
 * domu, a nazwa sklepu czy baru, który akurat tam stoi, idzie na sam koniec
 * kolejki. Null, gdy Photon nie zna niczego w pobliżu.
 */
export function reverseLabel(f: { properties: ReverseProps }): string | null {
  const { name, osm_key, street, district, locality, city } = f.properties
  const areaName = name && osm_key && AREA_KEYS.includes(osm_key) ? name : undefined
  const main = areaName || street || district || locality || name || city
  if (!main) return null
  return city && city !== main ? `${main}, ${city}` : main
}

/**
 * Co jest w punkcie (lat, lng) — pierwszy obiekt z Photon /reverse. Nazwy
 * lokalne („Warszawa”, nie „Warsaw”): to nazwa miejsca, nie tłumaczenie UI.
 */
export async function reversePlaceLabel(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang: 'default', limit: '1' })
    const res = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal })
    const data = await res.json()
    const f = data.features?.[0]
    return f ? reverseLabel(f) : null
  } catch {
    return null
  }
}
