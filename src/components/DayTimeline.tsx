import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK } from '../lib/tokens'
import {
  DAYS_COUNT, idxToDate, idxToOffset, normalizeRange, tapRange, tileState,
  type DayRange, type RangeSelection,
} from '../lib/timeline'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

/** Szerokość kafelka i przerwa między nimi — z nich liczy się przewijanie. */
const TILE = 56
const GAP = 4
const TRACK = 270
const MAX_TRANSLATE = 0
const MIN_TRANSLATE = -(DAYS_COUNT * TILE + (DAYS_COUNT - 1) * GAP - TRACK)

export type TimelineMode = 'day' | 'range'

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
  open, onOpenChange, mode, onModeChange, range, onRangeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  range: DayRange
  onRangeChange: (r: DayRange) => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'

  /** Kafelek, na którym stoi okno przewijania. */
  const [focusIdx, setFocusIdx] = useState(range.startIdx)
  /** Data początkowa czekająca na swój koniec. Null = następny tap ją ustawi. */
  const [anchorIdx, setAnchorIdx] = useState<number | null>(null)
  /** Kafelek pod kursorem — tylko myszą, palec nie ma stanu „nad". */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const preview = mode === 'range' && anchorIdx !== null && hoverIdx !== null
    ? { anchorIdx, range: normalizeRange(anchorIdx, hoverIdx) }
    : null

  const [liveTranslate, setLiveTranslate] = useState<number | null>(null)
  const drag = useRef({ startX: 0, baseTranslate: 0, on: false, moved: false })

  // Dzień ustawiony z zewnątrz — deep link do wydarzenia, przycisk pustej
  // karty — musi wjechać w okno paska, inaczej podświetlony kafelek zostaje
  // za krawędzią. Własne dotknięcia ustawiają oba naraz, więc dla nich to nic
  // nie zmienia.
  useEffect(() => { setFocusIdx(range.startIdx) }, [range.startIdx])

  // Zwinięcie paska kończy wybieranie zakresu. Kotwica nie ma swojego wyglądu —
  // kafelek z niedomkniętym zakresem wygląda jak zwykły wybrany dzień — więc
  // przetrwawszy zamknięcie kazałaby następnemu dotknięciu domknąć zakres od
  // daty, której nikt już nie widzi.
  useEffect(() => {
    if (!open) { setAnchorIdx(null); setHoverIdx(null) }
  }, [open])

  /**
   * Dotknięcie kafelka dochodzi dwiema drogami: przez `pointerup` na pasku
   * (to ta, którą chodzą palce — przechwycony wskaźnik zabiera klikowi jego
   * cel) i przez `onClick` samego kafelka, który zostaje dla klawiatury.
   * Po drodze przez wskaźnik przeglądarka dosyła jeszcze `click` — znacznik
   * zjada dokładnie ten jeden. Zapala go wyłącznie droga wskaźnika, bo tylko
   * ona ma swoje echo: klawiatura przychodzi sama i musi się liczyć zawsze,
   * a dwa prawdziwe dotknięcia pod rząd składają zakres i nie wolno ich mylić
   * z jednym policzonym dwa razy. Okno czasu domyka sprawę, gdy `click` po
   * wskaźniku nie przyjdzie wcale — inaczej znacznik zjadłby kiedyś nie swoje.
   */
  const pointerTapAt = useRef(0)

  function select(idx: number, from: 'pointer' | 'click') {
    if (from === 'click' && Date.now() - pointerTapAt.current < 400) {
      pointerTapAt.current = 0
      return
    }
    pointerTapAt.current = from === 'pointer' ? Date.now() : 0
    setFocusIdx(idx)
    if (mode === 'day') {
      setAnchorIdx(null)
      onRangeChange({ startIdx: idx, endIdx: idx })
      return
    }
    const sel: RangeSelection = { range, anchorIdx }
    const next = tapRange(sel, idx)
    setAnchorIdx(next.anchorIdx)
    onRangeChange(next.range)
  }

  /**
   * Przełącznik zmienia tylko to, jak pasek czyta dotknięcia. Wracając na dzień
   * trzeba jednak zwinąć zakres, bo mapa czyta wyłącznie zakres i inaczej
   * zostałaby przy wielu dniach mimo napisu „Dzień".
   */
  function switchMode(m: TimelineMode) {
    if (m === mode) return
    setAnchorIdx(null)
    setHoverIdx(null)
    onModeChange(m)
    // Zwinięcie zakresu zostawia zaznaczony jego początek, a okno paska stoi
    // tam, dokąd doszły strzałki — czyli często poza nim. Efekt wyżej tego nie
    // złapie, bo `startIdx` się nie zmienia; okno trzeba dosunąć tutaj.
    if (m === 'day') {
      setFocusIdx(range.startIdx)
      onRangeChange({ startIdx: range.startIdx, endIdx: range.startIdx })
    }
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
      // W trybie dnia puszczenie paska wybiera dzień, na którym się zatrzymał —
      // tak działał od zawsze. W trybie zakresu przeciąganie ma tylko przewijać,
      // bo zaznaczanie należy do dotknięć.
      if (mode === 'day') onRangeChange({ startIdx: snapped, endIdx: snapped })
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
    // W trybie zakresu strzałki przesuwają wyłącznie okno paska. Inaczej nie
    // dałoby się dojechać do odległej daty końcowej bez skasowania początku.
    if (mode === 'day') onRangeChange({ startIdx: next, endIdx: next })
  }

  const pillLabel = (() => {
    const from = idxToDate(range.startIdx)
    const short = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
    // Zakres wielodniowy nie mieści nazwy dnia tygodnia, więc pokazuje same daty.
    if (range.startIdx !== range.endIdx) {
      return `${short(from)} – ${short(idxToDate(range.endIdx))}`
    }
    const offset = idxToOffset(range.startIdx)
    const dayLabel = offset === 0 ? t('map.today')
      : offset === -1 ? t('map.yesterday')
      : from.toLocaleDateString(loc, { weekday: 'long' })
    return `${dayLabel} · ${short(from)}`
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      pointerEvents: 'auto',
    }}>
      <div style={{
        display: 'flex', padding: 3, borderRadius: 999, background: '#fff',
        border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
      }}>
        {(['day', 'range'] as const).map(m => (
          <button
            key={m}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => switchMode(m)}
            style={{
              padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: mode === m ? C.primary : 'transparent',
              color: mode === m ? '#fff' : C.ink,
              fontSize: 12, fontWeight: 800,
              transition: 'all 200ms ease',
            }}
          >
            {t(m === 'day' ? 'map.modeDay' : 'map.modeRange')}
          </button>
        ))}
      </div>

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
          touchAction: 'none', cursor: 'grab', userSelect: 'none',
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
              const state = tileState(i, range, preview)
              // Przynależność do zakresu bije zaznaczenie „dziś" — inaczej
              // dzisiejszy kafelek w środku zakresu wyglądałby na wyjęty z niego.
              const background =
                state === 'edge' ? C.primary
                : state === 'inside' ? C.primaryRange
                : state === 'preview' ? C.primarySoft
                : isToday ? C.primarySoft
                : 'transparent'
              return (
                <button
                  key={i}
                  data-day-idx={i}
                  data-testid={`day-${i}`}
                  onClick={() => select(i, 'click')}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(prev => (prev === i ? null : prev))}
                  style={{
                    flexShrink: 0, width: TILE, borderRadius: 14,
                    padding: '6px 0', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 1,
                    background,
                    color: state === 'edge' ? '#fff' : C.ink,
                    border: state === 'edge' ? `2px solid ${INK}` : '2px solid transparent',
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
          style={{
            flexShrink: 0, width: 24, color: INK, fontWeight: 900, opacity: 0.5, fontSize: 16,
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >×</button>
      </div>
    </div>
  )
}
