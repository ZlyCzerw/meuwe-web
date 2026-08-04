import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F, ALL_CATEGORIES } from '../lib/tokens'
import { db } from '../lib/supabase'
import CategoryChip from './CategoryChip'

// Step two of the first run. It exists because of a backend rule, not because
// the form is nice to have: selectEventAudience drops anyone whose `interests`
// share nothing with a tagged event, so an account that never answered this is
// invisible to the geo fan-out and never hears about anything nearby.
//
// That is also why there is no way past it. An empty answer and no answer are
// the same thing to the fan-out, so "Gotowe" stays shut until something is
// picked. The vocabulary is the picker's (CategoryChip), minus the custom-tag
// field — a brand-new account has nothing to name yet, and the profile panel
// still offers it later.
//
// The radius is not asked about at all; it arrives already worked out from how
// far away the nearest event actually is (radiusFromNearest in lib/onboarding).

export default function InterestsOnboardingModal({
  userId,
  radiusKm,
  initial,
  onDone,
}: {
  userId: string
  radiusKm: number
  /** First letter of the user's name, for the menu hint. */
  initial?: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const ready = picked.length > 0

  function toggle(cat: string) {
    setPicked(prev => prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat])
  }

  async function handleDone() {
    if (!ready) return
    setBusy(true)
    try {
      await db.updateProfile({ id: userId, interests: picked, radius_km: radiusKm })
    } catch (err) {
      // Stated, not hidden — but the user is not held here over it. The profile
      // panel can still set both fields.
      console.error('[onboarding] saving interests failed:', err)
    }
    setBusy(false)
    onDone()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 340, background: C.cream,
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 180ms ease',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{ padding: '32px 24px 16px', flexShrink: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('onboarding.interestsTitle')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5 }}>
          {t('onboarding.interestsBody')}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 20px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_CATEGORIES.map(cat => (
              <CategoryChip
                key={cat}
                category={cat}
                selected={picked.includes(cat)}
                onToggle={() => toggle(cat)}
                size="md"
              />
            ))}
          </div>
        </div>
        {/* Says "there is more below" on a short screen; invisible when the grid
            already fits, being cream over cream. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 24,
          background: `linear-gradient(rgba(255,246,236,0), ${C.cream})`, pointerEvents: 'none',
        }} />
      </div>

      <div style={{ flexShrink: 0, padding: '0 20px 24px' }}>
        {/* The hint points at a control the user has not noticed yet, so it is
            shown as well as described. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', borderRadius: 16, padding: '10px 12px', marginBottom: 14,
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

        <button
          onClick={handleDone}
          disabled={!ready || busy}
          style={{
            width: '100%', padding: '15px', borderRadius: 999,
            background: ready ? C.primary : '#E8DFD0',
            color: ready ? '#fff' : C.inkSoft,
            fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${ready ? INK : 'transparent'}`,
            boxShadow: ready ? '0 6px 16px rgba(255,122,69,0.35)' : 'none',
            transition: 'all 200ms ease',
            cursor: ready && !busy ? 'pointer' : 'default',
          }}
        >
          {t('onboarding.interestsDone')}
        </button>
      </div>
    </div>
  )
}
