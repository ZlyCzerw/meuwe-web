/**
 * One-off check: compares each RZESZOW_VENUES entry against Nominatim and
 * prints the distance. Run after editing the registry:
 *   npx tsx scripts/event-sync/verify-venues.ts
 * Investigate anything > 250 m (or NO RESULT) and fix coords by hand
 * (OpenStreetMap / Google Maps), then re-run.
 */
import { RZESZOW_VENUES } from './regions/rzeszow-venues.ts'

const UA = 'meuwe-event-sync/2.0 (meuwe@gmail.com)'

function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(s)))
}

for (const v of RZESZOW_VENUES) {
  await new Promise(r => setTimeout(r, 1100))
  const q = encodeURIComponent(`${v.name.split('(')[0].trim()}, ${v.city}, Poland`)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { 'User-Agent': UA } },
  )
  const hits = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
  if (!hits.length) { console.log(`?? NO RESULT   ${v.name}`); continue }
  const d = distMeters(v.lat, v.lng, parseFloat(hits[0].lat), parseFloat(hits[0].lon))
  const flag = d > 250 ? '⚠️ ' : 'ok '
  console.log(`${flag} ${String(d).padStart(5)}m  ${v.name}  (${hits[0].display_name.slice(0, 60)})`)
}
