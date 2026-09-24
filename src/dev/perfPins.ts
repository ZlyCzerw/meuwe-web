import { ALL_CATEGORIES } from '../lib/tokens'
import { MAX_MAP_KM } from '../lib/geo'
import type { EventWithMeta } from '../lib/types'

// Syntetyczne wydarzenia do pomiarów wydajności mapy (?perfPins=N, tylko dev).
// Deterministyczne: to samo ziarno daje ten sam układ, więc pomiar przed
// zmianą i po niej patrzy na tę samą mapę.

// mulberry32 - mały, szybki, powtarzalny generator.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makePerfEvents(
  n: number,
  center: { lat: number; lng: number },
  seed = 1,
  now = new Date(),
): EventWithMeta[] {
  const r = rng(seed)
  const kmPerDegLng = 111.32 * Math.cos((center.lat * Math.PI) / 180)
  const out: EventWithMeta[] = []
  for (let i = 0; i < n; i++) {
    // Losowania zawsze w tej samej liczbie i kolejności, żeby układ nie
    // zależał od tego, które wydarzenie trafiło na klaster.
    const distKm = Math.sqrt(r()) * (MAX_MAP_KM - 0.5)
    const ang = r() * 2 * Math.PI
    const catIdx = Math.floor(r() * ALL_CATEGORIES.length)
    const live = r() < 0.1
    const isPrivate = r() < 0.05
    const hoursAhead = 1 + r() * 10
    const interactions = Math.floor(r() * r() * 120)
    // Co dwudzieste stoi dokładnie na poprzednim - tak powstają klastry 3x3 m.
    const prev = out[i - 1]
    const stack = prev !== undefined && i % 20 === 0
    const lat = stack ? prev.lat : center.lat + (distKm * Math.sin(ang)) / 111.32
    const lng = stack ? prev.lng : center.lng + (distKm * Math.cos(ang)) / kmPerDegLng
    const startMs = live ? now.getTime() - 3600e3 : now.getTime() + hoursAhead * 3600e3
    out.push({
      id: `perf-${i}`,
      title: `Perf ${i}`,
      description: null,
      lat, lng,
      place_name: null,
      category: ALL_CATEGORIES[catIdx],
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(startMs + 3 * 3600e3).toISOString(),
      creator_id: null,
      status: live ? 'live' : 'upcoming',
      created_at: now.toISOString(),
      photos: null,
      is_private: isPrivate,
      tags: [],
      distKm,
      distStr: `${distKm.toFixed(1)} km`,
      interactionCount: interactions,
    })
  }
  return out
}
