import fs from 'node:fs'
import type { Bbox, Coords, RegionConfig, VenueEntry } from './types.ts'

export type GeoMethod =
  | 'venue-registry'  // hand-curated coords, no network
  | 'nominatim'       // venue-level Nominatim hit (bbox-validated when strict)
  | 'city-fallback'   // lenient only: city centroid
  | 'region-center'   // lenient only: last resort
  | 'none'            // strict only: event must be dropped

export interface GeoResult {
  coords: Coords | null
  method: GeoMethod
}

const UA = 'meuwe-event-sync/2.0 (meuwe@gmail.com)'
const MISS_TTL_MS = 7 * 24 * 3_600_000 // negative cache entries self-heal after a week

/** lowercase, Polish/Spanish diacritics stripped, punctuation → space. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inBbox(c: Coords, b: Bbox): boolean {
  return c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng
}

/** First venue whose alias equals or is contained in the normalized name wins. */
export function matchVenue(venueName: string, region: RegionConfig): VenueEntry | null {
  const norm = normalizeName(venueName)
  if (!norm) return null
  for (const v of region.venues) {
    if (v.aliases.some(a => norm === a || norm.includes(a))) return v
  }
  return null
}

type CacheEntry = Coords | { miss: true; at: string }
const COUNTRY_NAMES: Record<string, string> = { ES: 'Spain', PL: 'Poland' }

export class Geocoder {
  private cache: Record<string, CacheEntry> = {}
  private lastCall = 0

  constructor(private region: RegionConfig, private cachePath: string) {
    if (fs.existsSync(cachePath)) {
      try { this.cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) } catch { /* corrupt cache = empty */ }
    }
  }

  save(): void {
    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 1), 'utf8')
  }

  private async nominatim(params: URLSearchParams, validateBbox: boolean): Promise<Coords | null> {
    const wait = 1100 - (Date.now() - this.lastCall) // Nominatim ToS: max 1 req/s
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    this.lastCall = Date.now()
    try {
      params.set('format', 'json')
      params.set('limit', '3')
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': UA },
      })
      if (!res.ok) return null
      const data = await res.json() as Array<{ lat: string; lon: string }>
      for (const hit of data) {
        const c = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
        if (!validateBbox || inBbox(c, this.region.bbox)) return c
      }
      return null
    } catch {
      return null
    }
  }

  async geocode(venueName: string, city: string, address?: string): Promise<GeoResult> {
    // 1. Venue registry — instant, hand-verified.
    const v = matchVenue(venueName, this.region)
    if (v) return { coords: { lat: v.lat, lng: v.lng }, method: 'venue-registry' }

    const strict = this.region.precision === 'strict'
    const key = normalizeName(`${this.region.id} ${venueName} ${city} ${address ?? ''}`)
    const cached = this.cache[key]
    if (cached) {
      if (!('miss' in cached)) return { coords: cached, method: 'nominatim' }
      if (Date.now() - Date.parse(cached.at) < MISS_TTL_MS) return this.fallback(city)
      delete this.cache[key] // expired negative entry → retry
    }

    const cc = this.region.country.toLowerCase()
    let coords: Coords | null = null

    // 2. Structured query with street address — most precise.
    if (address) {
      coords = await this.nominatim(
        new URLSearchParams({ street: address, city, countrycodes: cc }), strict)
    }

    // 3. Free-text venue + city; in strict mode bounded to the region viewbox.
    if (!coords && venueName && venueName !== city) {
      const params = new URLSearchParams({ q: `${venueName}, ${city}`, countrycodes: cc })
      if (strict) {
        const b = this.region.bbox
        params.set('viewbox', `${b.minLng},${b.maxLat},${b.maxLng},${b.minLat}`)
        params.set('bounded', '1')
      }
      coords = await this.nominatim(params, strict)
    }

    if (coords) {
      this.cache[key] = coords
      return { coords, method: 'nominatim' }
    }
    this.cache[key] = { miss: true, at: new Date().toISOString() }
    return this.fallback(city)
  }

  /** strict: drop. lenient: v1 chain — city query → cityCoords → center. */
  private async fallback(city: string): Promise<GeoResult> {
    if (this.region.precision === 'strict') return { coords: null, method: 'none' }

    const countryName = COUNTRY_NAMES[this.region.country] ?? this.region.country
    const cityKey = normalizeName(`${this.region.id} city ${city}`)
    const cached = this.cache[cityKey]
    if (cached && !('miss' in cached)) return { coords: cached, method: 'city-fallback' }

    const missFresh = cached && 'miss' in cached &&
      Date.now() - Date.parse(cached.at) < MISS_TTL_MS
    if (city && !missFresh) {
      const c = await this.nominatim(new URLSearchParams({ q: `${city}, ${countryName}` }), false)
      if (c) {
        this.cache[cityKey] = c
        return { coords: c, method: 'city-fallback' }
      }
      this.cache[cityKey] = { miss: true, at: new Date().toISOString() }
    }

    const k = city.toLowerCase().trim()
    const cityCoords = this.region.cityCoords
    if (cityCoords[k]) return { coords: cityCoords[k], method: 'city-fallback' }
    for (const [name, c] of Object.entries(cityCoords)) {
      if (k && (k.includes(name) || name.includes(k))) return { coords: c, method: 'city-fallback' }
    }
    return { coords: this.region.center, method: 'region-center' }
  }
}
