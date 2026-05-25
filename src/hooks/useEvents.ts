import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import type { EventWithMeta } from '../lib/types'

export function useEvents(pos: { lat: number; lng: number } | null, dayOffset: number, refreshKey = 0) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const chanRef = useRef<ReturnType<typeof db.subscribeEvents> | null>(null)

  // Round to 4 decimal places (~11m) to avoid refetching on tiny GPS jitter
  const lat = pos != null ? Math.round(pos.lat * 1e4) / 1e4 : null
  const lng = pos != null ? Math.round(pos.lng * 1e4) / 1e4 : null

  const load = useCallback(async () => {
    if (lat === null || lng === null) return
    const data = await db.getEvents(lat, lng, 15, dayOffset)
    setEvents(data)
    setLoading(false)
  }, [lat, lng, dayOffset])

  // reload whenever load changes OR refreshKey bumps
  useEffect(() => { load() }, [load, refreshKey])

  useEffect(() => {
    if (lat === null || lng === null) return
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeEvents(() => load())
    return () => db.unsub(chanRef.current)
  }, [lat, lng, load])

  return { events, loading }
}
