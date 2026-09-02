import { useEffect, useRef, useState } from 'react'
import { resolveAxis, commitDir, dirOf, resolveHMode, type Axis } from '../lib/cardDrag'
import type { Dir } from '../lib/eventChain'

/**
 * 'ignored' nie wychodzi z resolveAxis — to gest poziomy, który należy do
 * czegoś innego: do wyłączonego sznurka albo do scrollera pod palcem (kadr
 * zdjęć, pasek tagów), który ma jeszcze dokąd jechać. Nie jest ani sznurkiem,
 * ani snapem: ma po prostu przelecieć obok.
 */
type Locked = Axis | 'ignored'

/** Tyle, ile potrzeba, żeby spytać scroller, czy stoi na krawędzi. */
type HScroller = Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>

type Gesture = {
  id: number; x: number; y: number; axis: Locked
  /** Scroller, nad którym zaczął się gest; null poza kadrem. */
  scroller: HScroller | null
}

/** Luz na subpiksele: iOS potrafi zatrzymać scrollLeft ułamek przed końcem. */
const EDGE_SLACK_PX = 1

const GLIDE = 'transform 260ms cubic-bezier(0.32,1.2,0.4,1)'

/**
 * Ten palec, który zaczął gest, a nie ten pod indeksem zero: TouchList
 * przenumerowuje się, gdy któryś z pozostałych puszcza, więc [0] potrafi w
 * połowie ciągnięcia zacząć znaczyć kogoś innego.
 */
function findTouch(list: React.TouchList, id: number): React.Touch | null {
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]
  return null
}

export function useCardDrag({ enabled, onCommitX, onCommitY }: {
  /** Czy sznurek w ogóle działa w tym stanie karty (np. nie pod czatem). */
  enabled: boolean
  /** Zwraca, czy krok się udał — od tego zależy, czy karta wraca, czy wjeżdża. */
  onCommitX: (dir: Dir) => boolean
  onCommitY: (dy: number) => void
}) {
  const [dx, setDx] = useState(0)
  /** Czy przesunięcie ma być animowane. W trakcie ciągnięcia nigdy. */
  const [gliding, setGliding] = useState(false)
  const g = useRef<Gesture | null>(null)
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  /** Sprężysty powrót z miejsca, w którym stanął palec. */
  function settle() {
    setGliding(true)
    setDx(0)
  }

  /**
   * Nowa treść siedzi pod spodem już w chwili puszczenia palca, więc nie ma
   * czego wysuwać — jest za to co wsuwać. Stawiamy ją poza ekranem po stronie
   * przeciwnej do ruchu palca i puszczamy do zera: palec w lewo, nowa karta
   * nadchodzi z prawej, dokładnie jak kolejny slajd karuzeli.
   *
   * Dwie klatki, bo przeglądarka złożyłaby oba położenia w jedno malowanie i
   * przejście nie miałoby od czego ruszyć.
   */
  function enterFrom(offset: number) {
    setGliding(false)
    setDx(offset)
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(settle)
    })
  }

  /** Porzuca gest bez rozstrzygania go i odstawia kartę na miejsce. */
  function abandon() {
    cancelAnimationFrame(raf.current)
    g.current = null
    settle()
  }

  function onTouchStart(e: React.TouchEvent) {
    // Drugi palec nie zaczyna nowego gestu. Bez tego oparty kciuk podmieniałby
    // punkt odniesienia i karta skakała w połowie ciągnięcia.
    if (g.current) return
    // Palec przerywa trwające wsuwanie i przejmuje kartę od zaraz.
    cancelAnimationFrame(raf.current)
    setGliding(false)
    const t = e.touches[0]
    const target = e.target as HTMLElement
    g.current = {
      id: t.identifier, x: t.clientX, y: t.clientY, axis: 'none',
      scroller: (target.closest?.('[data-hscroll]') as HScroller | null) ?? null,
    }
  }

  /**
   * Gest poziomy nad scrollerem: kto go dostaje — scroller, czy karta. Pytamy w
   * chwili rozstrzygnięcia osi, nie na starcie, bo dopiero wtedy znamy kierunek.
   */
  function claimHorizontal(s: Gesture, ddx: number): Locked {
    if (!enabled) return 'ignored'
    if (!s.scroller) return 'horizontal'
    const el = s.scroller
    const mode = resolveHMode({
      dir: dirOf(ddx),
      atStart: el.scrollLeft <= EDGE_SLACK_PX,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLACK_PX,
    })
    return mode === 'scroll' ? 'ignored' : 'horizontal'
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = g.current
    if (!s) return
    const t = findTouch(e.touches, s.id)
    if (!t) return
    const ddx = t.clientX - s.x
    const ddy = t.clientY - s.y
    if (s.axis === 'none') {
      const axis = resolveAxis(ddx, ddy)
      if (axis === 'none') return
      s.axis = axis === 'horizontal' ? claimHorizontal(s, ddx) : axis
    }
    if (s.axis !== 'horizontal') return
    setDx(ddx)
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = g.current
    if (!s) return
    // Puścił któryś z pozostałych palców — ten gest trwa dalej.
    const t = findTouch(e.changedTouches, s.id)
    if (!t) return
    g.current = null
    if (s.axis === 'vertical') { onCommitY(t.clientY - s.y); return }
    if (s.axis !== 'horizontal') return
    const width = (e.currentTarget as HTMLElement).clientWidth || window.innerWidth
    const dir = commitDir(t.clientX - s.x, width)
    // Krok bywa niemożliwy — koniec sznurka. Wtedy karta wraca stamtąd, gdzie
    // stanął palec, i to ten sam powrót bez zmiany treści jest jedynym
    // sygnałem, że dalej nic nie ma.
    if (dir && onCommitX(dir)) enterFrom(dir === 'east' ? width : -width)
    else settle()
  }

  return {
    dx,
    // touchcancel przychodzi, gdy gest przerwie system — rozmowa przychodząca,
    // gest krawędziowy iOS. Bez niego karta zostawała przesunięta o tyle, ile
    // zdążył palec, z wyłączonym przejściem, i nic już jej nie sprowadzało.
    bind: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: abandon },
    transition: gliding ? GLIDE : 'none',
  }
}
