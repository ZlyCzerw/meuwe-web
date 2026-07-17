import { useEffect, useState } from 'react'

// Compass heading in degrees (0 = north, clockwise), or null when the device
// has no orientation sensor / permission was denied. Used to point the "me"
// marker's direction indicator.
//
// Sources, in order of preference:
//   - iOS: `deviceorientation` + `event.webkitCompassHeading` (already 0=N, CW)
//   - Android/others: `deviceorientationabsolute` + `event.alpha` (0=N, CCW → 360-alpha)
// iOS 13+ (Safari and Capacitor WKWebView) gates the sensor behind
// DeviceOrientationEvent.requestPermission(), which must be called from a user
// gesture — so we request it lazily on the first pointerdown.

type OrientationEventiOS = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }
type PermissionCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export function useDeviceHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return

    let removed = false
    // Drop the heading (→ plain marker) if valid readings stop arriving, so a
    // stale angle never lingers after the sensor goes quiet.
    let staleTimer: ReturnType<typeof setTimeout> | null = null
    const STALE_MS = 3000

    const onOrient = (e: DeviceOrientationEvent) => {
      const ios = e as OrientationEventiOS
      let h: number | null = null
      if (typeof ios.webkitCompassHeading === 'number' && !Number.isNaN(ios.webkitCompassHeading)) {
        // iOS: only trust the heading when the compass reports a valid accuracy
        // (webkitCompassAccuracy < 0 means uncalibrated / no fix).
        if (ios.webkitCompassAccuracy == null || ios.webkitCompassAccuracy >= 0) h = ios.webkitCompassHeading
      } else if (e.absolute && typeof e.alpha === 'number') {
        // Others: only absolute (north-referenced) orientation is usable.
        h = 360 - e.alpha
      }
      if (h == null) return
      setHeading(((h % 360) + 360) % 360)
      if (staleTimer) clearTimeout(staleTimer)
      staleTimer = setTimeout(() => { if (!removed) setHeading(null) }, STALE_MS)
    }

    const attach = () => {
      window.addEventListener('deviceorientationabsolute', onOrient as EventListener)
      window.addEventListener('deviceorientation', onOrient as EventListener)
    }
    const detach = () => {
      if (staleTimer) { clearTimeout(staleTimer); staleTimer = null }
      window.removeEventListener('deviceorientationabsolute', onOrient as EventListener)
      window.removeEventListener('deviceorientation', onOrient as EventListener)
    }

    const ctor = window.DeviceOrientationEvent as PermissionCtor
    if (typeof ctor.requestPermission === 'function') {
      // iOS: must ask from a user gesture. Wire a one-shot pointer handler.
      const ask = () => {
        window.removeEventListener('pointerdown', ask)
        ctor.requestPermission!()
          .then(res => { if (!removed && res === 'granted') attach() })
          .catch(() => {})
      }
      window.addEventListener('pointerdown', ask, { once: true })
      return () => { removed = true; window.removeEventListener('pointerdown', ask); detach() }
    }

    // Android / others: no permission gate.
    attach()
    return () => { removed = true; detach() }
  }, [enabled])

  return heading
}
