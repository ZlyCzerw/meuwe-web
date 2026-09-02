// src/components/PlaceSearchInput.tsx
//
// Pole „wpisz kilka liter, wybierz z listy”. Jedno dla mapy (SearchBar) i dla
// miejscowości w Moich danych, żeby oba wyglądały identycznie. Wartość istnieje
// tylko po wyborze z listy: samo wpisanie tekstu niczego nie wybiera.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchPlaces, photonLang, type PlaceResult } from '../lib/placeSearch'
import { C, INK } from '../lib/tokens'

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
}

export default function PlaceSearchInput({
  placeholder, near, onSelect, settlementsOnly = false, initialQuery = '',
  labelFor = r => r.primary, onQueryChange, dropdownZIndex = 20,
}: Props) {
  const { i18n } = useTranslation()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PlaceResult[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setQuery(initialQuery) }, [initialQuery])

  async function search(val: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      setResults(await searchPlaces(val, { lang: photonLang(i18n.language), near, settlementsOnly, signal: controller.signal }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setResults([])
    } finally {
      setLoading(false)
    }
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

  function handleSelect(item: PlaceResult) {
    onSelect(item)
    setQuery(labelFor(item))
    setResults([])
    inputRef.current?.blur()
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
            aria-label="clear"
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
            return (
              <div
                key={item.id}
                onMouseDown={() => handleSelect(item)}
                style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${C.cream}`, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.cream }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.primary}
                </div>
                {item.secondary && (
                  <div style={{ fontSize: 12, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {item.secondary}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
