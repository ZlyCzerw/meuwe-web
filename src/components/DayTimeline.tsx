import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK } from '../lib/tokens'
import {
  DAYS_COUNT, idxToDate, idxToOffset, tileState,
  type DayRange,
} from '../lib/timeline'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

/** Szerokość kafelka i przerwa między nimi — z nich liczy się przewijanie. */
const TILE = 56
const GAP = 4
const TRACK = 270
const MAX_TRANSLATE = 0
const MIN_TRANSLATE = -(DAYS_COUNT * TILE + (DAYS_COUNT - 1) * GAP - TRACK)

function idxToTranslate(idx: number) {
  return Math.max(MIN_TRANSLATE, Math.min(MAX_TRANSLATE, 107 - idx * (TILE + GAP)))
}
function translateToIdx(tx: number) {
  return Math.max(0, Math.min(DAYS_COUNT - 1, Math.round((107 - tx) / (TILE + GAP))))
}

/**
 * Pasek wyboru dnia pod mapą. Nie wie nic o mapie ani o pobieraniu danych —
 * dostaje zakres i oddaje nowy zakres.
 */
export default function DayTimeline({
  open, onOpenChange, range, onRangeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  range: DayRange
  onRangeChange: (r: DayRange) => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'

  /** Kafelek, na którym stoi okno przewijania. */
  const [focusIdx, setFocusIdx] = useState(range.startIdx)
  const [liveTranslate, setLiveTranslate] = useState<number | null>(null)
  const drag = useRef({ startX: 0, baseTranslate: 0, on: false, moved: false })

  // Dzień ustawiony z zewnątrz — deep link do wydarzenia, przycisk pustej
  // karty — musi wjechać w okno paska, inaczej podświetlony kafelek zostaje
  // za krawędzią. Własne dotknięcia ustawiają oba naraz, więc dla nich to nic
  // nie zmienia.
  useEffect(() => { setFocusIdx(range.startIdx) }, [range.startIdx])

  /**
   * Dotknięcie kafelka dochodzi dwiema drogami: przez `pointerup` na pasku
   * (to ta, którą chodzą palce — przechwycony wskaźnik zabiera klikowi jego
   * cel) i przez `onClick` samego kafelka, który zostaje dla klawiatury.
   * Znacznik czasu pilnuje, żeby jedno dotknięcie nie policzyło się dwa razy.
   */
  const lastAppliedAt = useRef(0)

  function select(idx: number, from: 'pointer' | 'click') {
    if (from === 'click' && Date.now() - lastAppliedAt.current < 400) return
    lastAppliedAt.current = Date.now()
    setFocusIdx(idx)
    onRangeChange({ startIdx: idx, endIdx: idx })
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, baseTranslate: idxToTranslate(focusIdx), on: true, moved: false }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.on) return
    const delta = e.clientX - drag.current.startX
    if (Math.abs(delta) > 8) drag.current.moved = true
    if (!drag.current.moved) return
    const raw = drag.current.baseTranslate + delta
    setLiveTranslate(Math.max(MIN_TRANSLATE, Math.min(MAX_TRANSLATE, raw)))
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.on) return
    drag.current.on = false
    if (drag.current.moved && liveTranslate !== null) {
      const snapped = translateToIdx(liveTranslate)
      setFocusIdx(snapped)
      onRangeChange({ startIdx: snapped, endIdx: snapped })
    } else if (!drag.current.moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const dayEl = el?.closest('[data-day-idx]') as HTMLElement | null
      if (dayEl?.dataset.dayIdx != null) select(Number(dayEl.dataset.dayIdx), 'pointer')
    }
    setLiveTranslate(null)
  }
  function onPointerCancel() {
    drag.current.on = false
    setLiveTranslate(null)
  }

  function step(delta: number) {
    const next = Math.max(0, Math.min(DAYS_COUNT - 1, focusIdx + delta))
    setFocusIdx(next)
    onRangeChange({ startIdx: next, endIdx: next })
  }

  const pillLabel = (() => {
    const d = idxToDate(range.startIdx)
    const offset = idxToOffset(range.startIdx)
    const dayLabel = offset === 0 ? t('map.today')
      : offset === -1 ? t('map.yesterday')
      : d.toLocaleDateString(loc, { weekday: 'long' })
    return `${dayLabel} · ${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`
  })()

  if (!open) {
    return (
      <button onClick={() => onOpenChange(true)} style={{
        padding: '10px 20px', borderRadius: 999,
        background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
        fontSize: 13, fontWeight: 800, color: INK,
        display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto',
      }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: C.primary, border: `1.5px solid ${INK}` }} />
        {pillLabel}
      </button>
    )
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      data-testid="day-strip"
      style={{
        padding: '6px 8px', borderRadius: 999, background: '#fff',
        border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
        display: 'flex', alignItems: 'center', gap: 4,
        touchAction: 'none', cursor: 'grab', userSelect: 'none', pointerEvents: 'auto',
      }}
    >
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => step(-1)}
        style={{
          flexShrink: 0, width: 20, background: 'none', border: 'none', padding: 0,
          color: INK, opacity: focusIdx > 0 ? 0.7 : 0.2,
          fontWeight: 900, fontSize: 18, cursor: focusIdx > 0 ? 'pointer' : 'default',
        }}
      >‹</button>

      <div style={{ width: TRACK, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', gap: GAP,
          transition: liveTranslate !== null ? 'none' : 'transform 300ms cubic-bezier(0.32,1.2,0.4,1)',
          transform: `translateX(${liveTranslate !== null ? liveTranslate : idxToTranslate(focusIdx)}px)`,
        }}>
          {Array.from({ length: DAYS_COUNT }, (_, i) => {
            const d = idxToDate(i)
            const isToday = idxToOffset(i) === 0
            const state = tileState(i, range, null)
            const active = state === 'edge' || state === 'inside'
            return (
              <button
                key={i}
                data-day-idx={i}
                onClick={() => select(i, 'click')}
                style={{
                  flexShrink: 0, width: TILE, borderRadius: 14,
                  padding: '6px 0', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 1,
                  background: active ? C.primary : isToday ? C.primarySoft : 'transparent',
                  color: active ? '#fff' : C.ink,
                  border: active ? `2px solid ${INK}` : '2px solid transparent',
                  fontSize: 11, fontWeight: 800,
                  transition: 'all 200ms ease',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                  {isToday ? t('map.today').slice(0, 3)
                    : d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '')}
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{d.getDate()}</span>
                <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>
                  {d.toLocaleDateString(loc, { month: 'short' }).replace('.', '')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => step(1)}
        style={{
          flexShrink: 0, width: 20, background: 'none', border: 'none', padding: 0,
          color: INK, opacity: focusIdx < DAYS_COUNT - 1 ? 0.7 : 0.2,
          fontWeight: 900, fontSize: 18, cursor: focusIdx < DAYS_COUNT - 1 ? 'pointer' : 'default',
        }}
      >›</button>

      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onOpenChange(false)}
        aria-label="close-timeline"
        style={{ flexShrink: 0, width: 24, color: INK, fontWeight: 900, opacity: 0.5, fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}
      >×</button>
    </div>
  )
}
