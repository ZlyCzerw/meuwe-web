import { C } from '../lib/tokens';

export default function Toast({ visible, label }: { visible: boolean; label: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 120,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px) scale(${visible ? 1 : 0.9})`,
        opacity: visible ? 1 : 0,
        transition: 'all 320ms cubic-bezier(0.34,1.56,0.64,1)',
        background: C.ink,
        color: '#fff',
        padding: '10px 18px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        boxShadow: '0 8px 32px rgba(45,43,42,0.18)',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    >
      {label}
    </div>
  );
}
