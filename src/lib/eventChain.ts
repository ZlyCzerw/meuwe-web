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
   * Zwrócone wydarzenie nie może już być na `chain.path` — `step` i tak tego
   * pilnuje, ale kontrakt ma to gwarantować, a nie zakładać po cichu.
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
    if (!next || chain.path.some(e => e.id === next.id)) return null
    return { path: [...chain.path, next], cursor: chain.path.length, anchorIdx: chain.anchorIdx }
  }
  if (chain.cursor > 0) {
    return { ...chain, cursor: chain.cursor - 1 }
  }
  const next = strategy.extend(chain, pool, dir)
  if (!next || chain.path.some(e => e.id === next.id)) return null
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
    const half = firstOnThisSide(chain, dir)
    const candidates = pool
      .filter(e => {
        if (visited.has(e.id)) return false
        if (!half) return true
        // Proste porównanie długości geograficznej — meuwe pokrywa Polskę i
        // Wyspy Kanaryjskie, więc antypodalny południk 180° nigdy nie
        // wchodzi w grę. Gdyby kiedyś wszedł, to porównanie by się myliło.
        if (dir === 'east' && e.lng <= from.lng) return false
        if (dir === 'west' && e.lng >= from.lng) return false
        return true
      })
      .map(e => ({ e, km: haversineKm(from.lat, from.lng, e.lat, e.lng) }))
      .filter(c => c.km <= MAX_JUMP_KM)
    if (candidates.length === 0) return null
    // Remis rozstrzyga id, żeby ta sama okolica zawsze dawała tę samą trasę.
    return candidates.reduce((best, c) => {
      if (c.km !== best.km) return c.km < best.km ? c : best
      return c.e.id < best.e.id ? c : best
    }).e
  },
}

/**
 * Sznurek po liście: „obok" znaczy sąsiedni wiersz, nie sąsiednie miejsce.
 * Używany w Moich i Obserwowanych, gdzie użytkownik przegląda własną listę i
 * geografia wyprowadziłaby go z niej w nieoczekiwane miejsce.
 */
export const listStrategy: ChainStrategy = {
  extend(chain, pool, dir) {
    const from = currentOf(chain)
    const i = pool.findIndex(e => e.id === from.id)
    if (i === -1) return null
    const next = pool[dir === 'east' ? i + 1 : i - 1]
    return next ?? null
  },
}
