import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardDrag } from './useCardDrag'

function finger(id: number, x: number, y: number) {
  return { identifier: id, clientX: x, clientY: y }
}

function ev(over: Record<string, unknown> = {}) {
  return {
    touches: [], changedTouches: [],
    target: { closest: () => null },
    currentTarget: { clientWidth: 400 },
    ...over,
  } as unknown as React.TouchEvent
}

/** `stepped` mówi, czy sznurek miał dokąd pójść — od tego zależy animacja. */
function setup(stepped = true) {
  const onCommitX = vi.fn(() => stepped)
  const onCommitY = vi.fn()
  const hook = renderHook(() => useCardDrag({ enabled: true, onCommitX, onCommitY }))
  return { ...hook, onCommitX, onCommitY }
}

/** Wsuwanie czeka dwie klatki, żeby przeglądarka zdążyła namalować start. */
async function settleFrames() {
  await act(async () => { await new Promise(r => setTimeout(r, 60)) })
}

describe('useCardDrag', () => {
  it('carries the card with the finger and commits past the threshold', () => {
    const { result, onCommitX } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    expect(result.current.dx).toBe(-60)
    expect(result.current.transition).toBe('none')
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(1, 140, 400)] })))
    expect(onCommitX).toHaveBeenCalledWith('east')
  })

  // Palec w lewo odsuwa bieżącą kartę, więc następna ma nadejść z prawej —
  // jak kolejny slajd karuzeli, a nie jak powrót tego samego.
  it('brings the next card in from the right after a leftward swipe', async () => {
    const { result } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(1, 140, 400)] })))
    // Nowa treść startuje o całą szerokość karty poza prawą krawędzią…
    expect(result.current.dx).toBe(400)
    expect(result.current.transition).toBe('none')
    await settleFrames()
    // …i dojeżdża do zera już z przejściem.
    expect(result.current.dx).toBe(0)
    expect(result.current.transition).not.toBe('none')
  })

  it('brings it in from the left after a rightward swipe', async () => {
    const { result, onCommitX } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 100, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 160, 400)] })))
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(1, 260, 400)] })))
    expect(onCommitX).toHaveBeenCalledWith('west')
    expect(result.current.dx).toBe(-400)
    await settleFrames()
    expect(result.current.dx).toBe(0)
  })

  // Koniec sznurka: treść pod spodem się nie zmieniła, więc nic nie ma prawa
  // wjeżdżać. Karta wraca stamtąd, gdzie stanął palec — i ten sam powrót bez
  // zmiany treści jest jedynym sygnałem, że dalej nic nie ma.
  it('springs back from the finger when the walk is blocked', async () => {
    const { result, onCommitX } = setup(false)
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(1, 140, 400)] })))
    expect(onCommitX).toHaveBeenCalledWith('east')
    expect(result.current.dx).toBe(0)
    expect(result.current.transition).not.toBe('none')
    await settleFrames()
    expect(result.current.dx).toBe(0)
  })

  it('lets a new grab interrupt the card on its way in', async () => {
    const { result } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(1, 140, 400)] })))
    expect(result.current.dx).toBe(400)
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(2, 200, 400)] })))
    await settleFrames()
    // Palec przejął kartę, więc zaplanowane wsuwanie nie odpala się później.
    expect(result.current.transition).toBe('none')
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(2, 150, 400)] })))
    expect(result.current.dx).toBe(-50)
  })

  // Rozmowa przychodząca albo gest krawędziowy iOS przerywa gest w połowie.
  // Bez sprzątania karta zostawała przesunięta o tyle, ile zdążył palec, i to
  // z wyłączonym przejściem — więc nic już jej nie sprowadzało z powrotem.
  it('puts the card back when the system takes the gesture away', () => {
    const { result, onCommitX } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    expect(result.current.dx).toBe(-60)
    act(() => result.current.bind.onTouchCancel())
    expect(result.current.dx).toBe(0)
    expect(onCommitX).not.toHaveBeenCalled()
  })

  // Kciuk oparty o kartę w trakcie ciągnięcia trafiał na pierwsze miejsce w
  // TouchList i stawał się nowym punktem odniesienia — karta skakała.
  it('is not hijacked by a second finger landing mid-drag', () => {
    const { result } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(2, 90, 700), finger(1, 240, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(2, 90, 700), finger(1, 200, 400)] })))
    expect(result.current.dx).toBe(-100)
  })

  it('keeps going when a different finger lifts', () => {
    const { result, onCommitX } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 240, 400)] })))
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(2, 90, 700)] })))
    expect(onCommitX).not.toHaveBeenCalled()
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 180, 400)] })))
    expect(result.current.dx).toBe(-120)
  })

  it('hands a vertical gesture to the snaps and leaves the card unmoved', () => {
    const { result, onCommitX, onCommitY } = setup()
    act(() => result.current.bind.onTouchStart(ev({ touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ touches: [finger(1, 304, 500)] })))
    act(() => result.current.bind.onTouchEnd(ev({ changedTouches: [finger(1, 304, 520)] })))
    expect(onCommitY).toHaveBeenCalledWith(120)
    expect(onCommitX).not.toHaveBeenCalled()
    expect(result.current.dx).toBe(0)
  })

  // Kadr zdjęcia przewija się w poziomie sam. Gest stamtąd nie rusza sznurka —
  // ale nie wolno mu też udawać snapu, więc nie trafia nigdzie.
  it('lets a swipe that starts over the photos pass through untouched', () => {
    const { result, onCommitX, onCommitY } = setup()
    const overPhotos = { target: { closest: () => ({}) } }
    act(() => result.current.bind.onTouchStart(ev({ ...overPhotos, touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(ev({ ...overPhotos, touches: [finger(1, 200, 400)] })))
    expect(result.current.dx).toBe(0)
    act(() => result.current.bind.onTouchEnd(ev({ ...overPhotos, changedTouches: [finger(1, 100, 400)] })))
    expect(onCommitX).not.toHaveBeenCalled()
    expect(onCommitY).not.toHaveBeenCalled()
  })
})

/**
 * Atrapa poziomego scrollera (kadr zdjęć): `closest('[data-hscroll]')` zwraca
 * element z pozycją przewijania, resztę udaje jak wyżej.
 */
function scroller(scrollLeft: number, scrollWidth = 1200, clientWidth = 400) {
  return { scrollLeft, scrollWidth, clientWidth }
}

function evOver(el: object, over: Record<string, unknown> = {}) {
  return ev({ target: { closest: (sel: string) => (sel === '[data-hscroll]' ? el : null) }, ...over })
}

function setupWithKey(stepped = true) {
  const onCommitX = vi.fn(() => stepped)
  const onCommitY = vi.fn()
  const hook = renderHook(
    ({ resetKey }: { resetKey: string }) => useCardDrag({ enabled: true, onCommitX, onCommitY, resetKey }),
    { initialProps: { resetKey: 'a' } },
  )
  return { ...hook, onCommitX, onCommitY }
}

/** Jeden pełny gest w lewo (na wschód) o `px` pikseli, zaczęty nad `el`. */
function swipeLeftOver(result: { current: ReturnType<typeof useCardDrag> }, el: object, px: number) {
  act(() => result.current.bind.onTouchStart(evOver(el, { touches: [finger(1, 300, 400)] })))
  act(() => result.current.bind.onTouchMove(evOver(el, { touches: [finger(1, 300 - Math.min(px, 60), 400)] })))
  act(() => result.current.bind.onTouchEnd(evOver(el, { changedTouches: [finger(1, 300 - px, 400)] })))
}

describe('useCardDrag over a horizontal scroller', () => {
  // Zdjęcia jeszcze jadą: to ich gest, karta ani drgnie.
  it('stays put while the scroller can still move that way', () => {
    const { result, onCommitX } = setupWithKey()
    const el = scroller(0)
    act(() => result.current.bind.onTouchStart(evOver(el, { touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(evOver(el, { touches: [finger(1, 240, 400)] })))
    expect(result.current.dx).toBe(0)
    act(() => result.current.bind.onTouchEnd(evOver(el, { changedTouches: [finger(1, 140, 400)] })))
    expect(onCommitX).not.toHaveBeenCalled()
  })

  // Ostatnie zdjęcie: pierwszy ruch dalej niesie kartę za palcem, ale nic nie
  // zmienia — nawet daleko za progiem. Drugi ruch w tę samą stronę to już swipe.
  it('bounces on the first push past the edge and swipes on the second', async () => {
    const { result, onCommitX } = setupWithKey()
    const atEnd = scroller(800)
    act(() => result.current.bind.onTouchStart(evOver(atEnd, { touches: [finger(1, 300, 400)] })))
    act(() => result.current.bind.onTouchMove(evOver(atEnd, { touches: [finger(1, 240, 400)] })))
    expect(result.current.dx).toBe(-60)
    act(() => result.current.bind.onTouchEnd(evOver(atEnd, { changedTouches: [finger(1, 100, 400)] })))
    expect(onCommitX).not.toHaveBeenCalled()
    expect(result.current.dx).toBe(0)
    expect(result.current.transition).not.toBe('none')

    swipeLeftOver(result, atEnd, 160)
    expect(onCommitX).toHaveBeenCalledWith('east')
  })

  // Jedno zdjęcie stoi na obu krawędziach naraz: ta sama para gestów.
  it('treats a single photo like an edge', () => {
    const { result, onCommitX } = setupWithKey()
    const single = scroller(0, 400, 400)
    swipeLeftOver(result, single, 160)
    expect(onCommitX).not.toHaveBeenCalled()
    swipeLeftOver(result, single, 160)
    expect(onCommitX).toHaveBeenCalledWith('east')
  })

  // Kto po odbiciu cofnął zdjęcia, ten rozbroił kartę: następne dojście do
  // końca znów najpierw odbija.
  it('disarms when the scroller is moved the other way', () => {
    const { result, onCommitX } = setupWithKey()
    const atEnd = scroller(800)
    swipeLeftOver(result, atEnd, 160)          // odbicie, uzbrojone na wschód
    act(() => result.current.bind.onTouchStart(evOver(atEnd, { touches: [finger(1, 100, 400)] })))
    act(() => result.current.bind.onTouchMove(evOver(atEnd, { touches: [finger(1, 160, 400)] })))
    act(() => result.current.bind.onTouchEnd(evOver(atEnd, { changedTouches: [finger(1, 260, 400)] })))
    expect(result.current.dx).toBe(0)           // zdjęcia przewinęły się same
    swipeLeftOver(result, atEnd, 160)          // znów odbicie, nie swipe
    expect(onCommitX).not.toHaveBeenCalled()
  })

  // Odbicie w jedną stronę nie uzbraja drugiej.
  it('keeps the two edges armed separately', () => {
    const { result, onCommitX } = setupWithKey()
    const single = scroller(0, 400, 400)
    swipeLeftOver(result, single, 160)          // odbicie na wschód
    act(() => result.current.bind.onTouchStart(evOver(single, { touches: [finger(1, 100, 400)] })))
    act(() => result.current.bind.onTouchMove(evOver(single, { touches: [finger(1, 160, 400)] })))
    expect(result.current.dx).toBe(60)          // karta jedzie za palcem…
    act(() => result.current.bind.onTouchEnd(evOver(single, { changedTouches: [finger(1, 260, 400)] })))
    expect(onCommitX).not.toHaveBeenCalled()    // …ale pierwszy raz na zachód to odbicie
  })

  // Nowe wydarzenie pod kartą zaczyna od zera — jego zdjęcia mają własny koniec.
  it('disarms when the card content changes', () => {
    const { result, rerender, onCommitX } = setupWithKey()
    const atEnd = scroller(800)
    swipeLeftOver(result, atEnd, 160)
    rerender({ resetKey: 'b' })
    swipeLeftOver(result, atEnd, 160)
    expect(onCommitX).not.toHaveBeenCalled()
  })

  // Sznurek wyłączony (czat): scroller robi swoje, karta nigdy.
  it('never touches the card when disabled', () => {
    const onCommitX = vi.fn(() => true)
    const { result } = renderHook(() => useCardDrag({ enabled: false, onCommitX, onCommitY: vi.fn(), resetKey: 'a' }))
    const atEnd = scroller(800)
    swipeLeftOver(result, atEnd, 160)
    swipeLeftOver(result, atEnd, 160)
    expect(result.current.dx).toBe(0)
    expect(onCommitX).not.toHaveBeenCalled()
  })
})
