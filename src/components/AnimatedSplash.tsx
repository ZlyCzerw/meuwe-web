import { useEffect, useState } from 'react'
import OrganicBlob from './OrganicBlob'
import BlobFace from './BlobFace'
import ConfettiBurst from './ConfettiBurst'
import { C } from '../lib/tokens'

// Native launch splash: on an orange field (matching the static iOS LaunchScreen so the
// hand-off is seamless) the green smiley blob pops in — growing with an overshoot and a
// little bounce — while confetti bursts, then the whole thing fades out to reveal the app.
export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const [confetti, setConfetti] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timers = [
      setTimeout(() => setConfetti(true), 340),   // fire as the blob pops
      setTimeout(() => setConfetti(false), 340 + 850),
      setTimeout(() => setLeaving(true), 1550),    // start fade-out
      setTimeout(onDone, 1950),                    // reveal the app
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const size = 168

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: C.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: leaving ? 0 : 1,
      transition: 'opacity 400ms ease',
    }}>
      <div style={{ animation: 'splashBlobPop 900ms ease-out both', transformOrigin: 'center' }}>
        <OrganicBlob size={size} color={C.grass} idx={0} face={<BlobFace size={size * 0.5} />} />
      </div>
      <ConfettiBurst visible={confetti} />
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
