import { describe, it, expect } from 'vitest'
import { dateToIdx, idxToDate, idxToOffset, DAYS_COUNT, TODAY_IDX } from './timeline'

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
