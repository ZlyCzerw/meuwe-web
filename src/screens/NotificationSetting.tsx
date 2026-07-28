import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { isRepairableInApp } from '../lib/pushState'
import type { PushUiState } from '../lib/pushState'

/**
 * The notification row in the profile panel. Purely presentational: it is handed
 * the resolved state and renders it, which is what makes every state (including
 * the broken ones that are hard to reach on a dev machine) inspectable.
 *
 * `state === null` means the device has not been checked yet.
 */
export default function NotificationSetting({
  state,
  intent,
  loading,
  error,
  blockedHint,
  onToggle,
  onRepair,
}: {
  state: PushUiState | null
  intent: boolean
  loading: boolean
  error: boolean
  blockedHint: string
  onToggle: () => void
  onRepair: () => void
}) {
  const { t } = useTranslation()

  // The toggle shows the user's intent. When the intent is on but this device
  // cannot deliver, the row turns into a warning and the card below says why:
  // the two are never allowed to disagree silently.
  const broken = state !== null && state !== 'on' && state !== 'off' && state !== 'unsupported'
  const accent = broken ? C.sunshine : C.primary

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink, marginBottom: 12 }}>
        {t('profile.notifications')}
      </div>

      {state === null ? (
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
          {t('common.loading')}
        </div>
      ) : state === 'unsupported' ? (
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
          {t('profile.notificationsUnsupported')}
        </div>
      ) : (
        <>
          <button
            onClick={onToggle}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 16px', borderRadius: 20,
              background: intent && !broken ? C.primarySoft : C.cream,
              border: `2px solid ${intent ? accent : INK + '22'}`,
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={intent ? accent : C.inkSoft}
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                {intent && !broken ? null : <line x1="1" y1="1" x2="23" y2="23"/>}
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
                  {state === 'on' ? t('profile.notificationsOn')
                    : state === 'off' ? t('profile.notificationsOff')
                    : t('profile.pushNotHereShort')}
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 1 }}>
                  {t('profile.notificationsHint')}
                </div>
              </div>
            </div>
            {loading ? (
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2.5px solid ${C.inkSoft}44`, borderTopColor: C.primary, animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 24, borderRadius: 999, background: intent ? accent : '#E0D8CF', border: `2px solid ${intent ? INK : 'transparent'}`, position: 'relative', transition: 'all 200ms ease', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: intent ? 22 : 2, width: 16, height: 16, borderRadius: '50%', background: intent ? '#fff' : C.inkSoft, transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)' }} />
              </div>
            )}
          </button>

          {broken && (
            <div style={{
              marginTop: 10, padding: '12px 14px', borderRadius: 16,
              background: C.cream, border: `2px solid ${C.sunshine}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
                {state === 'blocked' ? t('profile.pushBlockedTitle') : t('profile.pushNotHereTitle')}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>
                {state === 'blocked' ? blockedHint : t('profile.pushNotHereBody')}
              </div>
              {error && (
                <div style={{ fontSize: 12, color: C.primaryPress, fontWeight: 700, marginTop: 6, lineHeight: 1.5 }}>
                  {t('profile.pushRepairFailed')}
                </div>
              )}
              {isRepairableInApp(state) && (
                <button
                  onClick={onRepair}
                  disabled={loading}
                  style={{
                    marginTop: 10, width: '100%', padding: '10px 16px', borderRadius: 999,
                    background: C.primary, border: `2px solid ${INK}`, color: '#fff',
                    fontSize: 13, fontWeight: 800,
                    cursor: loading ? 'default' : 'pointer',
                    transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {t('profile.pushRepair')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
