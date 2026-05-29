import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import type { EventWithMeta } from '../lib/types'

export function useEvents(pos: { lat: number; lng: number } | null, dayOffset: number, refreshKey = 0, km = 15) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const chanRef = useRef<ReturnType<typeof db.subscribeEvents> | null>(null)

  // Round to 4 decimal places (~11m) to avoid refetching on tiny GPS jitter
  const lat = pos != null ? Math.round(pos.lat * 1e4) / 1e4 : null
  const lng = pos != null ? Math.round(pos.lng * 1e4) / 1e4 : null

  const load = useCallback(async () => {
    if (lat === null || lng === null) return
    const data = await db.getEvents(lat, lng, km, dayOffset)
    setEvents(data)
    setLoading(false)
  }, [lat, lng, dayOffset, km])

  // reload whenever load changes OR refreshKey bumps
  useEffect(() => { load() }, [load, refreshKey])

  // auto-refresh every 5 minutes so ended events disappear without user action
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (lat === null || lng === null) return
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeEvents(() => load())
    return () => db.unsub(chanRef.current)
  }, [lat, lng, load])

  return { events, loading }
}
