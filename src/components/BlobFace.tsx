import { INK } from '../lib/tokens';

export type BlobMood = 'happy' | 'sleepy' | 'surprised' | 'startled';

/**
 * `look`: kierunek spojrzenia dla miny „startled" (−1…1 w obu osiach) — źrenice
 * wielkich oczu przesuwają się w stronę palca, który trzyma bloba.
 */
export default function BlobFace({ size = 28, mood = 'happy', look }: { size?: number; mood?: BlobMood; look?: { x: number; y: number } }) {
  const eyeY = mood === 'sleepy' ? 11 : 10;
  const lx = (look?.x ?? 0) * 1.7;
  const ly = (look?.y ?? 0) * 1.7;
  const eyes =
    mood === 'startled' ? (
      <>
        <ellipse cx="12" cy="10" rx="4.6" ry="5.4" fill="#fff" stroke={INK} strokeWidth="1.6" />
        <ellipse cx="24" cy="10" rx="4.6" ry="5.4" fill="#fff" stroke={INK} strokeWidth="1.6" />
        <ellipse cx={12 + lx} cy={10 + ly} rx="2.2" ry="2.7" fill={INK} />
        <ellipse cx={24 + lx} cy={10 + ly} rx="2.2" ry="2.7" fill={INK} />
      </>
    ) : mood === 'sleepy' ? (
      <>
        <path d={`M9 ${eyeY} q3 -2 6 0`} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d={`M21 ${eyeY} q3 -2 6 0`} stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse cx="13" cy={eyeY} rx="1.9" ry="2.4" fill={INK} />
        <ellipse cx="23" cy={eyeY} rx="1.9" ry="2.4" fill={INK} />
      </>
    );
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 36 28" style={{ display: 'block' }}>
      {eyes}
      {mood === 'surprised' || mood === 'startled'
        // Otwarta buzia do „blee" — blob właśnie wylądował pod palcem.
        ? <ellipse cx="18" cy={mood === 'startled' ? 21 : 19} rx="3.2" ry="4.2" fill={INK} />
        : <path d="M11 18 q7 6 14 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
