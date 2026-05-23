import { C } from '../lib/tokens'

const BITS = [
  { color: C.primary,   dx: -36, dy: -50, r: 8,  dur: 700 },
  { color: C.grass,     dx:  24, dy: -54, r: 6,  dur: 800 },
  { color: C.berry,     dx: -10, dy: -64, r: 5,  dur: 750 },
  { color: C.sunshine,  dx:  40, dy: -38, r: 9,  dur: 720 },
  { color: C.sky,       dx: -50, dy: -28, r: 6,  dur: 680 },
  { color: C.primary,   dx:  10, dy: -76, r: 4,  dur: 760 },
]

export default function ConfettiBurst({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{ position: 'fixed', left: '50%', top: '50%', pointerEvents: 'none', zIndex: 200 }}>
      {BITS.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: '50%',
            background: b.color,
            left: 0,
            top: 0,
            animation: `confetti-bit-${i} ${b.dur}ms ease-out forwards`,
          }}
        />
      ))}
      <style>{BITS.map((b, i) => `
        @keyframes confetti-bit-${i} {
          0%   { transform: translate(0,0) scale(0); opacity: 1; }
          30%  { transform: translate(${b.dx * 0.6}px,${b.dy * 0.6}px) scale(1.1); opacity: 1; }
          100% { transform: translate(${b.dx}px,${b.dy + 80}px) scale(0.6); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  )
}
