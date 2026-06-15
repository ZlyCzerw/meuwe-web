import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { haversineKm } from '../lib/geo'
import { C, INK } from '../lib/tokens'

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id: number
    name: string
    city?: string
    state?: string
    country?: string
  }
}

interface SearchResult {
  id: string
  primary: string
  secondary: string
  lat: number
  lng: number
}

interface Props {
  userPos: { lat: number; lng: number } | null
  onSelect: (p: { lat: number; lng: number }) => void
}

function parsePhoton(features: PhotonFeature[], userPos: { lat: number; lng: number } | null): SearchResult[] {
  const seen = new Set<string>()
  const results: SearchResult[] = []

  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const { name, city, state, country } = f.properties
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const parts = [city, state, country].filter(Boolean)
    results.push({
      id: `${f.properties.osm_id}-${lat}-${lng}`,
      primary: name,
      secondary: parts.slice(0, 2).join(', '),
      lat,
      lng,
    })
  }

  if (userPos) {
    results.sort((a, b) =>
      haversineKm(userPos.lat, userPos.lng, a.lat, a.lng) -
      haversineKm(userPos.lat, userPos.lng, b.lat, b.lng)
    )
  }

  return results.slice(0, 5)
}

function SearchBar({ userPos, onSelect }: Props) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function search(val: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const lang = ['de', 'en', 'fr', 'it'].includes(i18n.language) ? i18n.language : 'en'
      const params = new URLSearchParams({ q: val, limit: '8', lang })
      if (userPos) {
        params.set('lat', String(userPos.lat))
        params.set('lon', String(userPos.lng))
      }
      const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: controller.signal })
      const data = await res.json()
      setResults(parsePhoton(data.features ?? [], userPos))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (val.trim().length < 2) {
      abortRef.current?.abort()
      setResults([])
      setLoading(false)
      return
    }
    search(val.trim())
  }

  function handleSelect(item: SearchResult) {
    onSelect({ lat: item.lat, lng: item.lng })
    setQuery(item.primary)
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
    setResults([])
    setLoading(false)
    abortRef.current?.abort()
    inputRef.current?.focus()
  }

  const showDropdown = focused && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: '#fff',
        borderRadius: 999,
        border: `2px solid ${INK}`,
        boxShadow: `0 3px 0 ${INK}22`,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
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
          placeholder={t('map.search')}
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: C.ink,
            border: 'none',
            outline: 'none',
            background: 'transparent',
          }}
        />

        {query.length > 0 && !loading && (
          <button
            onMouseDown={e => { e.preventDefault(); handleClear() }}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.inkSoft,
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        )}

        {loading && (
          <div style={{
            flexShrink: 0,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `2px solid rgba(255,122,69,0.25)`,
            borderTopColor: C.primary,
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 6,
          background: '#fff',
          borderRadius: 18,
          border: `2px solid ${INK}`,
          boxShadow: `0 3px 0 ${INK}22`,
          overflow: 'hidden',
          maxHeight: 260,
          overflowY: 'auto',
          zIndex: 20,
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 150ms ease',
        }}>
          {results.map((item, idx) => {
            const isLast = idx === results.length - 1
            return (
              <div
                key={item.id}
                onMouseDown={() => handleSelect(item)}
                style={{
                  padding: '10px 14px',
                  borderBottom: isLast ? 'none' : `1px solid ${C.cream}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.cream }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.ink,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.primary}
                </div>
                {item.secondary && (
                  <div style={{
                    fontSize: 12,
                    color: C.inkSoft,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}>
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

export default SearchBar
