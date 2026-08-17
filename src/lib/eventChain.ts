import type { EventWithMeta } from './types'
import { haversineKm } from './geo'

/** 'east' to swipe w lewo: karta wychodzi w lewo, następna nadchodzi z prawej. */
export type Dir = 'east' | 'west'

/**
 * Przebyta droga i miejsce na niej.
 *
 * `anchorIdx` wskazuje wydarzenie otwarte ręcznie. Nie da się go wyliczyć,
 * bo doklejanie od zachodu przesuwa wszystkie indeksy — a to właśnie po nim
 * strategia poznaje, że robi pierwszy krok na daną stronę.
 */
export type Chain = { path: EventWithMeta[]; cursor: number; anchorIdx: number }

export interface ChainStrategy {
  /**
   * Wydarzenie, na którym stanie krok w danym kierunku, albo null, gdy nie ma
   * dokąd iść. Wołane wyłącznie wtedy, gdy kursor stoi na końcu ścieżki po tej
   * stronie — chodzenie po już przetartej drodze strategii nie potrzebuje.
   */
  extend(chain: Chain, pool: EventWithMeta[], dir: Dir): EventWithMeta | null
}

export function startChain(anchor: EventWithMeta): Chain {
  return { path: [anchor], cursor: 0, anchorIdx: 0 }
}

export function currentOf(chain: Chain): EventWithMeta {
  return chain.path[chain.cursor]
}

/**
 * Jeden krok po sznurku; null oznacza, że kroku nie da się zrobić i karta ma
 * odbić. Cała wiedza o tym, co jest „obok", siedzi w strategii — dzięki temu
 * wymiana mechanizmu nie dotyka ruchu po ścieżce.
 */
export function step(
  chain: Chain, pool: EventWithMeta[], dir: Dir, strategy: ChainStrategy,
): Chain | null {
  if (dir === 'east') {
    if (chain.cursor < chain.path.length - 1) {
      return { ...chain, cursor: chain.cursor + 1 }
    }
    const next = strategy.extend(chain, pool, dir)
    if (!next) return null
    return { path: [...chain.path, next], cursor: chain.path.length, anchorIdx: chain.anchorIdx }
  }
  if (chain.cursor > 0) {
    return { ...chain, cursor: chain.cursor - 1 }
  }
  const next = strategy.extend(chain, pool, dir)
  if (!next) return null
  return { path: [next, ...chain.path], cursor: 0, anchorIdx: chain.anchorIdx + 1 }
}

/**
 * Najdłuższy skok, jaki sznurek wykona. Powyżej tego uznajemy, że w okolicy nic
 * już nie ma — lepiej odbić kartę niż przerzucić kogoś na drugi koniec wyspy.
 */
export const MAX_JUMP_KM = 50

/**
 * Czy to pierwszy krok na tę stronę kotwicy. Tylko on ma znaczenie kierunkowe;
 * każdy następny idzie po prostu do najbliższego nieodwiedzonego.
 */
function firstOnThisSide(chain: Chain, dir: Dir): boolean {
  return dir === 'east'
    ? chain.anchorIdx === chain.path.length - 1
    : chain.anchorIdx === 0
}

export const geoStrategy: ChainStrategy = {
  extend(chain, pool, dir) {
    const from = currentOf(chain)
    const visited = new Set(chain.path.map(e => e.id))
    const candidates = pool.filter(e => {
      if (visited.has(e.id)) return false
      if (firstOnThisSide(chain, dir)) {
        if (dir === 'east' && e.lng <= from.lng) return false
        if (dir === 'west' && e.lng >= from.lng) return false
      }
      return haversineKm(from.lat, from.lng, e.lat, e.lng) <= MAX_JUMP_KM
    })
    if (candidates.length === 0) return null
    // Remis rozstrzyga id, żeby ta sama okolica zawsze dawała tę samą trasę.
    return candidates.reduce((best, e) => {
      const db = haversineKm(from.lat, from.lng, best.lat, best.lng)
      const de = haversineKm(from.lat, from.lng, e.lat, e.lng)
      if (de !== db) return de < db ? e : best
      return e.id < best.id ? e : best
    })
  },
}
