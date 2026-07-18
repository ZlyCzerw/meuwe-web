import { useEffect, useState } from 'react'
import OrganicBlob from './OrganicBlob'
import BlobFace from './BlobFace'
import ConfettiBurst from './ConfettiBurst'
import { C } from '../lib/tokens'

// Native launch splash: on a cream→pink gradient (matching the native LaunchScreen/splash
// on both iOS and Android so the hand-off is seamless) the green smiley blob pops in —
// growing with an overshoot and a little bounce — while confetti bursts, then the whole
// thing fades out to reveal the app.
export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const [confetti, setConfetti] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Order: empty orange → confetti bursts → the smiley pops in.
    const timers = [
      setTimeout(() => setConfetti(true), 180),        // confetti first, on empty orange
      setTimeout(() => setConfetti(false), 180 + 850),
      setTimeout(() => setLeaving(true), 1780),         // start fade-out
      setTimeout(onDone, 2180),                         // reveal the app
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const size = 168

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      // Same gradient as the Welcome screen, so the splash flows straight into it.
      background: `linear-gradient(180deg,${C.cream} 0%,#FFF1E0 40%,#FFE8DC 75%,#FFE0E8 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: leaving ? 0 : 1,
      transition: 'opacity 400ms ease',
    }}>
      {/* animationDelay + `both` keeps the blob at scale(0) (nothing on screen) until the
          confetti has burst, then it pops in growing with a bounce. */}
      <div style={{ animation: 'splashBlobPop 900ms ease-out 520ms both', transformOrigin: 'center' }}>
        <OrganicBlob size={size} color={C.grass} idx={0} face={<BlobFace size={size * 0.5} />} />
      </div>
      <ConfettiBurst visible={confetti} scale={2} />
      <style>{`
        @keyframes splashBlobPop {
          0%   { transform: scale(0)    translateY(0); }
          55%  { transform: scale(1.12) translateY(-12px); }
          72%  { transform: scale(0.94) translateY(0); }
          85%  { transform: scale(1.05) translateY(-6px); }
          100% { transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  )
}
