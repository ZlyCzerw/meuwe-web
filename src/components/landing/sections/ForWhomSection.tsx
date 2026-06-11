import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TAG_META, type Category } from '../../../lib/tokens'
import '../landing.css'

function ChevronLeft({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7l5 5" stroke="#2D2B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronRight({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M5 2l5 5-5 5" stroke="#2D2B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface CardConfig {
  category: Category
  // Replace this URL with any photo to swap the card image
  image: string | null
}

const CARDS: CardConfig[] = [
  { category: 'culture',      image: 'https://images.pexels.com/photos/13636688/pexels-photo-13636688.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop' },
  { category: 'music',        image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'sport',        image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'family',       image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'food',         image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'kids',         image: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'pets',         image: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'music',        image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'food',         image: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'volunteering', image: 'https://images.pexels.com/photos/36072012/pexels-photo-36072012.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop' },
  { category: 'sport',        image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'workshop',     image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&h=400&q=80' },
  { category: 'alert',        image: 'https://images.pexels.com/photos/10859263/pexels-photo-10859263.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&fit=crop' },
]

function CarouselCard({ config, title, desc }: { config: CardConfig; title: string; desc: string }) {
  const [imgError, setImgError] = useState(false)
  const showImg = config.image && !imgError
  const meta = TAG_META[config.category]

  return (
    <div className="lp-carousel-card">
      <div
        className="lp-carousel-card-media"
        style={{
          background: showImg
            ? '#ddd'
            : `linear-gradient(135deg, ${meta.color}55 0%, ${meta.color}22 100%)`,
        }}
      >
        {showImg ? (
          <img src={config.image!} alt={title} onError={() => setImgError(true)} />
        ) : (
          <div
            style={{ fontSize: 56, lineHeight: 1, color: meta.color }}
            dangerouslySetInnerHTML={{ __html: meta.glyph }}
          />
        )}
        {/* Category badge — uses actual app icon */}
        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          width: 30, height: 30, borderRadius: '50%',
          background: meta.color, border: '2px solid #2D2B2A',
          boxShadow: '2px 2px 0 #2D2B2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#2D2B2A',
        }}
          dangerouslySetInnerHTML={{ __html: meta.glyph }}
        />
      </div>
      <div className="lp-carousel-card-body">
        <div className="lp-carousel-card-title">{title}</div>
        <div className="lp-carousel-card-desc">{desc}</div>
      </div>
    </div>
  )
}

export function ForWhomSection() {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeDot, setActiveDot] = useState(0)
  // Ref keeps current index in sync for prev/next without stale closures
  const activeIndexRef = useRef(0)

  const cases = t('landing.uc', { returnObjects: true }) as Array<{ title: string; desc: string }>
  const count = CARDS.length

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current
    if (!track) return
    const card = track.children[index] as HTMLElement
    if (!card) return
    activeIndexRef.current = index
    setActiveDot(index)
    track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
  }, [])

  const prev = useCallback(() => scrollTo(Math.max(0, activeIndexRef.current - 1)), [scrollTo])
  const next = useCallback(() => scrollTo(Math.min(count - 1, activeIndexRef.current + 1)), [scrollTo, count])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Array.from(track.children).indexOf(e.target as HTMLElement)
            if (idx >= 0) {
              activeIndexRef.current = idx
              setActiveDot(idx)
            }
          }
        })
      },
      { root: track, threshold: 0.6 }
    )
    Array.from(track.children).forEach(c => observer.observe(c))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="lp-carousel-section" id="dla-kogo">
      <div className="lp-carousel-header lp-anim lp-slide-up">
        <div className="lp-carousel-header-text">
          <span className="lp-eyebrow">{t('landing.forWhomTitle')}</span>
          <h2 className="lp-h2" style={{ marginTop: 8 }}>{t('landing.forWhomSubtitle')}</h2>
        </div>
        <div className="lp-carousel-arrows">
          <button className="lp-carousel-arrow" onClick={prev} disabled={activeDot === 0} aria-label="Poprzedni">
            <ChevronLeft size={20} />
          </button>
          <button className="lp-carousel-arrow" onClick={next} disabled={activeDot === count - 1} aria-label="Następny">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="lp-carousel-track-wrap">
        <div className="lp-carousel-track" ref={trackRef}>
          {CARDS.map((cfg, i) => (
            <CarouselCard
              key={i}
              config={cfg}
              title={cases[i]?.title ?? ''}
              desc={cases[i]?.desc ?? ''}
            />
          ))}
        </div>
      </div>

      <div className="lp-carousel-dots">
        {CARDS.map((_, i) => (
          <button
            key={i}
            className={`lp-carousel-dot${i === activeDot ? ' active' : ''}`}
            onClick={() => scrollTo(i)}
            aria-label={`Karta ${i + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
