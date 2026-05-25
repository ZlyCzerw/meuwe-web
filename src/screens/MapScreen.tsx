import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import type { EventWithMeta, Profile } from '../lib/types'
import { useEvents } from '../hooks/useEvents'
import { haversineKm } from '../lib/geo'
import { pinHTML, meHTML } from '../components/mapIcons'
import Avatar from '../components/Avatar'
import AddButton from '../components/AddButton'
import SearchBar from './SearchBar'

const WARSAW = { lat: 52.2297, lng: 21.0122 }

const DAY_KEYS = ['yesterday', 'today', 'tomorrow', 'friday', 'saturday', 'sunday'] as const
function dayKey(i: number): typeof DAY_KEYS[number] { return DAY_KEYS[i] }

function dayIdxToOffset(idx: number): number {
  if (idx <= 2) return idx - 1 // 0→yesterday(-1), 1→today(0), 2→tomorrow(+1)
  const targetDow = idx === 3 ? 5 : idx === 4 ? 6 : 0 // Fri=5, Sat=6, Sun=0
  const dow = new Date().getDay()
  const diff = (targetDow - dow + 7) % 7
  return diff === 0 ? 7 : diff // if already that weekday, show next week's
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
}) {
  const { t } = useTranslation()

  const mapRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<L.Map | null>(null)
  const meRef = useRef<L.Marker | null>(null)
  const pinsRef = useRef<Record<string, L.Marker>>({})
  const userPosRef = useRef<{ lat: number; lng: number } | null>(userPos)
  useEffect(() => { userPosRef.current = userPos }, [userPos])
  const centeredRef = useRef(false) // track if we've done the initial center

  const [recenter, setRecenter] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [dayIdx, setDayIdx] = useState(1)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const eventsPos = mapCenter || userPos || WARSAW
  const { events, loading } = useEvents(eventsPos, dayIdxToOffset(dayIdx), eventsRefreshKey)

  // Timeline drag
  const tlDrag = useRef({ startX: 0, base: 0, on: false })
  function tlPD(e: React.PointerEvent<HTMLDivElement>) {
    ;(e.currentTarget as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
    tlDrag.current = { startX: e.clientX, base: dayIdx, on: true }
  }
  function tlPM(e: React.PointerEvent<HTMLDivElement>) {
    if (!tlDrag.current.on) return
    const delta = -Math.round((e.clientX - tlDrag.current.startX) / 78)
    const next = Math.max(0, Math.min(DAY_KEYS.length - 1, tlDrag.current.base + delta))
    if (next !== dayIdx) setDayIdx(next)
  }
  function tlPU() { tlDrag.current.on = false }

  // Leaflet init — runs once
  useEffect(() => {
    if (leafRef.current || !mapRef.current) return
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
      .setView([(userPos || WARSAW).lat, (userPos || WARSAW).lng], 15)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
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
    return () => { map.remove(); leafRef.current = null }
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
    events.forEach((ev, i) => {
      const icon = L.divIcon({
        html: pinHTML(ev.category, i),
        className: 'meuwe-icon',
        iconSize: [44, 56],
        iconAnchor: [22, 56],
      })
      const m = L.marker([ev.lat, ev.lng], { icon }).addTo(map)
      m.on('click', () => onOpenEvent(ev))
      pinsRef.current[ev.id] = m
    })
  }, [events]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, filter: 'url(#meuwe-wobble)' }}>
        <Avatar
          size={48}
          onClick={onOpenProfile}
          initials={(profile?.display_name || session?.user?.email || '?')[0].toUpperCase()}
          color={profile?.avatar_color || C.berry}
          hasUnread={false}
        />
      </div>

      {/* Search bar */}
      <div style={{ position: 'absolute', top: 16, left: 80, right: 16, zIndex: 10, filter: 'url(#meuwe-wobble)' }}>
        <SearchBar onSelect={p => leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })} />
      </div>

      {/* Recenter button */}
      {recenter && (
        <button onClick={doRecenter} style={{
          position: 'absolute', bottom: 180, right: 16, zIndex: 20,
          width: 48, height: 48, borderRadius: '50%',
          background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: 'url(#meuwe-wobble)',
        }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.primary, border: `2px solid ${INK}` }} />
        </button>
      )}

      {/* Timeline */}
      <div style={{ position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, filter: 'url(#meuwe-wobble)' }}>
        {!timelineOpen
          ? (
            <button onClick={() => setTimelineOpen(true)} style={{
              padding: '10px 20px', borderRadius: 999,
              background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
              fontSize: 13, fontWeight: 800, color: INK,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: C.primary, border: `1.5px solid ${INK}` }} />
              {t('map.days.' + dayKey(dayIdx))}
            </button>
          )
          : (
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
                  transform: `translateX(${(3 - dayIdx) * 58}px)`,
                }}>
                  {DAY_KEYS.map((dk, i) => (
                    <button
                      key={dk}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => setDayIdx(i)}
                      style={{
                        flex: '0 0 54px', padding: '7px 0', borderRadius: 999,
                        background: dayIdx === i ? C.primary : 'transparent',
                        color: dayIdx === i ? '#fff' : INK,
                        border: dayIdx === i ? `2px solid ${INK}` : '2px solid transparent',
                        fontSize: 12, fontWeight: 800, opacity: Math.abs(i - dayIdx) > 2 ? 0.3 : 1,
                      }}
                    >
                      {t('map.daysShort.' + dk)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: '0 0 14px', textAlign: 'center', color: INK, opacity: dayIdx < DAY_KEYS.length - 1 ? 0.5 : 0.15, fontWeight: 900, fontSize: 16 }}>›</div>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={() => setTimelineOpen(false)}
                style={{ flex: '0 0 24px', color: INK, fontWeight: 900, opacity: 0.5, fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          )
        }
      </div>

      {/* ADD button */}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, filter: 'url(#meuwe-wobble)' }}>
        <AddButton size={76} onClick={() => session ? onOpenCreate() : onAuthNeeded()} />
      </div>

      {/* Location picker overlay */}
      {pickingLocation && (
        <>
          {/* Top banner */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            padding: '52px 20px 16px',
            background: 'linear-gradient(180deg, rgba(255,246,236,0.97) 0%, rgba(255,246,236,0.85) 100%)',
            display: 'flex', alignItems: 'center', gap: 12,
            filter: 'url(#meuwe-wobble)',
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
                Wybierz miejsce
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
                Przesuń mapę, aby wybrać lokalizację
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
            filter: 'url(#meuwe-wobble)',
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
              Potwierdź miejsce
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {events.length === 0 && !loading && !pickingLocation && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%',
          transform: 'translate(-50%,-50%)',
          animation: 'bob 4s ease-in-out infinite', pointerEvents: 'none', zIndex: 5,
          filter: 'url(#meuwe-wobble)',
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
