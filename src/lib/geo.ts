import type { Lang } from './types'
import { isNativePlatform } from './platform'
import { Geolocation } from '@capacitor/geolocation'

export function haversineKm(lat1:number,lng1:number,lat2:number,lng2:number):number {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
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
