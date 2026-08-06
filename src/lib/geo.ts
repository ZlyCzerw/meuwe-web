import type { Lang } from './types'
import { isNativePlatform } from './platform'
import { Geolocation } from '@capacitor/geolocation'

export function haversineKm(lat1:number,lng1:number,lat2:number,lng2:number):number {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

/** Closest the map ever opens itself. Past this a lone event fills the screen with one roof. */
export const MAX_MAP_ZOOM = 18
/** Widest the map ever opens itself — matches MAX_RADIUS_KM in the fan-out. */
export const MAX_MAP_KM = 50

/** Kilometres to a degree of latitude. Longitude is this times cos(lat). */
const KM_PER_DEG_LAT = 111

/**
 * Half-width of a lat/lng box that reaches `km` in every direction from a point.
 *
 * The two deltas are not the same number. Meridians stay 111 km apart all the
 * way up, but parallels converge, so a degree of longitude is only 111·cos(lat)
 * km wide. Dividing by 111 on both axes — which both map queries used to do —
 * quietly squashes the box east-west: a "50 km" box reaches 32 km in Rzeszów
 * and 44 in Tenerife, and an event due east of you is simply never fetched.
 *
 * The box is only the coarse filter. Callers that owe an exact radius measure
 * it again with haversineKm; the ones that don't would rather show a pin from
 * just past the corner than miss one inside the circle.
 */
export function bboxDeltas(km: number, lat: number): { dLat: number; dLng: number } {
  const cosLat = Math.abs(Math.cos(lat * Math.PI / 180))
  // cos(lat) reaches zero at the poles and the longitude delta would run off to
  // infinity. 180° is both the widest a box can be and, up there, the true
  // answer: every meridian is a short walk from the pole.
  const dLng = cosLat > 0 ? Math.min(km / (KM_PER_DEG_LAT * cosLat), 180) : 180
  return { dLat: km / KM_PER_DEG_LAT, dLng }
}

/**
 * The zoom level that frames `targetKm` from the centre to the nearer screen
 * edge, on a portrait phone.
 *
 * Solve for Z: (shortPx/2) x 40075 x cos(lat) / (256 x 2^Z) = targetKm
 */
export function kmToZoom(targetKm: number, lat: number): number {
  const shortPx = Math.min(window.innerWidth, window.innerHeight)
  const cosLat = Math.cos(lat * Math.PI / 180)
  const km = Math.min(Math.max(targetKm, 0.01), MAX_MAP_KM)
  const z = Math.log2((shortPx / 2) * 40075 * cosLat / (256 * km))
  return Math.max(kmToZoomUnclamped(MAX_MAP_KM, lat), Math.min(MAX_MAP_ZOOM, Math.round(z)))
}

function kmToZoomUnclamped(km: number, lat: number): number {
  const shortPx = Math.min(window.innerWidth, window.innerHeight)
  const cosLat = Math.cos(lat * Math.PI / 180)
  return Math.round(Math.log2((shortPx / 2) * 40075 * cosLat / (256 * km)))
}

/**
 * Where the map opens on a cold start: far enough to take in the nearest thing
 * happening, and the same distance again, so the first pin on screen is not the
 * only pin on screen.
 *
 * Same rule as radiusFromNearest in lib/onboarding — one answer explains both
 * what you see at launch and what you get told about later. `nearestKm` is null
 * when nothing was found or the position is unknown, and then the widest view is
 * the only one that can show anything at all.
 */
export function startupZoom(nearestKm: number | null, lat: number): number {
  if (nearestKm === null) return kmToZoom(MAX_MAP_KM, lat)
  return kmToZoom(Math.min(nearestKm * 2, MAX_MAP_KM), lat)
}

const ES_COUNTRIES = new Set(['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR'])
const DE_COUNTRIES = new Set(['DE','AT','CH','LI'])

export function countryToLang(code:string):Lang {
  const c=(code||'').toUpperCase()
  if (c==='PL') return 'pl'
  if (c==='SI') return 'sl'
  if (ES_COUNTRIES.has(c)) return 'es'
  if (DE_COUNTRIES.has(c)) return 'de'
  return 'en'
}

export async function getCurrentPosition():Promise<{lat:number;lng:number}|null> {
  if (isNativePlatform()) {
    try {
      const perm = await Geolocation.requestPermissions()
      if (perm.location === 'denied') return null
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch { return null }
  }
  return new Promise(resolve=>{
    if(!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
      ()=>resolve(null),
      { enableHighAccuracy:false, timeout:8000, maximumAge:600000 }
    )
  })
}

// Production web origin — used only by native builds, whose runtime origin is
// capacitor://localhost. Web builds call the same-origin relative path.
const WEB_ORIGIN = 'https://meuwe.eu'

export type IpGeo = { lat: number; lng: number; country: string }

// Parse the /api/geo response. Returns null unless finite lat/lng are present.
export function parseIpGeo(data: unknown): IpGeo | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const lat = typeof d.lat === 'number' ? d.lat : Number(d.lat)
  const lng = typeof d.lng === 'number' ? d.lng : Number(d.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const country = typeof d.country === 'string' ? d.country.toUpperCase() : ''
  return { lat, lng, country }
}

// Coarse IP-based location from our Cloudflare Pages Function. Non-blocking,
// short timeout, null on any failure. Web uses the same-origin path; native uses
// the absolute production URL (its own origin is capacitor://localhost).
export async function getIpLocation(): Promise<IpGeo | null> {
  const url = (isNativePlatform() ? WEB_ORIGIN : '') + '/api/geo'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return parseIpGeo(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function reverseGeocodeCountry(lat:number,lng:number):Promise<string|null> {
  try {
    const url=`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`
    const res=await fetch(url,{headers:{'Accept-Language':'en'}})
    const data=await res.json()
    return data?.address?.country_code ? String(data.address.country_code).toUpperCase() : null
  } catch { return null }
}
