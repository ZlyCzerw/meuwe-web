import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import type { EventWithMeta } from '../lib/types'

export function useEvents(pos: { lat: number; lng: number } | null, dayOffset: number) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const chanRef = useRef<ReturnType<typeof db.subscribeEvents> | null>(null)

  const load = useCallback(async () => {
    if (!pos) return
    const data = await db.getEvents(pos.lat, pos.lng, 15, dayOffset)
    setEvents(data)
    setLoading(false)
  }, [pos, dayOffset])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!pos) return
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeEvents(() => load())
    return () => db.unsub(chanRef.current)
  }, [pos, load])

  return { events, loading }
}
