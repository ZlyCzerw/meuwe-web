import { useTranslation } from 'react-i18next'
import { C, INK, F, BLOBS } from '../lib/tokens'

// Cluster of three distinct meuwe blob pins (different shapes + colours) used as
// the modal's illustration — same blob recipe as the map markers (mapIcons.ts).
const CLUSTER = [
  { path: BLOBS[0], color: C.berry, size: 38, rot: -12, dy: 4 },
  { path: BLOBS[1], color: C.sky, size: 48, rot: 3, dy: 0 },
  { path: BLOBS[2], color: C.grass, size: 38, rot: 13, dy: 4 },
]

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 4, marginBottom: 10, height: 52 }}>
          {CLUSTER.map((b, i) => (
            <svg
              key={i}
              width={b.size}
              height={b.size}
              viewBox="-3 -3 106 106"
              style={{
                overflow: 'visible',
                transform: `translateY(${b.dy}px) rotate(${b.rot}deg)`,
                filter: 'drop-shadow(0 3px 0 #2D2B2A22)',
              }}
            >
              <path d={b.path} fill={b.color} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            </svg>
          ))}
        </div>
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
