import { useTranslation } from 'react-i18next'
import { C, BLOBS, TAG_META } from '../../../lib/tokens'
import '../landing.css'

const BLOB = BLOBS[0]

function AppPin({ color, glyph, size = 44 }: { color: string; glyph: string; size?: number }) {
  const dot = Math.round(size * 0.27)
  return (
    <div style={{ position: 'relative', width: size, height: Math.round(size * 1.27), flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="-3 -3 106 106" style={{ overflow: 'visible', filter: 'drop-shadow(0 3px 0 #2D2B2A22)', display: 'block' }}>
        <path d={BLOB} fill={color} stroke="#2D2B2A" strokeWidth="5" strokeLinejoin="round" />
      </svg>
      <div
        style={{ position: 'absolute', top: Math.round(size * 0.22), left: 0, width: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.42), pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: glyph }}
      />
      <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: dot, height: dot, borderRadius: '50%', background: color, border: `2px solid #2D2B2A` }} />
    </div>
  )
}

function PrivatePin({ size = 56 }: { size?: number }) {
  const dot = Math.round(size * 0.27)
  return (
    <div style={{ position: 'relative', width: size, height: Math.round(size * 1.27), flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="-3 -3 106 106" style={{ overflow: 'visible', filter: 'drop-shadow(0 5px 0 #2D2B2A44)', display: 'block' }}>
        <path d={BLOB} fill="white" stroke="#2D2B2A" strokeWidth="5" strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', top: Math.round(size * 0.25), left: 0, width: size, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <svg width={Math.round(size * 0.65)} height={Math.round(size * 0.54)} viewBox="0 0 26 22" fill="none">
          <ellipse cx="7.5" cy="7" rx="6" ry="5" fill="#2D2B2A" />
          <ellipse cx="18.5" cy="7" rx="6" ry="5" fill="#2D2B2A" />
          <rect x="11" y="3" width="4" height="8" fill="#2D2B2A" />
          <ellipse cx="7.5" cy="7" rx="3" ry="2.5" fill="white" />
          <ellipse cx="18.5" cy="7" rx="3" ry="2.5" fill="white" />
          <path d="M8 18Q13 22 18 18" stroke="#2D2B2A" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: dot, height: dot, borderRadius: '50%', background: 'white', border: `2px solid #2D2B2A` }} />
    </div>
  )
}

const PUBLIC_PINS = [
  { color: TAG_META.party.color,   glyph: TAG_META.party.glyph },
  { color: TAG_META.outdoor.color, glyph: TAG_META.outdoor.glyph },
  { color: TAG_META.music.color,   glyph: TAG_META.music.glyph },
  { color: TAG_META.food.color,    glyph: TAG_META.food.glyph },
  { color: TAG_META.sport.color,   glyph: TAG_META.sport.glyph },
  { color: TAG_META.film.color,    glyph: TAG_META.film.glyph },
  { color: TAG_META.gaming.color,  glyph: TAG_META.gaming.glyph },
]

function PinMap() {
  return (
    <div style={{
      position: 'relative',
      background: '#D4EDDA',
      border: '3px solid #2D2B2A',
      boxShadow: '8px 8px 0 #2D2B2A',
      borderRadius: 24,
      padding: '32px 28px 20px',
      overflow: 'hidden',
      width: '100%',
      maxWidth: 480,
    }}>
      {/* Map grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(45,43,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,43,42,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      {/* Road suggestions */}
      <div style={{ position: 'absolute', top: '45%', left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.6)' }} />
      <div style={{ position: 'absolute', left: '38%', top: 0, bottom: 0, width: 3, background: 'rgba(255,255,255,0.6)' }} />

      {/* Public pins row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20, position: 'relative' }}>
        {PUBLIC_PINS.map((p, i) => (
          <AppPin key={i} color={p.color} glyph={p.glyph} size={44} />
        ))}
      </div>

      {/* Divider label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative',
      }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(45,43,42,0.15)' }} />
        <span style={{
          fontFamily: '"Nunito", system-ui, sans-serif',
          fontWeight: 800, fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(45,43,42,0.4)',
          whiteSpace: 'nowrap',
        }}>vs</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(45,43,42,0.15)' }} />
      </div>

      {/* Private pin — centred, larger, spotlit */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -60%)',
          width: 100, height: 100, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <PrivatePin size={72} />
      </div>
    </div>
  )
}

export function PrivateSection() {
  const { t } = useTranslation()
  return (
    <section className="lp-section" id="prywatne" style={{ background: '#FFF6EC' }}>
      <div className="lp-deco" style={{ width: 380, height: 380, background: C.ink, top: -60, right: -60, opacity: 0.04 }} />
      <div className="lp-deco" style={{ width: 260, height: 260, background: C.primary, bottom: 40, left: 80, opacity: 0.09 }} />

      <div className="lp-section-inner">
        <div className="lp-text-col">
          <span className="lp-eyebrow lp-anim lp-slide-left lp-delay-1">{t('landing.privateEyebrow')}</span>
          <h2 className="lp-h2 lp-anim lp-slide-left lp-delay-2" style={{ whiteSpace: 'pre-line' }}>
            {t('landing.privateTitle')}
          </h2>
          <p className="lp-body lp-anim lp-slide-left lp-delay-3">{t('landing.privateBody')}</p>
        </div>

        <div className="lp-phone-col lp-anim lp-slide-right lp-delay-2">
          <PinMap />
        </div>
      </div>
    </section>
  )
}
