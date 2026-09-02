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
 *  swipe   scroller stoi na krawędzi w tę stronę — gest należy do karty.
 *
 * Jedno zdjęcie stoi na obu krawędziach naraz, więc każdy ruch w bok jest
 * swipe'em karty.
 */
export type HMode = 'scroll' | 'swipe'

/** Wspólny rdzeń obu reguł: gest jest karty tylko wtedy, gdy scroller pod palcem stoi na krawędzi w tę stronę. */
function claimsEdge(towardsEnd: boolean, atStart: boolean, atEnd: boolean): boolean {
  return towardsEnd ? atEnd : atStart
}

export function resolveHMode(ctx: { dir: Dir; atStart: boolean; atEnd: boolean }): HMode {
  return claimsEdge(ctx.dir === 'east', ctx.atStart, ctx.atEnd) ? 'swipe' : 'scroll'
}

/**
 * To samo dla pionu, nad treścią karty w trybie full: palec w dół przy samej
 * górze zmniejsza kartę, każdy inny gest przewija treść. Decyzja zapada przy
 * starcie gestu — treść, która dojedzie do góry w trakcie ciągnięcia, nie
 * oddaje gestu karcie; nowy gest to nowa decyzja (tak robi Material i iOS,
 * i tylko tak da się to zrobić bez preventDefault na pasywnym touchmove).
 */
export type VMode = 'scroll' | 'sheet'

export function resolveVMode(ctx: { down: boolean; atTop: boolean; atBottom: boolean }): VMode {
  // Palec w dół chce ku początkowi treści, więc "krawędź w tę stronę" to góra.
  return claimsEdge(!ctx.down, ctx.atTop, ctx.atBottom) ? 'sheet' : 'scroll'
}
