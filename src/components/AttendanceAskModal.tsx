import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'

// Pytanie zadawane nazajutrz o obserwowane wydarzenie, które się skończyło.
// Odpowiedź "nie" jest tak samo wartościowa jak "tak": zapisuje fakt i zamyka
// temat, więc modal nie wróci z tym samym wydarzeniem.

export default function AttendanceAskModal({
  title,
  onAnswer,
}: {
  title: string
  onAnswer: (attended: boolean) => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  function answer(attended: boolean) {
    setBusy(true)
    onAnswer(attended)
  }

  const button: React.CSSProperties = {
    flex: 1, padding: '14px', borderRadius: 999, fontSize: 16, fontWeight: 800,
    border: `2.5px solid ${INK}`, cursor: busy ? 'default' : 'pointer',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 320,
      background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
        padding: '28px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
        animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
      }}>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('attendance.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('attendance.question', { title })}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => answer(false)} disabled={busy}
            style={{ ...button, background: '#fff', color: C.ink }}>
            {t('attendance.no')}
          </button>
          <button onClick={() => answer(true)} disabled={busy}
            style={{ ...button, background: C.primary, color: '#fff' }}>
            {t('attendance.yes')}
          </button>
        </div>
      </div>
    </div>
  )
}
