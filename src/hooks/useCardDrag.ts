import { useRef, useState } from 'react'
import { resolveAxis, commitDir, type Axis } from '../lib/cardDrag'
import type { Dir } from '../lib/eventChain'

/**
 * 'ignored' nie wychodzi z resolveAxis — to gest poziomy, który zaczął się nad
 * czymś, co samo przewija się w poziomie (kadr zdjęcia, pasek tagów). Nie jest
 * ani sznurkiem, ani snapem: ma po prostu przelecieć obok.
 */
type Locked = Axis | 'ignored'

export function useCardDrag({ enabled, onCommitX, onCommitY }: {
  /** Czy sznurek w ogóle działa w tym stanie karty (np. nie pod czatem). */
  enabled: boolean
  onCommitX: (dir: Dir) => void
  onCommitY: (dy: number) => void
}) {
  const [dx, setDx] = useState(0)
  const g = useRef<{ x: number; y: number; axis: Locked; blocked: boolean } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    const target = e.target as HTMLElement
    g.current = {
      x: t.clientX, y: t.clientY, axis: 'none',
      blocked: !!target.closest?.('[data-no-hswipe]'),
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = g.current
    if (!s) return
    const t = e.touches[0]
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
    g.current = null
    if (!s) return
    const t = e.changedTouches[0]
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
    bind: { onTouchStart, onTouchMove, onTouchEnd },
    /** Podczas ciągnięcia bez przejścia, po puszczeniu z przejściem do zera. */
    transition: dx === 0 ? 'transform 220ms cubic-bezier(0.32,1.2,0.4,1)' : 'none',
  }
}
