// Kto dostaje powiadomienie o wydarzeniu.
//
// Public events fan out by location + interests. Private events never do: they
// are hidden by RLS from everyone except the creator and the users following
// them, so a notification about one may only reach that same set. Tags change
// nothing here — a private event with tags is still private. Public events
// additionally reach the event's followers - at insert time those are the
// creator's followers, added by a database trigger.

export const MAX_RADIUS_KM = 50

// Mirror of DEFAULT_RADIUS_KM in src/lib/appConfig.ts. Deno and the web bundle
// cannot share a module, so the two are kept equal by hand — change both.
// Exported for the weekly digest, which applies the same radius rule.
export const DEFAULT_RADIUS_KM = 10

export type AudienceProfile = {
  id: string
  interests: string[] | null
  radius_km: number | null
  last_lat: number
  last_lng: number
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function selectEventAudience(opts: {
  isPrivate: boolean
  tags: string[]
  profiles: AudienceProfile[]
  lat: number
  lng: number
  creatorId?: string | null
  /** Followers of this event — reached regardless of distance and interests. */
  followerIds?: string[]
  /** True when the creator triggered the notification themselves. */
  excludeCreator?: boolean
}): string[] {
  const {
    isPrivate, tags, profiles, lat, lng,
    creatorId = null, followerIds = [], excludeCreator = false,
  } = opts

  if (isPrivate) {
    const ids = new Set(followerIds)
    if (creatorId) ids.add(creatorId)
    if (excludeCreator && creatorId) ids.delete(creatorId)
    return [...ids]
  }

  const geo = profiles.filter((p) => {
    if (tags.length > 0) {
      const interests = p.interests ?? []
      if (!interests.some((i) => tags.includes(i))) return false
    }
    const radius = Math.min(p.radius_km ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    return haversineKm(p.last_lat, p.last_lng, lat, lng) <= radius
  }).map((p) => p.id)

  // Obserwujący twórcy (w event_follows od chwili utworzenia, przez trigger
  // w bazie) dochodzą niezależnie od promienia i tagów - to ich wybór.
  const ids = new Set([...geo, ...followerIds])
  if (excludeCreator && creatorId) ids.delete(creatorId)
  return [...ids]
}
