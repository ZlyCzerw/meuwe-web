import { useTranslation } from 'react-i18next'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import { C, INK, F } from '../lib/tokens'
import { useBlobPhysics } from '../hooks/useBlobPhysics'

export default function Welcome({ onSignIn }: { onSignIn: (mode: 'google' | 'skip') => void }) {
  const { t } = useTranslation()
  const blobs = useBlobPhysics(6)

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: `linear-gradient(180deg,${C.cream} 0%,#FFF1E0 40%,#FFE8DC 75%,#FFE0E8 100%)`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Physics blobs — behind all UI (zIndex 0) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {blobs.map(b => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - b.size / 2,
              top: b.y - b.size / 2,
            }}
          >
            <OrganicBlob
              size={b.size}
              color={b.color}
              idx={b.blobIdx}
              animated
              face={<BlobFace size={b.size * 0.55} />}
            />
          </div>
        ))}
      </div>

      {/* Logo + tagline */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', position: 'relative', zIndex: 1,
      }}>
        <div style={{
          fontFamily: F.display, fontWeight: 900, fontSize: 88,
          lineHeight: 0.95, letterSpacing: -3, display: 'flex', alignItems: 'baseline',
        }}>
          <span style={{ color: C.primary, animation: 'breathe-sm 3.2s 0s ease-in-out infinite', display: 'inline-block', transformOrigin: 'center bottom' }}>me</span>
          <span style={{ color: C.sky,     animation: 'breathe-sm 3.2s 0.6s ease-in-out infinite', display: 'inline-block', transformOrigin: 'center bottom' }}>u</span>
          <span style={{ color: C.grass,   animation: 'breathe-sm 3.2s 1.2s ease-in-out infinite', display: 'inline-block', transformOrigin: 'center bottom' }}>we</span>
        </div>
        <div style={{
          marginTop: 16, fontFamily: F.body, fontSize: 17, fontWeight: 600,
          color: C.ink, opacity: 0.7, textAlign: 'center', maxWidth: 280, lineHeight: 1.4,
          whiteSpace: 'pre-line',
        }}>
          {t('welcome.tagline')}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '0 24px 52px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => onSignIn('google')}
          style={{
            width: '100%', padding: '16px 24px', borderRadius: 999,
            background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 16, fontWeight: 700, color: C.ink,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4C13 4 4 13 4 24s9 20 20 20s20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.5 2.4c-5.2 0-9.6-3.3-11.3-8L6.1 32.8C9.4 39.5 16.1 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5c-.5.4 7.4-5.4 7.4-15.2c0-1.3-.1-2.6-.4-3.9z" />
          </svg>
          {t('welcome.google')}
        </button>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
          {t('welcome.terms')}
        </div>
        <button
          onClick={() => onSignIn('skip')}
          style={{
            marginTop: 12, width: '100%', padding: '12px',
            fontSize: 14, color: C.inkSoft, fontWeight: 700, textAlign: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          {t('welcome.skip')}
        </button>
      </div>
    </div>
  )
}
