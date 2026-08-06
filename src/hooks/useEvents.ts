import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import type { EventWithMeta } from '../lib/types'

/**
 * `km` is null until the map knows how much of the world it is showing. Nothing
 * is fetched until then — a guessed radius would only buy a throwaway query and
 * an answer about a view nobody is looking at.
 */
export function useEvents(pos: { lat: number; lng: number } | null, dayOffset: number, refreshKey = 0, km: number | null = null) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const chanRef = useRef<ReturnType<typeof db.subscribeEvents> | null>(null)
  const loadIdRef = useRef(0)

  // Round to 4 decimal places (~11m) to avoid refetching on tiny GPS jitter
  const lat = pos != null ? Math.round(pos.lat * 1e4) / 1e4 : null
  const lng = pos != null ? Math.round(pos.lng * 1e4) / 1e4 : null

  // Which view the events in hand were fetched for. While `answered` lags the
  // question being asked, the events on screen belong to a different view — and
  // that gap is what `loading` means. The empty-state card reads it to tell "we
  // asked and there is nothing" apart from "the answer is still on its way";
  // without it, a map that had just widened showed the events of the view it
  // left behind, and an empty card over a view it had not yet asked about.
  // Refetches that don't change the question (the 5-minute refresh, realtime)
  // leave `answered` matching, so they never blink the UI back into loading.
  const query = `${lat},${lng},${dayOffset},${km}`
  const [answered, setAnswered] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (lat === null || lng === null || km === null) return
    const id = ++loadIdRef.current
    const data = await db.getEvents(lat, lng, km, dayOffset)
    if (id !== loadIdRef.current) return // a newer question is out; this answer is stale
    setEvents(data)
    setAnswered(query)
  }, [lat, lng, dayOffset, km, query])

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

  return { events, loading: answered !== query }
}
