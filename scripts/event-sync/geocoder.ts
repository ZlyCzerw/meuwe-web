import type { Coords } from './types.ts';
import { fallbackCoords } from './mapper.ts';

/** Last-resort coordinates: centre of Tenerife. */
export const TENERIFE_CENTER = { lat: 28.2916, lng: -16.6291 };

const cache = new Map<string, Coords>();
const UA = 'meuwe-event-sync/1.0 (meuwe@gmail.com)';
let lastCall = 0;

async function nominatim(query: string): Promise<Coords | null> {
  // Rate limit: max 1 req/sec (Nominatim ToS)
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Geocode a venue + city combination.
 * @param venueName  Specific venue/place name
 * @param city       Municipality or city
 * @param country    ISO country code hint (default 'ES')
 */
export async function geocode(venueName: string, city: string, country = 'ES'): Promise<Coords> {
  const cacheKey = `${venueName}|${city}|${country}`.toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const countryName = country === 'ES' ? 'Spain' : country;

  // 1. Specific venue + city + country
  if (venueName && venueName !== city) {
    const c = await nominatim(`${venueName}, ${city}, ${countryName}`);
    if (c) { cache.set(cacheKey, c); return c; }
  }

  // 2. City + country only
  const c2 = await nominatim(`${city}, ${countryName}`);
  if (c2) { cache.set(cacheKey, c2); return c2; }

  // 3. Hardcoded municipality fallback (instant, no network)
  const fb = fallbackCoords(city);
  if (fb) { cache.set(cacheKey, fb); return fb; }

  // 4. Centre of Tenerife as last resort
  cache.set(cacheKey, TENERIFE_CENTER);
  return TENERIFE_CENTER;
}
