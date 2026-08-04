import { C } from '../lib/tokens'

// The one radius control. Lives here rather than in ProfilePanel because the
// onboarding step asks the same question, and two copies of a styled range
// input drift apart the first time either is touched.
//
// The real <input type="range"> is transparent and stretched over the drawn
// track: the browser keeps the keyboard and touch behaviour, we keep the look.

export const RADIUS_MIN_KM = 1
export const RADIUS_MAX_KM = 50

export default function RadiusSlider({
  value,
  onChange,
  onCommit,
  label,
}: {
  value: number
  onChange: (km: number) => void
  /** Fired on release only — callers use it to write, not on every drag frame. */
  onCommit?: (km: number) => void
  label: string
}) {
  const pct = ((value - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM)) * 100

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: '"Hanken Grotesk","Nunito",sans-serif', fontSize: 17, fontWeight: 800, color: C.ink }}>
          {label}
        </div>
        <div style={{ fontFamily: '"Hanken Grotesk","Nunito",sans-serif', fontSize: 20, fontWeight: 900, color: C.primary }}>
          {value} km
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 16, height: 36 }}>
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 6, borderRadius: 999, background: '#EFE4D2' }} />
        <div style={{ position: 'absolute', top: 16, left: 0, height: 6, borderRadius: 999, background: C.primary, width: `${pct}%` }} />
        <input
          type="range" min={RADIUS_MIN_KM} max={RADIUS_MAX_KM} value={value}
          aria-label={label}
          onChange={e => onChange(Number(e.target.value))}
          onPointerUp={e => onCommit?.(Number((e.target as HTMLInputElement).value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }}
        />
        <div style={{
          position: 'absolute', top: 6, left: `calc(${pct}% - 13px)`,
          width: 26, height: 26, borderRadius: '50%', background: '#fff',
          border: `3px solid ${C.primary}`, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', pointerEvents: 'none',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 4 }}>
        <span>{RADIUS_MIN_KM} km</span>
        <span>{RADIUS_MAX_KM} km</span>
      </div>
    </div>
  )
}
