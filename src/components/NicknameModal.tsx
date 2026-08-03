import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'

// Zmiana nazwy użytkownika. Geometria i ruch jak w DeleteAccountModal, żeby oba
// okna z panelu konta czytały się jako jedna rodzina.

export default function NicknameModal({
  currentName,
  onSaved,
  onClose,
}: {
  currentName: string
  onSaved: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const check = validateNickname(value)
    if (!check.ok) { setError(t(`account.nickname_${check.reason}`)); return }
    setBusy(true)
    setError(null)
    db.trackClick('nickname_save')
    const sess = await db.getSession()
    if (!sess) { setBusy(false); setError(t('account.nicknameFailed')); return }
    const res = await db.updateProfile({ id: sess.user.id, nickname: check.value })
    setBusy(false)
    // Zapis potrafi się nie udać po cichu (uprawnienia, ograniczenie w bazie) —
    // wtedy okno zostaje otwarte z komunikatem zamiast udawać sukces.
    if (res.error) { console.error('[nickname] zapis nieudany:', res.error); setError(t('account.nicknameFailed')); return }
    onSaved()
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
          marginBottom: 18, textAlign: 'center',
        }}>
          {t('account.nicknameTitle')}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 4 }}>
          {t('account.nicknameCurrent')}
        </div>
        <div style={{
          fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 18,
          overflowWrap: 'anywhere',
        }}>
          {currentName}
        </div>

        <label
          htmlFor="nickname-input"
          style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}
        >
          {t('account.nicknameNew')}
        </label>
        <input
          id="nickname-input"
          value={value}
          onChange={e => { setValue(e.target.value); if (error) setError(null) }}
          maxLength={NICKNAME_MAX}
          autoFocus
          autoComplete="off"
          disabled={busy}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 999,
            border: `2.5px solid ${error ? C.primaryPress : INK}`,
            background: '#fff', color: C.ink,
            fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{
          minHeight: 20, marginTop: 8,
          fontSize: 12, fontWeight: 700, lineHeight: 1.4,
          color: error ? C.primaryPress : C.inkSoft,
        }}>
          {error ?? t('account.nicknameHint')}
        </div>

        <button
          onClick={handleSave}
          disabled={busy}
          style={{
            marginTop: 12, width: '100%', padding: '14px', borderRadius: 999,
            background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(232,90,42,0.28)',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? t('common.loading') : t('account.nicknameSave')}
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
