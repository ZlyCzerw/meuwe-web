import type { Dir } from './eventChain'

/** Po tylu pikselach gest deklaruje oś i już jej nie zmienia. */
export const AXIS_LOCK_PX = 10
/** Ułamek szerokości karty, po którym poziomy gest zmienia wydarzenie. */
export const COMMIT_RATIO = 0.25
/** …ale nigdy mniej niż tyle, żeby na wąskiej karcie nie było zbyt czule. */
export const COMMIT_MIN_PX = 70

export type Axis = 'none' | 'horizontal' | 'vertical'

/**
 * Oś gestu. Dopóki palec nie przejechał AXIS_LOCK_PX, gest jest
 * nierozstrzygnięty — dzięki temu drgnięcie w bok przy przeciąganiu karty
 * w górę nie przełącza wydarzenia. Remis idzie na pion, bo snapy są główną
 * funkcją tej karty.
 */
export function resolveAxis(dx: number, dy: number): Axis {
  const ax = Math.abs(dx), ay = Math.abs(dy)
  if (Math.max(ax, ay) < AXIS_LOCK_PX) return 'none'
  return ax > ay ? 'horizontal' : 'vertical'
}

/** Kierunek, w który poszedł gest, albo null, gdy nie dociągnął do progu. */
export function commitDir(dx: number, width: number): Dir | null {
  const threshold = Math.max(COMMIT_MIN_PX, width * COMMIT_RATIO)
  if (dx <= -threshold) return 'east'
  if (dx >= threshold) return 'west'
  return null
}

/** Kierunek, w który idzie palec: w lewo znaczy na wschód (patrz commitDir). */
export function dirOf(dx: number): Dir {
  return dx < 0 ? 'east' : 'west'
}

/**
 * Co robi karta, gdy gest poziomy zaczął się nad czymś, co samo przewija się
 * w poziomie (kadr zdjęć, pasek tagów).
 *
 *  scroll  scroller ma jeszcze dokąd jechać — karta milczy, przewija natywnie.
 *  bounce  scroller stoi na krawędzi w tę stronę — karta jedzie za palcem, ale
 *          po puszczeniu wraca. Palec czuje koniec zdjęć, nic się nie zmienia.
 *  swipe   ta sama krawędź już raz odbiła — teraz to zwykły gest karty.
 *
 * Kolejność ma znaczenie: `scroll` wygrywa nawet z uzbrojeniem, bo kto cofnął
 * zdjęcia, ten znów chce je przewijać, a nie zmieniać wydarzenie.
 */
export type HMode = 'scroll' | 'bounce' | 'swipe'

export function resolveHMode(ctx: { dir: Dir; atStart: boolean; atEnd: boolean; primed: Dir | null }): HMode {
  const atEdge = ctx.dir === 'east' ? ctx.atEnd : ctx.atStart
  if (!atEdge) return 'scroll'
  return ctx.primed === ctx.dir ? 'swipe' : 'bounce'
}

/** Stan uzbrojenia po geście: odbicie uzbraja, swipe utrzymuje, przewinięcie rozbraja. */
export function nextPrimed(mode: HMode, dir: Dir, primed: Dir | null): Dir | null {
  if (mode === 'scroll') return null
  if (mode === 'bounce') return dir
  return primed
}
