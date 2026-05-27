import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { C, INK, F, ALL_CATEGORIES, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import type { EventWithMeta, Profile } from '../lib/types'
import { useEvents } from '../hooks/useEvents'
import { haversineKm } from '../lib/geo'
import { pinHTML, meHTML } from '../components/mapIcons'
import Avatar from '../components/Avatar'
import AddButton from '../components/AddButton'
import SearchBar from './SearchBar'

const WARSAW = { lat: 52.2297, lng: 21.0122 }

const DAYS_COUNT = 7          // yesterday + today + 5 future days
const TODAY_IDX  = 1          // index 1 = today
const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE' }

function idxToOffset(idx: number) { return idx - TODAY_IDX }  // 0→-1, 1→0, 2→+1 …

function idxToDate(idx: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + idxToOffset(idx))
  return d
}

function MapScreen({
  session,
  profile,
  onOpenProfile,
  onOpenCreate,
  onOpenEvent,
  onAuthNeeded,
  userPos,
  pickingLocation,
  onLocationPicked,
  eventsRefreshKey,
  onMapClick,
  onRegisterFlyTo,
}: {
  session: Session | null
  profile: Profile | null
  onOpenProfile: () => void
  onOpenCreate: () => void
  onOpenEvent: (ev: EventWithMeta) => void
  onAuthNeeded: () => void
  userPos: { lat: number; lng: number } | null
  pickingLocation?: boolean
  onLocationPicked?: (pos: { lat: number; lng: number }) => void
  eventsRefreshKey?: number
  onMapClick?: () => void
  onRegisterFlyTo?: (fn: (lat: number, lng: number) => void) => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'

  const mapRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<L.Map | null>(null)
  const meRef = useRef<L.Marker | null>(null)
  const pinsRef = useRef<Record<string, L.Marker>>({})
  const userPosRef = useRef<{ lat: number; lng: number } | null>(userPos)
  useEffect(() => { userPosRef.current = userPos }, [userPos])
  const onMapClickRef = useRef(onMapClick)
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  const centeredRef = useRef(false) // track if we've done the initial center

  const [recenter, setRecenter] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [dayIdx, setDayIdx] = useState(1)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null)
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const eventsPos = mapCenter || userPos || WARSAW
  const { events, loading } = useEvents(eventsPos, idxToOffset(dayIdx), eventsRefreshKey)
  const visibleEvents = categoryFilter ? events.filter(e => e.category === categoryFilter) : events

  // Timeline drag
  const tlDrag = useRef({ startX: 0, base: 0, on: false })
  function tlPD(e: React.PointerEvent<HTMLDivElement>) {
    ;(e.currentTarget as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
    tlDrag.current = { startX: e.clientX, base: dayIdx, on: true }
  }
  function tlPM(e: React.PointerEvent<HTMLDivElement>) {
    if (!tlDrag.current.on) return
    const delta = -Math.round((e.clientX - tlDrag.current.startX) / 78)
    const next = Math.max(0, Math.min(DAYS_COUNT - 1, tlDrag.current.base + delta))
    if (next !== dayIdx) setDayIdx(next)
  }
  function tlPU() { tlDrag.current.on = false }

  // Leaflet init — runs once
  useEffect(() => {
    if (leafRef.current || !mapRef.current) return
    const initialPos = userPosRef.current
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
      .setView([(initialPos || WARSAW).lat, (initialPos || WARSAW).lng], 15)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
    map.on('click', () => onMapClickRef.current?.())
    onRegisterFlyTo?.((lat, lng) => map.flyTo([lat, lng], 16, { duration: 0.7 }))
    map.on('moveend', () => {
      const up = userPosRef.current
      const center = map.getCenter()
      if (up) setRecenter(haversineKm(center.lat, center.lng, up.lat, up.lng) > 0.3)
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current)
      moveTimerRef.current = setTimeout(() => {
        setMapCenter({ lat: center.lat, lng: center.lng })
      }, 1000)
    })
    leafRef.current = map
    // If GPS already fired before this map instance was ready (e.g. StrictMode double-init),
    // add the me marker immediately using the always-current ref.
    if (initialPos && !meRef.current) {
      const icon = L.divIcon({ html: meHTML(), className: 'meuwe-icon', iconSize: [72, 72], iconAnchor: [36, 36] })
      meRef.current = L.marker([initialPos.lat, initialPos.lng], { icon, zIndexOffset: -1000 }).addTo(map)
      centeredRef.current = true  // started on real GPS — no need to re-center later
    }
    return () => { meRef.current = null; map.remove(); leafRef.current = null }
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
    // Center map only once on first GPS fix
    if (!centeredRef.current) {
      centeredRef.current = true
      map.setView([userPos.lat, userPos.lng], 15, { animate: true })
    }
  }, [userPos])

  // Pins — update on events change
  useEffect(() => {
    const map = leafRef.current
    if (!map) return
    Object.values(pinsRef.current).forEach(m => m.remove())
    pinsRef.current = {}
    visibleEvents.forEach((ev, i) => {
      const icon = L.divIcon({
        html: pinHTML(ev.category, i, ev.status, ev.start_time, ev.end_time),
        className: 'meuwe-icon',
        iconSize: [44, 56],
        iconAnchor: [22, 56],
      })
      const m = L.marker([ev.lat, ev.lng], { icon }).addTo(map)
      m.on('click', () => onOpenEvent(ev))
      pinsRef.current[ev.id] = m
    })
  }, [visibleEvents]) // eslint-disable-line react-hooks/exhaustive-deps

  function doRecenter() {
    const p = userPos || WARSAW
    leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })
    setRecenter(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Leaflet map */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, background: C.cream, zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            fontFamily: F.display, fontWeight: 900, fontSize: 56,
            letterSpacing: -2, lineHeight: 1, display: 'flex',
          }}>
            <span style={{ color: C.primary }}>me</span>
            <span style={{ color: C.sky }}>u</span>
            <span style={{ color: C.grass }}>we</span>
          </div>
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
            hasUnread={false}
          />
        </div>
      )}

      {/* Search bar */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', top: 16, left: 80, right: 16, zIndex: 10 }}>
          <SearchBar onSelect={p => leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })} />
        </div>
      )}

      {/* Category filter bar */}
      {!pickingLocation && (
        <div style={{
          position: 'absolute', top: 76, left: 0, right: 0, zIndex: 10,
          display: 'flex', overflowX: 'auto', gap: 8,
          padding: '0 16px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          {/* All button */}
          <button
            onClick={() => setCategoryFilter(null)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 999,
              background: !categoryFilter ? C.ink : '#fff',
              color: !categoryFilter ? '#fff' : C.inkSoft,
              fontSize: 12, fontWeight: 800,
              border: `2px solid ${!categoryFilter ? C.ink : INK + '22'}`,
              boxShadow: !categoryFilter ? `0 2px 0 ${INK}` : '0 2px 8px rgba(45,43,42,0.1)',
              transition: 'all 180ms ease',
              whiteSpace: 'nowrap',
            }}
          >{t('map.allCategories')}</button>

          {ALL_CATEGORIES.map(cat => {
            const meta = TAG_META[cat as Category]
            const active = categoryFilter === cat
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(active ? null : cat as Category)}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 999,
                  background: active ? meta.color : '#fff',
                  color: active ? '#fff' : C.ink,
                  fontSize: 12, fontWeight: 800,
                  border: `2px solid ${active ? C.ink : INK + '22'}`,
                  boxShadow: active ? `0 2px 0 ${C.ink}` : '0 2px 8px rgba(45,43,42,0.1)',
                  transition: 'all 180ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: meta.glyph }} />
                {t('tags.' + cat)}
              </button>
            )
          })}
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
      {!pickingLocation && <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        {!timelineOpen ? (
          <button onClick={() => setTimelineOpen(true)} style={{
            padding: '10px 20px', borderRadius: 999,
            background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
            fontSize: 13, fontWeight: 800, color: INK,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: C.primary, border: `1.5px solid ${INK}` }} />
            {(() => {
              const d = idxToDate(dayIdx)
              const offset = idxToOffset(dayIdx)
              const dayLabel = offset === 0 ? t('map.today')
                : offset === -1 ? t('map.yesterday')
                : d.toLocaleDateString(loc, { weekday: 'long' })
              const dateLabel = d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
              return `${dayLabel} · ${dateLabel}`
            })()}
          </button>
        ) : (
          <div
            onPointerDown={tlPD}
            onPointerMove={tlPM}
            onPointerUp={tlPU}
            onPointerCancel={tlPU}
            style={{
              padding: '6px 8px', borderRadius: 999, background: '#fff',
              border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
              display: 'flex', alignItems: 'center', gap: 4,
              touchAction: 'pan-y', cursor: 'grab', userSelect: 'none',
            }}
          >
            <div style={{ flex: '0 0 14px', textAlign: 'center', color: INK, opacity: dayIdx > 0 ? 0.5 : 0.15, fontWeight: 900, fontSize: 16 }}>‹</div>
            <div style={{ width: 270, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
              <div style={{
                display: 'flex', gap: 4,
                transition: 'transform 320ms cubic-bezier(0.32,1.4,0.4,1)',
                transform: `translateX(${(2 - dayIdx) * 62}px)`,
              }}>
                {Array.from({ length: DAYS_COUNT }, (_, i) => {
                  const d = idxToDate(i)
                  const offset = idxToOffset(i)
                  const isToday = offset === 0
                  const active = dayIdx === i
                  return (
                    <button
                      key={i}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => setDayIdx(i)}
                      style={{
                        flex: '0 0 56px', borderRadius: 14,
                        padding: '6px 0', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 1,
                        background: active ? C.primary : isToday ? C.primarySoft : 'transparent',
                        color: active ? '#fff' : C.ink,
                        border: active ? `2px solid ${INK}` : '2px solid transparent',
                        fontSize: 11, fontWeight: 800,
                        opacity: Math.abs(i - dayIdx) > 3 ? 0.25 : 1,
                        transition: 'all 200ms ease',
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                        {isToday ? t('map.today').slice(0, 3)
                          : d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '')}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>
                        {d.getDate()}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>
                        {d.toLocaleDateString(loc, { month: 'short' }).replace('.', '')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ flex: '0 0 14px', textAlign: 'center', color: INK, opacity: dayIdx < DAYS_COUNT - 1 ? 0.5 : 0.15, fontWeight: 900, fontSize: 16 }}>›</div>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setTimelineOpen(false)}
              style={{ flex: '0 0 24px', color: INK, fontWeight: 900, opacity: 0.5, fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >×</button>
          </div>
        )}
      </div>}

      {/* ADD button */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <AddButton size={76} onClick={() => session ? onOpenCreate() : onAuthNeeded()} />
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
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <button
              onClick={() => onLocationPicked?.(userPos || WARSAW)}
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: '#fff', border: `2px solid ${INK}22`,
                fontSize: 18, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >‹</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 17, color: C.ink }}>
                {t('map.pickLocation')}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
                {t('map.pickLocationHint')}
              </div>
            </div>
            <div style={{ width: 40 }} />
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

      {/* Empty state */}
      {visibleEvents.length === 0 && !loading && !pickingLocation && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%',
          transform: 'translate(-50%,-50%)',
          animation: 'bob 4s ease-in-out infinite', pointerEvents: 'none', zIndex: 5,
        }}>
          <div style={{
            padding: '14px 20px', background: '#fff',
            borderRadius: '24px 24px 24px 8px',
            border: `2px solid ${INK}22`,
            boxShadow: '0 8px 32px rgba(45,43,42,0.08)',
            fontFamily: F.display, fontSize: 15, fontWeight: 800, color: C.ink,
            textAlign: 'center', maxWidth: 240,
          }}>
            {t('map.empty')}<br />
            <span style={{ color: C.primary }}>{t('map.emptyCta')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapScreen
