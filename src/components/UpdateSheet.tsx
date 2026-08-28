import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import DragHandle from './DragHandle'

// Two ways of saying the same thing, because they are not the same situation.
//
// 'optional' is a nudge: a new build is in the store, nothing is broken, and
// the sheet keeps the map visible and closes on a tap — exactly like
// AppPromoSheet, which is the shape people here already know.
//
// 'blocking' is the backend having dropped this build. There is no close: an
// app that cannot talk to its server is not usable, and a dismissible warning
// would only hand back a broken screen with no explanation on it.

export type UpdateMode = 'optional' | 'blocking'

interface Props {
  mode: UpdateMode
  onUpdate: () => void
  /** Absent in blocking mode — there is nothing to dismiss to. */
  onDismiss?: () => void
}

export default function UpdateSheet({ mode, onUpdate, onDismiss }: Props) {
  const { t } = useTranslation()
  const blocking = mode === 'blocking'

  const button = (
    <button
      onClick={onUpdate}
      style={{
        width: blocking ? '100%' : undefined,
        background: C.primary, color: '#fff',
        border: `2.5px solid ${INK}`, borderRadius: 999,
        padding: '12px 22px', fontFamily: F.display,
        fontSize: 15, fontWeight: 900, cursor: 'pointer',
        boxShadow: `0 3px 0 ${INK}`,
      }}
    >
      {t('appUpdate.action')}
    </button>
  )

  if (blocking) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 3200,
          background: C.cream,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 28px calc(32px + env(safe-area-inset-bottom))',
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: C.ink, lineHeight: 1.25 }}>
          {t('appUpdate.blockedTitle')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginTop: 12, maxWidth: 340 }}>
          {t('appUpdate.blockedBody')}
        </div>
        <div style={{ marginTop: 28, width: '100%', maxWidth: 280 }}>{button}</div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 240,
        background: C.cream,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        border: `2.5px solid ${INK}`, borderBottom: 'none',
        boxShadow: '0 -8px 32px rgba(45,43,42,0.18)',
        padding: '0 20px calc(20px + env(safe-area-inset-bottom))',
        animation: 'bubble-up 300ms cubic-bezier(0.32,1.4,0.4,1)',
      }}
    >
      <DragHandle />

      <button
        onClick={onDismiss}
        aria-label={t('common.close')}
        style={{
          position: 'absolute', top: 14, right: 14,
          width: 32, height: 32, borderRadius: '50%',
          background: '#fff', border: `2px solid ${INK}22`,
          fontSize: 16, fontWeight: 900, color: C.inkSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        ×
      </button>

      {/* paddingRight keeps the heading clear of the close button */}
      <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.ink, marginTop: 4, paddingRight: 44 }}>
        {t('appUpdate.title')}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginTop: 6 }}>
        {t('appUpdate.body')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        {button}
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', padding: '10px 4px',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('appUpdate.later')}
        </button>
      </div>
    </div>
  )
}
