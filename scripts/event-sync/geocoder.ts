import type { Coords, RegionConfig } from './types.ts'

const cache = new Map<string, Coords>()
const UA = 'meuwe-event-sync/1.0 (meuwe@gmail.com)'
let lastCall = 0

async function nominatim(query: string): Promise<Coords | null> {
  // Rate limit: max 1 req/sec (Nominatim ToS)
  const wait = 1100 - (Date.now() - lastCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCall = Date.now()

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

function fallbackCoords(city: string, cityCoords: Record<string, Coords>): Coords | null {
  const key = city.toLowerCase().trim()
  if (cityCoords[key]) return cityCoords[key]
  for (const [k, v] of Object.entries(cityCoords)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

const COUNTRY_NAMES: Record<string, string> = { ES: 'Spain', PL: 'Poland' }

/** v1 geocoding chain, parameterized by region. Replaced by Geocoder in Task 4. */
export async function geocode(venueName: string, city: string, region: RegionConfig): Promise<Coords> {
  const cacheKey = `${region.id}|${venueName}|${city}`.toLowerCase()
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  const countryName = COUNTRY_NAMES[region.country] ?? region.country

  // 1. Specific venue + city + country
  if (venueName && venueName !== city) {
    const c = await nominatim(`${venueName}, ${city}, ${countryName}`)
    if (c) { cache.set(cacheKey, c); return c }
  }

  // 2. City + country only
  const c2 = await nominatim(`${city}, ${countryName}`)
  if (c2) { cache.set(cacheKey, c2); return c2 }

  // 3. Hardcoded municipality fallback (instant, no network)
  const fb = fallbackCoords(city, region.cityCoords)
  if (fb) { cache.set(cacheKey, fb); return fb }

  // 4. Region centre as last resort
  cache.set(cacheKey, region.center)
  return region.center
}
