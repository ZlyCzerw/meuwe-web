import { C } from '../../lib/tokens'

export type PhoneVariant = 'map' | 'event' | 'create'

function Pin({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: 26, height: 26, borderRadius: '50% 50% 50% 0',
      transform: 'translate(-50%,-100%) rotate(-45deg)',
      background: color, border: '2px solid #2D2B2A',
      boxShadow: '2px 2px 0 #2D2B2A',
    }} />
  )
}

function MapScreen() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#D4EDDA', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(45,43,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,43,42,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      {/* Roads suggestion */}
      <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.7)' }} />
      <div style={{ position: 'absolute', top: '55%', left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.7)' }} />
      <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 3, background: 'rgba(255,255,255,0.7)' }} />
      {/* Pins */}
      <Pin x={90}  y={200} color={C.primary} />
      <Pin x={155} y={155} color={C.sky} />
      <Pin x={60}  y={310} color={C.grass} />
      <Pin x={200} y={270} color={C.primary} />
      <Pin x={130} y={340} color={C.sky} />
      {/* Search bar */}
      <div style={{
        position: 'absolute', top: 52, left: 14, right: 14,
        background: '#fff', borderRadius: 14, padding: '10px 14px',
        border: '2px solid #2D2B2A', boxShadow: '3px 3px 0 #2D2B2A',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14, opacity: 0.4 }}>🔍</span>
        <span style={{ fontSize: 12, color: '#8A8580', fontFamily: '"Nunito"', fontWeight: 600 }}>Szukaj miejsca…</span>
      </div>
      {/* Category chips */}
      <div style={{
        position: 'absolute', bottom: 80, left: 10, right: 10,
        display: 'flex', gap: 6, overflowX: 'hidden',
      }}>
        {[
          { label: 'impreza', color: '#E91E6328' },
          { label: 'piknik',  color: '#7DD87A28' },
          { label: 'sport',   color: '#FF7A4528' },
        ].map(ch => (
          <div key={ch.label} style={{
            background: ch.color, borderRadius: 999, padding: '5px 11px',
            fontSize: 11, fontFamily: '"Nunito"', fontWeight: 700,
            color: '#2D2B2A', border: '1.5px solid #2D2B2A22', whiteSpace: 'nowrap',
          }}>{ch.label}</div>
        ))}
      </div>
      {/* Add button */}
      <div style={{
        position: 'absolute', bottom: 20, right: 16,
        width: 44, height: 44, borderRadius: '50%',
        background: C.primary, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 700,
        border: '2.5px solid #2D2B2A', boxShadow: '3px 3px 0 #2D2B2A',
      }}>+</div>
    </div>
  )
}

function EventScreen() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#D4EDDA', position: 'relative', overflow: 'hidden' }}>
      {/* Map bg */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(45,43,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,43,42,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.6)' }} />
      <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 3, background: 'rgba(255,255,255,0.6)' }} />
      <Pin x={140} y={190} color={C.primary} />
      {/* Event card sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
        background: '#fff', borderRadius: '20px 20px 0 0',
        border: '2px solid #2D2B2A', borderBottom: 'none',
        boxShadow: '0 -4px 0 #2D2B2A22',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Drag handle */}
        <div style={{ width: 32, height: 4, borderRadius: 2, background: '#2D2B2A22', margin: '0 auto 4px' }} />
        {/* Category badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: `${C.primary}22`, color: C.primary, borderRadius: 999,
            padding: '3px 10px', fontSize: 10, fontFamily: '"Nunito"', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>PIKNIK</span>
          <span style={{ fontSize: 10, color: '#8A8580', fontFamily: '"Nunito"', fontWeight: 600 }}>Dziś, 16:00</span>
        </div>
        {/* Title */}
        <div style={{ fontFamily: '"Hanken Grotesk"', fontWeight: 900, fontSize: 16, color: '#2D2B2A', lineHeight: 1.2 }}>
          Letni piknik<br/>w parku
        </div>
        {/* Location */}
        <div style={{ fontSize: 11, color: '#8A8580', fontFamily: '"Nunito"', fontWeight: 600 }}>
          📍 Park Centralny · 350 m
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div style={{
            flex: 1, background: C.primary, color: '#fff', borderRadius: 999,
            padding: '9px 0', textAlign: 'center',
            fontFamily: '"Nunito"', fontWeight: 800, fontSize: 13,
            border: `2px solid #2D2B2A`, boxShadow: `2px 2px 0 #2D2B2A`,
          }}>Obserwuj</div>
          <div style={{
            flex: 1, background: '#fff', color: '#2D2B2A', borderRadius: 999,
            padding: '9px 0', textAlign: 'center',
            fontFamily: '"Nunito"', fontWeight: 800, fontSize: 13,
            border: `2px solid #2D2B2A`,
          }}>Czat</div>
        </div>
        {/* Followers */}
        <div style={{ fontSize: 11, color: '#8A8580', fontFamily: '"Nunito"', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>👥</span><span>12 obserwuje</span>
        </div>
      </div>
    </div>
  )
}

function CreateScreen() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#D4EDDA', position: 'relative', overflow: 'hidden' }}>
      {/* Map bg */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(45,43,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,43,42,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      {/* Dim overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(45,43,42,0.3)' }} />
      {/* Create sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '68%',
        background: '#FFF6EC', borderRadius: '20px 20px 0 0',
        border: '2px solid #2D2B2A', borderBottom: 'none',
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ width: 32, height: 4, borderRadius: 2, background: '#2D2B2A22', margin: '0 auto 4px' }} />
        <div style={{ fontFamily: '"Hanken Grotesk"', fontWeight: 900, fontSize: 14, color: '#2D2B2A' }}>
          Nowe wydarzenie
        </div>
        {/* Title input */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '10px 12px',
          border: '2px solid #2D2B2A', boxShadow: '2px 2px 0 #2D2B2A22',
        }}>
          <div style={{ fontSize: 10, color: '#8A8580', fontFamily: '"Nunito"', fontWeight: 700, marginBottom: 3 }}>TYTUŁ</div>
          <div style={{ fontSize: 13, color: '#2D2B2A', fontFamily: '"Nunito"', fontWeight: 600 }}>Piknik o zachodzie słońca</div>
        </div>
        {/* Tags */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['piknik', 'outdoor', 'rodzinne'].map(tag => (
            <div key={tag} style={{
              background: `${C.primary}18`, color: C.primary, borderRadius: 999,
              padding: '4px 10px', fontSize: 11,
              fontFamily: '"Nunito"', fontWeight: 700,
              border: `1.5px solid ${C.primary}44`,
            }}>{tag}</div>
          ))}
        </div>
        {/* Location */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '8px 12px',
          border: '2px solid #2D2B2A22',
          fontSize: 12, color: '#5C564E', fontFamily: '"Nunito"', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>📍</span><span>Moja lokalizacja</span>
        </div>
        {/* Submit */}
        <div style={{
          background: C.primary, color: '#fff', borderRadius: 999,
          padding: '11px 0', textAlign: 'center',
          fontFamily: '"Nunito"', fontWeight: 800, fontSize: 14,
          border: `2px solid #2D2B2A`, boxShadow: `3px 3px 0 #2D2B2A`,
          marginTop: 'auto',
        }}>Dodaj wydarzenie</div>
      </div>
    </div>
  )
}

export function PhoneFrame({ variant, screenshot, alt }: { variant: PhoneVariant; screenshot?: string; alt?: string }) {
  return (
    <div className="lp-phone-frame" style={{
      width: 325, height: 655,
      borderRadius: 45,
      border: '3px solid #2D2B2A',
      boxShadow: '10px 10px 0 #2D2B2A',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      background: '#fff',
    }}>
      {/* Notch */}
      <div className="lp-phone-notch" style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 90, height: 28,
        background: '#2D2B2A',
        borderRadius: '0 0 18px 18px',
        zIndex: 10,
      }} />
      {screenshot
        ? <img src={screenshot} alt={alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        : variant === 'map'    ? <MapScreen />
        : variant === 'event'  ? <EventScreen />
        : <CreateScreen />
      }
    </div>
  )
}
