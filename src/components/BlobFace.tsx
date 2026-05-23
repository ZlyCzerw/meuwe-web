import { INK } from '../lib/tokens';

export default function BlobFace({ size = 28, mood = 'happy' }: { size?: number; mood?: 'happy' | 'sleepy' }) {
  const eyeY = mood === 'sleepy' ? 11 : 10;
  const eyes =
    mood === 'sleepy' ? (
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
      <path d="M11 18 q7 6 14 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
