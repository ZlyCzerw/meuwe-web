import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import DayTimeline, { type TimelineMode } from './DayTimeline'
import { TODAY_IDX, type DayRange } from '../lib/timeline'
// Bez tego tłumacz zwraca surowe klucze i asercje na napisach nic nie znaczą.
import '../lib/i18n'

// jsdom nie zna przechwytywania wskaźnika, a komponent woła je na każdym
// wciśnięciu — bez atrapy każdy test wywraca się na TypeError.
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  // jsdom nie umie też trafiać w punkt, a to tą drogą pasek odnajduje kafelek
  // pod palcem. Domyślnie pod wskaźnikiem nie leży nic; test dotknięcia
  // podstawia sobie kafelek, w który chce trafić.
  document.elementFromPoint = () => null
})

/** Pasek z prawdziwym stanem, tak jak trzyma go MapScreen. */
function Harness({ onRange }: { onRange?: (r: DayRange) => void }) {
  const [range, setRange] = useState<DayRange>({ startIdx: TODAY_IDX, endIdx: TODAY_IDX })
  const [mode, setMode] = useState<TimelineMode>('day')
  const [open, setOpen] = useState(true)
  return (
    <DayTimeline
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      onModeChange={setMode}
      range={range}
      onRangeChange={r => { setRange(r); onRange?.(r) }}
    />
  )
}

const tile = (idx: number) => screen.getByTestId(`day-${idx}`)
const toRange = () => fireEvent.click(screen.getByRole('button', { name: 'Date range' }))

describe('tryb dnia', () => {
  it('dotknięcie kafelka wybiera jeden dzień', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    fireEvent.click(tile(5))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })
  })

  // Zachowanie z db86eb1: przeciągnięcie przewija pasek, a puszczenie wybiera
  // dzień, na którym się zatrzymał. W trybie zakresu ten sam gest tylko
  // przewija — patrz test niżej, który sprawdza to od drugiej strony.
  it('puszczenie przeciągniętego paska wybiera dzień, na którym stanął', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    const strip = screen.getByTestId('day-strip')
    fireEvent.pointerDown(strip, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(strip, { clientX: 120, pointerId: 1 })
    fireEvent.pointerUp(strip, { clientX: 120, pointerId: 1 })
    // Pasek stoi na dziś, czyli z przesunięciem 107 px, a kafelek z przerwą
    // zajmuje 60 px. Przeciągnięcie o 80 px w lewo wypada więc na indeksie 3.
    expect(onRange).toHaveBeenCalledTimes(1)
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 3, endIdx: 3 })
  })
})

describe('tryb zakresu', () => {
  it('dwa dotknięcia składają zakres', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })
    fireEvent.click(tile(8))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 8 })
  })

  it('drugie dotknięcie we wcześniejszą datę zaznacza wstecz', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(tile(1))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 1, endIdx: 5 })
  })

  it('trzecie dotknięcie zaczyna nowy zakres', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(tile(8))
    fireEvent.click(tile(2))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 2, endIdx: 2 })
  })

  it('powrót na tryb dnia zrównuje koniec z początkiem', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(tile(8))
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })
  })

  // Kotwica nie ma swojego wyglądu — kafelek z niedomkniętym zakresem wygląda
  // jak zwykły wybrany dzień. Gdyby przetrwała zwinięcie paska, dotknięcie po
  // ponownym otwarciu domknęłoby zakres od daty, której nikt już nie widzi.
  it('zwinięcie paska porzuca niedomknięty zakres', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(screen.getByLabelText('close-timeline'))
    // Zwinięty pasek to jeden guzik — pigułka, która otwiera go z powrotem.
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(tile(9))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 9, endIdx: 9 })
  })

  // Palec nie chodzi drogą `click`: dotknięcie wraca przez `pointerup` na
  // pasku, bo przechwycony wskaźnik zabiera klikowi jego cel. Przeglądarka
  // dosyła po nim własny `click` i ten jeden musi przepaść — inaczej jedno
  // dotknięcie policzyłoby się dwa razy i od razu domknęło zakres na jednym dniu.
  it('dotknięcie wskaźnikiem liczy się raz, mimo dosłanego kliknięcia', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    document.elementFromPoint = () => tile(5)
    const strip = screen.getByTestId('day-strip')
    fireEvent.pointerDown(strip, { clientX: 200, clientY: 40, pointerId: 1 })
    fireEvent.pointerUp(strip, { clientX: 200, clientY: 40, pointerId: 1 })
    expect(onRange).toHaveBeenCalledTimes(1)
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })

    // Echo przeglądarki — kafelek dostaje `click`, którego nikt nie wykonał.
    fireEvent.click(tile(5))
    expect(onRange).toHaveBeenCalledTimes(1)

    // Kotwica została otwarta, więc dopiero kolejne dotknięcie domyka zakres.
    // Gdyby echo się policzyło, ten tap zaczynałby nowy zakres na dniu 8.
    fireEvent.click(tile(8))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 8 })
  })

  it('przeciągnięcie przewija pasek i niczego nie zaznacza', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    const strip = screen.getByTestId('day-strip')
    fireEvent.pointerDown(strip, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(strip, { clientX: 120, pointerId: 1 })
    fireEvent.pointerUp(strip, { clientX: 120, pointerId: 1 })
    expect(onRange).not.toHaveBeenCalled()
  })
})
