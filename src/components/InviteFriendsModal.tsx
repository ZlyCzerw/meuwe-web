import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F, BLOBS, SHADOW_BUTTON } from '../lib/tokens'
import { db } from '../lib/supabase'
import { shareInvite } from '../lib/invite'

// Offered once, right after the first run finishes. Needs no permission: the
// system share sheet does the work and meuwe never learns who was invited.

const CLUSTER = [
  { path: BLOBS[0], color: C.sky, size: 34, rot: -10, dy: 4 },
  { path: BLOBS[1], color: C.primary, size: 44, rot: 4, dy: 0 },
  { path: BLOBS[2], color: C.grass, size: 34, rot: 12, dy: 4 },
]

export default function InviteFriendsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleInvite() {
    setBusy(true)
    setFailed(false)
    db.trackClick('invite_friends')
    const result = await shareInvite(t('invite.message'))
    setBusy(false)
    if (result === 'shared') { onClose(); return }
    if (result === 'copied') { setCopied(true); setTimeout(onClose, 1600); return }
    if (result === 'failed') { setFailed(true); return }
    // 'dismissed' — the user backed out of the sheet; leave the card as it is.
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 330,
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 4, marginBottom: 12, height: 48 }}>
          {CLUSTER.map((b, i) => (
            <svg key={i} width={b.size} height={b.size} viewBox="-3 -3 106 106"
              style={{
                overflow: 'visible',
                transform: `translateY(${b.dy}px) rotate(${b.rot}deg)`,
                filter: 'drop-shadow(0 3px 0 #2D2B2A22)',
              }}>
              <path d={b.path} fill={b.color} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            </svg>
          ))}
        </div>

        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('invite.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('invite.body')}
        </div>

        {failed && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primaryPress, lineHeight: 1.5, marginBottom: 14 }}>
            {t('invite.failed')}
          </div>
        )}

        <button
          onClick={handleInvite}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: copied ? C.grass : C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
            border: `2.5px solid ${INK}`, boxShadow: SHADOW_BUTTON,
            cursor: busy ? 'default' : 'pointer',
            transition: 'background 200ms ease',
          }}
        >
          {copied ? t('invite.copied') : t('invite.share')}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          style={{
            marginTop: 12, width: '100%', padding: '10px',
            background: 'none', border: 'none',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('invite.later')}
        </button>
      </div>
    </div>
  )
}
