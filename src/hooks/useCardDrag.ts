import { useRef, useState } from 'react'
import { resolveAxis, commitDir, type Axis } from '../lib/cardDrag'
import type { Dir } from '../lib/eventChain'

/**
 * 'ignored' nie wychodzi z resolveAxis — to gest poziomy, który zaczął się nad
 * czymś, co samo przewija się w poziomie (kadr zdjęcia, pasek tagów). Nie jest
 * ani sznurkiem, ani snapem: ma po prostu przelecieć obok.
 */
type Locked = Axis | 'ignored'

type Gesture = { id: number; x: number; y: number; axis: Locked; blocked: boolean }

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
  onCommitX: (dir: Dir) => void
  onCommitY: (dy: number) => void
}) {
  const [dx, setDx] = useState(0)
  const g = useRef<Gesture | null>(null)

  /** Porzuca gest bez rozstrzygania go i odstawia kartę na miejsce. */
  function abandon() {
    g.current = null
    setDx(0)
  }

  function onTouchStart(e: React.TouchEvent) {
    // Drugi palec nie zaczyna nowego gestu. Bez tego oparty kciuk podmieniałby
    // punkt odniesienia i karta skakała w połowie ciągnięcia.
    if (g.current) return
    const t = e.touches[0]
    const target = e.target as HTMLElement
    g.current = {
      id: t.identifier, x: t.clientX, y: t.clientY, axis: 'none',
      blocked: !!target.closest?.('[data-no-hswipe]'),
    }
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
      s.axis = axis === 'horizontal' && (!enabled || s.blocked) ? 'ignored' : axis
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
    if (dir) onCommitX(dir)
    // Wraca do zera niezależnie od tego, czy krok się udał. Ten sam sprężysty
    // powrót bez zmiany treści pod spodem jest jedynym sygnałem, że sznurek
    // się skończył.
    setDx(0)
  }

  return {
    dx,
    // touchcancel przychodzi, gdy gest przerwie system — rozmowa przychodząca,
    // gest krawędziowy iOS. Bez niego karta zostawała przesunięta o tyle, ile
    // zdążył palec, z wyłączonym przejściem, i nic już jej nie sprowadzało.
    bind: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: abandon },
    /** Podczas ciągnięcia bez przejścia, po puszczeniu z przejściem do zera. */
    transition: dx === 0 ? 'transform 220ms cubic-bezier(0.32,1.2,0.4,1)' : 'none',
  }
}
