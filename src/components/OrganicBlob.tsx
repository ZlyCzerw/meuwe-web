import React from 'react';
import { C, INK, BLOBS } from '../lib/tokens';

// Rączki i nóżki trzymanego bloba: punkt zaczepienia na brzegu ciała i koniec
// kończyny, w jednostkach viewBoxa ciała (0–100). Wysuwają się skalowaniem od
// zaczepu, więc wyglądają, jakby wyrastały z bloba, a nie pojawiały znikąd.
const LIMBS: { ox: number; oy: number; ex: number; ey: number }[] = [
  { ox: 12, oy: 50, ex: -30, ey: 26 },  // lewa rączka
  { ox: 88, oy: 50, ex: 130, ey: 26 },  // prawa rączka
  { ox: 36, oy: 88, ex: 16, ey: 130 },  // lewa nóżka
  { ox: 64, oy: 88, ex: 84, ey: 130 },  // prawa nóżka
];

const LIMB_EASE = 'cubic-bezier(.34,1.56,.64,1)';

export default function OrganicBlob({
  size = 60,
  color = C.primary,
  idx = 0,
  face,
  animated = false,
  held = false,
}: {
  size?: number;
  color?: string;
  idx?: number;
  face?: React.ReactNode;
  animated?: boolean;
  /** Pod palcem: rozpłaszczony, z rozłożonymi szeroko rączkami i nóżkami. */
  held?: boolean;
}) {
  const path = BLOBS[idx % BLOBS.length];
  // Obrys skaluje się razem z ciałem, więc duży blob (po zlaniu) dostaje cieńszą
  // kreskę w jednostkach viewBoxa, żeby na ekranie wyszła podobna do małych.
  const sw = size <= 28 ? 4 : size <= 44 ? 4.5 : size <= 80 ? 5 : Math.max(2.5, 5 * 72 / size);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="-3 -3 106 106"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        {LIMBS.map((l, i) => (
          <g
            key={i}
            style={{
              transform: `translate(${l.ox}px, ${l.oy}px) scale(${held ? 1 : 0}) translate(${-l.ox}px, ${-l.oy}px)`,
              transition: `transform 180ms ${held ? LIMB_EASE : 'ease-in'}`,
            }}
          >
            <line x1={l.ox} y1={l.oy} x2={l.ex} y2={l.ey} stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <circle cx={l.ex} cy={l.ey} r={5.5} fill={INK} />
          </g>
        ))}
      </svg>
      <svg
        width={size}
        height={size}
        viewBox="-3 -3 106 106"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          filter: `drop-shadow(0 3px 0 ${INK}22)`,
          transformOrigin: 'center',
          transition: 'transform 150ms ease-out',
          ...(held
            ? { transform: 'scale(1.25, 0.8)' }
            : animated
              ? { animation: 'blobPulse 3s ease-in-out infinite' }
              : {}),
        }}
      >
        <path d={path} fill={color} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
      {face && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'center',
            transition: 'transform 150ms ease-out',
            transform: held ? 'scale(1.25, 0.8)' : 'none',
          }}
        >
          {face}
        </div>
      )}
    </div>
  );
}
