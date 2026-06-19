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
  if (ES_COUNTRIES.has(c)) return 'es'
  if (DE_COUNTRIES.has(c)) return 'de'
  return 'en'
}

export async function getCurrentPosition():Promise<{lat:number;lng:number}|null> {
  if (isNativePlatform()) {
    try {
      const perm = await Geolocation.requestPermissions()
      if (perm.location === 'denied') return null
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch { return null }
  }
  return new Promise(resolve=>{
    if(!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
      ()=>resolve(null),
      { enableHighAccuracy:false, timeout:8000, maximumAge:30000 }
    )
  })
}

export async function reverseGeocodeCountry(lat:number,lng:number):Promise<string|null> {
  try {
    const url=`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`
    const res=await fetch(url,{headers:{'Accept-Language':'en'}})
    const data=await res.json()
    return data?.address?.country_code ? String(data.address.country_code).toUpperCase() : null
  } catch { return null }
}
