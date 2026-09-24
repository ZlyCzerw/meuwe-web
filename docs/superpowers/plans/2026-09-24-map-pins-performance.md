# Płynność mapy przy wielu pinezkach - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mapa przesuwa się i przybliża płynnie przy ~1500 pinezkach na telefonie, a pinezki wyglądają piksel w piksel jak dziś.

**Architecture:**
- Kurs kompasu przestaje być stanem Reacta i trafia prosto do DOM, najwyżej raz na klatkę.
- Każdy wariant pinezki (blob + narysowany cień + glif) jest jednym gotowym SVG pod stałym URL-em, więc marker to `<img>` i kilka divów zamiast ~15 elementów z `filter: drop-shadow`.
- Na mapie wiszą tylko markery w kadrze z zapasem pół ekranu.
- Klik i z-index nie są przepinane przy każdej zmianie.
- Grupowanie 3×3 m idzie przez siatkę.

**Tech Stack:** React 19, Leaflet 1.9 (`L.divIcon`), Vite, Vitest + jsdom, TypeScript (`npx tsc -b`).

**Spec:** `docs/superpowers/specs/2026-09-24-map-pins-performance-design.md`

## Global Constraints

- Wygląd pinezek, klastrów, prywatnych, halo i skali od interakcji bez widocznych zmian. Sprawdza to strona `pin-compare.html` (Task 4).
- Bez łączenia pinezek przy oddaleniu, bez canvasa, bez zmiany `MAP_EVENT_LIMIT = 1500` i zasięgu pobierania.
- Build sprawdzany przez `npx tsc -b` (nie `--noEmit`), do tego `npm test` i `npm run lint`.
- Nowe teksty UI wyłącznie przez `t('...')` w pl/en/es/de. Ten plan nie dodaje tekstów UI. Strony `src/dev/*` są narzędziami dewelopera i mają polskie napisy na sztywno, jak istniejący `pinPreview.tsx`.
- Commity bez linii `Co-Authored-By`, wiadomości po polsku, pełnym zdaniem, w stylu repo.
- Kod pomiarowy (`?perfPins`, `window.__perf`, `window.__map`) działa tylko pod `import.meta.env.DEV`.
- CSP (`public/_headers`) dopuszcza `img-src blob: data:`. Obrazki pinezek muszą używać jednego z tych schematów.

## Procedura pomiaru

Używana na końcu Task 1 (pomiar wyjściowy) i po Task 2, 4, 5, 6, 7. Wyniki trafiają do tabeli „Pomiary” w specu.

**A. Desktop (wykonawca, Browser pane):**
1. `preview_start` z `{name: "meuwe-web"}`, potem `navigate` na `http://localhost:5173/?perfPins=1500`. Przejdź do ekranu mapy.
2. `javascript_tool`: `__map.setView([52.2297, 21.0122], 8)`, odczekaj 2 s.
3. `javascript_tool`:
   ```js
   const icons = document.querySelectorAll('.leaflet-marker-icon').length
   const nodes = document.querySelectorAll('.leaflet-marker-icon *').length
   const t = __perf.timings.pins ?? []
   ;({ icons, nodesPerPin: +(nodes / icons).toFixed(1), pinsEffectMs: t.slice(-3).map(x => +x.toFixed(1)) })
   ```
4. Powtórz 2-3 dla zoomu 12 (`__map.setZoom(12)`).

**B. Telefon (Wiktor):**
1. Na Macu uruchom `npx vite --host` i zanotuj adres LAN z wyjścia vite.
2. **Android:** Chrome na telefonie, `http://<adres-LAN>:5173/?perfPins=1500`. Na Macu `chrome://inspect` → Inspect → Performance → Record. Gest: pinch-out z 15 do 8, przesunięcie w cztery strony, pinch-in do 12. Stop. Odczytaj z paska Frames średnie fps i liczbę klatek > 50 ms.
3. **iPhone:** Safari, ten sam adres. Na Macu Safari → Programowanie → iPhone → Timelines → nagranie tego samego gestu.
4. W konsoli (telefon trzymany nieruchomo, kompas działa):
   ```js
   const a = __perf.renders.MapScreen; await new Promise(r => setTimeout(r, 10000)); (__perf.renders.MapScreen - a) / 10
   ```
   Wynik to liczba renderów `MapScreen` na sekundę.

Dev build Reacta jest wolniejszy od produkcyjnego. Liczą się różnice między krokami, nie wartości bezwzględne.

## Review Focus

1. **Pinezki w `EventPickerModal`:** inny kontener (kolor, rozmiar tekstu) ma wyglądać jak dziś. Weryfikacja ręczna w Task 4, krok 8.
2. **Szybki rzut mapą i pinch-out daleko poza zapas:** nic nie znika na stałe, a po zatrzymaniu wszystkie pinezki w kadrze są obecne. Weryfikacja skryptem w Task 5, krok 9.
3. **Marker zdjęty z mapy, a potem zmieniony (realtime/refresh) i przywrócony:** pokazuje nowy wygląd i daje się kliknąć. Test Leafleta `setIcon` na markerze bez mapy w Task 5, krok 1.
4. **Pierwsze wejście na zimno:** żadna pinezka nie pokazuje pustego pudełka. Test `allPinVariants` w Task 3 i ręczny odczyt w Task 4, krok 8.
5. **Kompas na iOS po refaktorze:** zgoda z gestu nadal podpina nasłuch, a odsubskrybowanie (StrictMode, odmontowanie) nic nie zostawia. Testy w Task 2, krok 1.

---

## Mapa plików

| Plik | Rola | Task |
|---|---|---|
| `src/dev/perfPins.ts` (nowy) | Deterministyczne syntetyczne wydarzenia do pomiarów | 1 |
| `src/dev/perfProbe.ts` (nowy) | Liczniki renderów, czasy, `?perfPins`, `window.__map` (tylko dev) | 1 |
| `src/hooks/useDeviceHeading.ts` | `subscribeDeviceHeading` + cienki hook | 2 |
| `src/components/pinImages.ts` (nowy) | SVG wariantów pinezek, cache URL-i, rozgrzewka | 3 |
| `src/dev/legacyMapIcons.ts` (nowy, tymczasowy) | Kopia dzisiejszego `mapIcons.ts` jako wzorzec wyglądu | 3 → usunięty w 7 |
| `src/components/mapIcons.ts` | `pinHTML`/`privateHTML`/`clusterHTML` na obrazkach | 4 |
| `pin-compare.html`, `src/dev/pinCompare.tsx` (nowe, tymczasowe) | Nakładka różnicowa stary/nowy | 4 → usunięte w 7 |
| `src/lib/pinCulling.ts` (nowy) | Które markery mają wisieć na mapie | 5 |
| `src/screens/MapScreen.tsx` | Podpięcie wszystkiego | 1, 2, 4, 5 |
| `src/lib/zoneConflict.ts`, `src/lib/eventClusters.ts` | Eksport stałych, siatka | 6 |

---

### Task 1: Narzędzia pomiarowe i pomiar wyjściowy

**Files:**
- Create: `src/dev/perfPins.ts`, `src/dev/perfPins.test.ts`, `src/dev/perfProbe.ts`, `src/dev/perfProbe.test.ts`
- Modify: `src/screens/MapScreen.tsx` (importy; stan przy `useEvents` ~243-256; efekt pinezek ~511; init mapy ~264-329)

**Interfaces:**
- Produces:
  - `makePerfEvents(n: number, center: {lat: number; lng: number}, seed?: number, now?: Date): EventWithMeta[]`
  - `countRender(name: string): void`
  - `timed<T>(name: string, fn: () => T): T`
  - `perfPinsParam(): number`
  - `exposeMap(map: unknown): void`
  - `window.__perf: { renders: Record<string, number>; timings: Record<string, number[]> }`, `window.__map`

- [ ] **Step 1: Testy generatora i sondy**

`src/dev/perfPins.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makePerfEvents } from './perfPins'
import { haversineKm, MAX_MAP_KM } from '../lib/geo'
import { isCurrentlyLive } from '../lib/eventStatus'
import { clusterPublicEvents } from '../lib/eventClusters'

const C = { lat: 52.2297, lng: 21.0122 }
const NOW = new Date('2026-09-24T12:00:00Z')

describe('makePerfEvents', () => {
  it('is deterministic for a seed', () => {
    const a = makePerfEvents(200, C, 7, NOW)
    const b = makePerfEvents(200, C, 7, NOW)
    expect(a.map(e => [e.id, e.lat, e.lng, e.category])).toEqual(b.map(e => [e.id, e.lat, e.lng, e.category]))
  })

  it('returns n events within MAX_MAP_KM of the centre', () => {
    const evs = makePerfEvents(1000, C, 1, NOW)
    expect(evs).toHaveLength(1000)
    for (const e of evs) expect(haversineKm(C.lat, C.lng, e.lat, e.lng)).toBeLessThanOrEqual(MAX_MAP_KM + 0.01)
  })

  it('mixes live, private and same-spot events', () => {
    const evs = makePerfEvents(1000, C, 1, NOW)
    const live = evs.filter(e => isCurrentlyLive(e, [], NOW)).length
    expect(live).toBeGreaterThan(50)
    expect(live).toBeLessThan(150)
    expect(evs.some(e => e.is_private)).toBe(true)
    const pub = evs.filter(e => !e.is_private)
    expect(clusterPublicEvents(pub).length).toBeLessThan(pub.length)
  })
})
```

`src/dev/perfProbe.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { countRender, timed, perfPinsParam } from './perfProbe'

describe('perfProbe', () => {
  beforeEach(() => { delete window.__perf; window.history.replaceState(null, '', '/') })

  it('counts renders per name', () => {
    countRender('A'); countRender('A'); countRender('B')
    expect(window.__perf!.renders).toEqual({ A: 2, B: 1 })
  })

  it('timed returns the value and records a duration', () => {
    expect(timed('x', () => 42)).toBe(42)
    expect(window.__perf!.timings.x).toHaveLength(1)
  })

  it('perfPinsParam reads ?perfPins, clamps, ignores junk', () => {
    expect(perfPinsParam()).toBe(0)
    window.history.replaceState(null, '', '/?perfPins=1500')
    expect(perfPinsParam()).toBe(1500)
    window.history.replaceState(null, '', '/?perfPins=99999')
    expect(perfPinsParam()).toBe(5000)
    window.history.replaceState(null, '', '/?perfPins=abc')
    expect(perfPinsParam()).toBe(0)
  })
})
```

- [ ] **Step 2: Uruchom testy - mają nie przejść**

Run: `npx vitest run src/dev/perfPins.test.ts src/dev/perfProbe.test.ts`
Expected: FAIL, `Failed to resolve import "./perfPins"` / `"./perfProbe"`.

- [ ] **Step 3: Implementacja**

`src/dev/perfPins.ts`:
```ts
import { ALL_CATEGORIES } from '../lib/tokens'
import { MAX_MAP_KM } from '../lib/geo'
import type { EventWithMeta } from '../lib/types'

// Syntetyczne wydarzenia do pomiarów wydajności mapy (?perfPins=N, tylko dev).
// Deterministyczne: to samo ziarno daje ten sam układ, więc pomiar przed
// zmianą i po niej patrzy na tę samą mapę.

// mulberry32 - mały, szybki, powtarzalny generator.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makePerfEvents(
  n: number,
  center: { lat: number; lng: number },
  seed = 1,
  now = new Date(),
): EventWithMeta[] {
  const r = rng(seed)
  const kmPerDegLng = 111.32 * Math.cos((center.lat * Math.PI) / 180)
  const out: EventWithMeta[] = []
  for (let i = 0; i < n; i++) {
    // Losowania zawsze w tej samej liczbie i kolejności, żeby układ nie
    // zależał od tego, które wydarzenie trafiło na klaster.
    const distKm = Math.sqrt(r()) * (MAX_MAP_KM - 0.5)
    const ang = r() * 2 * Math.PI
    const catIdx = Math.floor(r() * ALL_CATEGORIES.length)
    const live = r() < 0.1
    const isPrivate = r() < 0.05
    const hoursAhead = 1 + r() * 10
    const interactions = Math.floor(r() * r() * 120)
    // Co dwudzieste stoi dokładnie na poprzednim - tak powstają klastry 3x3 m.
    const prev = out[i - 1]
    const stack = prev !== undefined && i % 20 === 0
    const lat = stack ? prev.lat : center.lat + (distKm * Math.sin(ang)) / 111.32
    const lng = stack ? prev.lng : center.lng + (distKm * Math.cos(ang)) / kmPerDegLng
    const startMs = live ? now.getTime() - 3600e3 : now.getTime() + hoursAhead * 3600e3
    out.push({
      id: `perf-${i}`,
      title: `Perf ${i}`,
      description: null,
      lat, lng,
      place_name: null,
      category: ALL_CATEGORIES[catIdx],
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(startMs + 3 * 3600e3).toISOString(),
      creator_id: null,
      status: live ? 'live' : 'upcoming',
      created_at: now.toISOString(),
      photos: null,
      is_private: isPrivate,
      tags: [],
      distKm,
      distStr: `${distKm.toFixed(1)} km`,
      interactionCount: interactions,
    })
  }
  return out
}
```

`src/dev/perfProbe.ts`:
```ts
// Liczniki do pomiarów wydajności mapy, czytane z konsoli (window.__perf,
// window.__map). Poza trybem dev nic nie robią.

type PerfStats = { renders: Record<string, number>; timings: Record<string, number[]> }

declare global {
  interface Window {
    __perf?: PerfStats
    __map?: unknown
  }
}

function stats(): PerfStats {
  return (window.__perf ??= { renders: {}, timings: {} })
}

export function countRender(name: string): void {
  if (!import.meta.env.DEV) return
  const s = stats()
  s.renders[name] = (s.renders[name] ?? 0) + 1
}

export function timed<T>(name: string, fn: () => T): T {
  if (!import.meta.env.DEV) return fn()
  const t0 = performance.now()
  try {
    return fn()
  } finally {
    (stats().timings[name] ??= []).push(performance.now() - t0)
  }
}

/** Liczba syntetycznych wydarzeń z ?perfPins=N (0 = wyłączone, max 5000). */
export function perfPinsParam(): number {
  if (!import.meta.env.DEV) return 0
  const n = Number(new URLSearchParams(window.location.search).get('perfPins'))
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 5000) : 0
}

export function exposeMap(map: unknown): void {
  if (import.meta.env.DEV) window.__map = map
}
```

- [ ] **Step 4: Uruchom testy - mają przejść**

Run: `npx vitest run src/dev/perfPins.test.ts src/dev/perfProbe.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: Podpięcie w `MapScreen`**

Importy (obok pozostałych):
```ts
import { countRender, timed, perfPinsParam, exposeMap } from '../dev/perfProbe'
import { makePerfEvents } from '../dev/perfPins'
```

Na początku ciała komponentu, zaraz po `const loc = ...`:
```ts
  countRender('MapScreen')
```

Zamień blok `const { events, loading, ready } = useEvents(...)` oraz `visibleEvents` na:
```ts
  const { events, loading, ready } = useEvents(
    fetchView, idxToOffset(range.startIdx), idxToOffset(range.endIdx), eventsRefreshKey,
  )
  // ?perfPins=N (tylko dev): syntetyczne wydarzenia do pomiarów wydajności.
  // Wyliczane raz, wokół punktu startowego mapy.
  const [perfEvents] = useState<EventWithMeta[]>(() => {
    const n = perfPinsParam()
    return n ? makePerfEvents(n, initialCenter || userPos || lastKnownPos || ipPos || WARSAW) : []
  })
  const allEvents = useMemo(
    () => perfEvents.length ? [...events, ...perfEvents] : events,
    [events, perfEvents],
  )
  // An event matches a filter if it IS that category or carries it as a tag (handles custom tags too).
  // Memoised because the pins effect keys off it: an inline filter() is a new
  // array every render, and on a phone the compass re-renders this screen
  // dozens of times a second.
  const visibleEvents = useMemo(
    () => selectedFilters.length
      ? allEvents.filter(e => selectedFilters.some(f => e.category === f || (e.tags?.includes(f) ?? false)))
      : allEvents,
    [allEvents, selectedFilters],
  )
```

Efekt pinezek: owiń ciało w `timed`. Pierwsza linia efektu:
```ts
  useEffect(() => timed('pins', () => {
```
Zamknięcie:
```ts
  }), [visibleEvents]) // eslint-disable-line react-hooks/exhaustive-deps
```

W efekcie inicjalizacji mapy, zaraz po `leafRef.current = map`:
```ts
    exposeMap(map)
```

- [ ] **Step 6: Build, lint, testy**

Run: `npx tsc -b && npm run lint && npm test`
Expected: bez błędów, wszystkie testy PASS.

- [ ] **Step 7: Pomiar wyjściowy**

Wykonaj **Procedurę pomiaru** A (wykonawca) i poproś Wiktora o B. Wpisz wiersz „0” do tabeli „Pomiary” w specu. Na zoomie 8 oczekiwane jest `nodesPerPin` ≈ 15-25.

- [ ] **Step 8: Commit**

```bash
git add src/dev/perfPins.ts src/dev/perfPins.test.ts src/dev/perfProbe.ts src/dev/perfProbe.test.ts src/screens/MapScreen.tsx docs/superpowers/specs/2026-09-24-map-pins-performance-design.md
git commit -m "Pomiary mapy w trybie dev: ?perfPins=N dokłada syntetyczne wydarzenia, window.__perf liczy rendery i czas efektu pinezek"
```

---

### Task 2: Kompas poza Reactem

**Files:**
- Modify: `src/hooks/useDeviceHeading.ts` (cały plik)
- Create: `src/hooks/useDeviceHeading.test.ts`
- Modify: `src/screens/MapScreen.tsx` (import; linia `const heading = useDeviceHeading(true)`; efekt „Direction indicator” ~359-368)

**Interfaces:**
- Produces:
  - `subscribeDeviceHeading(onHeading: (deg: number | null) => void, schedule?: (cb: () => void) => void): () => void`
  - `useDeviceHeading(enabled: boolean): number | null` (bez zmian w API)

- [ ] **Step 1: Testy**

`src/hooks/useDeviceHeading.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeDeviceHeading } from './useDeviceHeading'

type W = Window & { DeviceOrientationEvent?: unknown }

function orient(type: string, props: Record<string, unknown>) {
  window.dispatchEvent(Object.assign(new Event(type), props))
}

describe('subscribeDeviceHeading', () => {
  let queued: (() => void)[] = []
  const schedule = (cb: () => void) => { queued.push(cb) }
  const frame = () => { const q = queued; queued = []; q.forEach(f => f()) }

  beforeEach(() => {
    queued = []
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(window as W).DeviceOrientationEvent = class extends Event {}
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (window as W).DeviceOrientationEvent
  })

  it('coalesces readings within one frame into one call with the last value', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientationabsolute', { absolute: true, alpha: 10 })
    orient('deviceorientationabsolute', { absolute: true, alpha: 20 })
    orient('deviceorientationabsolute', { absolute: true, alpha: 30 })
    expect(cb).not.toHaveBeenCalled()
    frame()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(330)
    off()
  })

  it('uses iOS webkitCompassHeading as is', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientation', { webkitCompassHeading: 45, webkitCompassAccuracy: 10 })
    frame()
    expect(cb).toHaveBeenLastCalledWith(45)
    off()
  })

  it('ignores relative readings with no compass heading', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientation', { absolute: false, alpha: 90 })
    frame()
    expect(cb).not.toHaveBeenCalled()
    off()
  })

  it('reports null after 3 s without a usable reading', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientationabsolute', { absolute: true, alpha: 0 })
    frame()
    vi.advanceTimersByTime(3000)
    expect(cb).toHaveBeenLastCalledWith(null)
    off()
  })

  it('stops listening after unsubscribe', () => {
    const cb = vi.fn()
    subscribeDeviceHeading(cb, schedule)()
    orient('deviceorientationabsolute', { absolute: true, alpha: 10 })
    frame()
    expect(cb).not.toHaveBeenCalled()
  })

  it('iOS: asks permission on a tap, then listens', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    ;(window as W).DeviceOrientationEvent = Object.assign(class extends Event {}, { requestPermission })
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientation', { webkitCompassHeading: 90, webkitCompassAccuracy: 5 })
    frame()
    expect(cb).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('click'))
    expect(requestPermission).toHaveBeenCalled()
    for (let i = 0; i < 5; i++) await Promise.resolve() // .then(attach) po rozwiązaniu zgody
    orient('deviceorientation', { webkitCompassHeading: 90, webkitCompassAccuracy: 5 })
    frame()
    expect(cb).toHaveBeenLastCalledWith(90)
    off()
  })

  it('no DeviceOrientationEvent: no-op unsubscribe', () => {
    delete (window as W).DeviceOrientationEvent
    const off = subscribeDeviceHeading(vi.fn(), schedule)
    expect(() => off()).not.toThrow()
  })
})
```

- [ ] **Step 2: Uruchom - ma nie przejść**

Run: `npx vitest run src/hooks/useDeviceHeading.test.ts`
Expected: FAIL, `subscribeDeviceHeading is not a function` (brak eksportu).

- [ ] **Step 3: Nowa treść `src/hooks/useDeviceHeading.ts`**

```ts
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
```

- [ ] **Step 4: Uruchom - ma przejść**

Run: `npx vitest run src/hooks/useDeviceHeading.test.ts`
Expected: PASS (7 testów).

- [ ] **Step 5: `MapScreen` subskrybuje zamiast trzymać stan**

Import: zamień `import { useDeviceHeading } from '../hooks/useDeviceHeading'` na:
```ts
import { subscribeDeviceHeading } from '../hooks/useDeviceHeading'
```
Usuń linię `const heading = useDeviceHeading(true)`.

Zastąp cały efekt „Direction indicator” (komentarz + `useEffect(..., [heading, userPos])`) tym:
```ts
  // Direction indicator — rotate the me-marker's orbiting chevron to the compass
  // heading. Kurs żyje w refie i trafia prosto do DOM: jako stan re-renderował
  // cały ekran przy każdym odczycie czujnika. userPos re-applies after the
  // marker is (re)created. Hidden when no heading available.
  const headingRef = useRef<number | null>(null)
  function applyHeading() {
    const ind = meRef.current?.getElement()?.querySelector('.me-heading') as HTMLElement | null
    if (!ind) return
    const h = headingRef.current
    if (h == null) { ind.style.opacity = '0'; return }
    ind.style.transform = `rotate(${h}deg)`
    ind.style.opacity = '1'
  }
  useEffect(() => subscribeDeviceHeading(h => {
    headingRef.current = h
    applyHeading()
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { applyHeading() }, [userPos]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: Build, lint, testy**

Run: `npx tsc -b && npm run lint && npm test`
Expected: bez błędów.

- [ ] **Step 7: Pomiar**

Procedura pomiaru, część B, krok 4 (rendery/s z działającym kompasem). Oczekiwane: ~0/s (przed zmianą kilkadziesiąt). Wiktor sprawdza też na iPhonie, że strzałka pojawia się po pierwszym tapnięciu i obraca się płynnie. Wpisz wiersz „1” do tabeli.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useDeviceHeading.ts src/hooks/useDeviceHeading.test.ts src/screens/MapScreen.tsx docs/superpowers/specs/2026-09-24-map-pins-performance-design.md
git commit -m "Kompas nie przerysowuje już całej mapy: kurs idzie prosto do strzałki, najwyżej raz na klatkę"
```

---

### Task 3: Obrazki pinezek (`pinImages.ts`)

**Files:**
- Create: `src/components/pinImages.ts`, `src/components/pinImages.test.ts`
- Create: `src/dev/legacyMapIcons.ts` (dosłowna kopia dzisiejszego `src/components/mapIcons.ts`)

**Interfaces:**
- Consumes: `BLOBS`, `TAG_META`, `INK`, `ALL_CATEGORIES`, `type Category` z `src/lib/tokens.ts`
- Produces:
  - `type PinVariant = { kind: 'public'; category: Category; blob: number } | { kind: 'private' } | { kind: 'badge' }`
  - `pinSvg(v: PinVariant): string`
  - `pinImageUrl(v: PinVariant): string`
  - `allPinVariants(): PinVariant[]`
  - `warmPinImages(): void`
  - stałe `PIN_IMG_W = 44`, `PIN_IMG_H = 50`, `BADGE_IMG = 28`, `BADGE_IMG_H = 30`

- [ ] **Step 1: Wzorzec wyglądu przed jakąkolwiek zmianą**

Run: `cp src/components/mapIcons.ts src/dev/legacyMapIcons.ts`
Na górze `src/dev/legacyMapIcons.ts` dopisz komentarz (reszta bez zmian; ścieżki `../lib/...` są poprawne także z `src/dev`):
```ts
// TYMCZASOWE: dzisiejszy mapIcons.ts sprzed przejścia na obrazki - wzorzec dla
// pin-compare.html. Usuwany, gdy wygląd nowych pinezek jest zatwierdzony.
```

- [ ] **Step 2: Testy**

`src/components/pinImages.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { pinSvg, pinImageUrl, allPinVariants } from './pinImages'
import { ALL_CATEGORIES, BLOBS, TAG_META } from '../lib/tokens'

describe('pinSvg', () => {
  it('public: shadow copy drawn 3 px lower at 0x22 alpha, then the coloured blob, no filter', () => {
    const svg = pinSvg({ kind: 'public', category: 'music', blob: 1 })
    expect(svg).toContain('viewBox="-3 -3 106 120.455"')
    expect(svg).toContain(`d="${BLOBS[1]}" fill="#2D2B2A"`)
    expect(svg).toContain('opacity="0.1333" transform="translate(0 7.227)"')
    expect(svg).toContain(`d="${BLOBS[1]}" fill="${TAG_META.music.color}"`)
    expect(svg).not.toContain('filter')
  })

  it('glyph is placed as an 18 px box centred on the blob, in ink', () => {
    const svg = pinSvg({ kind: 'public', category: 'party', blob: 0 })
    expect(svg).toContain('<g color="#2D2B2A"><svg x="28.318" y="28.318" width="43.364" height="43.364"')
  })

  it('every category glyph gets placed (no 1em box left over)', () => {
    for (const category of ALL_CATEGORIES) {
      expect(pinSvg({ kind: 'public', category, blob: 0 })).not.toContain('width="1em"')
    }
  })

  it('blob index wraps like BLOBS[idx % length]', () => {
    expect(pinSvg({ kind: 'public', category: 'art', blob: 4 })).toBe(pinSvg({ kind: 'public', category: 'art', blob: 1 }))
  })

  it('private: white blob, darker 0x44 shadow, face glyph 30x25', () => {
    const svg = pinSvg({ kind: 'private' })
    expect(svg).toContain(`d="${BLOBS[0]}" fill="#fff"`)
    expect(svg).toContain('opacity="0.2667"')
    expect(svg).toContain('<svg x="13.864" y="19.886" width="72.273" height="60.227"')
  })

  it('badge: shadow circle 2 px lower, white circle on top, 28x30', () => {
    const svg = pinSvg({ kind: 'badge' })
    expect(svg).toContain('width="28" height="30" viewBox="0 0 100 107.143"')
    expect(svg).toContain('opacity="0.1333" transform="translate(0 7.143)"')
    expect(svg).toContain('fill="#fff"/>')
  })
})

describe('pinImageUrl', () => {
  it('returns the same URL for the same variant (built once)', () => {
    const a = pinImageUrl({ kind: 'public', category: 'food', blob: 2 })
    expect(pinImageUrl({ kind: 'public', category: 'food', blob: 5 })).toBe(a)
    expect(pinImageUrl({ kind: 'public', category: 'food', blob: 0 })).not.toBe(a)
  })

  it('falls back to a data: URL where createObjectURL is missing (jsdom)', () => {
    expect(pinImageUrl({ kind: 'badge' })).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
  })

  it('uses a blob: URL when the browser can make one', async () => {
    vi.resetModules()
    const create = vi.fn(() => 'blob:test/1')
    const orig = URL.createObjectURL
    URL.createObjectURL = create
    try {
      const mod = await import('./pinImages')
      expect(mod.pinImageUrl({ kind: 'private' })).toBe('blob:test/1')
      mod.pinImageUrl({ kind: 'private' })
      expect(create).toHaveBeenCalledTimes(1)
    } finally {
      URL.createObjectURL = orig
    }
  })
})

describe('allPinVariants', () => {
  it('covers every category x blob, plus private and badge', () => {
    const vs = allPinVariants()
    expect(vs).toHaveLength(ALL_CATEGORIES.length * BLOBS.length + 2)
    expect(new Set(vs.map(v => pinImageUrl(v))).size).toBe(vs.length)
  })
})
```

- [ ] **Step 3: Uruchom - ma nie przejść**

Run: `npx vitest run src/components/pinImages.test.ts`
Expected: FAIL, `Failed to resolve import "./pinImages"`.

- [ ] **Step 4: Implementacja `src/components/pinImages.ts`**

```ts
import { ALL_CATEGORIES, BLOBS, INK, TAG_META, type Category } from '../lib/tokens'

// Pinezki jako gotowe obrazki. Blob, jego cień i glif to jeden SVG, budowany
// raz na wariant i trzymany pod stałym URL-em, więc marker na mapie ma jeden
// <img> zamiast kilkunastu elementów.
//
// Cień jest narysowany, nie nałożony filtrem. drop-shadow(0 Npx 0 c) bez
// rozmycia to ta sama sylwetka przesunięta o N px w kolorze c, a filtr kazał
// przeglądarce rysować każdą pinezkę osobno w każdej klatce ruchu mapy.

export type PinVariant =
  | { kind: 'public'; category: Category; blob: number }
  | { kind: 'private' }
  | { kind: 'badge' }

// Pudełko pinezki: 44 px na viewBox -3..103. Obrazek jest o 6 px wyższy, bo
// cień wychodzi 3 px pod sylwetkę, a <img> - inaczej niż inline SVG z
// overflow:visible - przycina wszystko poza swoim obszarem.
export const PIN_IMG_W = 44
export const PIN_IMG_H = 50
const UNIT = 106 / 44 // jednostek viewBoxa na piksel
const PIN_VB_H = (PIN_IMG_H * UNIT).toFixed(3)

// Odznaka klastra: 28 px na viewBox 0..100, +2 px na cień.
export const BADGE_IMG = 28
export const BADGE_IMG_H = 30
const BADGE_UNIT = 100 / BADGE_IMG

// '#2D2B2A22' i '#2D2B2A44' z dzisiejszych filtrów, jako krycie.
const SHADOW_PUBLIC = (0x22 / 255).toFixed(4)
const SHADOW_PRIVATE = (0x44 / 255).toFixed(4)

const GLYPH_PX = 18

// Buźka pinezki prywatnej - ta sama co w dawnym privateHTML.
const PRIVATE_FACE = `<svg width="30" height="25" viewBox="0 0 26 22" fill="none">
  <ellipse cx="7.5" cy="7" rx="6" ry="5" fill="#2D2B2A"/>
  <ellipse cx="18.5" cy="7" rx="6" ry="5" fill="#2D2B2A"/>
  <rect x="11" y="3" width="4" height="8" fill="#2D2B2A"/>
  <ellipse cx="7.5" cy="7" rx="3" ry="2.5" fill="white"/>
  <ellipse cx="18.5" cy="7" rx="3" ry="2.5" fill="white"/>
  <path d="M8 18Q13 22 18 18" stroke="#2D2B2A" stroke-width="2" stroke-linecap="round"/>
</svg>`

function blobWithShadow(path: string, fill: string, shadowOpacity: string): string {
  const shape = `stroke="${INK}" stroke-width="5" stroke-linejoin="round"`
  const dy = (3 * UNIT).toFixed(3)
  return `<path d="${path}" fill="${INK}" ${shape} opacity="${shadowOpacity}" transform="translate(0 ${dy})"/>`
    + `<path d="${path}" fill="${fill}" ${shape}/>`
}

// Glif ma dziś pudełko wielkości w px wyśrodkowane flexem na pudełku 44x44,
// którego środek to (50, 50) w viewBoxie. Tu to samo pudełko wstawiamy wprost.
// color: w obrazku nie ma strony, po której currentColor mógłby dziedziczyć.
function placedGlyph(glyph: string, wPx: number, hPx: number): string {
  const w = wPx * UNIT
  const h = hPx * UNIT
  const box = `<svg x="${(50 - w / 2).toFixed(3)}" y="${(50 - h / 2).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"`
  return `<g color="${INK}">${glyph.replace(/^<svg width="[^"]*" height="[^"]*"/, box)}</g>`
}

export function pinSvg(v: PinVariant): string {
  if (v.kind === 'badge') {
    const circle = `cx="50" cy="50" r="46.5" stroke="${INK}" stroke-width="7"`
    const dy = (2 * BADGE_UNIT).toFixed(3)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_IMG}" height="${BADGE_IMG_H}" viewBox="0 0 100 ${(BADGE_IMG_H * BADGE_UNIT).toFixed(3)}">`
      + `<circle ${circle} fill="${INK}" opacity="${SHADOW_PUBLIC}" transform="translate(0 ${dy})"/>`
      + `<circle ${circle} fill="#fff"/></svg>`
  }
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_IMG_W}" height="${PIN_IMG_H}" viewBox="-3 -3 106 ${PIN_VB_H}">`
  if (v.kind === 'private') {
    return open + blobWithShadow(BLOBS[0], '#fff', SHADOW_PRIVATE) + placedGlyph(PRIVATE_FACE, 30, 25) + '</svg>'
  }
  const meta = TAG_META[v.category] ?? TAG_META.party
  return open
    + blobWithShadow(BLOBS[v.blob % BLOBS.length], meta.color, SHADOW_PUBLIC)
    + placedGlyph(meta.glyph, GLYPH_PX, GLYPH_PX)
    + '</svg>'
}

function keyOf(v: PinVariant): string {
  return v.kind === 'public' ? `public|${v.category}|${v.blob % BLOBS.length}` : v.kind
}

const urls = new Map<string, string>()

/** Stały URL obrazka wariantu. blob: w przeglądarce, data: tam, gdzie go nie ma. */
export function pinImageUrl(v: PinVariant): string {
  const key = keyOf(v)
  let url = urls.get(key)
  if (!url) {
    const svg = pinSvg(v)
    url = typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    urls.set(key, url)
  }
  return url
}

export function allPinVariants(): PinVariant[] {
  const out: PinVariant[] = []
  for (const category of ALL_CATEGORIES) {
    for (let blob = 0; blob < BLOBS.length; blob++) out.push({ kind: 'public', category, blob })
  }
  out.push({ kind: 'private' }, { kind: 'badge' })
  return out
}

/**
 * Tworzy i dekoduje wszystkie warianty z góry. Bez tego pierwsza pinezka danej
 * kategorii mogłaby przez klatkę dekodowania stać pustym pudełkiem.
 */
export function warmPinImages(): void {
  for (const v of allPinVariants()) {
    const img = new Image()
    img.src = pinImageUrl(v)
    img.decode?.().catch(() => {})
  }
}
```

- [ ] **Step 5: Uruchom - ma przejść**

Run: `npx vitest run src/components/pinImages.test.ts`
Expected: PASS (10 testów). Jeśli test „blob: URL” pada przez cache modułu, sprawdź, czy `vi.resetModules()` jest przed `import()`.

- [ ] **Step 6: Build i lint**

Run: `npx tsc -b && npm run lint`
Expected: bez błędów (`legacyMapIcons.ts` kompiluje się jak oryginał).

- [ ] **Step 7: Commit**

```bash
git add src/components/pinImages.ts src/components/pinImages.test.ts src/dev/legacyMapIcons.ts
git commit -m "Pinezki jako gotowe obrazki SVG: blob, narysowany cień i glif w jednym pliku na wariant, budowanym raz"
```

---

### Task 4: `mapIcons` na obrazkach, nakładka różnicowa, rozgrzewka

**Files:**
- Modify: `src/components/mapIcons.ts` (`pinHTML`, `privateHTML`, `clusterHTML`; `meHTML` bez zmian)
- Create: `src/components/mapIcons.test.ts`
- Create: `pin-compare.html`, `src/dev/pinCompare.tsx`
- Modify: `src/screens/MapScreen.tsx` (init mapy: rozgrzewka)

**Interfaces:**
- Consumes: `pinImageUrl`, `warmPinImages`, `PIN_IMG_W`, `PIN_IMG_H`, `BADGE_IMG`, `BADGE_IMG_H` z Task 3
- Produces: te same sygnatury co dziś:
  - `pinHTML(category: string, idx: number, _dbStatus?: string, startTime?: string, endTime?: string, scale?: number): string`
  - `privateHTML(isLive?: boolean): string`
  - `clusterHTML(category, idx, dbStatus, startTime, endTime, count): string`

- [ ] **Step 1: Testy**

`src/components/mapIcons.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { pinHTML, privateHTML, clusterHTML } from './mapIcons'
import { pinImageUrl } from './pinImages'
import { TAG_META } from '../lib/tokens'

const now = Date.now()
const LIVE_S = new Date(now - 3600e3).toISOString()
const LIVE_E = new Date(now + 3600e3).toISOString()
const PAST_S = '2020-01-01T10:00:00Z'
const PAST_E = '2020-01-01T12:00:00Z'

function parse(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}
const elements = (html: string) => parse(html).querySelectorAll('*').length

describe('pin markup', () => {
  it('plain pin: 4 elements, image of its variant, no CSS filter', () => {
    const html = pinHTML('music', 4, 'upcoming', PAST_S, PAST_E)
    expect(elements(html)).toBe(4)
    expect(parse(html).querySelector('img')!.getAttribute('src')).toBe(pinImageUrl({ kind: 'public', category: 'music', blob: 1 }))
    expect(html).not.toContain('filter')
  })

  it('live pin adds the two halos (6 elements)', () => {
    expect(elements(pinHTML('music', 0, 'live', LIVE_S, LIVE_E))).toBe(6)
  })

  it('scale from interactions stays on the 44x44 box', () => {
    expect(pinHTML('art', 0, undefined, undefined, undefined, 1.25)).toContain('transform:scale(1.250);transform-origin:bottom center;')
  })

  it('unknown category falls back to party', () => {
    const html = pinHTML('nope', 0)
    expect(html).toContain(pinImageUrl({ kind: 'public', category: 'party', blob: 0 }))
    expect(html).toContain(`background:${TAG_META.party.color}`)
  })

  it('private pin: 4 elements, 6 when live, white dot', () => {
    expect(elements(privateHTML(false))).toBe(4)
    expect(elements(privateHTML(true))).toBe(6)
    expect(privateHTML(false)).toContain('background:white')
  })

  it('cluster: 7 elements, 9 when live, count as text', () => {
    expect(elements(clusterHTML('food', 0, 'upcoming', PAST_S, PAST_E, 3))).toBe(7)
    expect(elements(clusterHTML('food', 0, 'live', LIVE_S, LIVE_E, 3))).toBe(9)
    expect(parse(clusterHTML('food', 0, 'upcoming', PAST_S, PAST_E, 12)).textContent).toContain('>9')
  })

  it('images do not take clicks or drags', () => {
    const img = parse(pinHTML('music', 0)).querySelector('img')!
    expect(img.getAttribute('draggable')).toBe('false')
    expect(img.getAttribute('style')).toContain('pointer-events:none')
  })
})
```

- [ ] **Step 2: Uruchom - ma nie przejść**

Run: `npx vitest run src/components/mapIcons.test.ts`
Expected: FAIL (np. `expected 11 to be 4` i `filter` w HTML).

- [ ] **Step 3: Nowe `pinHTML`/`privateHTML`/`clusterHTML`**

W `src/components/mapIcons.ts` zamień importy i trzy funkcje (`meHTML` zostaje dosłownie):
```ts
import { TAG_META, type Category } from '../lib/tokens'
import { isCurrentlyLive } from '../lib/eventStatus'
import { formatClusterCount } from '../lib/eventClusters'
import { pinImageUrl, PIN_IMG_W, PIN_IMG_H, BADGE_IMG, BADGE_IMG_H } from './pinImages'

// Pinezka to obrazek z pinImages.ts (blob + cień + glif) plus to, czego obrazek
// nie umie: pulsujące halo, kropka pod spodem i liczba w odznace, pisana
// fontem strony, do którego <img> nie ma dostępu.

function halosHTML(color: string): string {
  const ring = (delay: string) =>
    `<div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid ${color};animation:halo 2.8s${delay} ease-out infinite;opacity:0;pointer-events:none"></div>`
  return ring('') + ring(' 1.4s')
}

function imgHTML(url: string, w: number, h: number): string {
  return `<img src="${url}" width="${w}" height="${h}" alt="" draggable="false" style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;pointer-events:none">`
}

function pinBody(url: string, haloColor: string, dotColor: string, live: boolean, scale: number, extra = ''): string {
  const scaleStyle = scale !== 1 ? `transform:scale(${scale.toFixed(3)});transform-origin:bottom center;` : ''
  return `<div style="position:relative;width:44px;height:56px;">`
    + `<div style="position:absolute;top:0;left:0;width:44px;height:44px;${scaleStyle}">`
    + (live ? halosHTML(haloColor) : '')
    + imgHTML(url, PIN_IMG_W, PIN_IMG_H)
    + `</div>`
    + `<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${dotColor};border:2.5px solid #2D2B2A"></div>`
    + extra
    + `</div>`
}

function knownCategory(category: string): Category {
  return (TAG_META[category as Category] ? category : 'party') as Category
}

export function pinHTML(category: string, idx: number, _dbStatus?: string, startTime?: string, endTime?: string, scale = 1): string {
  const cat = knownCategory(category)
  const color = TAG_META[cat].color
  const live = startTime && endTime
    ? isCurrentlyLive({ start_time: startTime, end_time: endTime })
    : false
  return pinBody(pinImageUrl({ kind: 'public', category: cat, blob: idx }), color, color, live, scale)
}
```
(`meHTML` bez zmian, między `pinHTML` a `privateHTML`.)
```ts
export function privateHTML(isLive = false): string {
  return pinBody(pinImageUrl({ kind: 'private' }), '#2D2B2A', 'white', isLive, 1)
}

// Representative pin for a same-zone cluster (size >= 2): the normal pin plus a
// comic circle badge (white, ink outline, no tail) in the upper-right carrying
// the event count. Same 44x56 icon box as pinHTML; the badge sits in the pin's
// own container rather than in an extra wrapper.
export function clusterHTML(
  category: string,
  idx: number,
  _dbStatus: string | undefined,
  startTime: string,
  endTime: string,
  count: number,
): string {
  const cat = knownCategory(category)
  const color = TAG_META[cat].color
  const live = isCurrentlyLive({ start_time: startTime, end_time: endTime })
  const label = formatClusterCount(count)
  const fontSize = label.length > 1 ? 11 : 14
  const badge = `<div style="position:absolute;top:-8px;right:-8px;width:28px;height:28px;pointer-events:none">`
    + imgHTML(pinImageUrl({ kind: 'badge' }), BADGE_IMG, BADGE_IMG_H)
    + `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Hanken Grotesk','Nunito',sans-serif;font-size:${fontSize}px;font-weight:900;color:#2D2B2A">${label}</div>`
    + `</div>`
  return pinBody(pinImageUrl({ kind: 'public', category: cat, blob: idx }), color, color, live, 1, badge)
}
```

- [ ] **Step 4: Uruchom - ma przejść**

Run: `npx vitest run src/components/mapIcons.test.ts src/components/pinImages.test.ts`
Expected: PASS.

- [ ] **Step 5: Strona porównania**

`pin-compare.html`:
```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>meuwe — pinezki: stare vs nowe</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/dev/pinCompare.tsx"></script>
  </body>
</html>
```

`src/dev/pinCompare.tsx`:
```tsx
// TYMCZASOWE: porównanie starych pinezek (legacyMapIcons) z nowymi (obrazki).
// Kolumna „różnica” kładzie nową na starą z mix-blend-mode:difference - to, co
// identyczne, wychodzi czarne, każda różnica świeci. „Miganie” przełącza obie
// co 0,6 s, co łapie przesunięcie o piksel lepiej niż oko przy zestawieniu.
// Usuwane razem z legacyMapIcons.ts po zatwierdzeniu wyglądu.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ALL_CATEGORIES, C, INK, F } from '../lib/tokens'
import * as next from '../components/mapIcons'
import * as legacy from './legacyMapIcons'
import '../index.css'

type Icons = Pick<typeof next, 'pinHTML' | 'privateHTML' | 'clusterHTML'>
const now = Date.now()
const LS = new Date(now - 3600e3).toISOString()
const LE = new Date(now + 3600e3).toISOString()
const PS = '2020-01-01T10:00:00Z'
const PE = '2020-01-01T12:00:00Z'

const CASES: { name: string; html: (m: Icons) => string }[] = [
  ...ALL_CATEGORIES.map((cat, i) => ({ name: cat, html: (m: Icons) => m.pinHTML(cat, i, 'upcoming', PS, PE) })),
  ...[0, 1, 2].map(b => ({ name: `blob ${b}`, html: (m: Icons) => m.pinHTML('party', b, 'upcoming', PS, PE) })),
  { name: 'skala 1.5', html: m => m.pinHTML('music', 0, 'upcoming', PS, PE, 1.5) },
  { name: 'trwające', html: m => m.pinHTML('sport', 1, 'live', LS, LE) },
  { name: 'prywatne', html: m => m.privateHTML(false) },
  { name: 'prywatne trwające', html: m => m.privateHTML(true) },
  { name: 'klaster 3', html: m => m.clusterHTML('food', 1, 'upcoming', PS, PE, 3) },
  { name: 'klaster >9', html: m => m.clusterHTML('art', 2, 'upcoming', PS, PE, 12) },
]

const cell: React.CSSProperties = { position: 'relative', width: 60, height: 64, zoom: 4, background: C.cream }
const pinAt: React.CSSProperties = { position: 'absolute', left: 8, top: 8 }

function Blink({ a, b }: { a: string; b: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = setInterval(() => setOn(x => !x), 600); return () => clearInterval(id) }, [])
  return <div style={cell}><div style={pinAt} dangerouslySetInnerHTML={{ __html: on ? b : a }} /></div>
}

function App() {
  return (
    <div style={{ background: C.cream, minHeight: '100%', padding: 20, fontFamily: F.body, color: INK, overflow: 'auto' }}>
      {/* Halo animuje się - zatrzymane na tej samej klatce w obu wersjach. */}
      <style>{`.cmp *{animation-play-state:paused!important;animation-delay:-1s!important}`}</style>
      <h2 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 10 }}>stare | nowe | różnica | miganie (4×)</h2>
      {CASES.map(c => {
        const a = c.html(legacy)
        const b = c.html(next)
        return (
          <div key={c.name} className="cmp" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 110, fontSize: 11 }}>{c.name}</div>
            <div style={cell}><div style={pinAt} dangerouslySetInnerHTML={{ __html: a }} /></div>
            <div style={cell}><div style={pinAt} dangerouslySetInnerHTML={{ __html: b }} /></div>
            <div style={{ ...cell, isolation: 'isolate' }}>
              <div style={pinAt} dangerouslySetInnerHTML={{ __html: a }} />
              <div style={{ ...pinAt, mixBlendMode: 'difference' }} dangerouslySetInnerHTML={{ __html: b }} />
            </div>
            <Blink a={a} b={b} />
          </div>
        )
      })}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
```

- [ ] **Step 6: Porównanie wyglądu**

1. `preview_start` `{name: "meuwe-web"}`, `navigate` na `http://localhost:5173/pin-compare.html`.
2. `computer` → `screenshot`, potem `zoom` na kolumnę „różnica” dla każdego wiersza.
3. Oczekiwane: w kolumnie „różnica” sylwetki czarne, bez kolorowych obwódek i jasnych plam. Dopuszczalna jest cienka szara linia antyaliasingu na krawędzi.
4. Jeśli glif świeci jako przesunięty kształt, zmierz przesunięcie na zrzucie (4 px na zrzucie = 1 px CSS). Popraw w `placedGlyph` w `pinImages.ts` współrzędną `y` (albo `x`) o tyle pikseli × `UNIT` i zaktualizuj oczekiwane liczby w teście „glyph is placed…”.
5. Powtórz przy `resize_window` z `preset: "mobile"` (DPR urządzenia mobilnego), potem `preset: "desktop"`.
6. Wyślij Wiktorowi zrzut kolumny „różnica” do akceptacji.

- [ ] **Step 7: Rozgrzewka w `MapScreen`**

Import:
```ts
import { warmPinImages } from '../components/pinImages'
```
W efekcie inicjalizacji mapy, zaraz po `L.control.attribution(...).addTo(map)`:
```ts
    // Obrazki pinezek dekodowane z góry, w wolnej chwili: pierwsza pinezka
    // danej kategorii nie mignie pustym pudełkiem. iOS nie ma requestIdleCallback.
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmPinImages)
    else setTimeout(warmPinImages, 200)
```

- [ ] **Step 8: Sprawdzenie w aplikacji**

1. W Browser pane `http://localhost:5173/`, ekran mapy. `read_console_messages` z `onlyErrors: true`: brak błędów CSP i ładowania obrazków.
2. `javascript_tool`: `[...document.querySelectorAll('.leaflet-marker-icon img')].every(i => i.complete && i.naturalWidth > 0)` → `true`.
3. Kliknij klaster (dowolny z `?perfPins=300`, np. `perf-20` stoi na `perf-19`), otwórz `EventPickerModal` i zrób zrzut. Pinezki w liście mają wyglądać jak na mapie: glif w kolorze tuszu, ten sam rozmiar.
4. Procedura pomiaru A. Oczekiwane `nodesPerPin` ≈ 4-5. Poproś Wiktora o B. Wpisz wiersz „2” do tabeli.

- [ ] **Step 9: Build, lint, testy**

Run: `npx tsc -b && npm run lint && npm test`
Expected: bez błędów.

- [ ] **Step 10: Commit**

```bash
git add src/components/mapIcons.ts src/components/mapIcons.test.ts pin-compare.html src/dev/pinCompare.tsx src/screens/MapScreen.tsx docs/superpowers/specs/2026-09-24-map-pins-performance-design.md
git commit -m "Pinezka na mapie to jeden obrazek zamiast kilkunastu elementów z filtrem cienia; wygląd sprawdzony nakładką różnicową"
```

---

### Task 5: Na mapie tylko markery przy kadrze; klik i z-index bez przepinania

**Files:**
- Create: `src/lib/pinCulling.ts`, `src/lib/pinCulling.test.ts`, `src/lib/leafletAssumptions.test.ts`
- Modify: `src/screens/MapScreen.tsx` (`pinsRef` ~117; init mapy ~288-316; efekt pinezek ~511-582)

**Interfaces:**
- Produces:
  - `interface GeoBounds { south: number; west: number; north: number; east: number }`
  - `pinsToMount(points: Record<string, { lat: number; lng: number }>, b: GeoBounds): Set<string>`
  - `planMount(pins: Record<string, { mounted: boolean }>, want: Set<string>, addOnly: boolean): { add: string[]; remove: string[] }`

- [ ] **Step 1: Testy**

`src/lib/pinCulling.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { pinsToMount, planMount } from './pinCulling'

const B = { south: 50, west: 20, north: 51, east: 21 }

describe('pinsToMount', () => {
  it('keeps points inside the bounds, edges included, drops the rest', () => {
    const got = pinsToMount({
      in: { lat: 50.5, lng: 20.5 },
      edge: { lat: 51, lng: 20 },
      north: { lat: 51.01, lng: 20.5 },
      east: { lat: 50.5, lng: 21.2 },
    }, B)
    expect([...got].sort()).toEqual(['edge', 'in'])
  })

  it('empty input -> empty set', () => {
    expect(pinsToMount({}, B).size).toBe(0)
  })
})

describe('planMount', () => {
  const pins = { a: { mounted: true }, b: { mounted: false }, c: { mounted: true } }

  it('adds wanted-but-unmounted, removes mounted-but-unwanted', () => {
    expect(planMount(pins, new Set(['a', 'b']), false)).toEqual({ add: ['b'], remove: ['c'] })
  })

  it('addOnly never removes (used while the map is moving)', () => {
    expect(planMount(pins, new Set(['b']), true)).toEqual({ add: ['b'], remove: [] })
  })

  it('nothing to do when mounted matches wanted', () => {
    expect(planMount(pins, new Set(['a', 'c']), false)).toEqual({ add: [], remove: [] })
  })
})
```

`src/lib/leafletAssumptions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import L from 'leaflet'

// Kadrowanie trzyma markery poza mapą i zmienia im ikonę, zanim wrócą.
// To sprawdza, że Leaflet przyjmuje setIcon/setLatLng bez mapy i pokazuje
// najnowszą ikonę po addTo.
describe('Leaflet marker off the map', () => {
  it('setIcon and setLatLng while removed, then addTo shows the latest icon', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const map = L.map(el).setView([50, 20], 10)
    const icon = (html: string) => L.divIcon({ html, className: 'meuwe-icon', iconSize: [44, 56], iconAnchor: [22, 56] })
    const m = L.marker([50, 20], { icon: icon('<b>old</b>') }).addTo(map)
    m.remove()
    m.setIcon(icon('<b>new</b>'))
    m.setLatLng([50.1, 20.1])
    let clicks = 0
    m.on('click', () => { clicks++ })
    m.addTo(map)
    expect(m.getElement()!.innerHTML).toContain('new')
    m.fire('click')
    expect(clicks).toBe(1)
    map.remove()
    el.remove()
  })
})
```

- [ ] **Step 2: Uruchom - ma nie przejść**

Run: `npx vitest run src/lib/pinCulling.test.ts src/lib/leafletAssumptions.test.ts`
Expected: `pinCulling` FAIL (brak modułu). `leafletAssumptions` powinien przejść od razu, bo potwierdza założenie o Leaflecie. Jeśli nie przejdzie, **stop** i zgłoś: kadrowanie trzeba przeprojektować.

- [ ] **Step 3: Implementacja `src/lib/pinCulling.ts`**

```ts
// Które pinezki mają wisieć na mapie: te w kadrze powiększonym o zapas. Czysta
// geometria na stopniach, bez Leafleta. Antypołudnika świadomie nie obsługujemy:
// mapa pokazuje najwyżej ~300 km, a wydarzenia są w Europie i na Kanarach.

export interface GeoBounds {
  south: number
  west: number
  north: number
  east: number
}

export function pinsToMount(
  points: Record<string, { lat: number; lng: number }>,
  b: GeoBounds,
): Set<string> {
  const out = new Set<string>()
  for (const id in points) {
    const p = points[id]
    if (p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east) out.add(id)
  }
  return out
}

/**
 * Co dołożyć i co zdjąć, żeby na mapie było dokładnie `want`. W trakcie ruchu
 * (`addOnly`) tylko dokładamy - zdejmowanie czeka na moveend, żeby nie mielić
 * DOM-u w każdej klatce przesuwania.
 */
export function planMount(
  pins: Record<string, { mounted: boolean }>,
  want: Set<string>,
  addOnly: boolean,
): { add: string[]; remove: string[] } {
  const add: string[] = []
  const remove: string[] = []
  for (const id in pins) {
    const wanted = want.has(id)
    if (wanted && !pins[id].mounted) add.push(id)
    else if (!wanted && pins[id].mounted && !addOnly) remove.push(id)
  }
  return { add, remove }
}
```

- [ ] **Step 4: Uruchom - ma przejść**

Run: `npx vitest run src/lib/pinCulling.test.ts src/lib/leafletAssumptions.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: `MapScreen` - stan markerów i synchronizacja**

Import:
```ts
import { pinsToMount, planMount } from '../lib/pinCulling'
```

Zamień deklarację `pinsRef` (z komentarzem) na:
```ts
  // Markers by event id, each remembered with the look it was built for, so a
  // pin whose look has not changed is left alone instead of rebuilt. `mounted`
  // mówi, czy marker wisi na mapie: poza kadrem (z zapasem) czeka tu z gotową
  // ikoną, a jego halo nie animuje się na próżno.
  type Pin = { marker: L.Marker; sig: string; z: number; lat: number; lng: number; mounted: boolean }
  const pinsRef = useRef<Record<string, Pin>>({})
  // Klik markera czyta handler stąd: podpinany raz przy tworzeniu, a nie
  // przepinany na każdym markerze przy każdej zmianie wydarzeń.
  const clickRef = useRef<Record<string, () => void>>({})
  const syncMountedRef = useRef<(addOnly: boolean) => void>(() => {})
```

Tuż przed efektem pinezek (przed komentarzem „Pins — update on events change”):
```ts
  // Na mapie wisi to, co jest w kadrze albo do pół ekranu od niego.
  function syncMounted(addOnly: boolean) {
    const map = leafRef.current
    if (!map) return
    const b = map.getBounds().pad(0.5)
    const want = pinsToMount(pinsRef.current, {
      south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(),
    })
    const { add, remove } = planMount(pinsRef.current, want, addOnly)
    for (const id of add) { pinsRef.current[id].marker.addTo(map); pinsRef.current[id].mounted = true }
    for (const id of remove) { pinsRef.current[id].marker.remove(); pinsRef.current[id].mounted = false }
  }
  useEffect(() => { syncMountedRef.current = syncMounted })
```

- [ ] **Step 6: `MapScreen` - zdarzenia mapy**

W efekcie inicjalizacji, w handlerze `map.on('moveend', () => {`, jako pierwsza linia:
```ts
      syncMountedRef.current(false)
```
(`moveend` przychodzi też po każdym `zoomend`, więc jeden punkt obsługuje oba.)

Zaraz po zamknięciu handlera `moveend`:
```ts
    // W trakcie ruchu dokładamy pinezki wjeżdżające w kadr, co ~200 ms, żeby
    // przy szybkim rzucie mapą nie pojawiały się dopiero po zatrzymaniu.
    let lastMoveSync = 0
    map.on('move', () => {
      const now = performance.now()
      if (now - lastMoveSync < 200) return
      lastMoveSync = now
      syncMountedRef.current(true)
    })
```

W `ResizeObserver`, po `map.invalidateSize(false)`:
```ts
      syncMountedRef.current(false)
```

W sprzątaniu efektu (`return () => { ... }`) dopisz `clickRef.current = {};` obok `pinsRef.current = {};`.

- [ ] **Step 7: `MapScreen` - efekt pinezek**

Zastąp część efektu od `const iconFor = ...` do końca ciała (przed `}), [visibleEvents])`):
```ts
    const iconFor = (html: string) =>
      L.divIcon({ html, className: 'meuwe-icon', iconSize: [44, 56], iconAnchor: [22, 56] })

    Object.entries(pinsRef.current).forEach(([id, pin]) => {
      if (desired[id]) return
      pin.marker.remove()
      delete pinsRef.current[id]
    })

    const clicks: Record<string, () => void> = {}
    Object.entries(desired).forEach(([id, d]) => {
      clicks[id] = d.onClick
      const pin = pinsRef.current[id]
      if (pin) {
        if (pin.sig !== d.sig) {
          // Działa też na markerze zdjętym z mapy: ikona czeka na powrót w kadr.
          pin.marker.setIcon(iconFor(d.html))
          pin.marker.setLatLng([d.lat, d.lng])
          pin.sig = d.sig
          pin.lat = d.lat
          pin.lng = d.lng
        }
        // The offset follows a count that moves on its own, but touching it
        // re-sorts the marker pane - only when it actually changed.
        if (pin.z !== d.zIndexOffset) {
          pin.marker.setZIndexOffset(d.zIndexOffset)
          pin.z = d.zIndexOffset
        }
        return
      }
      const marker = L.marker([d.lat, d.lng], { icon: iconFor(d.html), zIndexOffset: d.zIndexOffset })
      marker.on('click', () => clickRef.current[id]?.())
      pinsRef.current[id] = { marker, sig: d.sig, z: d.zIndexOffset, lat: d.lat, lng: d.lng, mounted: false }
    })
    // The handlers close over this run's event objects.
    clickRef.current = clicks

    syncMounted(false)
```

- [ ] **Step 8: Build, lint, testy**

Run: `npx tsc -b && npm run lint && npm test`
Expected: bez błędów.

- [ ] **Step 9: Sprawdzenie zachowania (Browser pane, `?perfPins=1500`)**

`javascript_tool`, po kolei:
```js
__map.setView([52.2297, 21.0122], 14); await new Promise(r => setTimeout(r, 800))
document.querySelectorAll('.leaflet-marker-icon').length   // wyraźnie < 1500
```
```js
// szybki rzut daleko poza zapas, bez animacji
__map.panBy([3000, 0], { animate: false }); await new Promise(r => setTimeout(r, 800))
const shown = [...document.querySelectorAll('.leaflet-marker-icon')].length
;({ shown, center: __map.getCenter() })
```
```js
// wszystko w kadrze po zatrzymaniu: każdy perf-event w bounds ma ikonę
__map.setView([52.2297, 21.0122], 8); await new Promise(r => setTimeout(r, 1500))
document.querySelectorAll('.leaflet-marker-icon').length   // ≈ liczba grup (prawie wszystkie)
```
Potem ręcznie:
- klik w pinezkę po powrocie w kadr otwiera kartę;
- klik w nachodzące pinezki je rozsuwa (`spreadOrOpen`);
- `read_console_messages` z `onlyErrors: true` jest pusty.

- [ ] **Step 10: Pomiar**

Procedura pomiaru A i B. Wpisz wiersz „3” do tabeli. Na zoomie 12 liczba ikon ma spaść wyraźnie względem wiersza „2”.

- [ ] **Step 11: Commit**

```bash
git add src/lib/pinCulling.ts src/lib/pinCulling.test.ts src/lib/leafletAssumptions.test.ts src/screens/MapScreen.tsx docs/superpowers/specs/2026-09-24-map-pins-performance-design.md
git commit -m "Na mapie wiszą tylko pinezki w kadrze i pół ekranu wokół; klik i kolejność warstw nie są przepinane przy każdej zmianie"
```

---

### Task 6: Grupowanie 3×3 m przez siatkę

**Files:**
- Modify: `src/lib/zoneConflict.ts:16-17` (eksport stałych)
- Modify: `src/lib/eventClusters.ts` (`clusterPublicEvents`)
- Modify: `src/lib/eventClusters.test.ts` (test równoważności)

**Interfaces:**
- Consumes: `zonesOverlapSpatially`, `M_PER_DEG_LAT`, `ZONE_SIDE_M` z `zoneConflict.ts`
- Produces: `clusterPublicEvents(events: EventWithMeta[]): EventWithMeta[][]`, wynik identyczny z dzisiejszym

- [ ] **Step 1: Test równoważności**

W `src/lib/eventClusters.test.ts` dopisz do importów na górze pliku:
```ts
import { zonesOverlapSpatially } from './zoneConflict'
```
i na końcu pliku:
```ts
// Wzorzec: implementacja sprzed siatki, słowo w słowo.
function legacyCluster(events: EventWithMeta[]): EventWithMeta[][] {
  const pub = events.filter(e => !e.is_private)
  const used = new Array(pub.length).fill(false)
  const clusters: EventWithMeta[][] = []
  for (let i = 0; i < pub.length; i++) {
    if (used[i]) continue
    used[i] = true
    const anchor = pub[i]
    const group = [anchor]
    for (let j = i + 1; j < pub.length; j++) {
      if (used[j]) continue
      if (zonesOverlapSpatially(anchor, pub[j])) { used[j] = true; group.push(pub[j]) }
    }
    group.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    clusters.push(group)
  }
  return clusters
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

describe('clusterPublicEvents - grid matches the pairwise sweep', () => {
  const M = 111320
  for (const [label, lat0] of [['Rzeszów', 50.04], ['Teneryfa', 28.3], ['Gdańsk', 54.35]] as const) {
    it(`same groups in the same order around ${label}`, () => {
      const r = seeded(lat0 * 1000)
      const cosL = Math.cos((lat0 * Math.PI) / 180)
      const evs: EventWithMeta[] = []
      for (let i = 0; i < 600; i++) {
        const base = evs.length && r() < 0.4 ? evs[Math.floor(r() * evs.length)] : null
        // obok istniejącego: 0-4 m, czyli także tuż pod i tuż nad progiem 3 m
        const dN = base ? (r() * 8 - 4) : (r() - 0.5) * 2000
        const dE = base ? (r() * 8 - 4) : (r() - 0.5) * 2000
        const lat = (base ? base.lat : lat0) + dN / M
        const lng = (base ? base.lng : 22) + dE / (M * cosL)
        const h = Math.floor(r() * 5)
        evs.push(ev({
          id: `r${i}`, lat, lng, is_private: r() < 0.05,
          start_time: `2026-07-14T1${h}:00:00.000Z`, end_time: `2026-07-14T1${h + 1}:00:00.000Z`,
        }))
      }
      const ids = (cs: EventWithMeta[][]) => cs.map(c => c.map(e => e.id))
      expect(ids(clusterPublicEvents(evs))).toEqual(ids(legacyCluster(evs)))
    })
  }

  it('exactly on a grid line still groups with a neighbour 1 m away', () => {
    const cell = 3 / M
    const a = ev({ id: 'a', lat: cell * 16680, lng: 22 })
    const b = ev({ id: 'b', lat: cell * 16680 - 1 / M, lng: 22 })
    expect(ids1(clusterPublicEvents([a, b]))).toEqual([['a', 'b']])
  })
})

const ids1 = (cs: EventWithMeta[][]) => cs.map(c => c.map(e => e.id))
```

- [ ] **Step 2: Uruchom - nowe testy przechodzą już na starej wersji**

Run: `npx vitest run src/lib/eventClusters.test.ts`
Expected: PASS. Stara implementacja jest wzorcem, więc testy równoważności muszą przejść przed zmianą. To dowód, że test nie jest pusty. Jeśli któryś pada, test jest błędny: popraw test, nie kod.

- [ ] **Step 3: Eksport stałych**

`src/lib/zoneConflict.ts`, linie 16-17:
```ts
export const M_PER_DEG_LAT = 111320
export const ZONE_SIDE_M = 3 // two 1.5 m half-squares -> overlap when centres < 3 m per axis
```

- [ ] **Step 4: Siatka w `clusterPublicEvents`**

`src/lib/eventClusters.ts`, import i funkcja:
```ts
import { zonesOverlapSpatially, M_PER_DEG_LAT, ZONE_SIDE_M } from './zoneConflict'
import type { EventWithMeta } from './types'

// Group PUBLIC events that share a 3x3 m zone into clusters. Private events are
// filtered out here (clustering is public-only). Each cluster is sorted by
// start_time ascending, so cluster[0] is the current-or-next representative.
// Single-pass anchor sweep: real data places same-venue events at identical
// coordinates, so transitive chaining is a non-issue.
//
// Kandydaci do strefy kotwicy pochodzą z siatki o boku strefy: wszystko, co
// może się z nią nakładać, leży w jej komórce albo w jednej z ośmiu sąsiednich.
// Komórka w długości liczona jest dla największej |szerokości| w zbiorze - tam
// stopień długości jest najkrótszy, więc komórka wychodzi najszersza i nikt nie
// wypada poza sąsiadów. Kolejność i warunek są te same co w przeglądzie każdy z
// każdym, więc wynik też (pilnuje tego test równoważności).
export function clusterPublicEvents(events: EventWithMeta[]): EventWithMeta[][] {
  const pub = events.filter(e => !e.is_private)
  let maxAbsLat = 0
  for (const e of pub) maxAbsLat = Math.max(maxAbsLat, Math.abs(e.lat))
  const cellLat = ZONE_SIDE_M / M_PER_DEG_LAT
  const cellLng = ZONE_SIDE_M / (M_PER_DEG_LAT * Math.cos((Math.min(maxAbsLat, 89) * Math.PI) / 180))

  const cx = new Array<number>(pub.length)
  const cy = new Array<number>(pub.length)
  const cells = new Map<string, number[]>()
  for (let i = 0; i < pub.length; i++) {
    cx[i] = Math.floor(pub[i].lng / cellLng)
    cy[i] = Math.floor(pub[i].lat / cellLat)
    const k = `${cx[i]}:${cy[i]}`
    const bucket = cells.get(k)
    if (bucket) bucket.push(i)
    else cells.set(k, [i])
  }

  const used = new Array(pub.length).fill(false)
  const clusters: EventWithMeta[][] = []
  for (let i = 0; i < pub.length; i++) {
    if (used[i]) continue
    used[i] = true
    const anchor = pub[i]
    const found: number[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = cells.get(`${cx[i] + dx}:${cy[i] + dy}`)
        if (!bucket) continue
        for (const j of bucket) {
          if (j > i && !used[j] && zonesOverlapSpatially(anchor, pub[j])) found.push(j)
        }
      }
    }
    found.sort((a, b) => a - b)
    const group = [anchor]
    for (const j of found) { used[j] = true; group.push(pub[j]) }
    group.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    clusters.push(group)
  }
  return clusters
}
```
(`formatClusterCount` bez zmian.)

- [ ] **Step 5: Uruchom - dalej przechodzi**

Run: `npx vitest run src/lib/eventClusters.test.ts src/lib/zoneConflict.test.ts`
Expected: PASS (jeśli `zoneConflict.test.ts` nie istnieje, uruchom tylko pierwszy plik).

- [ ] **Step 6: Build, lint, testy, pomiar**

Run: `npx tsc -b && npm run lint && npm test`
Expected: bez błędów. Potem Procedura pomiaru A i wiersz „4” w tabeli. Oczekiwany niższy `pinsEffectMs` na zoomie 8.

- [ ] **Step 7: Commit**

```bash
git add src/lib/zoneConflict.ts src/lib/eventClusters.ts src/lib/eventClusters.test.ts docs/superpowers/specs/2026-09-24-map-pins-performance-design.md
git commit -m "Grupowanie pinezek w tym samym miejscu przez siatkę zamiast porównywania każdego z każdym; wynik identyczny, pilnuje test"
```

---

### Task 7: Pomiar końcowy, warstwy, sprzątanie

**Files:**
- Delete: `src/dev/legacyMapIcons.ts`, `src/dev/pinCompare.tsx`, `pin-compare.html`
- Modify: `docs/superpowers/specs/2026-09-24-map-pins-performance-design.md` (tabela „Pomiary”, wniosek)

- [ ] **Step 1: Pomiar końcowy**

Procedura pomiaru A i B na obu telefonach. Wiersz „końcowy” w tabeli. Porównaj z celami ze specu: ≥ 50 fps przy pinch na średnim Androidzie, ~0 renderów/s w spoczynku, 4/6/7/9 elementów na pinezkę.

- [ ] **Step 2: Warstwy kompozytora (sekcja 5 specu)**

Wiktor, Android, `chrome://inspect` → More tools → Layers, na zoomie 8 z `?perfPins=1500`. Zanotuj liczbę warstw i pamięć. Decyzja w specu:
- cel z kroku 1 osiągnięty → wpisz „eksperyment niepotrzebny”, koniec;
- cel nieosiągnięty i warstw jest setki → wpisz obserwację i **zatrzymaj się**. Kolejny krok (osobny `pane` z `contain`, ewentualnie canvas) wymaga nowej rozmowy i osobnego specu.

- [ ] **Step 3: Usunięcie narzędzi tymczasowych (po akceptacji wyglądu przez Wiktora)**

```bash
git rm src/dev/legacyMapIcons.ts src/dev/pinCompare.tsx pin-compare.html
```
Narzędzia pomiarowe (`perfPins`, `perfProbe`) zostają. Są tylko w trybie dev i przydadzą się przy kolejnych zmianach mapy.

- [ ] **Step 4: Build, lint, testy**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: bez błędów. `grep -c "perf-" dist/assets/*.js` daje 0, czyli generator nie trafił do bundla. Jeśli trafił, zamień w `MapScreen` statyczny import `makePerfEvents` na `import.meta.env.DEV ? makePerfEvents(...) : []`, sprawdź ponownie i opisz to w commicie.

- [ ] **Step 5: Commit**

```bash
git add -A docs/superpowers/specs/2026-09-24-map-pins-performance-design.md
git commit -m "Pomiary płynności mapy po zmianach; tymczasowe porównanie starych i nowych pinezek usunięte"
```
