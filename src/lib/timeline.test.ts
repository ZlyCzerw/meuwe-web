import { describe, it, expect } from 'vitest'
import {
  dateToIdx, idxToDate, idxToOffset, DAYS_COUNT, TODAY_IDX,
  normalizeRange, isInRange, tapRange, tileState, rangeWindow,
} from './timeline'

// Południe, żeby dodawanie dni nie ocierało się o zmianę czasu.
const now = new Date(2026, 7, 19, 12, 0, 0) // 19 sierpnia 2026

describe('dateToIdx', () => {
  it('kładzie dzisiejszą datę na indeksie dziś', () => {
    expect(dateToIdx(new Date(2026, 7, 19, 23, 30), now)).toBe(TODAY_IDX)
  })

  it('liczy dni kalendarzowo, nie dobami — wczorajszy wieczór to wczoraj', () => {
    expect(dateToIdx(new Date(2026, 7, 18, 23, 0), now)).toBe(0)
  })

  it('trafia w dzień wydarzenia z linku (23 sierpnia = cztery dni w przód)', () => {
    expect(dateToIdx(new Date(2026, 7, 23, 16, 0), now)).toBe(TODAY_IDX + 4)
  })

  it('nie schodzi poniżej początku osi', () => {
    expect(dateToIdx(new Date(2026, 6, 1), now)).toBe(0)
  })

  it('nie wychodzi poza koniec osi', () => {
    expect(dateToIdx(new Date(2027, 0, 1), now)).toBe(DAYS_COUNT - 1)
  })

  it('każdy indeks osi wraca na swoje miejsce', () => {
    for (let i = 0; i < DAYS_COUNT; i++) {
      expect(dateToIdx(idxToDate(i, now), now)).toBe(i)
    }
  })
})

describe('idxToOffset', () => {
  it('mierzy dni od dziś', () => {
    expect(idxToOffset(0)).toBe(-1)
    expect(idxToOffset(TODAY_IDX)).toBe(0)
    expect(idxToOffset(DAYS_COUNT - 1)).toBe(13)
  })
})

describe('normalizeRange', () => {
  it('zostawia zakres wybrany od najwcześniejszej daty', () => {
    expect(normalizeRange(2, 6)).toEqual({ startIdx: 2, endIdx: 6 })
  })

  it('zamienia daty, gdy zakres zaznaczono wstecz', () => {
    // Tap na niedzielę 23.08 (idx 5), potem na środę 19.08 (idx 1).
    expect(normalizeRange(5, 1)).toEqual({ startIdx: 1, endIdx: 5 })
  })

  it('ta sama data z obu stron to zakres jednodniowy', () => {
    expect(normalizeRange(3, 3)).toEqual({ startIdx: 3, endIdx: 3 })
  })
})

describe('isInRange', () => {
  const range = { startIdx: 2, endIdx: 5 }

  it('obejmuje oba końce', () => {
    expect(isInRange(2, range)).toBe(true)
    expect(isInRange(5, range)).toBe(true)
  })

  it('obejmuje środek', () => {
    expect(isInRange(4, range)).toBe(true)
  })

  it('nie obejmuje dni poza zakresem', () => {
    expect(isInRange(1, range)).toBe(false)
    expect(isInRange(6, range)).toBe(false)
  })
})

describe('tapRange', () => {
  const start = { range: { startIdx: 1, endIdx: 1 }, anchorIdx: null }

  it('pierwsze dotknięcie zwija zakres do jednego dnia i zapamiętuje początek', () => {
    expect(tapRange(start, 5)).toEqual({
      range: { startIdx: 5, endIdx: 5 }, anchorIdx: 5,
    })
  })

  it('drugie dotknięcie dopina koniec i zwalnia kotwicę', () => {
    const afterFirst = tapRange(start, 5)
    expect(tapRange(afterFirst, 8)).toEqual({
      range: { startIdx: 5, endIdx: 8 }, anchorIdx: null,
    })
  })

  it('drugie dotknięcie we wcześniejszą datę zaznacza wstecz', () => {
    const afterFirst = tapRange(start, 5)
    expect(tapRange(afterFirst, 1)).toEqual({
      range: { startIdx: 1, endIdx: 5 }, anchorIdx: null,
    })
  })

  it('trzecie dotknięcie zaczyna nowy zakres', () => {
    const complete = tapRange(tapRange(start, 5), 8)
    expect(tapRange(complete, 2)).toEqual({
      range: { startIdx: 2, endIdx: 2 }, anchorIdx: 2,
    })
  })
})

describe('tileState', () => {
  const range = { startIdx: 2, endIdx: 5 }

  it('bez podglądu maluje końce, środek i resztę osobno', () => {
    expect(tileState(2, range, null)).toBe('edge')
    expect(tileState(5, range, null)).toBe('edge')
    expect(tileState(3, range, null)).toBe('inside')
    expect(tileState(9, range, null)).toBe('idle')
  })

  it('podgląd zastępuje zaznaczenie, a kotwica zostaje końcem', () => {
    const preview = { anchorIdx: 2, range: { startIdx: 2, endIdx: 7 } }
    expect(tileState(2, range, preview)).toBe('edge')
    expect(tileState(6, range, preview)).toBe('preview')
    expect(tileState(3, range, preview)).toBe('preview')
    expect(tileState(9, range, preview)).toBe('idle')
  })
})

describe('rangeWindow', () => {
  it('zakres jednodniowy na dziś obejmuje całą dzisiejszą dobę', () => {
    const w = rangeWindow(0, 0, now)
    expect(w.dayStart).toEqual(new Date(2026, 7, 19, 0, 0, 0, 0))
    expect(w.dayEnd).toEqual(new Date(2026, 7, 19, 23, 59, 59, 999))
  })

  it('zakres wielodniowy kończy się o północy ostatniego dnia', () => {
    const w = rangeWindow(0, 4, now)
    expect(w.dayStart).toEqual(new Date(2026, 7, 19, 0, 0, 0, 0))
    expect(w.dayEnd).toEqual(new Date(2026, 7, 23, 23, 59, 59, 999))
  })

  it('zakres zaczynający się dziś chowa wydarzenia już zakończone', () => {
    expect(rangeWindow(0, 4, now).endTimeFloor).toEqual(now)
  })

  it('zakres zaczynający się wczoraj pokazuje wczorajsze zakończone', () => {
    const w = rangeWindow(-1, 4, now)
    expect(w.endTimeFloor).toEqual(new Date(2026, 7, 18, 0, 0, 0, 0))
  })

  it('zakres w całości w przyszłości liczy się od swojej pierwszej północy', () => {
    const w = rangeWindow(3, 5, now)
    expect(w.endTimeFloor).toEqual(new Date(2026, 7, 22, 0, 0, 0, 0))
  })
})
