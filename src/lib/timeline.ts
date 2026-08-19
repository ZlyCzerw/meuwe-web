/**
 * Oś dni pod mapą: krótki pasek kalendarza, po którym chodzi wybór dnia.
 * Indeks 0 to wczoraj, 1 to dziś, dalej dwa tygodnie w przód.
 */
export const DAYS_COUNT = 15
export const TODAY_IDX = 1

export function idxToOffset(idx: number) { return idx - TODAY_IDX }  // 0→-1, 1→0, 2→+1 …

export function idxToDate(idx: number, now: Date = new Date()): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + idxToOffset(idx))
  return d
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/**
 * Dzień z kalendarza na miejsce na osi. Liczone od lokalnej północy, bo oś
 * mówi o dniach, a nie o dobach od teraz. Poza oś nie ma dokąd trafić, więc
 * bardzo odległe wydarzenie ląduje na jej krańcu — bliżej już się nie da.
 */
export function dateToIdx(d: Date, now: Date = new Date()): number {
  const diff = Math.round((midnight(d) - midnight(now)) / 86_400_000)
  return Math.min(DAYS_COUNT - 1, Math.max(0, TODAY_IDX + diff))
}
