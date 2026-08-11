import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/supabase'
import { mergeEvents } from '../lib/eventCache'
import type { FetchView } from '../lib/mapView'
import type { EventWithMeta } from '../lib/types'

/**
 * The events for a map view, kept across views rather than refetched for each
 * one.
 *
 * `view` is null until the map has been laid out and knows what it is showing.
 * Nothing is fetched until then — a guessed box would only buy a throwaway
 * query and an answer about a view nobody is looking at. After that it moves
 * only when the viewport leaves what was last fetched (see lib/mapView), so
 * ordinary panning asks nothing of the network at all.
 */
export function useEvents(view: FetchView | null, dayOffset: number, refreshKey = 0) {
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const loadIdRef = useRef(0)

  // Round to 4 decimal places (~11m) so the query key cannot be churned by
  // floating-point noise in a view that has not really moved.
  const lat = view ? Math.round(view.lat * 1e4) / 1e4 : null
  const lng = view ? Math.round(view.lng * 1e4) / 1e4 : null
  const km = view ? view.km : null

  // Which view the events in hand were fetched for. While `answered` lags the
  // question being asked, some part of the map is still waiting on an answer —
  // and that gap is what `loading` means. The empty-state card reads it to tell
  // "we asked and there is nothing" apart from "the answer is still on its way".
  // Refetches that don't change the question (the 5-minute refresh, realtime)
  // leave `answered` matching, so they never blink the UI.
  const query = `${lat},${lng},${km},${dayOffset}`
  const [answered, setAnswered] = useState<string | null>(null)

  // A different day is a different set of events, not more of the same one, so
  // the cache cannot carry across it. Cleared during the render that brings the
  // new day in rather than in an effect afterwards: an effect would leave one
  // painted frame showing yesterday's pins under today's question.
  const [dayInState, setDayInState] = useState(dayOffset)
  if (dayInState !== dayOffset) {
    setDayInState(dayOffset)
    setEvents([])
  }

  const load = useCallback(async () => {
    if (lat === null || lng === null || km === null) return
    const id = ++loadIdRef.current
    const box = { lat, lng, km }
    const data = await db.getEvents(lat, lng, km, dayOffset)
    if (id !== loadIdRef.current) return // a newer question is out; this answer is stale
    // null means the query failed, which is not a statement about what is out
    // there. Keeping the events is the difference between a hiccup nobody
    // notices and a map that empties itself.
    if (data !== null) setEvents(prev => mergeEvents(prev, data, box))
    setAnswered(query)
  }, [lat, lng, km, dayOffset, query])

  // reload whenever load changes OR refreshKey bumps.
  // set-state-in-effect cannot see through the await: everything `load` runs
  // synchronously is a guard, a counter and an object literal. The state is
  // touched only once the network has answered.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load, refreshKey])

  // The refresh and the realtime channel want the current `load`, but neither
  // wants to be torn down and rebuilt every time it changes identity — which is
  // every time the map view moves. The channel in particular used to be
  // unsubscribed and resubscribed on every pan.
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  // auto-refresh every 5 minutes so ended events disappear without user action
  useEffect(() => {
    const id = setInterval(() => loadRef.current(), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const ch = db.subscribeEvents(() => loadRef.current())
    return () => db.unsub(ch)
  }, [])

  return {
    events,
    loading: answered !== query,
    // Has this hook ever answered anything. The full-screen splash hangs off
    // this and not off `loading`, so it stays a cold-start screen instead of
    // reappearing every time the map is nudged.
    ready: answered !== null,
  }
}
