import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { C } from '../../lib/tokens'
import { setLanguage } from '../../lib/i18n'
import type { Lang } from '../../lib/types'
import './landing.css'

const W = 22, H = 15, R = 2.5

function Flag({ code }: { code: Lang }) {
  const id = `lp-flag-${code}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <clipPath id={id}>
          <rect width={W} height={H} rx={R} ry={R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {code === 'pl' && <>
          <rect width={W} height={H / 2} fill="#fff" />
          <rect y={H / 2} width={W} height={H / 2} fill="#DC143C" />
        </>}
        {code === 'de' && <>
          <rect width={W} height={H / 3} fill="#1C1C1C" />
          <rect y={H / 3} width={W} height={H / 3} fill="#DD0000" />
          <rect y={H * 2 / 3} width={W} height={H / 3} fill="#FFCE00" />
        </>}
        {code === 'es' && <>
          <rect width={W} height={H / 3} fill="#AA151B" />
          <rect y={H / 3} width={W} height={H / 3} fill="#F1BF00" />
          <rect y={H * 2 / 3} width={W} height={H / 3} fill="#AA151B" />
        </>}
        {code === 'en' && <>
          <rect width={W} height={H} fill="#012169" />
          <line x1="0" y1="0" x2={W} y2={H} stroke="#fff" strokeWidth="5" />
          <line x1={W} y1="0" x2="0" y2={H} stroke="#fff" strokeWidth="5" />
          <line x1="0" y1="0" x2={W} y2={H} stroke="#C8102E" strokeWidth="2.5" />
          <line x1={W} y1="0" x2="0" y2={H} stroke="#C8102E" strokeWidth="2.5" />
          <rect x="0" y={H / 2 - 2} width={W} height={4.5} fill="#fff" />
          <rect x={W / 2 - 2} y="0" width={4.5} height={H} fill="#fff" />
          <rect x="0" y={H / 2 - 1} width={W} height={2.5} fill="#C8102E" />
          <rect x={W / 2 - 1} y="0" width={2.5} height={H} fill="#C8102E" />
        </>}
      </g>
      <rect width={W} height={H} rx={R} ry={R} fill="none" stroke="#2D2B2A" strokeWidth="1.5" />
    </svg>
  )
}

const LANGS: { code: Lang; label: string }[] = [
  { code: 'pl', label: 'Polski' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function LangSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentCode = (LANGS.find(l => l.code === i18n.language)?.code ?? 'en') as Lang

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="lp-lang" ref={ref}>
      <button className={`lp-lang-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <Flag code={currentCode} />
        {currentCode.toUpperCase()}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="#5C564E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="lp-lang-drop">
          {LANGS.map(l => (
            <button
              key={l.code}
              className={`lp-lang-opt${l.code === i18n.language ? ' active' : ''}`}
              onClick={() => { setLanguage(l.code); setOpen(false) }}
            >
              <Flag code={l.code} />
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

interface NavProps {
  onSignIn?: (mode: 'google' | 'skip') => void
}

export function LandingNav({ onSignIn }: NavProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const onBlog = location.pathname === '/blog'

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location])

function handleAnchor(anchor: string) {
    setMenuOpen(false)
    if (onBlog) {
      navigate('/', { state: { scrollTo: anchor } })
    } else {
      setTimeout(() => scrollToId(anchor), 50)
    }
  }

  return (
    <>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LangSwitcher />
          <button className="lp-nav-cta" onClick={() => handleAnchor('pobierz')}>
            {t('landing.nav.openApp')}
          </button>
          <button
            className={`lp-hamburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            <span className="lp-hamburger-line" />
            <span className="lp-hamburger-line" />
            <span className="lp-hamburger-line" />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="lp-mobile-menu">
          <button className="lp-mobile-menu-link" onClick={() => handleAnchor('jak-dziala')}>
            {t('landing.nav.howItWorks')}
          </button>
          <button className="lp-mobile-menu-link" onClick={() => handleAnchor('wydarzenia')}>
            {t('landing.nav.events')}
          </button>
          <button className="lp-mobile-menu-link" onClick={() => handleAnchor('stworz')}>
            {t('landing.nav.create')}
          </button>
          <button className="lp-mobile-menu-link" onClick={() => { setMenuOpen(false); navigate('/blog') }}>
            Blog
          </button>
          <button className="lp-mobile-menu-link" onClick={() => handleAnchor('pobierz')}>
            {t('landing.nav.openApp')}
          </button>
          {onSignIn && (
            <button className="lp-mobile-menu-signin" onClick={() => { setMenuOpen(false); onSignIn('google') }}>
              <GoogleIcon />
              {t('welcome.google')}
            </button>
          )}
        </div>
      )}
    </>
  )
}
