import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TagChip from '../../components/TagChip'
import OrganicBlob from '../../components/OrganicBlob'
import BlobFace from '../../components/BlobFace'
import { C, INK, F, TAG_META } from '../../lib/tokens'
import type { Category } from '../../lib/tokens'

/** Ile awatarów obserwujących mieści się w rogu, zanim zaczną zasłaniać zdjęcie. */
const MAX_FACES = 3

export default function EventPhotoStrip({
  photos,
  category,
  tags,
  followers,
  followersLabel,
  onClose,
  onOpenPhoto,
}: {
  photos: string[] | null
  category: Category
  tags: string[]
  followers: { avatar_color: string | null; display_name: string | null }[]
  followersLabel: string
  onClose: () => void
  onOpenPhoto: (idx: number) => void
}) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const list = photos ?? []
  const meta = TAG_META[category] || TAG_META.party

  // Indeks bierzemy z pozycji przewijania, a nie z własnego licznika — wtedy
  // swipe palcem i kliknięcie strzałki opowiadają tę samą historię.
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  function goTo(next: number) {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(list.length - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIdx(clamped)
  }

  const arrowStyle: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 32, height: 32, borderRadius: '50%', zIndex: 3,
    background: 'rgba(255,255,255,0.92)', border: `2px solid ${INK}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 900, color: INK,
  }

  return (
    <div
      data-testid="photo-frame"
      style={{
        position: 'relative', aspectRatio: '16 / 9', borderRadius: 20,
        overflow: 'hidden', marginBottom: 12,
        background: `linear-gradient(135deg, ${meta.color}, ${C.cream})`,
      }}
    >
      {list.length > 0 ? (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{
            display: 'flex', height: '100%', overflowX: 'auto', overflowY: 'hidden',
            scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
          }}
        >
          {list.map((src, i) => (
            <img
              key={i}
              data-testid="photo-slide"
              src={src}
              alt=""
              onClick={() => onOpenPhoto(i)}
              style={{
                flex: '0 0 100%', width: '100%', height: '100%',
                objectFit: 'cover', scrollSnapAlign: 'center', cursor: 'pointer',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <OrganicBlob size={72} color={meta.color} idx={0} face={<BlobFace size={44} />} />
        </div>
      )}

      {/* Przyciemnienia pod treścią w rogach. pointerEvents none, żeby nie
          przechwytywały ani swipe'u, ani kliknięcia w tag. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to bottom, rgba(0,0,0,0.38), transparent)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', pointerEvents: 'none', zIndex: 1 }} />

      {followers.length > 0 && (
        <div
          data-testid="followers-bar"
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <div style={{ display: 'flex' }}>
            {followers.slice(0, MAX_FACES).map((f, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: f.avatar_color || C.primary,
                border: `2px solid ${INK}`, marginLeft: i > 0 ? -7 : 0,
                zIndex: MAX_FACES - i, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: INK, fontFamily: F.display,
              }}>
                {(f.display_name || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>
          <span style={{
            fontFamily: F.body, fontSize: 11.5, fontWeight: 800, color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
          }}>{followersLabel}</span>
        </div>
      )}

      <button
        data-testid="close-card"
        onClick={onClose}
        aria-label={t('common.close')}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 3,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(45,43,42,0.55)', border: '1.5px solid rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, fontWeight: 700,
        }}
      >×</button>

      {list.length > 1 && (
        <>
          <button aria-label={t('event.photoPrev')} onClick={() => goTo(idx - 1)}
            style={{ ...arrowStyle, left: 10, opacity: idx === 0 ? 0.4 : 1 }}>‹</button>
          <button aria-label={t('event.photoNext')} onClick={() => goTo(idx + 1)}
            style={{ ...arrowStyle, right: 10, opacity: idx === list.length - 1 ? 0.4 : 1 }}>›</button>
          <div style={{ position: 'absolute', bottom: 46, left: 0, right: 0, zIndex: 3, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {list.map((_, i) => (
              <button key={i} aria-hidden onClick={() => goTo(i)} style={{
                width: i === idx ? 18 : 6, height: 6, borderRadius: 999,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.55)',
                transition: 'width 200ms cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            ))}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <div
          data-testid="tag-bar"
          style={{
            position: 'absolute', bottom: 8, left: 0, right: 0, zIndex: 3,
            display: 'flex', gap: 6, overflowX: 'auto', padding: '0 10px',
            scrollbarWidth: 'none',
          }}
        >
          {tags.map(tag => (
            <div key={tag} style={{ flexShrink: 0 }}>
              <TagChip category={tag} selected outlined />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
