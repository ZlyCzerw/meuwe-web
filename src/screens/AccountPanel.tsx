import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { isNativePlatform } from '../lib/platform'
import DeleteAccountModal from '../components/DeleteAccountModal'

// "Account and data", one level below the profile. Deliberately quiet: it is
// reachable in three taps from the map, which is what App Review asks for, but
// nothing about it shouts at someone who is only looking for the radius slider.
//
// Slides in over the profile panel, same geometry, so it reads as a step deeper
// rather than a different place.

export default function AccountPanel({
  open,
  onClose,
  onDeleted,
  currentName,
  onOpenMyData,
}: {
  open: boolean
  onClose: () => void
  onDeleted: () => void
  /** Nazwa pokazywana dziś — nickname, a w jego braku ta od dostawcy logowania. */
  currentName: string
  onOpenMyData: () => void
}) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  // On native "/privacy.html" resolves to capacitor://localhost/... which the
  // system browser cannot open, so point at the hosted page (same as Welcome).
  const privacyHref = isNativePlatform() ? 'https://meuwe.eu/privacy.html' : '/privacy.html'

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 32,
          background: 'rgba(45,43,42,0.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }}
      />

      <div
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0,
          width: '88%', maxWidth: 380,
          background: C.cream,
          borderTopRightRadius: 32, borderBottomRightRadius: 32,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 380ms cubic-bezier(0.32,1.4,0.4,1)',
          boxShadow: '8px 0 32px rgba(45,43,42,0.15)',
          zIndex: 33,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: 'calc(24px + env(safe-area-inset-top)) 24px 24px',
          overflowY: 'auto', flex: 1,
        }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', padding: 0, marginBottom: 20,
              color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900 }}>‹</span>
            {t('account.back')}
          </button>

          <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink, marginBottom: 14 }}>
            {t('account.title')}
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, lineHeight: 1.6 }}>
            {t('account.body')}
          </div>

          <a
            href={privacyHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', marginTop: 14,
              fontSize: 13, fontWeight: 700, color: C.ink,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            {t('account.privacy')}
          </a>

          <div style={{ height: 1, background: `${INK}18`, margin: '28px 0 20px' }} />

          <button
            onClick={onOpenMyData}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              textAlign: 'left', padding: '12px 0', background: 'none', border: 'none',
              fontSize: 14, fontWeight: 700, color: C.ink, cursor: 'pointer',
            }}
          >
            {t('account.myData')}
            <span style={{ fontSize: 20, fontWeight: 900 }}>›</span>
          </button>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
            {currentName}
          </div>

          <div style={{ height: 1, background: `${INK}18`, margin: '20px 0' }} />

          <button
            onClick={() => setConfirmOpen(true)}
            style={{
              padding: '12px 0', background: 'none', border: 'none',
              fontSize: 14, fontWeight: 700, color: C.primaryPress, cursor: 'pointer',
            }}
          >
            {t('account.delete')}
          </button>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5 }}>
            {t('account.deleteHint')}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <DeleteAccountModal
          onDeleted={onDeleted}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  )
}
