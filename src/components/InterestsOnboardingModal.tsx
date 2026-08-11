import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F, ALL_CATEGORIES } from '../lib/tokens'
import { db } from '../lib/supabase'
import { enablePushOnThisDevice } from '../lib/push'
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

/** The card's single left edge — header, grid and footer all use it. */
const PAD = 20

// The waiting state of "Gotowe". It has to read as not-yet-usable without
// becoming unreadable: C.inkSoft on the old #E8DFD0 measured 2.77:1, which is
// under every threshold there is. Both ends move a quarter of the way out of
// the grey — the label towards ink, the fill towards white — for 4.06:1. Still
// short of the 4.5:1 that body text would need, but this is a label on a
// deliberately dormant control, and going further starts to look enabled.
const DISABLED_BG = '#EEE7DC'
const DISABLED_INK = '#736F6B'

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

    // The answer goes down first, in a write of its own, before anything raises
    // a system dialog. It used to share a call with the notification wish, after
    // it: enablePushOnThisDevice blocks until the OS prompt is answered, and if
    // it threw — or the user walked away from that prompt and killed the app —
    // the categories were never written at all. The step then looked done on
    // this device and empty in the database, which is the state selectEventAudience
    // reads as "notify nobody".
    //
    // interests_onboarded_at is what stops the card coming back on the next
    // device. It is stamped here rather than by the caller because a failed
    // write must leave it unstamped: no row change, no claim that the question
    // was answered, and the step is offered again at the next launch.
    try {
      const res = await db.updateProfile({
        id: userId,
        interests: picked,
        radius_km: radiusKm,
        interests_onboarded_at: new Date().toISOString(),
      })
      // updateProfile resolves with the error rather than throwing it, so a
      // permission or constraint failure looks exactly like success from here
      // unless it is read.
      if (res.error) console.error('[onboarding] saving interests failed:', res.error)
    } catch (err) {
      // Stated, not hidden — but the user is not held here over it. The profile
      // panel can still set both fields, and the step returns next launch.
      console.error('[onboarding] saving interests failed:', err)
    }

    // The card promises to let the user know when something happens nearby, so
    // "Gotowe" has to be the moment that becomes true — saving the categories
    // and leaving notifications off would make the promise something they only
    // discover is empty weeks later, by never hearing anything.
    //
    // A refusal is not a failure of this step: the categories are already kept,
    // and 'denied' remains repairable from the profile. Only a platform that
    // cannot deliver at all is left unclaimed.
    try {
      const device = await enablePushOnThisDevice(userId)
      if (device.permission !== 'unsupported') {
        await db.updateProfile({ id: userId, push_enabled: true })
      }
    } catch (err) {
      console.error('[onboarding] enabling notifications failed:', err)
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
      {/* Centred, and the sentence under it with the heading — a centred title
          over left-set body text reads as a mistake rather than a choice. The
          grid and footer keep their single left edge at PAD. */}
      <div style={{ padding: `28px ${PAD}px 16px`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink, marginBottom: 8 }}>
          {t('onboarding.interestsTitle')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.45 }}>
          {t('onboarding.interestsBody')}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        {/* scrollbarWidth: none keeps the grid exactly as wide as the button
            below it. A classic scrollbar would take its width out of this
            container only, pulling the right-hand pills in while "Gotowe" kept
            the full width — the two would stop lining up on any browser that
            still draws one. WebKit is already covered by index.css. */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: `0 ${PAD}px 16px`, scrollbarWidth: 'none' }}>
          {/* A fixed two-column grid rather than a wrapping row. Pills sized to
              their own text left a different ragged edge on every line and a
              wide gutter down the right; two even columns give the eye one
              vertical line to follow through twenty-one options. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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

      <div style={{ flexShrink: 0, padding: `0 ${PAD}px 20px` }}>
        {/* The hint points at a control the user has not noticed yet, so it is
            shown as well as described. Borderless: a white card here competed
            with the pills for attention at the exact moment the pills are the
            thing to look at. */}
        {/* No inset of its own: the avatar starts on the same rail as the pills
            above and the button below, at PAD. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
            background: C.berry, border: `2px solid ${INK}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F.display, fontWeight: 900, fontSize: 14, color: '#fff',
          }}>{(initial || '?').toUpperCase()}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, lineHeight: 1.4 }}>
            {t('onboarding.interestsMenuHint')}
          </div>
        </div>

        <button
          onClick={handleDone}
          disabled={!ready || busy}
          style={{
            width: '100%', padding: '15px', borderRadius: 999,
            background: ready ? C.primary : DISABLED_BG,
            color: ready ? '#fff' : DISABLED_INK,
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
