import React from 'react';
import { C, INK, BLOBS } from '../lib/tokens';

// Rączki i nóżki trzymanego bloba, w jednostkach viewBoxa ciała (0–100).
// Rączki krótkie, rozłożone szeroko, z trzema palcami. Nóżki w kształcie L:
// pionowa nóżka i pozioma stópka skierowana na zewnątrz. Wysuwają się
// skalowaniem od zaczepu, więc wyglądają, jakby wyrastały z bloba.
type Limb = { ox: number; oy: number; ex: number; ey: number; kind: 'hand' | 'foot' }
const LIMBS: Limb[] = [
  { ox: 12, oy: 50, ex: -9, ey: 38, kind: 'hand' },   // lewa rączka
  { ox: 88, oy: 50, ex: 109, ey: 38, kind: 'hand' },  // prawa rączka
  { ox: 36, oy: 88, ex: 36, ey: 108, kind: 'foot' },  // lewa nóżka
  { ox: 64, oy: 88, ex: 64, ey: 108, kind: 'foot' },  // prawa nóżka
];

const FINGER_LEN = 10;
const FINGER_SPREAD = (32 * Math.PI) / 180;
const FOOT_LEN = 10;

function LimbTip({ l }: { l: Limb }) {
  if (l.kind === 'hand') {
    const dir = Math.atan2(l.ey - l.oy, l.ex - l.ox);
    return (
      <>
        {[-1, 0, 1].map(k => {
          const a = dir + k * FINGER_SPREAD;
          return (
            <line key={k} x1={l.ex} y1={l.ey}
              x2={l.ex + Math.cos(a) * FINGER_LEN} y2={l.ey + Math.sin(a) * FINGER_LEN}
              stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
          );
        })}
      </>
    );
  }
  // Stópka: pozioma kreska od pięty na zewnątrz ciała.
  const outward = l.ox < 50 ? -1 : 1;
  return (
    <line x1={l.ex} y1={l.ey} x2={l.ex + outward * FOOT_LEN} y2={l.ey}
      stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
  );
}

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
            <line x1={l.ox} y1={l.oy} x2={l.ex} y2={l.ey} stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
            <LimbTip l={l} />
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
