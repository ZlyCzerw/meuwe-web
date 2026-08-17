import type { EventWithMeta } from './types'

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
