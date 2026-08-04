import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F, TAG_META, ONBOARDING_CATEGORIES } from '../lib/tokens'
import { db } from '../lib/supabase'
import { DEFAULT_RADIUS_KM } from '../lib/appConfig'
import RadiusSlider from './RadiusSlider'

// Step two of the first run. It exists because of a backend rule, not because
// the form is nice to have: selectEventAudience drops anyone whose `interests`
// share nothing with a tagged event, so an account that never answered this is
// invisible to the geo fan-out and never hears about anything nearby.
//
// The categories come from the same ordered list the filter bar renders
// (ONBOARDING_CATEGORIES in lib/tokens.ts), so the product names its categories
// the same way everywhere. Custom tags belong in the profile, not here: this is
// the shortest possible answer to "what are you into".

export default function InterestsOnboardingModal({
  userId,
  initial,
  onDone,
  onSkip,
}: {
  userId: string
  /** First letter of the user's name, for the menu hint. */
  initial?: string
  onDone: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string[]>([])
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM)
  const [busy, setBusy] = useState(false)

  function toggle(cat: string) {
    setPicked(prev => prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat])
  }

  async function handleDone() {
    setBusy(true)
    try {
      await db.updateProfile({ id: userId, interests: picked, radius_km: radius })
    } catch (err) {
      // Stated, not hidden — but the user is not held in the modal over it. The
      // step counts as answered; the profile panel can still set both fields.
      console.error('[onboarding] saving interests failed:', err)
    }
    setBusy(false)
    onDone()
  }

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
          // The card scrolls, the buttons do not: on a short screen "Gotowe" has
          // to stay reachable without discovering that the card scrolls at all.
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ position: 'relative', minHeight: 0, display: 'flex' }}>
        <div style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 8 }}>
          {t('onboarding.interestsTitle')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
          {t('onboarding.interestsBody')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          {ONBOARDING_CATEGORIES.map(cat => {
            const meta = TAG_META[cat]
            const isOn = picked.includes(cat)
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                aria-pressed={isOn}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 4, minHeight: 64, padding: '10px 8px', borderRadius: 20,
                  background: isOn ? meta.color : `${meta.color}33`,
                  color: isOn ? '#fff' : C.ink,
                  fontSize: 14, fontWeight: 800,
                  border: isOn ? `2.5px solid ${INK}` : '2.5px solid transparent',
                  transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
                  transform: isOn ? 'scale(1.05)' : 'scale(1)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 24, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: meta.glyph }} />
                <span>{t('tags.' + cat)}</span>
              </button>
            )
          })}
        </div>

        <div style={{ textAlign: 'left', marginBottom: 16 }}>
          <RadiusSlider
            value={radius}
            onChange={setRadius}
            label={t('onboarding.interestsRadius')}
          />
        </div>

        {/* The hint points at a control the user has not noticed yet, so it is
            shown as well as described — a sentence alone does not teach where
            the menu is. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
          background: C.cream, borderRadius: 16, padding: '10px 12px', marginBottom: 18,
        }}>
          <div style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: '50%',
            background: C.berry, border: `2px solid ${INK}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F.display, fontWeight: 900, fontSize: 16, color: '#fff',
          }}>{(initial || '?').toUpperCase()}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft, lineHeight: 1.45 }}>
            {t('onboarding.interestsMenuHint')}
          </div>
        </div>
        </div>
        {/* Says "there is more below" on a short screen. On a tall one it is
            white over white and nobody sees it. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 24,
          background: 'linear-gradient(rgba(255,255,255,0), #fff)', pointerEvents: 'none',
        }} />
        </div>

        <button
          onClick={handleDone}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(255,122,69,0.35)',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {t('onboarding.interestsDone')}
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
          {t('onboarding.interestsSkip')}
        </button>
      </div>
    </div>
  )
}
