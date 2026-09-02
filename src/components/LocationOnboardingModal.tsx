import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F, SHADOW_BUTTON } from '../lib/tokens'

// Step one of the native first run: one sentence about why the map wants a
// location, and only then the system dialog. Refusing is a normal outcome, not
// an error — the map falls back to the last known or coarse position.

export default function LocationOnboardingModal({
  onAllow,
  onSkip,
}: {
  /** Raises the system dialog. Resolves with whatever the user decided. */
  onAllow: () => Promise<void>
  onSkip: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 340,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
          padding: '28px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
          background: C.primarySoft, border: `2.5px solid ${INK}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.primary}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/>
            <circle cx="12" cy="10" r="2.6"/>
          </svg>
        </div>

        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('onboarding.locationTitle')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('onboarding.locationBody')}
        </div>

        <button
          onClick={async () => { setBusy(true); await onAllow(); setBusy(false) }}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: SHADOW_BUTTON,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {t('onboarding.locationAllow')}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          style={{
            marginTop: 12, width: '100%', padding: '10px',
            background: 'none', border: 'none',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('onboarding.locationSkip')}
        </button>
      </div>
    </div>
  )
}
