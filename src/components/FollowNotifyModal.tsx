import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import { enablePushOnThisDevice } from '../lib/push'
import { addToCalendar } from '../lib/calendar'
import CalendarChooserModal from './CalendarChooserModal'
import { isIOS, isAndroid } from '../lib/platform'
import type { IcsEvent } from '../lib/ics'

// Shown the first time someone follows an event while this device would not
// deliver a notification. The system prompt is never raised before this: the
// explanation comes first, the prompt only from the button below.
//
// A refusal is not a dead end — the same card then offers the calendar, which
// needs no permission at all.

type View = 'ask' | 'fallback'

export default function FollowNotifyModal({
  event,
  userId,
  provider,
  reason,
  onEnabled,
  onClose,
}: {
  event: IcsEvent
  userId: string
  /** How the account signed in — lets the calendar skip the "which one?" question. */
  provider: string | null
  /**
   * 'ask' — the prompt can still be raised.
   * 'blocked' — the system permission is denied, no prompt is possible.
   * 'unsupported' — this browser has no push at all.
   */
  reason: 'ask' | 'blocked' | 'unsupported'
  onEnabled: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(reason === 'ask' ? 'ask' : 'fallback')
  const [busy, setBusy] = useState(false)
  const [calendarFailed, setCalendarFailed] = useState(false)
  const [chooser, setChooser] = useState(false)

  const blockedHint = isIOS() ? t('profile.pushBlockedIos')
    : isAndroid() ? t('profile.pushBlockedAndroid')
    : t('profile.pushBlockedWeb')

  async function handleEnable() {
    setBusy(true)
    db.trackClick('follow_push_enable')
    const device = await enablePushOnThisDevice(userId)
    await db.updateProfile({ id: userId, push_enabled: true })
    setBusy(false)
    if (device.permission === 'granted' && device.registered) {
      onEnabled()
      onClose()
      return
    }
    // Refused, dismissed or failed to register: say so and offer the calendar.
    setView('fallback')
  }

  async function handleCalendar() {
    setBusy(true)
    setCalendarFailed(false)
    db.trackClick('follow_calendar')
    const result = await addToCalendar(event, { provider })
    setBusy(false)
    // Nothing is known about this device's calendar: ask rather than guess.
    if (result === 'choose') { setChooser(true); return }
    if (result === 'failed') {
      setCalendarFailed(true)
      return
    }
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 320,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
          padding: '28px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
          background: view === 'ask' ? C.primarySoft : C.cream,
          border: `2.5px solid ${INK}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {view === 'ask' ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.primary}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.ink}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="3"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="3" x2="8" y2="7"/>
              <line x1="16" y1="3" x2="16" y2="7"/>
            </svg>
          )}
        </div>

        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {view === 'ask' ? t('followNotify.title') : t('followNotify.fallbackTitle')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 20 }}>
          {view === 'ask' ? t('followNotify.body')
            : reason === 'blocked' ? `${t('followNotify.blockedBody')} ${blockedHint}`
            : reason === 'unsupported' ? t('followNotify.unsupportedBody')
            : t('followNotify.deniedBody')}
        </div>

        {calendarFailed && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primaryPress, lineHeight: 1.5, marginBottom: 14 }}>
            {t('followNotify.calendarFailed')}
          </div>
        )}

        {view === 'ask' ? (
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
        ) : (
          <button
            onClick={handleCalendar}
            disabled={busy}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
              border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(255,122,69,0.35)',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {t('followNotify.calendar')}
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 12, width: '100%', padding: '10px',
            background: 'none', border: 'none',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {view === 'ask' ? t('followNotify.later') : t('common.close')}
        </button>
      </div>

      {chooser && (
        <CalendarChooserModal
          event={event}
          onPicked={result => {
            setChooser(false)
            if (result === 'failed') setCalendarFailed(true)
            else onClose()
          }}
          onClose={() => setChooser(false)}
        />
      )}
    </div>
  )
}
