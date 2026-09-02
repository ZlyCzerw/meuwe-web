// src/components/PlaceSearchInput.tsx
//
// Pole „wpisz kilka liter, wybierz z listy”. Jedno dla mapy (SearchBar) i dla
// miejscowości w Moich danych, żeby oba wyglądały identycznie. Wartość istnieje
// tylko po wyborze z listy: samo wpisanie tekstu niczego nie wybiera.
//
// Mapa dokłada do listy wydarzenia (searchEvents + onSelectEvent): wtedy oba
// pytania biegną równolegle, a lista pokazuje najpierw miejsca, potem
// wydarzenia - podział miejsc na liście liczy lib/searchResults.

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchPlaces, photonLang, type PlaceResult } from '../lib/placeSearch'
import { mergeSearchResults, type EventHit, type SearchResult } from '../lib/searchResults'
import { C, INK, TAG_META } from '../lib/tokens'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

interface Props {
  placeholder: string
  near: { lat: number; lng: number } | null
  onSelect: (r: PlaceResult) => void
  settlementsOnly?: boolean
  /** Tekst w polu na start i przy każdej zmianie tej wartości. */
  initialQuery?: string
  /** Co wpisać w pole po wyborze; domyślnie sama nazwa. */
  labelFor?: (r: PlaceResult) => string
  /** Każda ręczna zmiana tekstu, także wyczyszczenie. */
  onQueryChange?: (q: string) => void
  dropdownZIndex?: number
  /** Id na samym `<input>` - żeby `<label htmlFor>` z zewnątrz miało cel. */
  id?: string
  /** Gdy podane, lista zawiera też wydarzenia z tytułem pasującym do frazy. */
  searchEvents?: (q: string) => Promise<EventHit[]>
  onSelectEvent?: (e: EventHit) => void
}

export default function PlaceSearchInput({
  placeholder, near, onSelect, settlementsOnly = false, initialQuery = '',
  labelFor = r => r.primary, onQueryChange, dropdownZIndex = 20, id,
  searchEvents, onSelectEvent,
}: Props) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Zapytanie o wydarzenia nie ma sygnału przerwania, więc spóźniona odpowiedź
  // na starszą frazę poznaje się po numerze i ląduje w koszu.
  const seqRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // stan pochodny z propsa liczony w renderze, nie w efekcie - patrz lint set-state-in-effect
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery)
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery)
    setQuery(initialQuery)
  }

  async function search(val: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const seq = ++seqRef.current
    setLoading(true)
    const [places, events] = await Promise.allSettled([
      searchPlaces(val, { lang: photonLang(i18n.language), near, settlementsOnly, signal: controller.signal }),
      searchEvents ? searchEvents(val) : Promise.resolve([] as EventHit[]),
    ])
    if (seq !== seqRef.current) return
    // Photon padł albo przerwany: lista miejsc pusta, wydarzenia i tak mogą być.
    // Przerwanie zawsze oznacza nowszą frazę, którą łapie już seq wyżej.
    setResults(mergeSearchResults(
      places.status === 'fulfilled' ? places.value : [],
      events.status === 'fulfilled' ? events.value : [],
    ))
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    onQueryChange?.(val)
    if (val.trim().length < 2) {
      abortRef.current?.abort()
      setResults([])
      setLoading(false)
      return
    }
    search(val.trim())
  }

  function handleSelect(item: SearchResult) {
    if (item.kind === 'place') {
      onSelect(item.place)
      setQuery(labelFor(item.place))
    } else {
      onSelectEvent?.(item.event)
      setQuery(item.event.title)
    }
    setResults([])
    inputRef.current?.blur()
  }

  function eventSecondary(e: EventHit): string {
    const day = new Date(e.start_time).toLocaleDateString(LOC_MAP[i18n.language] || 'en-US', { day: 'numeric', month: 'short' })
    return e.place_name ? `${day} · ${e.place_name}` : day
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      handleSelect(results[0])
    }
  }

  function handleClear() {
    setQuery('')
    onQueryChange?.('')
    setResults([])
    setLoading(false)
    abortRef.current?.abort()
    inputRef.current?.focus()
  }

  const showDropdown = focused && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: '#fff', borderRadius: 999, border: `2px solid ${INK}`,
        boxShadow: `0 3px 0 ${INK}22`, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13 13 L17 17" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        <input
          id={id}
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          style={{
            flex: 1,
            // >=16px prevents iOS from auto-zooming the page when the field is focused.
            fontSize: 16, fontWeight: 600, color: C.ink,
            border: 'none', outline: 'none', background: 'transparent', minWidth: 0,
          }}
        />

        {query.length > 0 && !loading && (
          <button
            aria-label={t('common.clear')}
            onMouseDown={e => { e.preventDefault(); handleClear() }}
            style={{
              flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
              color: C.inkSoft, fontSize: 16, fontWeight: 900, lineHeight: 1, padding: '0 2px',
            }}
          >
            ×
          </button>
        )}

        {loading && (
          <div style={{
            flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
            border: `2px solid rgba(255,122,69,0.25)`, borderTopColor: C.primary,
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: '#fff', borderRadius: 18, border: `2px solid ${INK}`,
          boxShadow: `0 3px 0 ${INK}22`, overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
          zIndex: dropdownZIndex, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease',
        }}>
          {results.map((item, idx) => {
            const isLast = idx === results.length - 1
            const key = item.kind === 'place' ? item.place.id : `ev-${item.event.id}`
            const primary = item.kind === 'place' ? item.place.primary : item.event.title
            const secondary = item.kind === 'place' ? item.place.secondary : eventSecondary(item.event)
            return (
              <div
                key={key}
                onMouseDown={() => handleSelect(item)}
                style={{
                  padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${C.cream}`, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.cream }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                {item.kind === 'event' && (
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                      background: TAG_META[item.event.category]?.color ?? C.cream,
                      border: `2px solid ${INK}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}
                    dangerouslySetInnerHTML={{ __html: TAG_META[item.event.category]?.glyph ?? '' }}
                  />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {primary}
                  </div>
                  {secondary && (
                    <div style={{ fontSize: 12, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {secondary}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
