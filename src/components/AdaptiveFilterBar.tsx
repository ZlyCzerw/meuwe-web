import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { computeVisibleCount } from '../lib/filterBarFit'

// Bar order; party + music lead per product requirement, then the rest.
const PRIORITY_FILTERS: Category[] = [
  'party', 'music', 'culture', 'sport', 'food', 'outdoor', 'family', 'art',
  'film', 'gaming', 'tech', 'nature', 'travel', 'yoga', 'dance', 'comedy',
  'kids', 'pets', 'volunteering', 'workshop', 'alert',
]
const GAP = 8

type Props = {
  selectedFilters: string[]
  onToggle: (cat: string) => void
  onClear: () => void
  onOpenPicker: () => void
}

const allStyle = (active: boolean): CSSProperties => ({
  flexShrink: 0, padding: '6px 14px', borderRadius: 999,
  background: active ? C.ink : '#fff', color: active ? '#fff' : C.inkSoft,
  fontSize: 12, fontWeight: 800,
  border: `2px solid ${active ? C.ink : INK + '22'}`,
  boxShadow: active ? `0 2px 0 ${INK}` : 'none',
  transition: 'all 180ms ease', whiteSpace: 'nowrap',
})
const chipStyle = (active: boolean, color: string): CSSProperties => ({
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 999,
  background: active ? color : '#fff', color: active ? '#fff' : C.ink,
  fontSize: 12, fontWeight: 800,
  border: `2px solid ${active ? C.ink : INK + '22'}`,
  boxShadow: active ? `0 2px 0 ${C.ink}` : 'none',
  transition: 'all 180ms ease', whiteSpace: 'nowrap',
})
const plusStyle = (on: boolean): CSSProperties => ({
  flexShrink: 0, position: 'relative', width: 34, height: 34, borderRadius: '50%',
  background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink,
  border: `2px solid ${on ? C.ink : INK + '22'}`,
  boxShadow: on ? `0 2px 0 ${INK}` : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 20, fontWeight: 700, lineHeight: 1, transition: 'all 180ms ease',
})

export default function AdaptiveFilterBar({ selectedFilters, onToggle, onClear, onOpenPicker }: Props) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const allMeasureRef = useRef<HTMLButtonElement>(null)
  const plusMeasureRef = useRef<HTMLButtonElement>(null)
  const chipMeasureRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [visibleCount, setVisibleCount] = useState(PRIORITY_FILTERS.length)

  const recompute = () => {
    const container = containerRef.current
    if (!container) return
    const available = container.clientWidth - 32 // 16px horizontal padding each side
    const allWidth = allMeasureRef.current?.offsetWidth ?? 0
    const plusWidth = plusMeasureRef.current?.offsetWidth ?? 0
    const chipWidths = chipMeasureRefs.current.map(el => el?.offsetWidth ?? 0)
    setVisibleCount(computeVisibleCount(available, chipWidths, allWidth, plusWidth, GAP))
  }

  // Re-measure when labels change language (chip widths change).
  useLayoutEffect(() => { recompute() }, [i18n.language])

  // Re-measure on container resize / orientation change.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const renderChip = (cat: Category, measureRef?: (el: HTMLButtonElement | null) => void) => {
    const meta = TAG_META[cat]
    const active = selectedFilters.includes(cat)
    return (
      <button key={cat} ref={measureRef} onClick={() => onToggle(cat)} style={chipStyle(active, meta.color)}>
        {/* SAFETY: meta.glyph is a static SVG from tokens.ts — not user input */}
        <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: meta.glyph }} />
        {t('tags.' + cat)}
      </button>
    )
  }

  const visible = PRIORITY_FILTERS.slice(0, visibleCount)
  const hiddenSelected = selectedFilters.filter(f => !visible.includes(f as Category)).length
  const plusActive = hiddenSelected > 0

  return (
    <>
      <div ref={containerRef} style={{
        position: 'absolute', top: 76, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: GAP, padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: GAP, minWidth: 0 }}>
          <button onClick={onClear} style={allStyle(selectedFilters.length === 0)}>{t('map.allCategories')}</button>
          {visible.map(cat => renderChip(cat))}
        </div>
        <button onClick={onOpenPicker} aria-label="More filters" style={plusStyle(plusActive)}>
          +
          {plusActive && (
            <span style={{
              position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 999, background: C.primary, color: '#fff', fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff',
            }}>{hiddenSelected}</span>
          )}
        </button>
      </div>

      {/* Hidden measurement row — off-screen, measures natural chip widths. */}
      <div aria-hidden style={{
        position: 'absolute', top: -9999, left: 0, visibility: 'hidden', pointerEvents: 'none',
        display: 'flex', gap: GAP,
      }}>
        <button ref={allMeasureRef} style={allStyle(false)}>{t('map.allCategories')}</button>
        {PRIORITY_FILTERS.map((cat, i) => renderChip(cat, el => { chipMeasureRefs.current[i] = el }))}
        <button ref={plusMeasureRef} style={plusStyle(false)}>+</button>
      </div>
    </>
  )
}
