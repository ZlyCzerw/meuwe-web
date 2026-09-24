import { useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F, TAG_META, BLOBS } from '../lib/tokens'
import type { EventWithMeta } from '../lib/types'
import { useEvents } from '../hooks/useEvents'
import { MAX_MAP_KM } from '../lib/geo'
import { computeStatus } from '../lib/eventStatus'
import { idxToOffset, type DayRange } from '../lib/timeline'
import { listEvents, formatDistance } from '../lib/eventList'
import AdaptiveFilterBar from './AdaptiveFilterBar'
import DayTimeline, { type TimelineMode } from './DayTimeline'
import OrganicBlob from './OrganicBlob'
import BlobFace from './BlobFace'
import StatusPill from './StatusPill'
import SearchBar from '../screens/SearchBar'
import type { EventHit } from '../lib/searchResults'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

// Pozycja przewinięcia przeżywa zamknięcie listy: wybór wydarzenia zamyka
// modal, a powrót do niego ma zacząć tam, gdzie się skończyło.
let savedScroll = 0

/**
 * Pełnoekranowa lista wydarzeń w okolicy, od najbliższego. Filtry i dni są
 * wspólne z mapą (trzyma je MapScreen), wyszukiwanie po tekście — tylko tutaj.
 * Wydarzenia pobiera sama, w promieniu MAX_MAP_KM wokół `origin`, a nie z kadru
 * mapy: inaczej zawartość listy zależałaby od tego, gdzie ktoś przesunął mapę.
 */
export default function EventListModal({
  origin, range, onRangeChange, mode, onModeChange,
  selectedFilters, onToggleFilter, onClearFilters, onOpenFilterPicker,
  refreshKey, onSelect, onClose,
  placeChosen, searchText, onSearchPlace, onSearchEvent, onSearchQueryChange,
}: {
  /** Punkt, wokół którego lista szuka: użytkownik albo wybrane miejsce. */
  origin: { lat: number; lng: number }
  /** Czy `origin` to miejsce wybrane w wyszukiwarce (a nie użytkownik). */
  placeChosen: boolean
  /** Co stoi w polu wyszukiwania: nazwa miejsca, od którego liczy lista. */
  searchText: string
  onSearchPlace: (p: { lat: number; lng: number; label: string }) => void
  onSearchEvent: (hit: EventHit) => void
  /** Ręczna zmiana tekstu; puste pole wraca listę do okolicy użytkownika. */
  onSearchQueryChange: (q: string) => void
  range: DayRange
  onRangeChange: (r: DayRange) => void
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  selectedFilters: string[]
  onToggleFilter: (f: string) => void
  onClearFilters: () => void
  onOpenFilterPicker: () => void
  refreshKey?: number
  onSelect: (ev: EventWithMeta) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'

  // Środek zapytania zaokrąglony do ~1 km: GPS drga co kilka metrów, a nowe
  // pobranie przy każdym drgnięciu nic nie wnosi. Odległości w kafelkach i tak
  // liczą się od dokładnego punktu.
  const qLat = Math.round(origin.lat * 100) / 100
  const qLng = Math.round(origin.lng * 100) / 100
  const view = useMemo(() => ({ lat: qLat, lng: qLng, km: MAX_MAP_KM }), [qLat, qLng])
  const { events, loading } = useEvents(view, idxToOffset(range.startIdx), idxToOffset(range.endIdx), refreshKey)
  const items = useMemo(
    () => listEvents(events, { filters: selectedFilters, from: origin }),
    [events, selectedFilters, origin],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = savedScroll
  }, [])

  const time = (d: Date) => d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  const day = (d: Date) => {
    const wd = d.toLocaleDateString(loc, { weekday: 'short' })
    const dm = d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${dm}`
  }
  function whenLabel(ev: EventWithMeta) {
    const s = new Date(ev.start_time)
    const e = new Date(ev.end_time)
    // Wydarzenie przez kilka dni pokazuje oba końce z datą — sam zakres godzin
    // „20:00–02:00” wyglądałby na pomyłkę.
    if (s.toDateString() !== e.toDateString()) return `${day(s)} ${time(s)} – ${day(e)} ${time(e)}`
    return `${day(s)} · ${time(s)}–${time(e)}`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('eventList.title')}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: `linear-gradient(180deg,${C.cream} 0%,#FFF1E0 40%,#FFE8DC 75%,#FFE0E8 100%)`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp 280ms cubic-bezier(0.32,1.1,0.4,1)',
      }}
    >
      {/* Tło: miękkie plamy w kształtach blobów meuwe, bez obrysu — kolor, nie rysunek. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {([
          { d: BLOBS[1], color: C.primarySoft, style: { top: -80, right: -90, width: 260 }, opacity: 0.55 },
          { d: BLOBS[2], color: C.sunshine, style: { top: '40%', left: -120, width: 230 }, opacity: 0.28 },
          { d: BLOBS[0], color: C.berry, style: { bottom: 70, right: -100, width: 220 }, opacity: 0.22 },
        ] as const).map((b, i) => (
          <svg key={i} viewBox="0 0 100 100" style={{ position: 'absolute', height: 'auto', ...b.style }}>
            <path d={b.d} fill={b.color} opacity={b.opacity} />
          </svg>
        ))}
      </div>

      {/* Nagłówek: tytuł, zamknięcie, wyszukiwanie, filtry */}
      <div style={{
        position: 'relative', zIndex: 2, flexShrink: 0,
        padding: 'calc(16px + env(safe-area-inset-top)) 0 8px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink, letterSpacing: -0.5, lineHeight: 1.1 }}>
              {t('eventList.title')}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, marginTop: 2 }}>
              {loading && !items.length ? t('common.loading') : t(placeChosen ? 'eventList.countNearPlace' : 'eventList.count', { count: items.length, km: MAX_MAP_KM })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              width: 44, height: 44, flexShrink: 0, borderRadius: '50%', background: '#fff',
              border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* To samo pole co na mapie: miejsce albo wydarzenie. Miejsce przestawia
            punkt, wokół którego lista szuka i od którego liczy odległości. */}
        <div style={{ padding: '0 16px' }}>
          <SearchBar
            userPos={origin}
            onSelect={p => { savedScroll = 0; if (scrollRef.current) scrollRef.current.scrollTop = 0; onSearchPlace(p) }}
            onSelectEvent={onSearchEvent}
            onQueryChange={onSearchQueryChange}
            initialQuery={searchText}
            dropdownZIndex={30}
          />
        </div>

        <AdaptiveFilterBar
          inline
          selectedFilters={selectedFilters}
          onToggle={onToggleFilter}
          onClear={onClearFilters}
          onOpenPicker={onOpenFilterPicker}
        />
      </div>

      {/* Lista */}
      <div
        ref={scrollRef}
        onScroll={e => { savedScroll = e.currentTarget.scrollTop }}
        style={{
          position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
          padding: '8px 16px 16px',
          // Karty wjeżdżają pod pasek dat miękko, a nie ucięte linijką.
          maskImage: 'linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 18px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 18px), transparent 100%)',
        }}
      >
        {loading && !items.length && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid rgba(255,122,69,0.25)', borderTopColor: C.primary,
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
        )}

        {!loading && !items.length && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 24px', textAlign: 'center' }}>
            <OrganicBlob size={84} color={C.primarySoft} idx={0} face={<BlobFace size={56} mood="sleepy" />} />
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
              {t('eventList.empty')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>
              {t('eventList.emptyHint')}
            </div>
          </div>
        )}

        {items.map((ev, i) => {
          const meta = TAG_META[ev.category] ?? TAG_META.culture
          const status = computeStatus(ev)
          const interactions = ev.interactionCount ?? 0
          return (
            <button
              key={ev.id}
              onClick={() => onSelect(ev)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, marginBottom: 10, borderRadius: 22,
                background: '#fff', boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
                border: `2px solid ${INK}10`, textAlign: 'left',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0, width: 52, height: 52 }}>
                <OrganicBlob size={52} color={meta.color} idx={i % 3} />
                {/* SAFETY: meta.glyph to statyczny SVG z tokens.ts, nie dane użytkownika */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 24,
                  }}
                  dangerouslySetInnerHTML={{ __html: meta.glyph }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <rect x="1.5" y="2.5" width="13" height="12" rx="3" fill="none" stroke={C.primary} strokeWidth="1.8" />
                    <path d="M1.5 6.5 H14.5 M5 1 V4 M11 1 V4" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span style={{
                    fontSize: 12.5, fontWeight: 800, color: C.primary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{whenLabel(ev)}</span>
                  {(status === 'live' || status === 'extended') && <StatusPill status={status} size="sm" />}
                </div>
                <div style={{
                  fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.ink, marginTop: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{ev.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, minWidth: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <path d="M8 15 C8 15 2.5 9.6 2.5 6.2 A5.5 5.5 0 0 1 13.5 6.2 C13.5 9.6 8 15 8 15 Z" fill="none" stroke={C.inkSoft} strokeWidth="1.7" strokeLinejoin="round" />
                    <circle cx="8" cy="6.3" r="1.9" fill={C.inkSoft} />
                  </svg>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: C.inkSoft, flex: 1, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <span style={{ fontWeight: 800, color: C.ink }}>{formatDistance(ev.distKm, loc)}</span>
                    {ev.place_name ? ` · ${ev.place_name}` : ''}
                  </span>
                </div>
              </div>

              <div
                title={t('eventList.interactions')}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: 40, padding: '6px 8px', borderRadius: 14, background: C.cream,
                }}
              >
                <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
                  <circle cx="6.5" cy="4.5" r="2.8" fill="none" stroke={interactions ? C.primary : C.inkSoft} strokeWidth="1.8" />
                  <path d="M1.5 14.5 C1.5 11 3.8 9.3 6.5 9.3 C9.2 9.3 11.5 11 11.5 14.5" fill="none" stroke={interactions ? C.primary : C.inkSoft} strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12.5" cy="5" r="2.3" fill="none" stroke={interactions ? C.primary : C.inkSoft} strokeWidth="1.6" />
                  <path d="M13.3 9.4 C15.4 9.7 16.8 11.3 16.8 14" fill="none" stroke={interactions ? C.primary : C.inkSoft} strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 900, color: interactions ? C.primary : C.inkSoft, lineHeight: 1.2 }}>
                  {interactions}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Wybór dni — zawsze rozwinięty */}
      <div style={{
        position: 'relative', zIndex: 1, flexShrink: 0,
        padding: '8px 16px calc(16px + env(safe-area-inset-bottom))',
        display: 'flex', justifyContent: 'center',
      }}>
        <DayTimeline
          alwaysOpen
          open
          onOpenChange={() => {}}
          mode={mode}
          onModeChange={onModeChange}
          range={range}
          onRangeChange={r => { savedScroll = 0; if (scrollRef.current) scrollRef.current.scrollTop = 0; onRangeChange(r) }}
        />
      </div>
    </div>
  )
}
