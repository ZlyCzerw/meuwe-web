import { describe, it, expect } from 'vitest'
import { resolveAxis, commitDir, dirOf, resolveHMode, AXIS_LOCK_PX, COMMIT_MIN_PX } from './cardDrag'

describe('resolveAxis', () => {
  it('holds off until the finger has actually travelled', () => {
    expect(resolveAxis(4, 4)).toBe('none')
    expect(resolveAxis(AXIS_LOCK_PX - 1, 0)).toBe('none')
  })

  it('calls the dominant direction', () => {
    expect(resolveAxis(-40, 6)).toBe('horizontal')
    expect(resolveAxis(6, 40)).toBe('vertical')
  })

  // Remis idzie na pion: karta jest przede wszystkim szufladą, a sznurek
  // dodatkiem. Niepewny gest ma podnosić kartę, nie zmieniać wydarzenie.
  it('gives a tie to the vertical axis', () => {
    expect(resolveAxis(20, 20)).toBe('vertical')
  })
})

describe('commitDir', () => {
  it('needs a real quarter of the card', () => {
    expect(commitDir(-90, 400)).toBeNull()      // 25% z 400 to 100
    expect(commitDir(-110, 400)).toBe('east')
  })

  // Palec w lewo odsuwa kartę w lewo, więc następna nadchodzi z prawej — czyli
  // ze wschodu.
  it('reads a leftward swipe as east and a rightward one as west', () => {
    expect(commitDir(-200, 400)).toBe('east')
    expect(commitDir(200, 400)).toBe('west')
  })

  it('keeps a floor under the threshold on a narrow card', () => {
    expect(commitDir(-(COMMIT_MIN_PX - 1), 100)).toBeNull()
    expect(commitDir(-COMMIT_MIN_PX, 100)).toBe('east')
  })

  it('is null when the finger barely moved', () => {
    expect(commitDir(0, 400)).toBeNull()
  })
})

describe('dirOf', () => {
  it('reads a leftward finger as east and a rightward one as west', () => {
    expect(dirOf(-12)).toBe('east')
    expect(dirOf(12)).toBe('west')
  })
})

// Gest poziomy nad czymś, co samo przewija się w poziomie (kadr zdjęć, pasek
// tagów): póki scroller ma dokąd jechać, karta milczy; na krawędzi gest jest jej.
describe('resolveHMode', () => {
  it('lets the scroller move while it still has somewhere to go', () => {
    expect(resolveHMode({ dir: 'east', atStart: true, atEnd: false })).toBe('scroll')
    expect(resolveHMode({ dir: 'west', atStart: false, atEnd: true })).toBe('scroll')
  })

  it('hands the gesture to the card once the finger pushes past the edge', () => {
    expect(resolveHMode({ dir: 'east', atStart: false, atEnd: true })).toBe('swipe')
    expect(resolveHMode({ dir: 'west', atStart: true, atEnd: false })).toBe('swipe')
  })

  // Jedno zdjęcie: obie krawędzie naraz, więc każdy ruch w bok to swipe karty.
  it('treats a single photo as both edges', () => {
    expect(resolveHMode({ dir: 'east', atStart: true, atEnd: true })).toBe('swipe')
    expect(resolveHMode({ dir: 'west', atStart: true, atEnd: true })).toBe('swipe')
  })
})
