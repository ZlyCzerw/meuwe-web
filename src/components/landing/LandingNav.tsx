import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { C, F } from '../../lib/tokens'
import { setLanguage } from '../../lib/i18n'
import type { Lang } from '../../lib/types'

const LANGS: Lang[] = ['pl', 'en', 'de', 'es']

function MeuweLogo() {
  const base: React.CSSProperties = { fontFamily: F.display, fontSize: 24, fontWeight: 900, letterSpacing: -1, cursor: 'pointer', userSelect: 'none' }
  return (
    <span style={base}>
      <span style={{ color: C.primary }}>me</span>
      <span style={{ color: C.sky }}>u</span>
      <span style={{ color: C.grass }}>we</span>
    </span>
  )
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingNav() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const onBlog = location.pathname === '/blog'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleNav(anchor: string) {
    setMenuOpen(false)
    if (onBlog) {
      navigate('/', { state: { scrollTo: anchor } })
    } else {
      scrollToId(anchor)
    }
  }

  const navStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 60,
    background: scrolled ? '#fff' : 'transparent',
    borderBottom: scrolled ? '1.5px solid #2D2B2A22' : 'none',
    transition: 'background 0.2s',
  }
  const linkBtn: React.CSSProperties = {
    fontFamily: F.body, fontSize: 15, fontWeight: 700, color: C.ink,
    cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px',
  }
  const ctaBtn: React.CSSProperties = {
    fontFamily: F.body, fontSize: 14, fontWeight: 800, color: '#fff',
    background: C.primary, border: `2px solid ${C.ink}`, borderRadius: 999,
    padding: '8px 16px', cursor: 'pointer', boxShadow: `0 4px 0 ${C.ink}33`,
  }

  return (
    <nav style={navStyle}>
      <span onClick={() => handleNav('hero')} style={{ cursor: 'pointer' }}>
        <MeuweLogo />
      </span>

      {/* Center links — hide on small screens via display logic in parent */}
      <span style={{ display: 'flex', gap: 4 }}>
        <button style={linkBtn} onClick={() => handleNav('how')}>{t('landing.how.title')}</button>
        <button style={linkBtn} onClick={() => handleNav('features')}>{t('landing.features.title')}</button>
        <button style={linkBtn} onClick={() => { setMenuOpen(false); navigate('/blog') }}>Blog</button>
      </span>

      {/* Right: lang switcher + CTA + hamburger */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', gap: 0 }}>
          {LANGS.map(l => (
            <button key={l} onClick={() => setLanguage(l)} style={{
              fontFamily: F.body, fontSize: 11, fontWeight: i18n.language === l ? 800 : 500,
              color: i18n.language === l ? C.primary : C.inkSoft,
              background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', padding: '2px 5px',
            }}>{l}</button>
          ))}
        </span>
        <button style={ctaBtn} onClick={() => handleNav('hero')}>{t('landing.nav.openApp')}</button>
        <button
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '4px 0', lineHeight: 1 }}
          onClick={() => setMenuOpen(m => !m)}
          aria-label="Menu"
        >☰</button>
      </span>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0,
          background: '#fff', borderBottom: `2px solid ${C.ink}`,
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: `0 4px 0 ${C.ink}22`, zIndex: 999,
        }}>
          <button style={linkBtn} onClick={() => handleNav('how')}>{t('landing.how.title')}</button>
          <button style={linkBtn} onClick={() => handleNav('features')}>{t('landing.features.title')}</button>
          <button style={linkBtn} onClick={() => { setMenuOpen(false); navigate('/blog') }}>Blog</button>
          <button style={ctaBtn} onClick={() => handleNav('hero')}>{t('landing.nav.openApp')}</button>
        </div>
      )}
    </nav>
  )
}
