import { useState, useEffect } from 'react';
import { C, INK, BLOBS } from '../lib/tokens';

export default function AddButton({
  size = 76,
  onClick,
  active = true,
}: {
  size?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const [blobIdx, setBlobIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBlobIdx((i) => (i + 1) % BLOBS.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      style={{
        position: 'relative',
        width: size * 1.5,
        height: size * 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: size * 1.15,
          height: size * 1.15,
          borderRadius: '50%',
          border: `3px solid ${C.primary}`,
          opacity: active ? 0.22 : 0,
          animation: active ? 'halo 3.4s ease-out infinite' : 'none',
        }}
      />
      <button
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          position: 'relative',
          width: size,
          height: size,
          transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
          transform: pressed ? 'scale(0.92)' : 'scale(1)',
          animation: active ? 'breathe 3s ease-in-out infinite' : 'none',
        }}
      >
        <svg
          width={size * 1.12}
          height={size * 1.12}
          viewBox="-3 -3 106 106"
          style={{
            position: 'absolute',
            left: -size * 0.06,
            top: -size * 0.06,
            overflow: 'visible',
            filter: `drop-shadow(0 5px 0 ${INK}44)`,
            transition: 'all 1.6s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <path
            d={BLOBS[blobIdx]}
            fill={C.primary}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
            style={{ transition: 'd 1.6s cubic-bezier(0.4,0,0.2,1)' } as React.CSSProperties}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 40 40">
            <path
              d="M20 7 L20.7 19.2 L31.5 19 C32 19 32.5 19.5 32.5 20 C32.5 20.5 32 21 31.5 21 L20.7 20.8 L21 31.6 C21 32.2 20.5 32.6 20 32.6 C19.5 32.6 19 32.2 19 31.6 L19.3 20.8 L8.4 21 C7.9 21 7.5 20.5 7.5 20 C7.5 19.5 7.9 19 8.4 19 L19.3 19.2 L19 8 C19 7.5 19.5 7 20 7 Z"
              fill="#fff"
            />
          </svg>
        </div>
      </button>
    </div>
  );
}
