/**
 * How many priority chips fit before the "+" button.
 * Layout is: [All] [chip]... [Plus], packed with `gap` between every item.
 * With k chips there are k+2 items and k+1 gaps.
 * Returns the largest k in [0, chipWidths.length] whose total width <= available.
 */
export function computeVisibleCount(
  available: number,
  chipWidths: number[],
  allWidth: number,
  plusWidth: number,
  gap: number,
): number {
  if (available <= 0) return 0
  let count = 0
  let sum = 0
  for (let k = 1; k <= chipWidths.length; k++) {
    sum += chipWidths[k - 1]
    const total = allWidth + sum + plusWidth + gap * (k + 1)
    if (total <= available) count = k
    else break
  }
  return count
}
