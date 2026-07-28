import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import { deleteAccount } from '../lib/account'

// Confirmation before deleting the account. The list is deliberately precise:
// the account goes, the content stays without a name. Promising that everything
// disappears would be a lie, and the person deciding deserves the real thing.

export default function DeleteAccountModal({
  onDeleted,
  onClose,
}: {
  onDeleted: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleDelete() {
    setBusy(true)
    setFailed(false)
    db.trackClick('delete_account')
    const result = await deleteAccount()
    setBusy(false)
    if (result === 'ok') { onDeleted(); return }
    setFailed(true)
  }

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
          padding: '28px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)',
        }}
      >
        <div style={{
          fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink,
          marginBottom: 12, textAlign: 'center',
        }}>
          {t('account.deleteTitle')}
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, lineHeight: 1.6, marginBottom: 8 }}>
          {[
            t('account.deletePoint1'),
            t('account.deletePoint2'),
            t('account.deletePoint3'),
          ].map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: C.primary, fontWeight: 900 }}>·</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, lineHeight: 1.5, marginBottom: 20 }}>
          {t('account.deleteIrreversible')}
        </div>

        {failed && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primaryPress, lineHeight: 1.5, marginBottom: 14 }}>
            {t('account.deleteFailed')}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: C.primaryPress, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(232,90,42,0.35)',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? t('common.loading') : t('account.deleteConfirm')}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          style={{
            marginTop: 12, width: '100%', padding: '10px',
            background: 'none', border: 'none',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
