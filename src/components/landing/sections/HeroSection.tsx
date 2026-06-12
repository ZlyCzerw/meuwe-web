import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Welcome from '../../../screens/Welcome'
import { C, INK } from '../../../lib/tokens'

interface Props {
  onSignIn: (mode: 'google' | 'skip') => void
}

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1,
  padding: 0, margin: -1, overflow: 'hidden',
  clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

export function HeroSection({ onSignIn }: Props) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="hero" style={{ height: '85dvh', position: 'relative' }}>
      <h1 style={srOnly}>{t('welcome.tagline').replace('\n', ' ')}</h1>
      <Welcome onSignIn={onSignIn} />
      <div ref={sentinelRef} style={{ position: 'absolute', bottom: 0, height: 1, width: '100%' }} />
      <div style={{
        position: 'fixed', bottom: 28, left: 0, right: 0, zIndex: 200,
        display: 'flex', justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 600ms ease',
        pointerEvents: 'none',
      }}>
        <svg
          width="36" height="36" viewBox="0 0 32 32" fill="none"
          style={{ animation: 'hero-bounce 1.6s ease-in-out infinite', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))' }}
        >
          <circle cx="16" cy="16" r="15" fill={C.primary} stroke={INK} strokeWidth="1.5" />
          <path d="M10 13.5L16 19.5L22 13.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  )
}
