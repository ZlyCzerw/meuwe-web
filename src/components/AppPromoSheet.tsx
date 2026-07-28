import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import DragHandle from './DragHandle'
import StoreBadge from './StoreBadge'
import type { StoreOs } from '../lib/stores'

// Bottom sheet nudging a mobile web visitor towards the app. Deliberately has
// no backdrop: the map underneath stays visible and usable, so this can never
// trap anyone. Dismissed by swiping it down or by the close button.

export default function AppPromoSheet({ os, onClose }: { os: StoreOs; onClose: () => void }) {
  const { t } = useTranslation()
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) setDragY(dy)
  }
  function onTouchEnd() {
    startY.current = null
    if (dragY > 70) onClose()
    else setDragY(0)
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 240,
        background: C.cream,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        border: `2.5px solid ${INK}`, borderBottom: 'none',
        boxShadow: '0 -8px 32px rgba(45,43,42,0.18)',
        padding: '0 20px calc(20px + env(safe-area-inset-bottom))',
        transform: `translateY(${dragY}px)`,
        transition: dragY ? 'none' : 'transform 260ms cubic-bezier(0.34,1.56,0.64,1)',
        animation: 'bubble-up 300ms cubic-bezier(0.32,1.4,0.4,1)',
      }}
    >
      <DragHandle />

      <button
        onClick={onClose}
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
        {t('appPromo.title')}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginTop: 6 }}>
        {t('appPromo.body')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <StoreBadge os={os} onNavigate={onClose} />
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', padding: '10px 4px',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('appPromo.later')}
        </button>
      </div>
    </div>
  )
}
