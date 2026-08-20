import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import type { EventWithMeta, Profile } from '../lib/types'
import { useEvents } from '../hooks/useEvents'
import { haversineKm, startupZoom, MAX_MAP_KM } from '../lib/geo'
import { db } from '../lib/supabase'
import { enablePushOnThisDevice } from '../lib/push'
import {
  summariseProbe, pickEmptyStateVariant, shouldOfferWayOut,
  type NearbyProbe, type EmptyVariant,
} from '../lib/emptyState'
import { pinHTML, meHTML, privateHTML, clusterHTML } from '../components/mapIcons'
import { isCurrentlyLive } from '../lib/eventStatus'
import Avatar from '../components/Avatar'
import AddButton from '../components/AddButton'
import SearchBar from './SearchBar'
import TagPickerModal from '../components/TagPickerModal'
import AdaptiveFilterBar from '../components/AdaptiveFilterBar'
import EventPickerModal from '../components/EventPickerModal'
import { clusterPublicEvents } from '../lib/eventClusters'
import { overlapChainInView } from '../lib/pinOverlap'
import { nextFetchView, type FetchView } from '../lib/mapView'
import { useDeviceHeading } from '../hooks/useDeviceHeading'
import { MeuweLogo } from '../components/MeuweLogo'
import { TODAY_IDX, idxToOffset, idxToDate, dateToIdx, isInRange, type DayRange } from '../lib/timeline'
import DayTimeline, { type TimelineMode } from '../components/DayTimeline'

const WARSAW = { lat: 52.2297, lng: 21.0122 }
const IP_ZOOM = 11 // coarse city-level zoom for an IP-based guess (GPS uses 15)

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

function MapScreen({
  session,
  profile,
  onOpenProfile,
  unreadMenu = false,
  onOpenCreate,
  onOpenEvent,
  onAuthNeeded,
  userPos,
  lastKnownPos,
  ipPos,
  initialZoom = 15,
  initialCenter,
  pickingLocation,
  onLocationPicked,
  eventsRefreshKey,
  onMapClick,
  onRegisterFlyTo,
  onRegisterFlyToSpot,
  onRegisterShowDay,
  onPoolChange,
}: {
  session: Session | null
  profile: Profile | null
  onOpenProfile: () => void
  unreadMenu?: boolean
  onOpenCreate: () => void
  onOpenEvent: (ev: EventWithMeta) => void
  onAuthNeeded: () => void
  userPos: { lat: number; lng: number } | null
  lastKnownPos?: { lat: number; lng: number } | null
  ipPos?: { lat: number; lng: number } | null
  initialZoom?: number
  initialCenter?: { lat: number; lng: number } | null
  pickingLocation?: boolean
  onLocationPicked?: (pos: { lat: number; lng: number }) => void
  eventsRefreshKey?: number
  onMapClick?: () => void
  onRegisterFlyTo?: (fn: (lat: number, lng: number) => void) => void
  onRegisterFlyToSpot?: (fn: (lat: number, lng: number, zoom: number) => void) => void
  /**
   * Przestawienie osi dni na konkretną datę. Wydarzenie otwarte z linku żyje
   * w swoim dniu, a nie w dzisiejszym — bez tego mapa mówiłaby „dziś" pod
   * kartą sierpniowego wydarzenia.
   */
  onRegisterShowDay?: (fn: (d: Date) => void) => void
  /**
   * Wydarzenia, po których może chodzić sznurek, razem z podpisem tego, z czego
   * są zbudowane. Zmiana podpisu — inny filtr, inny dzień — resetuje sznurek.
   */
  onPoolChange?: (events: EventWithMeta[], poolKey: string) => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'
  const heading = useDeviceHeading(true)

  const mapRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<L.Map | null>(null)
  const meRef = useRef<L.Marker | null>(null)
  // Markers by event id, each remembered with the look it was built for, so a
  // pin whose look has not changed is left alone instead of rebuilt.
  const pinsRef = useRef<Record<string, { marker: L.Marker; sig: string }>>({})
  const userPosRef = useRef<{ lat: number; lng: number } | null>(userPos)
  useEffect(() => { userPosRef.current = userPos }, [userPos])
  const onMapClickRef = useRef(onMapClick)
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  const centeredRef = useRef(false) // track if we've done the initial center

  const [recenter, setRecenter] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [range, setRange] = useState<DayRange>({ startIdx: TODAY_IDX, endIdx: TODAY_IDX })
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('day')
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  // How much of the world the user is looking at: the number the empty card
  // quotes and the radius "notify me here" writes to the profile. Null until
  // the map has been laid out and has a view to measure.
  const [mapRadiusKm, setMapRadiusKm] = useState<number | null>(null)
  // What events are fetched for, which is a different question. Nothing caps
  // it — the map fetches what it is showing — and it moves only when the
  // viewport leaves what has already been fetched. See lib/mapView.
  const [fetchView, setFetchView] = useState<FetchView | null>(null)
  const fetchViewRef = useRef<FetchView | null>(null)
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [pickerEvents, setPickerEvents] = useState<EventWithMeta[] | null>(null)
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRecenterCheckRef = useRef(false)

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  // ── Empty state ────────────────────────────────────────────────────────────
  // `probed` separates "asked and there is nothing" from "have not asked yet",
  // because only the first of those earns the words "be the first".
  const [probe, setProbe] = useState<{ key: string; result: NearbyProbe | null } | null>(null)
  const [notifyDone, setNotifyDone] = useState(false)
  const autoWidenedRef = useRef(false)
  // Two facts the card needs about this visit, not about this viewport: has the
  // map ever had anything on it, and has the card already had its say.
  const seenAnyEventRef = useRef(false)
  const offeredWayOutRef = useRef(false)

  const emptyCtaStyle: React.CSSProperties = {
    marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 999,
    background: C.primary, color: '#fff', border: `2px solid ${INK}`,
    fontFamily: F.display, fontSize: 14, fontWeight: 800, cursor: 'pointer',
  }

  function dayLabel(idx: number): string {
    if (idxToOffset(idx) === 0) return t('map.today')
    return idxToDate(idx).toLocaleDateString(loc, { weekday: 'long' })
  }

  /**
   * Adopts (lat, lng, zoom) as the view that events are fetched for, at the
   * moment the view is requested rather than when its animation lands. moveend
   * is not a reliable courier for this: Leaflet stops an interrupted animation
   * without ever firing it, which used to leave the fetch radius on its
   * hardcoded default — a wide startup view over an empty 15 km fetch box —
   * until the first touch of the map. Asking early also means the events for
   * the destination load while the flight is still in the air.
   */
  function adoptView(map: L.Map, lat: number, lng: number, zoom: number) {
    const size = map.getSize()
    const corner = map.unproject(map.project([lat, lng], zoom).add([size.x / 2, -size.y / 2]), zoom)
    const halfDiagonalKm = Math.ceil(haversineKm(lat, lng, corner.lat, corner.lng))
    // MAX_MAP_KM is the edge of what the fan-out, the probe and the startup
    // framing deal in. A viewport pulled wider than that (a landscape window, a
    // pinch out) must not turn into a promise meuwe cannot honour, nor into a
    // card claiming a 99 km radius.
    setMapRadiusKm(Math.min(halfDiagonalKm, MAX_MAP_KM))
    setMapCenter({ lat, lng })
    // What gets fetched is emphatically not that number. Tying the two together
    // meant the user's notification radius decided how far out the map would
    // still put pins on the screen, and from about zoom 10 the answer was "no
    // further". This one moves only when the viewport leaves the box already in
    // hand, so ordinary panning costs nothing at all.
    const next = nextFetchView(fetchViewRef.current, { lat, lng, km: halfDiagonalKm })
    if (next) {
      fetchViewRef.current = next
      setFetchView(next)
    }
  }

  /** Flies to the point and adopts the destination as the fetch view now. */
  function flyAdopting(map: L.Map, lat: number, lng: number, zoom: number, duration: number) {
    adoptView(map, lat, lng, zoom)
    map.flyTo([lat, lng], zoom, { duration })
  }

  /** Pulls the view back far enough to take in something `km` away. */
  function widenTo(km: number) {
    const map = leafRef.current
    if (!map) return
    const c = map.getCenter()
    flyAdopting(map, c.lat, c.lng, startupZoom(km, c.lat), 0.8)
  }

  function toggleFilter(f: string) {
    setSelectedFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  const eventsPos = mapCenter || initialCenter || userPos || lastKnownPos || ipPos || WARSAW
  const { events, loading, ready } = useEvents(
    fetchView, idxToOffset(range.startIdx), idxToOffset(range.endIdx), eventsRefreshKey,
  )
  // An event matches a filter if it IS that category or carries it as a tag (handles custom tags too).
  // Memoised because the pins effect keys off it: an inline filter() is a new
  // array every render, and on a phone the compass re-renders this screen
  // dozens of times a second.
  const visibleEvents = useMemo(
    () => selectedFilters.length
      ? events.filter(e => selectedFilters.some(f => e.category === f || (e.tags?.includes(f) ?? false)))
      : events,
    [events, selectedFilters],
  )

  const poolKey = `${[...selectedFilters].sort().join(',')}|${range.startIdx}-${range.endIdx}`
  useEffect(() => {
    onPoolChange?.(visibleEvents, poolKey)
  }, [visibleEvents, poolKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaflet init — runs once
  useEffect(() => {
    if (leafRef.current || !mapRef.current) return
    const initialPos = initialCenter || userPosRef.current
    const start = initialPos || lastKnownPos || ipPos || WARSAW
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
      .setView([start.lat, start.lng], initialZoom)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
    map.on('click', () => onMapClickRef.current?.())
    onRegisterFlyTo?.((lat, lng) => {
      // Offset center downward so the pin appears in the visible area above the event sheet.
      // The sheet covers ~50% of screen height; shift by 25% to center the pin in the upper half.
      const zoom = 16
      const offsetPx = window.innerHeight * 0.25
      const target = map.project([lat, lng], zoom)
      const shifted = map.unproject(target.add([0, offsetPx]), zoom)
      flyAdopting(map, shifted.lat, shifted.lng, zoom, 0.7)
    })
    // Smart-link spot: center exactly on the point at the requested zoom, no sheet offset.
    onRegisterFlyToSpot?.((lat, lng, zoom) => {
      flyAdopting(map, lat, lng, Math.min(zoom, 19), 0.7)
    })
    // Link prowadzi do konkretnego wydarzenia, więc pokazuje jego dzień —
    // zakres z poprzedniego oglądania mapy tylko by go rozmył.
    onRegisterShowDay?.(d => {
      const idx = dateToIdx(d)
      setTimelineMode('day')
      setRange({ startIdx: idx, endIdx: idx })
    })
    map.on('moveend', () => {
      const up = userPosRef.current
      const center = map.getCenter()
      if (up) {
        setRecenter(haversineKm(center.lat, center.lng, up.lat, up.lng) > 0.3)
      } else {
        // GPS not yet available — flag that we need a recenter check when it arrives
        pendingRecenterCheckRef.current = true
      }
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current)
      moveTimerRef.current = setTimeout(() => {
        adoptView(map, center.lat, center.lng, map.getZoom())
      }, 300)
    })
    // The state the map opens on is a view too — without this, a map that
    // starts at the right zoom and is never moved fetches for no view at all.
    adoptView(map, start.lat, start.lng, initialZoom)
    // ...but at this point the container can still be 0x0 — the map is mounted
    // behind the landing screen — and then what was just adopted is a view of
    // nothing, which stands until the first drag. Leaflet re-measures itself on
    // a window resize but nothing else, so a container that changes size on its
    // own goes unnoticed. Watching the element is what makes "every pin in the
    // visible part of the map" true from the moment it is visible.
    const ro = new ResizeObserver(() => {
      map.invalidateSize(false)
      const c = map.getCenter()
      adoptView(map, c.lat, c.lng, map.getZoom())
    })
    ro.observe(mapRef.current)
    leafRef.current = map
    // If GPS already fired before this map instance was ready (e.g. StrictMode double-init),
    // add the me marker immediately using the always-current ref.
    if (initialPos && !meRef.current) {
      const icon = L.divIcon({ html: meHTML(), className: 'meuwe-icon', iconSize: [72, 72], iconAnchor: [36, 36] })
      meRef.current = L.marker([initialPos.lat, initialPos.lng], { icon, zIndexOffset: -1000 }).addTo(map)
      centeredRef.current = true  // started on real GPS — no need to re-center later
    }
    // The markers belong to this map instance; leaving them in the ref would
    // hand a StrictMode remount a set of pins attached to a destroyed map,
    // which the diff would then happily try to reuse.
    return () => { ro.disconnect(); meRef.current = null; pinsRef.current = {}; map.remove(); leafRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Me marker — update on userPos change; center map only on first GPS fix
  useEffect(() => {
    const map = leafRef.current
    if (!userPos || !map) return
    // Update marker position
    if (meRef.current) {
      meRef.current.setLatLng([userPos.lat, userPos.lng])
    } else {
      const icon = L.divIcon({ html: meHTML(), className: 'meuwe-icon', iconSize: [72, 72], iconAnchor: [36, 36] })
      meRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: -1000 }).addTo(map)
    }
    // Center map only once on first GPS fix. It keeps whatever zoom the map is
    // already on: a hardcoded 15 here used to overwrite the startup zoom a
    // second after it was worked out, so the framing calculation never actually
    // reached the screen. A position fix moves the centre, not the scale.
    if (!centeredRef.current) {
      centeredRef.current = true
      map.setView([userPos.lat, userPos.lng], map.getZoom(), { animate: true })
    } else {
      // GPS fired — check if recenter needed (map may have moved while GPS was unavailable)
      const center = map.getCenter()
      if (pendingRecenterCheckRef.current || haversineKm(center.lat, center.lng, userPos.lat, userPos.lng) > 0.3) {
        pendingRecenterCheckRef.current = false
        setRecenter(haversineKm(center.lat, center.lng, userPos.lat, userPos.lng) > 0.3)
      }
    }
  }, [userPos])

  // Direction indicator — rotate the me-marker's orbiting chevron to the compass
  // heading. Updates the DOM node directly (cheap, fires often); userPos in deps
  // re-applies after the marker is (re)created. Hidden when no heading available.
  useEffect(() => {
    const ind = meRef.current?.getElement()?.querySelector('.me-heading') as HTMLElement | null
    if (!ind) return
    if (heading == null) { ind.style.opacity = '0'; return }
    ind.style.transform = `rotate(${heading}deg)`
    ind.style.opacity = '1'
  }, [heading, userPos])

  // IP-based coarse center: apply once, before any GPS fix, without claiming a
  // "real" center — so the first GPS fix still auto-centers (see centeredRef).
  useEffect(() => {
    const map = leafRef.current
    if (!ipPos || !map) return
    if (centeredRef.current || userPosRef.current) return
    adoptView(map, ipPos.lat, ipPos.lng, IP_ZOOM)
    map.setView([ipPos.lat, ipPos.lng], IP_ZOOM, { animate: true })
  }, [ipPos]) // eslint-disable-line react-hooks/exhaustive-deps

  // The empty map asks one cheap question — anything later today further out,
  // anything on a later day — instead of the three heavy ones getEvents would
  // have cost. Debounced, because panning fires this on every settle.
  // The answer is stored with the view it was computed for. Deriving "have we
  // asked about *this* view" from that key, rather than resetting a flag as the
  // view changes, keeps a stale answer from being shown against a new position
  // and keeps setState out of the effect body.
  const probeKey = `${eventsPos.lat.toFixed(3)},${eventsPos.lng.toFixed(3)},${mapRadiusKm ?? '?'}`
  // The card is gated by the probe rather than by a render-time check: the probe
  // effect is the one place allowed to look at the refs, and it simply declines
  // to ask about a view it should not comment on. No probe, no card.
  const isEmptyView = visibleEvents.length === 0 && !loading && !pickingLocation

  useEffect(() => {
    if (visibleEvents.length > 0) { seenAnyEventRef.current = true; return }
    if (!isEmptyView || mapRadiusKm === null) return
    // Someone who has already watched pins appear knows the map has things on
    // it; telling them so every time they cross a field is noise.
    if (!shouldOfferWayOut({
      seenAnyEvent: seenAnyEventRef.current,
      alreadyOffered: offeredWayOutRef.current,
    })) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const rows = await db.probeNearby(eventsPos.lat, eventsPos.lng)
      if (cancelled) return
      setProbe({
        key: probeKey,
        result: rows === null ? null : summariseProbe(rows, {
          lat: eventsPos.lat, lng: eventsPos.lng, viewKm: mapRadiusKm, now: new Date(),
        }),
      })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [isEmptyView, probeKey, eventsPos.lat, eventsPos.lng, mapRadiusKm, visibleEvents.length])

  const emptyVariant = useMemo<EmptyVariant>(
    () => probe?.key === probeKey ? pickEmptyStateVariant(probe.result) : { kind: 'unknown' },
    [probe, probeKey],
  )

  // The card offers a day the probe found, and the probe knows neither the
  // selected range nor the filters. In range mode that day is often already
  // inside the range - the button would then have nothing left to widen, and
  // the user gets only one such invitation, so a dead one costs them all of it.
  const nextDayOfferIsMoot = emptyVariant.kind === 'nextDay'
    && isInRange(TODAY_IDX + emptyVariant.dayOffset, range)

  // Nothing in view but something on today within reach: widen to it instead of
  // saying a word about it. Once per mount, so a user who deliberately zoomed
  // back in afterwards is not fought over it.
  useEffect(() => {
    if (autoWidenedRef.current || emptyVariant.kind !== 'wider') return
    autoWidenedRef.current = true
    widenTo(emptyVariant.nearestKm)
  }, [emptyVariant]) // eslint-disable-line react-hooks/exhaustive-deps

  // The fan-out measures from profiles.last_lat/lng, so this is only honest
  // while the user is looking at their own neighbourhood.
  const canNotifyHere = !!session && !!userPos
    && haversineKm(eventsPos.lat, eventsPos.lng, userPos.lat, userPos.lng) <= (profile?.radius_km ?? MAX_MAP_KM)

  async function handleNotifyHere() {
    if (!session) { onAuthNeeded(); return }
    await enablePushOnThisDevice(session.user.id)
    await db.updateProfile({
      id: session.user.id,
      push_enabled: true,
      radius_km: Math.min(MAX_MAP_KM, Math.max(profile?.radius_km ?? 0, Math.ceil(mapRadiusKm ?? 0))),
    })
    setNotifyDone(true)
  }

  /**
   * A tap on a pin buried under its neighbours spreads them out instead of
   * opening anything: centre on the tapped pin, fly to the closest zoom that
   * still frames its whole overlap chain, and let the user tap again once the
   * pins have separated.
   *
   * `open` is the fall-through for every case where zooming would not help -
   * nothing overlaps, or the map is already as close as it goes. Without it a
   * pin that no zoom can separate (two private events at one address share
   * exact coordinates, and private events never go through clusterPublicEvents)
   * would be permanently unopenable.
   *
   * The zoom comes from getBoundsZoom, which frames the chain rather than
   * measuring the gaps inside it - see the spec for why that trade was taken.
   */
  function spreadOrOpen(
    id: string,
    all: Record<string, { lat: number; lng: number }>,
    open: () => void,
  ) {
    const map = leafRef.current
    if (!map) { open(); return }
    const ids = Object.keys(all)
    const clickedIdx = ids.indexOf(id)
    if (clickedIdx < 0) { open(); return }

    const points = ids.map(k => {
      const p = map.latLngToContainerPoint([all[k].lat, all[k].lng])
      return { x: p.x, y: p.y }
    })
    const size = map.getSize()
    const chain = overlapChainInView(points, clickedIdx, { x: size.x, y: size.y })
    if (chain.length < 2) { open(); return }

    // Mirrored about the tapped pin: the map centres on it, so the frame has to
    // reach as far on the empty side as on the crowded one.
    const origin = all[id]
    const bounds = L.latLngBounds([[origin.lat, origin.lng]])
    chain.forEach(i => {
      const q = all[ids[i]]
      bounds.extend([q.lat, q.lng])
      bounds.extend([2 * origin.lat - q.lat, 2 * origin.lng - q.lng])
    })

    const target = map.getBoundsZoom(bounds, false, L.point(40, 40))
    if (target <= map.getZoom()) { open(); return }
    flyAdopting(map, origin.lat, origin.lng, target, 0.7)
  }

  // Pins — update on events change. Private events render individually; public
  // events are grouped by 3x3 m zone: singletons open the half-sheet directly,
  // clusters (>= 2) show a count badge and open the event picker.
  //
  // What the map should show is worked out in full first, then diffed against
  // what it already shows. Wiping every marker and building them all again was
  // most of what "the pins arrive in batches" looked like — and with a filter
  // selected it ran on every render, which on a phone means every compass
  // reading.
  useEffect(() => {
    const map = leafRef.current
    if (!map) return

    type Desired = {
      sig: string; html: string; lat: number; lng: number
      zIndexOffset: number; onClick: () => void
    }
    const desired: Record<string, Desired> = {}

    // Private events — one marker each, unchanged behaviour.
    visibleEvents.filter(e => e.is_private).forEach(ev => {
      const live = isCurrentlyLive(ev)
      desired[ev.id] = {
        sig: `private|${live}|${ev.lat}|${ev.lng}`,
        html: privateHTML(live),
        lat: ev.lat, lng: ev.lng, zIndexOffset: 0,
        onClick: () => spreadOrOpen(ev.id, desired, () => onOpenEvent(ev)),
      }
    })

    // Public events — grouped by zone (clusterPublicEvents ignores private).
    clusterPublicEvents(visibleEvents).forEach((group, ci) => {
      const rep = group[0]
      const interactions = rep.interactionCount ?? 0
      const scale = 1 + Math.min(interactions, 100) / 100 * 0.5
      const live = isCurrentlyLive(rep)
      desired[rep.id] = {
        // The blob index (ci) is deliberately not in here. It is decorative and
        // it comes from the position in the array, so it changes whenever the
        // set does — folding it in would rebuild every marker on every pan,
        // which is the thing this diff exists to stop.
        sig: `public|${rep.category}|${group.length}|${rep.status}|${live}|${scale.toFixed(3)}|${rep.lat}|${rep.lng}`,
        html: group.length >= 2
          ? clusterHTML(rep.category, ci, rep.status, rep.start_time, rep.end_time, group.length)
          : pinHTML(rep.category, ci, rep.status, rep.start_time, rep.end_time, scale),
        lat: rep.lat, lng: rep.lng, zIndexOffset: interactions,
        onClick: () => spreadOrOpen(rep.id, desired, () => {
          if (group.length >= 2) setPickerEvents(group)
          else onOpenEvent(rep)
        }),
      }
    })

    const iconFor = (html: string) =>
      L.divIcon({ html, className: 'meuwe-icon', iconSize: [44, 56], iconAnchor: [22, 56] })

    Object.entries(pinsRef.current).forEach(([id, pin]) => {
      if (desired[id]) return
      pin.marker.remove()
      delete pinsRef.current[id]
    })

    Object.entries(desired).forEach(([id, d]) => {
      const pin = pinsRef.current[id]
      if (pin) {
        if (pin.sig !== d.sig) {
          pin.marker.setIcon(iconFor(d.html))
          pin.marker.setLatLng([d.lat, d.lng])
          pin.sig = d.sig
        }
        // Cheap and always worth doing: the handler closes over this run's
        // event objects, and the offset follows a count that moves on its own.
        pin.marker.setZIndexOffset(d.zIndexOffset)
        pin.marker.off('click').on('click', d.onClick)
        return
      }
      const marker = L.marker([d.lat, d.lng], { icon: iconFor(d.html), zIndexOffset: d.zIndexOffset }).addTo(map)
      marker.on('click', d.onClick)
      pinsRef.current[id] = { marker, sig: d.sig }
    })
  }, [visibleEvents]) // eslint-disable-line react-hooks/exhaustive-deps

  function doRecenter() {
    const p = userPos || lastKnownPos || ipPos || WARSAW
    if (leafRef.current) flyAdopting(leafRef.current, p.lat, p.lng, 15, 0.7)
    setRecenter(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Leaflet map */}
      {/* position: fixed → the map fills the whole viewport edge-to-edge, breaking out of
          the body's safe-area padding, so it reaches under the notch and home indicator.
          The UI controls stay position:absolute within the padded area (env()=0 on web/
          Android, so this is a no-op there). */}
      <div ref={mapRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />

      {/* Cold-start splash. Hung off `ready` and not `loading`: `loading` is
          true whenever any part of the map is waiting on an answer, which used
          to mean this covered the screen on every pan and every day change. */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, background: C.cream, zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <MeuweLogo height={40} />
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid rgba(255,122,69,0.25)', borderTopColor: C.primary,
            animation: 'spin 0.9s linear infinite',
          }} />
        </div>
      )}

      {/* Avatar top-left */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
          <Avatar
            size={48}
            onClick={onOpenProfile}
            initials={(profile?.display_name || session?.user?.email || '?')[0].toUpperCase()}
            color={profile?.avatar_color || C.berry}
            hasUnread={unreadMenu}
          />
        </div>
      )}

      {/* Search bar */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', top: 16, left: 80, right: 16, zIndex: 20 }}>
          <SearchBar userPos={userPos} onSelect={p => { if (leafRef.current) flyAdopting(leafRef.current, p.lat, p.lng, 15, 0.7) }} />
        </div>
      )}

      {/* Category filter bar — adapts the number of chips to the screen width */}
      {!pickingLocation && (
        <AdaptiveFilterBar
          selectedFilters={selectedFilters}
          onToggle={toggleFilter}
          onClear={() => setSelectedFilters([])}
          onOpenPicker={() => setFilterModalOpen(true)}
        />
      )}

      {/* Full filter picker — drops from the top, anchored at the "+" */}
      {filterModalOpen && (
        <TagPickerModal
          anchor="top"
          selected={selectedFilters}
          onChange={setSelectedFilters}
          onClose={() => setFilterModalOpen(false)}
        />
      )}

      {/* Zoom controls — desktop only */}
      {isDesktop && (
        <div style={{
          position: 'absolute', bottom: 113, right: 24, zIndex: 20,
          display: 'flex', flexDirection: 'column',
          width: 48,
          border: `2.5px solid ${INK}`,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: `0 3px 0 ${INK}33`,
        }}>
          <button
            onClick={() => leafRef.current?.zoomIn()}
            style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', borderBottom: `2px solid ${INK}`,
              cursor: 'pointer', fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1,
            }}
          >+</button>
          <button
            onClick={() => leafRef.current?.zoomOut()}
            style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              cursor: 'pointer', fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1,
            }}
          >−</button>
        </div>
      )}

      {/* Recenter button */}
      {recenter && (
        <button onClick={doRecenter} style={{
          position: 'absolute', bottom: 53, right: 24, zIndex: 20,
          width: 48, height: 48, borderRadius: '50%',
          background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.primary, border: `2px solid ${INK}` }} />
        </button>
      )}

      {/* Timeline */}
      {!pickingLocation && <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
        <DayTimeline
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          mode={timelineMode}
          onModeChange={setTimelineMode}
          range={range}
          onRangeChange={setRange}
        />
      </div>}

      {/* ADD button */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <AddButton size={76} active={!!session} onClick={() => session ? onOpenCreate() : onAuthNeeded()} />
          </div>
        </div>
      )}

      {/* Location picker overlay */}
      {pickingLocation && (
        <>
          {/* Top banner */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            padding: '52px 20px 16px',
            background: 'linear-gradient(180deg, rgba(255,246,236,0.97) 0%, rgba(255,246,236,0.85) 100%)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => onLocationPicked?.(userPos || lastKnownPos || ipPos || WARSAW)}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: '#fff', border: `2px solid ${INK}22`,
                  fontSize: 18, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >‹</button>
              <div style={{ flex: 1, textAlign: 'center', fontFamily: F.display, fontWeight: 900, fontSize: 17, color: C.ink }}>
                {t('map.pickLocation')}
              </div>
              <div style={{ width: 40 }} />
            </div>
            {/* Address search */}
            <div style={{ position: 'relative', zIndex: 50 }}>
              <SearchBar userPos={userPos} onSelect={p => { if (leafRef.current) flyAdopting(leafRef.current, p.lat, p.lng, 15, 0.7) }} />
            </div>
            {/* Hint */}
            <div style={{ textAlign: 'center', fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
              {t('map.pickLocationHintAlt')}
            </div>
          </div>

          {/* Crosshair pin — always at center */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', zIndex: 25,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
          }}>
            {/* Pin body */}
            <div style={{
              width: 36, height: 36, borderRadius: '50% 50% 50% 0',
              background: C.primary, border: `3px solid ${INK}`,
              transform: 'rotate(-45deg)',
              boxShadow: '0 4px 12px rgba(255,122,69,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ transform: 'rotate(45deg)', width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
            </div>
            {/* Shadow */}
            <div style={{
              width: 12, height: 4, borderRadius: '50%',
              background: 'rgba(45,43,42,0.25)', margin: '2px auto 0',
            }} />
          </div>

          {/* Confirm button */}
          <div style={{
            position: 'absolute', bottom: 48, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', zIndex: 30,
          }}>
            <button
              onClick={() => {
                const center = leafRef.current?.getCenter()
                if (center) onLocationPicked?.({ lat: center.lat, lng: center.lng })
              }}
              style={{
                padding: '16px 40px', borderRadius: 999,
                background: C.primary, color: '#fff',
                fontSize: 16, fontWeight: 800,
                border: `2.5px solid ${INK}`,
                boxShadow: '0 8px 20px rgba(255,122,69,0.35)',
              }}
            >
              {t('map.confirmLocation')}
            </button>
          </div>
        </>
      )}

      {/* Event picker — same-zone cluster */}
      {pickerEvents && (
        <EventPickerModal
          events={pickerEvents}
          onSelect={ev => { setPickerEvents(null); onOpenEvent(ev) }}
          onClose={() => setPickerEvents(null)}
        />
      )}

      {/* Empty state — a fork with a way out, not a dead end. See lib/emptyState. */}
      {/* Centring and bobbing are two elements on purpose: the bob keyframes
          animate `transform`, so putting both on one node let the animation win
          and the card drifted off centre — invisible while it was a narrow
          bubble, half off-screen once it grew buttons. */}
      {isEmptyView && probe?.key === probeKey && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none', zIndex: 5, width: 268,
        }}>
          {/* Only the card takes taps; the box around it must stay transparent
              to dragging or the map would be pinned wherever this appears. */}
          <div style={{
            animation: 'bob 4s ease-in-out infinite',
            pointerEvents: 'auto',
            padding: '16px 18px', background: '#fff',
            borderRadius: '24px 24px 24px 8px',
            border: `2px solid ${INK}22`,
            boxShadow: '0 8px 32px rgba(45,43,42,0.08)',
            fontFamily: F.display, color: C.ink, textAlign: 'center',
          }}>
            {emptyVariant.kind === 'nextDay' && !nextDayOfferIsMoot && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                  {/* The card only exists because nothing today is within
                      MAX_MAP_KM, so that — not the size of the viewport — is
                      the distance it can honestly quote. */}
                  {t('map.emptyToday', { km: MAX_MAP_KM })}
                </div>
                <button
                  onClick={() => {
                    // Acted on, so it has said its piece — a user who lands on
                    // another empty day is not told the same thing again.
                    offeredWayOutRef.current = true
                    const target = TODAY_IDX + emptyVariant.dayOffset
                    // W trybie zakresu przycisk dokłada ten dzień do zakresu
                    // zamiast go zastępować — obietnica „zobacz: sobota (3)”
                    // zostaje dotrzymana bez wyrzucania z trybu, który user wybrał.
                    setRange(prev => timelineMode === 'range'
                      ? { startIdx: Math.min(prev.startIdx, target), endIdx: Math.max(prev.endIdx, target) }
                      : { startIdx: target, endIdx: target })
                  }}
                  style={emptyCtaStyle}
                >
                  {t('map.emptyNextDayCta', {
                    day: dayLabel(TODAY_IDX + emptyVariant.dayOffset),
                    count: emptyVariant.count,
                  })}
                </button>
              </>
            )}

            {(emptyVariant.kind === 'nothing' || emptyVariant.kind === 'unknown' || nextDayOfferIsMoot) && (
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {t('map.empty')}<br />
                <span style={{ color: C.primary }}>{t('map.emptyCta')}</span>
              </div>
            )}

            {/* Offered only where the fan-out can honour it: it measures from the
                account's own last position, so promising alerts for a city the
                user is merely looking at would be a promise we cannot keep. */}
            {canNotifyHere && (
              <button
                onClick={handleNotifyHere}
                disabled={notifyDone}
                style={{
                  marginTop: 10, width: '100%', padding: '8px 10px',
                  background: 'none', border: 'none',
                  fontFamily: F.display, fontSize: 12.5, fontWeight: 700,
                  color: notifyDone ? C.grass : C.inkSoft,
                  cursor: notifyDone ? 'default' : 'pointer',
                }}
              >
                {t(notifyDone ? 'map.emptyNotifyDone' : 'map.emptyNotify')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MapScreen
