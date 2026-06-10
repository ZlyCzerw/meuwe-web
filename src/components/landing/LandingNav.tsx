import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { C } from '../../lib/tokens'
import './landing.css'

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const onBlog = location.pathname === '/blog'

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  function handleAnchor(anchor: string) {
    if (onBlog) {
      navigate('/', { state: { scrollTo: anchor } })
    } else {
      scrollToId(anchor)
    }
  }

  return (
    <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <a className="lp-nav-logo" onClick={() => handleAnchor('hero')}>
        <span style={{ color: C.primary }}>me</span>
        <span style={{ color: C.sky }}>u</span>
        <span style={{ color: C.grass }}>we</span>
      </a>

      <ul className="lp-nav-links">
        <li><a onClick={() => handleAnchor('jak-dziala')}>{t('landing.nav.howItWorks')}</a></li>
        <li><a onClick={() => handleAnchor('wydarzenia')}>{t('landing.nav.events')}</a></li>
        <li><a onClick={() => handleAnchor('stworz')}>{t('landing.nav.create')}</a></li>
        <li><a onClick={() => navigate('/blog')}>Blog</a></li>
      </ul>

      <button className="lp-nav-cta" onClick={() => handleAnchor('pobierz')}>
        {t('landing.nav.openApp')}
      </button>
    </nav>
  )
}
