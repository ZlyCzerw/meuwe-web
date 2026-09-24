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
