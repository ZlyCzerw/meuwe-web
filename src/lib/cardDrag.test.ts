import { describe, it, expect } from 'vitest'
import { resolveAxis, commitDir, dirOf, resolveHMode, nextPrimed, AXIS_LOCK_PX, COMMIT_MIN_PX } from './cardDrag'

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
// tagów). Trzy odpowiedzi: scroller jeszcze jedzie → karta milczy; scroller na
// krawędzi → karta jedzie za palcem, ale wraca (odbicie, żeby palec poczuł
// koniec); drugie odbicie w tę samą stronę → prawdziwy swipe karty.
describe('resolveHMode', () => {
  it('lets the scroller move while it still has somewhere to go', () => {
    expect(resolveHMode({ dir: 'east', atStart: true, atEnd: false, primed: null })).toBe('scroll')
    expect(resolveHMode({ dir: 'west', atStart: false, atEnd: true, primed: null })).toBe('scroll')
  })

  it('bounces the card the first time the finger pushes past the edge', () => {
    expect(resolveHMode({ dir: 'east', atStart: false, atEnd: true, primed: null })).toBe('bounce')
    expect(resolveHMode({ dir: 'west', atStart: true, atEnd: false, primed: null })).toBe('bounce')
  })

  it('swipes the card once that same edge has already bounced', () => {
    expect(resolveHMode({ dir: 'east', atStart: false, atEnd: true, primed: 'east' })).toBe('swipe')
    expect(resolveHMode({ dir: 'west', atStart: true, atEnd: false, primed: 'west' })).toBe('swipe')
  })

  // Uzbrojenie w jedną stronę nic nie mówi o drugiej.
  it('does not let a bounce on one edge arm the other', () => {
    expect(resolveHMode({ dir: 'west', atStart: true, atEnd: true, primed: 'east' })).toBe('bounce')
  })

  // Jedno zdjęcie: obie krawędzie naraz, więc pierwszy ruch odbija, drugi przesuwa.
  it('treats a single photo as both edges', () => {
    expect(resolveHMode({ dir: 'east', atStart: true, atEnd: true, primed: null })).toBe('bounce')
    expect(resolveHMode({ dir: 'east', atStart: true, atEnd: true, primed: 'east' })).toBe('swipe')
  })

  // Scroller nie na krawędzi ma pierwszeństwo nawet po uzbrojeniu: kto cofnął
  // zdjęcia, ten znów je przewija.
  it('scrolls even when armed if the scroller can still move that way', () => {
    expect(resolveHMode({ dir: 'east', atStart: true, atEnd: false, primed: 'east' })).toBe('scroll')
  })
})

describe('nextPrimed', () => {
  it('arms on a bounce, keeps on a swipe, disarms on a scroll', () => {
    expect(nextPrimed('bounce', 'east', null)).toBe('east')
    expect(nextPrimed('swipe', 'east', 'east')).toBe('east')
    expect(nextPrimed('scroll', 'west', 'east')).toBeNull()
  })
})
