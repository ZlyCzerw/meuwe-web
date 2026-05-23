import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import type { EventWithMeta } from '../lib/types'

export function useEvents(pos: { lat: number; lng: number } | null, dayOffset: number) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const chanRef = useRef<ReturnType<typeof db.subscribeEvents> | null>(null)

  const lat = pos?.lat ?? null
  const lng = pos?.lng ?? null

  const load = useCallback(async () => {
    if (lat === null || lng === null) return
    const data = await db.getEvents(lat, lng, 15, dayOffset)
    setEvents(data)
    setLoading(false)
  }, [lat, lng, dayOffset])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (lat === null || lng === null) return
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeEvents(() => load())
    return () => db.unsub(chanRef.current)
  }, [lat, lng, load])

  return { events, loading }
}
