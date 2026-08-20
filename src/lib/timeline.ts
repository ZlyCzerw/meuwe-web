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

/** Zakres dni na osi, oba końce włącznie. Dzień to zakres o długości jeden. */
export interface DayRange { startIdx: number; endIdx: number }

/** Porządkuje dwa dotknięte indeksy, więc zaznaczanie wstecz działa samo. */
export function normalizeRange(a: number, b: number): DayRange {
  return a <= b ? { startIdx: a, endIdx: b } : { startIdx: b, endIdx: a }
}

export function isInRange(idx: number, range: DayRange): boolean {
  return idx >= range.startIdx && idx <= range.endIdx
}

/**
 * Wybór zakresu w toku. `anchorIdx` to data początkowa czekająca na swój
 * koniec — dopóki nie jest null, następne dotknięcie domyka zakres.
 */
export interface RangeSelection { range: DayRange; anchorIdx: number | null }

/**
 * Kolejne dotknięcie kafelka w trybie zakresu. Trzy stany chodzą w kółko:
 * nowy początek → koniec → nowy początek. Trzymane tutaj, a nie w komponencie,
 * bo to jedyna część wyboru daty, w której jest jakakolwiek decyzja.
 */
export function tapRange(sel: RangeSelection, idx: number): RangeSelection {
  if (sel.anchorIdx === null) {
    return { range: { startIdx: idx, endIdx: idx }, anchorIdx: idx }
  }
  return { range: normalizeRange(sel.anchorIdx, idx), anchorIdx: null }
}

/** Jak wygląda kafelek: kraniec zakresu, jego środek, podgląd albo nic. */
export type TileState = 'idle' | 'edge' | 'inside' | 'preview'

/**
 * `preview` to zakres rysowany pod kursorem, zanim ktokolwiek go zatwierdzi.
 * Gdy jest, wypiera zaznaczenie — poza własną kotwicą, która zostaje krańcem,
 * żeby było widać, od czego zakres się liczy.
 */
export function tileState(
  idx: number,
  range: DayRange,
  preview: { anchorIdx: number; range: DayRange } | null,
): TileState {
  if (preview) {
    if (idx === preview.anchorIdx) return 'edge'
    return isInRange(idx, preview.range) ? 'preview' : 'idle'
  }
  if (idx === range.startIdx || idx === range.endIdx) return 'edge'
  return isInRange(idx, range) ? 'inside' : 'idle'
}

/**
 * Okno czasu, o które pyta zapytanie o wydarzenia. Wydarzenie trafia na mapę,
 * jeśli nachodzi na nie choćby częściowo.
 *
 * `endTimeFloor` to jedyna decyzja w całym zapytaniu: zakres zaczynający się
 * dziś chowa to, co już się skończyło, a każdy inny liczy się od swojej
 * pierwszej północy — dlatego wybranie wczoraj nadal pokazuje wczorajsze
 * zakończone wydarzenia.
 */
export function rangeWindow(startOffset: number, endOffset: number, now: Date = new Date()) {
  const s = new Date(now); s.setDate(s.getDate() + startOffset)
  const e = new Date(now); e.setDate(e.getDate() + endOffset)
  const dayStart = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0)
  const dayEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999)
  return { dayStart, dayEnd, endTimeFloor: startOffset === 0 ? now : dayStart }
}
