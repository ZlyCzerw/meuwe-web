import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import { enablePushOnThisDevice } from '../lib/push'

// The ask for notification permission when there is no event in front of the
// user — a second session, a few events opened, an event created. FollowNotify
// covers the other case, where a specific event is on screen and a refusal can
// still be answered with the calendar. Here there is nothing to put in a
// calendar, so the card says what it is for and takes no for an answer.
//
// The buttons deliberately reuse followNotify.enable / followNotify.later: the
// same action asked in two places should not be worded two ways.

export default function PushAskModal({
  userId,
  onEnabled,
  onDecline,
}: {
  userId: string
  onEnabled: () => void
  /** Pressed "not now", or the system prompt was refused — both start the cooldown. */
  onDecline: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleEnable() {
    setBusy(true)
    db.trackClick('push_ask_enable')
    const device = await enablePushOnThisDevice(userId)
    // The wish is recorded even when the device refuses, so the profile panel
    // shows the mismatch and offers the repair instead of hiding it — but only
    // where a repair exists. 'unsupported' has none, and an account marked as
    // wanting notifications it can never receive is a lie the profile would
    // then have to keep telling.
    if (device.permission !== 'unsupported') {
      await db.updateProfile({ id: userId, push_enabled: true })
    }
    setBusy(false)
    if (device.permission === 'granted' && device.registered) {
      onEnabled()
      return
    }
    onDecline()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 320,
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
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('pushAsk.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('pushAsk.body')}
        </div>

        <button
          onClick={handleEnable}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(255,122,69,0.35)',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {t('followNotify.enable')}
        </button>
        <button
          onClick={onDecline}
          disabled={busy}
          style={{
            marginTop: 12, width: '100%', padding: '10px',
            background: 'none', border: 'none',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('followNotify.later')}
        </button>
      </div>
    </div>
  )
}
