import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readConsent, saveConsent, onCookieSettings } from '../../lib/consent'
import './landing.css'

type Mode = 'hidden' | 'banner' | 'settings'

interface RowProps {
  label: string
  desc: string
  checked: boolean
  disabled?: boolean
  onChange?: (next: boolean) => void
}

function SwitchRow({ label, desc, checked, disabled, onChange }: RowProps) {
  return (
    <div className="lp-cookie-row">
      <div className="lp-cookie-row-text">
        <span className="lp-cookie-row-label">{label}</span>
        <span className="lp-cookie-row-desc">{desc}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`lp-cookie-switch${checked ? ' on' : ''}`}
        onClick={() => onChange?.(!checked)}
      >
        <span className="lp-cookie-knob" />
      </button>
    </div>
  )
}

/**
 * Baner zgody na cookies. Pokazuje się raz — dopóki gość nie kliknie — i potem
 * wraca tylko na życzenie ze stopki (openCookieSettings). Nie przyciemnia strony:
 * to karta w rogu, którą można zignorować i czytać dalej.
 */
export function CookieConsent() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>(() => (readConsent() ? 'hidden' : 'banner'))
  const [analytics, setAnalytics] = useState(() => readConsent()?.analytics ?? false)

  useEffect(() => onCookieSettings(() => {
    setAnalytics(readConsent()?.analytics ?? false)
    setMode('settings')
  }), [])

  if (mode === 'hidden') return null

  const decide = (value: boolean) => {
    saveConsent({ analytics: value })
    setMode('hidden')
  }
  const k = (key: string) => t(`landing.cookies.${key}`)

  return (
    <div className={`lp-cookie${mode === 'settings' ? ' settings' : ''}`} role="dialog" aria-label={k('title')}>
      <div className="lp-cookie-head">
        <strong className="lp-cookie-title">{k('title')}</strong>
        {mode === 'settings' && (
          <button
            type="button"
            className="lp-cookie-close"
            aria-label={k('close')}
            // Zamknięcie bez zapisu: kto już zdecydował, ten wraca do strony;
            // kto jeszcze nie, ten dostaje z powrotem krótką wersję pytania.
            onClick={() => setMode(readConsent() ? 'hidden' : 'banner')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {mode === 'banner' ? (
        <>
          <p className="lp-cookie-body">
            {k('body')} <a href="/privacy.html">{k('privacy')}</a>
          </p>
          <div className="lp-cookie-actions">
            <button type="button" className="lp-cookie-btn primary" onClick={() => decide(true)}>
              {k('acceptAll')}
            </button>
            <button type="button" className="lp-cookie-btn" onClick={() => decide(false)}>
              {k('necessaryOnly')}
            </button>
          </div>
          <button type="button" className="lp-cookie-link" onClick={() => setMode('settings')}>
            {k('customize')}
          </button>
        </>
      ) : (
        <>
          <SwitchRow label={k('necessary')} desc={k('necessaryDesc')} checked disabled />
          <SwitchRow label={k('analytics')} desc={k('analyticsDesc')} checked={analytics} onChange={setAnalytics} />
          <div className="lp-cookie-actions">
            <button type="button" className="lp-cookie-btn primary" onClick={() => decide(analytics)}>
              {k('save')}
            </button>
          </div>
          <a className="lp-cookie-link" href="/privacy.html">{k('privacy')}</a>
        </>
      )}
    </div>
  )
}
