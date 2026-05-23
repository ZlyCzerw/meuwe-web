import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK } from '../lib/tokens'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

function SearchBar({ onSelect }: { onSelect: (p: { lat: number; lng: number }) => void }) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

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
      const q = val.trim()
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=${i18n.language}`
      try {
        const res = await fetch(url, { headers: { 'Accept-Language': i18n.language } })
        const data: NominatimResult[] = await res.json()
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  function handleSelect(item: NominatimResult) {
    const primary = item.display_name.split(',')[0]
    onSelect({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) })
    setQuery(primary)
    setResults([])
    inputRef.current?.blur()
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setLoading(false)
    clearTimeout(timerRef.current)
    inputRef.current?.focus()
  }

  const showDropdown = focused && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      {/* Search bar */}
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
        {/* Magnifier icon */}
        <svg width="16" height="16" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13 13 L17 17" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
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

        {/* Clear button */}
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

        {/* Loading spinner */}
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

      {/* Results dropdown */}
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
