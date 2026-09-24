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
// gesture — so we request it lazily on the first click/touchend.
//
// Czujnik mówi dziesiątki razy na sekundę. Jako stan Reacta każdy odczyt
// re-renderował cały ekran mapy, więc mapa słucha go przez subskrypcję i pisze
// kurs prosto do DOM. Odczyty z jednej klatki zlewają się w jeden.

type OrientationEventiOS = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }
type PermissionCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export function subscribeDeviceHeading(
  onHeading: (deg: number | null) => void,
  schedule: (cb: () => void) => void = cb => { requestAnimationFrame(cb) },
): () => void {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return () => {}

  let removed = false
  // Kompas potrafi milczeć na wiele sposobów (odmowa zgody, brak zdarzeń,
  // zdarzenia bez użytecznego kursu). Bez tych logów strzałka po prostu nie
  // pojawia się i nie ma śladu dlaczego.
  let sawUnusable = false
  let sawAnyEvent = false
  // Drop the heading (→ plain marker) if valid readings stop arriving, so a
  // stale angle never lingers after the sensor goes quiet.
  let staleTimer: ReturnType<typeof setTimeout> | null = null
  const STALE_MS = 3000

  let pending: number | null = null
  let scheduled = false
  const flush = () => {
    scheduled = false
    if (removed || pending == null) return
    const h = pending
    pending = null
    onHeading(h)
  }

  const onOrient = (e: DeviceOrientationEvent) => {
    sawAnyEvent = true
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
    if (h == null) {
      if (!sawUnusable) {
        sawUnusable = true
        console.warn('[heading] orientation event without a usable heading:',
          { webkitCompassHeading: ios.webkitCompassHeading, webkitCompassAccuracy: ios.webkitCompassAccuracy, absolute: e.absolute, alpha: e.alpha })
      }
      return
    }
    pending = ((h % 360) + 360) % 360
    if (!scheduled) { scheduled = true; schedule(flush) }
    if (staleTimer) clearTimeout(staleTimer)
    staleTimer = setTimeout(() => {
      if (removed) return
      pending = null
      onHeading(null)
    }, STALE_MS)
  }

  const attach = () => {
    window.addEventListener('deviceorientationabsolute', onOrient as EventListener)
    window.addEventListener('deviceorientation', onOrient as EventListener)
    // Rozróżnia "czujnik milczy" od "czujnik mówi, ale bez kursu".
    setTimeout(() => {
      if (!removed && !sawAnyEvent) console.warn('[heading] brak zdarzeń orientacji po 5 s od podpięcia')
    }, 5000)
  }
  const detach = () => {
    if (staleTimer) { clearTimeout(staleTimer); staleTimer = null }
    window.removeEventListener('deviceorientationabsolute', onOrient as EventListener)
    window.removeEventListener('deviceorientation', onOrient as EventListener)
  }

  const ctor = window.DeviceOrientationEvent as PermissionCtor
  if (typeof ctor.requestPermission === 'function') {
    // iOS: pytamy z gestu użytkownika, ale WebKit uznaje za gest tylko `click`
    // i `touchend` — `pointerdown` kończył się twardym
    // "NotAllowedError: requires a user gesture to prompt", więc strzałka
    // kursu nie pojawiała się nigdy. Słuchamy w fazie przechwytywania, żeby
    // nie zgubić zdarzenia, które ktoś po drodze zatrzyma (np. Leaflet).
    const gestures = ['click', 'touchend'] as const
    const opts: AddEventListenerOptions = { once: true, capture: true }
    const unbind = () => gestures.forEach(g => window.removeEventListener(g, ask, opts))
    const ask = () => {
      unbind()
      ctor.requestPermission!()
        .then(res => {
          if (removed) return
          if (res === 'granted') attach()
          else console.warn('[heading] odmowa zgody na orientację urządzenia:', res)
        })
        .catch(e => {
          const err = e as { name?: string; message?: string }
          console.warn('[heading] requestPermission odrzucone:',
            err?.name ?? '(bez nazwy)', '|', err?.message ?? String(e),
            '| origin:', location.origin, '| secureContext:', window.isSecureContext)
        })
    }
    gestures.forEach(g => window.addEventListener(g, ask, opts))
    return () => { removed = true; unbind(); detach() }
  }

  // Android / others: no permission gate.
  attach()
  return () => { removed = true; detach() }
}

/** Kurs jako stan Reacta - dla miejsc, które nie odświeżają się co klatkę. */
export function useDeviceHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null)
  useEffect(() => (enabled ? subscribeDeviceHeading(setHeading) : undefined), [enabled])
  return heading
}
