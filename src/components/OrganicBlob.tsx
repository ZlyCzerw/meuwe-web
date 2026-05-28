import React from 'react';
import { C, INK, BLOBS } from '../lib/tokens';

export default function OrganicBlob({
  size = 60,
  color = C.primary,
  idx = 0,
  face,
  animated = false,
}: {
  size?: number;
  color?: string;
  idx?: number;
  face?: React.ReactNode;
  animated?: boolean;
}) {
  const path = BLOBS[idx % BLOBS.length];
  const sw = size <= 28 ? 4 : size <= 44 ? 4.5 : 5;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="-3 -3 106 106"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          filter: `drop-shadow(0 3px 0 ${INK}22)`,
          ...(animated
            ? { animation: 'blobPulse 3s ease-in-out infinite', transformOrigin: 'center' }
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
          }}
        >
          {face}
        </div>
      )}
    </div>
  );
}
