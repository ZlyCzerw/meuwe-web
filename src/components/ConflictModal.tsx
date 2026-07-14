import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'

// Meuwe-styled alert: dimmed backdrop + centred card. Shown when a pin's 3x3 m
// exclusivity zone overlaps an existing public pin during an overlapping window.
export default function ConflictModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
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
        <div style={{ fontSize: 44, marginBottom: 8 }}>📍</div>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('conflict.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('conflict.body')}
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(255,122,69,0.35)',
          }}
        >
          {t('conflict.ok')}
        </button>
      </div>
    </div>
  )
}
