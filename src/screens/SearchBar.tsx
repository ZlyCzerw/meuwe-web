import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { haversineKm } from '../lib/geo'
import { C, INK } from '../lib/tokens'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  userPos: { lat: number; lng: number } | null
  onSelect: (p: { lat: number; lng: number }) => void
}

function SearchBar({ userPos, onSelect }: Props) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function buildUrl(q: string): string {
    const params = new URLSearchParams({
      q,
      format: 'json',
      limit: '8',
      'accept-language': i18n.language,
      dedupe: '1',
    })
    if (userPos) {
      const delta = 1.5 // ~150km box
      params.set('viewbox', [
        userPos.lng - delta,
        userPos.lat + delta,
        userPos.lng + delta,
        userPos.lat - delta,
      ].join(','))
      params.set('bounded', '0')
    }
    return `https://nominatim.openstreetmap.org/search?${params}`
  }

  function dedup(items: NominatimResult[]): NominatimResult[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = item.display_name.split(',')[0].trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  function sortByDistance(items: NominatimResult[]): NominatimResult[] {
    if (!userPos) return items
    return [...items].sort((a, b) =>
      haversineKm(userPos.lat, userPos.lng, parseFloat(a.lat), parseFloat(a.lon)) -
      haversineKm(userPos.lat, userPos.lng, parseFloat(b.lat), parseFloat(b.lon))
    )
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)

    if (val.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    timerRef.current = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(buildUrl(val.trim()), {
          headers: { 'Accept-Language': i18n.language },
          signal: controller.signal,
        })
        const data: NominatimResult[] = await res.json()
        setResults(sortByDistance(dedup(data)).slice(0, 5))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function handleSelect(item: NominatimResult) {
    const primary = item.display_name.split(',')[0]
    onSelect({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) })
    setQuery(primary)
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
    clearTimeout(timerRef.current)
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
        }}>
          {results.map((item, idx) => {
            const parts = item.display_name.split(',')
            const primary = parts[0]
            const secondary = parts.slice(1, 3).join(',').trim()
            const isLast = idx === results.length - 1
            return (
              <div
                key={item.place_id}
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
                  {primary}
                </div>
                {secondary && (
                  <div style={{
                    fontSize: 12,
                    color: C.inkSoft,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}>
                    {secondary}
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
