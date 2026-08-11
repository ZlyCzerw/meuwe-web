import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Odsunięcie przycisku zamykania od górnej krawędzi.
 *
 * Sam bezpieczny obszar nie wystarczał: na natywnym Androidzie przycisk lądował
 * pod paskiem statusu i był nieklikalny. 72 px zostawia go poniżej wszystkiego,
 * co system rysuje po swojemu.
 */
const CLOSE_TOP = 'calc(env(safe-area-inset-top, 0px) + 72px)'

export default function PhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[]
  index: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [idx, setIdx] = useState(index)

  // Wejście od razu na klikniętym zdjęciu — bez animacji, bo widz nie prosił
  // o podróż od pierwszego.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = index * el.clientWidth
  }, [index])

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  function goTo(next: number) {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(photos.length - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIdx(clamped)
  }

  const arrowStyle: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 40, height: 40, borderRadius: '50%', zIndex: 3,
    background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
    color: '#fff', fontSize: 22, fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div
      data-testid="lightbox-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.92)' }}
    >
      <div
        data-testid="lightbox-scroller"
        ref={scrollRef}
        onScroll={onScroll}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', height: '100%', overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
        }}
      >
        {photos.map((src, i) => (
          <div key={i} data-testid="lightbox-slide" style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={src} alt="" style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, display: 'block' }} />
          </div>
        ))}
      </div>

      <button
        data-testid="lightbox-close"
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label={t('event.backToEvent')}
        style={{
          position: 'absolute', top: CLOSE_TOP, right: 16, zIndex: 4,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
          color: '#fff', fontSize: 20, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {photos.length > 1 && (
        <>
          <button aria-label={t('event.photoPrev')} onClick={e => { e.stopPropagation(); goTo(idx - 1) }}
            style={{ ...arrowStyle, left: 16, opacity: idx === 0 ? 0.3 : 1 }}>‹</button>
          <button aria-label={t('event.photoNext')} onClick={e => { e.stopPropagation(); goTo(idx + 1) }}
            style={{ ...arrowStyle, right: 16, opacity: idx === photos.length - 1 ? 0.3 : 1 }}>›</button>
        </>
      )}
    </div>
  )
}
