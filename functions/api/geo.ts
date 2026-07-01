// Cloudflare Pages Function: GET /api/geo
// Returns the coarse geolocation Cloudflare already computed for the request IP.
// The response is per-IP — it must never be cached and served to another user.

interface CfGeo {
  latitude?: string
  longitude?: string
  country?: string
}

export const onRequestGet = (context: { request: Request }): Response => {
  const cf = (context.request as Request & { cf?: CfGeo }).cf ?? {}
  const lat = cf.latitude != null ? Number(cf.latitude) : NaN
  const lng = cf.longitude != null ? Number(cf.longitude) : NaN
  const country = (cf.country ?? '').toUpperCase()

  const body =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, country } : { country }

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
