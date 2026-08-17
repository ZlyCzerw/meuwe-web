import { useCallback, useEffect, useState } from 'react'
import {
  startChain, step, currentOf,
  type Chain, type ChainStrategy, type Dir,
} from '../lib/eventChain'
import type { EventWithMeta } from '../lib/types'

/**
 * Sznurek wydarzeń jako stan Reacta.
 *
 * `poolKey` to podpis tego, z czego zbudowana jest pula — filtry i dzień na
 * mapie. Gdy się zmienia, pula pod sznurkiem jest już inna, więc historia
 * odwiedzonych traci sens: zostaje samo wydarzenie, na które ktoś właśnie
 * patrzy, i to ono staje się nową kotwicą.
 */
export function useEventChain(
  pool: EventWithMeta[],
  strategy: ChainStrategy,
  poolKey: string,
) {
  const [chain, setChain] = useState<Chain | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- celowy reset przy wymianie puli
    setChain(c => (c ? startChain(currentOf(c)) : c))
  }, [poolKey])

  const start = useCallback((ev: EventWithMeta) => setChain(startChain(ev)), [])
  const close = useCallback(() => setChain(null), [])
  const replace = useCallback((ev: EventWithMeta) => {
    setChain(c => (c
      ? { ...c, path: c.path.map((e, i) => (i === c.cursor ? ev : e)) }
      : c))
  }, [])

  // Liczone tym samym `step`, którym chodzimy — strzałka nie może twierdzić
  // czegoś innego niż gest.
  const canGo = useCallback(
    (dir: Dir) => !!chain && step(chain, pool, dir, strategy) !== null,
    [chain, pool, strategy],
  )

  const go = useCallback((dir: Dir): EventWithMeta | null => {
    if (!chain) return null
    const next = step(chain, pool, dir, strategy)
    if (!next) return null
    setChain(next)
    return currentOf(next)
  }, [chain, pool, strategy])

  return {
    current: chain ? currentOf(chain) : null,
    start, close, replace, canGo, go,
  }
}
