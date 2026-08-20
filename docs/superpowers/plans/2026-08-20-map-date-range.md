# Zakres dat na mapie — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mapa meuwe pokazuje wydarzenia z wybranego zakresu dat, a nie tylko z jednego dnia.

**Architecture:** Cała logika dat schodzi do czystych funkcji w `src/lib/timeline.ts` (porządkowanie zakresu, maszyna stanu dotknięć, okno czasowe zapytania, stan wizualny kafelka). Pasek dni wychodzi z `MapScreen` do nowego komponentu `src/components/DayTimeline.tsx`. `useEvents` i `db.getEvents` przyjmują parę offsetów zamiast jednego, dzięki czemu jedno zapytanie obsługuje dowolnie długi zakres.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react (jsdom), Leaflet, Supabase, i18next.

**Spec:** `docs/superpowers/specs/2026-08-20-map-date-range-design.md`

---

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `src/lib/timeline.ts` (modyfikacja) | Oś dni: indeksy ↔ daty, `DayRange`, porządkowanie zakresu, maszyna dotknięć, okno czasowe zapytania, stan wizualny kafelka. Bez Reacta i bez DOM. |
| `src/lib/timeline.test.ts` (modyfikacja) | Testy wszystkich powyższych. |
| `src/lib/tokens.ts` (modyfikacja) | Nowy kolor `primaryRange`. |
| `src/components/DayTimeline.tsx` (nowy) | Pigułka, przewijany pasek, przełącznik trybu, podgląd na hover. Nie wie nic o mapie ani o pobieraniu danych. |
| `src/components/DayTimeline.test.tsx` (nowy) | Testy zachowania paska. |
| `src/lib/supabase.ts` (modyfikacja) | `getEvents` przyjmuje offset końcowy i bierze okno z `rangeWindow`. |
| `src/hooks/useEvents.ts` (modyfikacja) | Klucz zapytania i czyszczenie cache po parze offsetów. |
| `src/hooks/useEvents.test.tsx` (modyfikacja) | Test zmiany końca zakresu. |
| `src/screens/MapScreen.tsx` (modyfikacja) | Trzyma `range` i `mode`, spina pasek z `useEvents`, pustą kartą i pulą kart. |
| `src/locales/{pl,en,es,de,sl}.ts` (modyfikacja) | `map.modeDay`, `map.modeRange`. |
| `src/locales/parity.test.ts` (modyfikacja) | Pilnuje obecności obu kluczy w pięciu językach. |

## Decyzja dopisana do specyfikacji podczas planowania

Strzałki `‹ ›` po bokach paska w trybie „Dzień" przesuwają wybrany dzień, tak jak dotychczas. W trybie „Zakres dat" **przewijają tylko widok paska** (przesuwają okno o jeden dzień), nie ruszając zaznaczenia — inaczej nie dałoby się dojść do odległej daty końcowej bez zniszczenia zaznaczonego początku. Realizuje to `focusIdx` w `DayTimeline` (Task 6).

---

### Task 1: Model zakresu w `lib/timeline.ts`

**Files:**
- Modify: `src/lib/timeline.ts`
- Test: `src/lib/timeline.test.ts`

- [ ] **Step 1: Write the failing tests**

Dopisz na końcu `src/lib/timeline.test.ts`:

```ts
describe('normalizeRange', () => {
  it('zostawia zakres wybrany od najwcześniejszej daty', () => {
    expect(normalizeRange(2, 6)).toEqual({ startIdx: 2, endIdx: 6 })
  })

  it('zamienia daty, gdy zakres zaznaczono wstecz', () => {
    // Tap na niedzielę 23.08 (idx 5), potem na środę 19.08 (idx 1).
    expect(normalizeRange(5, 1)).toEqual({ startIdx: 1, endIdx: 5 })
  })

  it('ta sama data z obu stron to zakres jednodniowy', () => {
    expect(normalizeRange(3, 3)).toEqual({ startIdx: 3, endIdx: 3 })
  })
})

describe('isInRange', () => {
  const range = { startIdx: 2, endIdx: 5 }

  it('obejmuje oba końce', () => {
    expect(isInRange(2, range)).toBe(true)
    expect(isInRange(5, range)).toBe(true)
  })

  it('obejmuje środek', () => {
    expect(isInRange(4, range)).toBe(true)
  })

  it('nie obejmuje dni poza zakresem', () => {
    expect(isInRange(1, range)).toBe(false)
    expect(isInRange(6, range)).toBe(false)
  })
})

describe('tapRange', () => {
  const start = { range: { startIdx: 1, endIdx: 1 }, anchorIdx: null }

  it('pierwsze dotknięcie zwija zakres do jednego dnia i zapamiętuje początek', () => {
    expect(tapRange(start, 5)).toEqual({
      range: { startIdx: 5, endIdx: 5 }, anchorIdx: 5,
    })
  })

  it('drugie dotknięcie dopina koniec i zwalnia kotwicę', () => {
    const afterFirst = tapRange(start, 5)
    expect(tapRange(afterFirst, 8)).toEqual({
      range: { startIdx: 5, endIdx: 8 }, anchorIdx: null,
    })
  })

  it('drugie dotknięcie we wcześniejszą datę zaznacza wstecz', () => {
    const afterFirst = tapRange(start, 5)
    expect(tapRange(afterFirst, 1)).toEqual({
      range: { startIdx: 1, endIdx: 5 }, anchorIdx: null,
    })
  })

  it('trzecie dotknięcie zaczyna nowy zakres', () => {
    const complete = tapRange(tapRange(start, 5), 8)
    expect(tapRange(complete, 2)).toEqual({
      range: { startIdx: 2, endIdx: 2 }, anchorIdx: 2,
    })
  })
})

describe('tileState', () => {
  const range = { startIdx: 2, endIdx: 5 }

  it('bez podglądu maluje końce, środek i resztę osobno', () => {
    expect(tileState(2, range, null)).toBe('edge')
    expect(tileState(5, range, null)).toBe('edge')
    expect(tileState(3, range, null)).toBe('inside')
    expect(tileState(9, range, null)).toBe('idle')
  })

  it('podgląd zastępuje zaznaczenie, a kotwica zostaje końcem', () => {
    const preview = { anchorIdx: 2, range: { startIdx: 2, endIdx: 7 } }
    expect(tileState(2, range, preview)).toBe('edge')
    expect(tileState(6, range, preview)).toBe('preview')
    expect(tileState(3, range, preview)).toBe('preview')
    expect(tileState(9, range, preview)).toBe('idle')
  })
})
```

Rozszerz import na górze pliku testowego:

```ts
import {
  dateToIdx, idxToDate, idxToOffset, DAYS_COUNT, TODAY_IDX,
  normalizeRange, isInRange, tapRange, tileState,
} from './timeline'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: FAIL — `normalizeRange is not a function` (i analogicznie dla pozostałych).

- [ ] **Step 3: Write the implementation**

Dopisz na końcu `src/lib/timeline.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: PASS — wszystkie testy pliku, łącznie z dotychczasowymi `dateToIdx` i `idxToOffset`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/timeline.test.ts
git commit -m "Model zakresu dni na osi czasu"
```

---

### Task 2: Okno czasowe zapytania (`rangeWindow`)

**Files:**
- Modify: `src/lib/timeline.ts`
- Test: `src/lib/timeline.test.ts`

- [ ] **Step 1: Write the failing tests**

Dopisz na końcu `src/lib/timeline.test.ts` (stała `now` jest już zadeklarowana na górze pliku — 19 sierpnia 2026, godz. 12:00):

```ts
describe('rangeWindow', () => {
  it('zakres jednodniowy na dziś obejmuje całą dzisiejszą dobę', () => {
    const w = rangeWindow(0, 0, now)
    expect(w.dayStart).toEqual(new Date(2026, 7, 19, 0, 0, 0, 0))
    expect(w.dayEnd).toEqual(new Date(2026, 7, 19, 23, 59, 59, 999))
  })

  it('zakres wielodniowy kończy się o północy ostatniego dnia', () => {
    const w = rangeWindow(0, 4, now)
    expect(w.dayStart).toEqual(new Date(2026, 7, 19, 0, 0, 0, 0))
    expect(w.dayEnd).toEqual(new Date(2026, 7, 23, 23, 59, 59, 999))
  })

  it('zakres zaczynający się dziś chowa wydarzenia już zakończone', () => {
    expect(rangeWindow(0, 4, now).endTimeFloor).toEqual(now)
  })

  it('zakres zaczynający się wczoraj pokazuje wczorajsze zakończone', () => {
    const w = rangeWindow(-1, 4, now)
    expect(w.endTimeFloor).toEqual(new Date(2026, 7, 18, 0, 0, 0, 0))
  })

  it('zakres w całości w przyszłości liczy się od swojej pierwszej północy', () => {
    const w = rangeWindow(3, 5, now)
    expect(w.endTimeFloor).toEqual(new Date(2026, 7, 22, 0, 0, 0, 0))
  })
})
```

Dopisz `rangeWindow` do importu na górze pliku testowego.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/timeline.test.ts -t rangeWindow`
Expected: FAIL — `rangeWindow is not a function`.

- [ ] **Step 3: Write the implementation**

Dopisz na końcu `src/lib/timeline.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/timeline.test.ts
git commit -m "Okno czasowe zapytania liczone dla zakresu dni"
```

---

### Task 3: `db.getEvents` przyjmuje koniec zakresu

**Files:**
- Modify: `src/lib/supabase.ts:237-247`

Testów nie dopisujemy: całe zapytanie to składanie filtrów PostgREST, a jedyna decyzja w nim — okno czasu — jest już pokryta testami `rangeWindow` z Taska 2.

- [ ] **Step 1: Add the import**

W `src/lib/supabase.ts` dopisz do istniejących importów na górze pliku:

```ts
import { rangeWindow } from './timeline'
```

- [ ] **Step 2: Replace the signature and the date arithmetic**

Zamień w `src/lib/supabase.ts` ten fragment:

```ts
  async getEvents(lat:number,lng:number,km=15,dayOffset=0):Promise<EventWithMeta[]|null> {
    const {dLat,dLng}=bboxDeltas(km,lat)
    // Compute the target day's start/end in local time, then convert to UTC.
    // This replicates the same semantics as the previous toDateString() comparison.
    const now    = new Date()
    const target = new Date()
    target.setDate(target.getDate() + dayOffset)
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0)
    const dayEnd   = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999)
    // For today: hide events whose end_time has already passed.
    // For future days: show all events that overlap that day.
    const endTimeFloor = dayOffset === 0 ? now : dayStart
```

na:

```ts
  /**
   * `dayOffsetEnd` domyślnie równa się początkowi, więc wywołanie jednodniowe
   * pyta dokładnie o to samo, co przed wprowadzeniem zakresów.
   */
  async getEvents(lat:number,lng:number,km=15,dayOffsetStart=0,dayOffsetEnd=dayOffsetStart):Promise<EventWithMeta[]|null> {
    const {dLat,dLng}=bboxDeltas(km,lat)
    const { dayEnd, endTimeFloor } = rangeWindow(dayOffsetStart, dayOffsetEnd)
```

Reszta ciała funkcji — zapytanie, mapowanie dystansów, RPC `get_event_interactions` — zostaje bez zmian. `dayStart` nie był używany nigdzie poza wyliczeniem `endTimeFloor`, dlatego nie ma go w destrukturyzacji.

- [ ] **Step 3: Verify the build**

Run: `npx tsc -b`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "getEvents pyta o zakres dni zamiast o jeden dzień"
```

---

### Task 4: `useEvents` kluczuje się parą offsetów

**Files:**
- Modify: `src/hooks/useEvents.ts`
- Test: `src/hooks/useEvents.test.tsx`

- [ ] **Step 1: Write the failing test**

Dopisz nowy blok na końcu `src/hooks/useEvents.test.tsx`:

```ts
describe('zakres dni', () => {
  it('rozszerzenie zakresu czyści piny i pyta o nową parę offsetów', async () => {
    const first = pendingEvents()
    getEvents.mockReturnValueOnce(first.promise)
    const { result, rerender } = renderHook(
      ({ end }) => useEvents(HERE, 0, end),
      { initialProps: { end: 0 } },
    )
    await act(async () => { first.resolve([here('a')]) })
    await waitFor(() => expect(result.current.events).toHaveLength(1))

    const second = pendingEvents()
    getEvents.mockReturnValueOnce(second.promise)
    rerender({ end: 3 })

    // Piny znikają w tym samym renderze, w którym zmienia się pytanie — bez
    // tego jedna klatka pokazywałaby wydarzenia spoza nowego zakresu.
    expect(result.current.events).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    expect(getEvents).toHaveBeenLastCalledWith(HERE.lat, HERE.lng, HERE.km, 0, 3)

    await act(async () => { second.resolve([here('a'), here('b')]) })
    await waitFor(() => expect(result.current.events).toHaveLength(2))
    expect(result.current.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useEvents.test.tsx -t "zakres dni"`
Expected: FAIL — `getEvents` dostaje cztery argumenty zamiast pięciu, a zmiana `end` nie czyści pinów.

- [ ] **Step 3: Write the implementation**

W `src/hooks/useEvents.ts` zamień sygnaturę:

```ts
export function useEvents(view: FetchView | null, dayOffset: number, refreshKey = 0) {
```

na:

```ts
export function useEvents(
  view: FetchView | null,
  startOffset: number,
  endOffset: number = startOffset,
  refreshKey = 0,
) {
```

Zamień wiersz z kluczem zapytania:

```ts
  const query = `${lat},${lng},${km},${dayOffset}`
```

na:

```ts
  const query = `${lat},${lng},${km},${startOffset},${endOffset}`
```

Zamień blok czyszczący cache:

```ts
  const [dayInState, setDayInState] = useState(dayOffset)
  if (dayInState !== dayOffset) {
    setDayInState(dayOffset)
    setEvents([])
  }
```

na:

```ts
  const rangeKey = `${startOffset},${endOffset}`
  const [rangeInState, setRangeInState] = useState(rangeKey)
  if (rangeInState !== rangeKey) {
    setRangeInState(rangeKey)
    setEvents([])
  }
```

W `load` zamień wywołanie:

```ts
    const data = await db.getEvents(lat, lng, km, dayOffset)
```

na:

```ts
    const data = await db.getEvents(lat, lng, km, startOffset, endOffset)
```

i zamień listę zależności `useCallback`:

```ts
  }, [lat, lng, km, dayOffset, query])
```

na:

```ts
  }, [lat, lng, km, startOffset, endOffset, query])
```

Popraw też komentarz nad blokiem czyszczącym — mówi o dniu, a chodzi o zakres:

```ts
  // A different range is a different set of events, not more of the same one,
  // so the cache cannot carry across it. Cleared during the render that brings
  // the new range in rather than in an effect afterwards: an effect would leave
  // one painted frame showing the old range's pins under the new question.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useEvents.test.tsx`
Expected: PASS — nowy blok i wszystkie dotychczasowe testy hooka.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEvents.ts src/hooks/useEvents.test.tsx
git commit -m "useEvents pobiera wydarzenia dla zakresu dni"
```

---

### Task 5: Teksty przełącznika w pięciu językach

**Files:**
- Modify: `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`, `src/locales/sl.ts`
- Test: `src/locales/parity.test.ts`

- [ ] **Step 1: Write the failing test**

W `src/locales/parity.test.ts` dopisz pod istniejącą stałą `NEW_EVENT_KEYS`:

```ts
const MAP_MODE_KEYS = ['modeDay', 'modeRange'] as const
```

i dopisz nowy blok na końcu pliku:

```ts
describe('timeline mode switch', () => {
  it.each(Object.entries(LOCALES))('%s names both timeline modes', (_name, dict) => {
    const map = (dict as { map: Record<string, unknown> }).map
    for (const key of MAP_MODE_KEYS) {
      expect(typeof map[key]).toBe('string')
      expect(map[key]).not.toBe('')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/locales/parity.test.ts -t "timeline mode"`
Expected: FAIL — pięć razy `expected undefined to be 'string'`.

- [ ] **Step 3: Add the keys**

W każdym pliku lokalizacji dopisz dwa klucze w bloku `map`, tuż pod wierszem `today: … , yesterday: …` (wiersz 28 w `pl.ts`, wiersz 30 w pozostałych):

`src/locales/pl.ts`:
```ts
    modeDay: 'Dzień', modeRange: 'Zakres dat',
```

`src/locales/en.ts`:
```ts
    modeDay: 'Day', modeRange: 'Date range',
```

`src/locales/es.ts`:
```ts
    modeDay: 'Día', modeRange: 'Rango de fechas',
```

`src/locales/de.ts`:
```ts
    modeDay: 'Tag', modeRange: 'Zeitraum',
```

`src/locales/sl.ts`:
```ts
    modeDay: 'Dan', modeRange: 'Obdobje',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/locales
git commit -m "Nazwy trybów paska dat w pięciu językach"
```

---

### Task 6: Komponent `DayTimeline` — przeniesienie paska bez zmiany zachowania

Ten task tylko przenosi kod. Pasek ma po nim działać dokładnie tak jak przed zmianą: jeden dzień, żadnego przełącznika. Zakres dochodzi w Tasku 7.

**Files:**
- Create: `src/components/DayTimeline.tsx`
- Modify: `src/screens/MapScreen.tsx`

- [ ] **Step 1: Create the component**

Utwórz `src/components/DayTimeline.tsx`:

```tsx
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK } from '../lib/tokens'
import {
  DAYS_COUNT, idxToDate, idxToOffset, tileState,
  type DayRange,
} from '../lib/timeline'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

/** Szerokość kafelka i przerwa między nimi — z nich liczy się przewijanie. */
const TILE = 56
const GAP = 4
const TRACK = 270
const MAX_TRANSLATE = 0
const MIN_TRANSLATE = -(DAYS_COUNT * TILE + (DAYS_COUNT - 1) * GAP - TRACK)

function idxToTranslate(idx: number) {
  return Math.max(MIN_TRANSLATE, Math.min(MAX_TRANSLATE, 107 - idx * (TILE + GAP)))
}
function translateToIdx(tx: number) {
  return Math.max(0, Math.min(DAYS_COUNT - 1, Math.round((107 - tx) / (TILE + GAP))))
}

/**
 * Pasek wyboru dnia pod mapą. Nie wie nic o mapie ani o pobieraniu danych —
 * dostaje zakres i oddaje nowy zakres.
 */
export default function DayTimeline({
  open, onOpenChange, range, onRangeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  range: DayRange
  onRangeChange: (r: DayRange) => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'

  /** Kafelek, na którym stoi okno przewijania. */
  const [focusIdx, setFocusIdx] = useState(range.startIdx)
  const [liveTranslate, setLiveTranslate] = useState<number | null>(null)
  const drag = useRef({ startX: 0, baseTranslate: 0, on: false, moved: false })

  /**
   * Dotknięcie kafelka dochodzi dwiema drogami: przez `pointerup` na pasku
   * (to ta, którą chodzą palce — przechwycony wskaźnik zabiera klikowi jego
   * cel) i przez `onClick` samego kafelka, który zostaje dla klawiatury.
   * Znacznik czasu pilnuje, żeby jedno dotknięcie nie policzyło się dwa razy.
   */
  const lastAppliedAt = useRef(0)

  function select(idx: number, from: 'pointer' | 'click') {
    if (from === 'click' && Date.now() - lastAppliedAt.current < 400) return
    lastAppliedAt.current = Date.now()
    setFocusIdx(idx)
    onRangeChange({ startIdx: idx, endIdx: idx })
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, baseTranslate: idxToTranslate(focusIdx), on: true, moved: false }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.on) return
    const delta = e.clientX - drag.current.startX
    if (Math.abs(delta) > 8) drag.current.moved = true
    if (!drag.current.moved) return
    const raw = drag.current.baseTranslate + delta
    setLiveTranslate(Math.max(MIN_TRANSLATE, Math.min(MAX_TRANSLATE, raw)))
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.on) return
    drag.current.on = false
    if (drag.current.moved && liveTranslate !== null) {
      setFocusIdx(translateToIdx(liveTranslate))
    } else if (!drag.current.moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const dayEl = el?.closest('[data-day-idx]') as HTMLElement | null
      if (dayEl?.dataset.dayIdx != null) select(Number(dayEl.dataset.dayIdx), 'pointer')
    }
    setLiveTranslate(null)
  }
  function onPointerCancel() {
    drag.current.on = false
    setLiveTranslate(null)
  }

  function step(delta: number) {
    const next = Math.max(0, Math.min(DAYS_COUNT - 1, focusIdx + delta))
    setFocusIdx(next)
    onRangeChange({ startIdx: next, endIdx: next })
  }

  const pillLabel = (() => {
    const d = idxToDate(range.startIdx)
    const offset = idxToOffset(range.startIdx)
    const dayLabel = offset === 0 ? t('map.today')
      : offset === -1 ? t('map.yesterday')
      : d.toLocaleDateString(loc, { weekday: 'long' })
    return `${dayLabel} · ${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`
  })()

  if (!open) {
    return (
      <button onClick={() => onOpenChange(true)} style={{
        padding: '10px 20px', borderRadius: 999,
        background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
        fontSize: 13, fontWeight: 800, color: INK,
        display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto',
      }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: C.primary, border: `1.5px solid ${INK}` }} />
        {pillLabel}
      </button>
    )
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      data-testid="day-strip"
      style={{
        padding: '6px 8px', borderRadius: 999, background: '#fff',
        border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
        display: 'flex', alignItems: 'center', gap: 4,
        touchAction: 'none', cursor: 'grab', userSelect: 'none', pointerEvents: 'auto',
      }}
    >
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => step(-1)}
        style={{
          flexShrink: 0, width: 20, background: 'none', border: 'none', padding: 0,
          color: INK, opacity: focusIdx > 0 ? 0.7 : 0.2,
          fontWeight: 900, fontSize: 18, cursor: focusIdx > 0 ? 'pointer' : 'default',
        }}
      >‹</button>

      <div style={{ width: TRACK, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', gap: GAP,
          transition: liveTranslate !== null ? 'none' : 'transform 300ms cubic-bezier(0.32,1.2,0.4,1)',
          transform: `translateX(${liveTranslate !== null ? liveTranslate : idxToTranslate(focusIdx)}px)`,
        }}>
          {Array.from({ length: DAYS_COUNT }, (_, i) => {
            const d = idxToDate(i)
            const isToday = idxToOffset(i) === 0
            const state = tileState(i, range, null)
            const active = state === 'edge' || state === 'inside'
            return (
              <button
                key={i}
                data-day-idx={i}
                onPointerDown={e => e.stopPropagation()}
                onClick={() => select(i, 'click')}
                style={{
                  flexShrink: 0, width: TILE, borderRadius: 14,
                  padding: '6px 0', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 1,
                  background: active ? C.primary : isToday ? C.primarySoft : 'transparent',
                  color: active ? '#fff' : C.ink,
                  border: active ? `2px solid ${INK}` : '2px solid transparent',
                  fontSize: 11, fontWeight: 800,
                  transition: 'all 200ms ease',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                  {isToday ? t('map.today').slice(0, 3)
                    : d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '')}
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{d.getDate()}</span>
                <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>
                  {d.toLocaleDateString(loc, { month: 'short' }).replace('.', '')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => step(1)}
        style={{
          flexShrink: 0, width: 20, background: 'none', border: 'none', padding: 0,
          color: INK, opacity: focusIdx < DAYS_COUNT - 1 ? 0.7 : 0.2,
          fontWeight: 900, fontSize: 18, cursor: focusIdx < DAYS_COUNT - 1 ? 'pointer' : 'default',
        }}
      >›</button>

      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onOpenChange(false)}
        aria-label="close-timeline"
        style={{ flexShrink: 0, width: 24, color: INK, fontWeight: 900, opacity: 0.5, fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}
      >×</button>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into MapScreen**

W `src/screens/MapScreen.tsx` dopisz import:

```ts
import DayTimeline from '../components/DayTimeline'
```

Zamień stan dnia (wiersz 106):

```ts
  const [dayIdx, setDayIdx] = useState(1)
```

na:

```ts
  const [range, setRange] = useState<DayRange>({ startIdx: TODAY_IDX, endIdx: TODAY_IDX })
  const dayIdx = range.startIdx
  const setDayIdx = (next: number | ((prev: number) => number)) => {
    setRange(prev => {
      const idx = typeof next === 'function' ? next(prev.startIdx) : next
      return { startIdx: idx, endIdx: idx }
    })
  }
```

Zamień import z `../lib/timeline` — `DAYS_COUNT` przechodzi do `DayTimeline`, a projekt ma włączone `noUnusedLocals`, więc zostawiony w `MapScreen` wywróci build:

```ts
import { TODAY_IDX, idxToOffset, idxToDate, dateToIdx, type DayRange } from '../lib/timeline'
```

Usuń z `MapScreen` cały blok przewijania paska — stałe `MAX_TRANSLATE`, `MIN_TRANSLATE`, funkcje `idxToTranslate`, `translateToIdx`, stan `liveTranslate`, ref `tlDrag` oraz funkcje `tlPD`, `tlPM`, `tlPU`, `tlCancel` (wiersze 213-255). Wszystko to żyje teraz w `DayTimeline`.

Zamień całą zawartość kontenera `{/* Timeline */}` (wiersze 687-790, czyli wyrażenie `!timelineOpen ? (…) : (…)` wraz z oboma gałęziami) na:

```tsx
        <DayTimeline
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          range={range}
          onRangeChange={setRange}
        />
```

Otaczający `<div style={{ position: 'absolute', bottom: 168, … }}>` z `pointerEvents: 'none'` zostaje bez zmian.

- [ ] **Step 3: Verify the build and the suite**

Run: `npx tsc -b && npm test`
Expected: kompilacja bez błędów, cała bateria testów przechodzi. `idxToDate` i `idxToOffset` zostają w `MapScreen`, bo korzysta z nich `dayLabel`; `TODAY_IDX` — bo korzysta z niego stan początkowy i pusta karta.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayTimeline.tsx src/screens/MapScreen.tsx
git commit -m "Pasek wyboru dnia jako osobny komponent"
```

---

### Task 7: Przełącznik trybu i wybór zakresu

**Files:**
- Modify: `src/lib/tokens.ts`
- Modify: `src/components/DayTimeline.tsx`
- Test: `src/components/DayTimeline.test.tsx` (nowy)

- [ ] **Step 1: Write the failing tests**

Utwórz `src/components/DayTimeline.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import DayTimeline, { type TimelineMode } from './DayTimeline'
import { TODAY_IDX, type DayRange } from '../lib/timeline'
// Bez tego tłumacz zwraca surowe klucze i asercje na napisach nic nie znaczą.
import '../lib/i18n'

// jsdom nie zna przechwytywania wskaźnika, a komponent woła je na każdym
// wciśnięciu — bez atrapy każdy test wywraca się na TypeError.
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

/** Pasek z prawdziwym stanem, tak jak trzyma go MapScreen. */
function Harness({ onRange }: { onRange?: (r: DayRange) => void }) {
  const [range, setRange] = useState<DayRange>({ startIdx: TODAY_IDX, endIdx: TODAY_IDX })
  const [mode, setMode] = useState<TimelineMode>('day')
  return (
    <DayTimeline
      open
      onOpenChange={() => {}}
      mode={mode}
      onModeChange={setMode}
      range={range}
      onRangeChange={r => { setRange(r); onRange?.(r) }}
    />
  )
}

const tile = (idx: number) => screen.getByTestId(`day-${idx}`)
const toRange = () => fireEvent.click(screen.getByRole('button', { name: 'Date range' }))

describe('tryb dnia', () => {
  it('dotknięcie kafelka wybiera jeden dzień', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    fireEvent.click(tile(5))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })
  })
})

describe('tryb zakresu', () => {
  it('dwa dotknięcia składają zakres', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })
    fireEvent.click(tile(8))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 8 })
  })

  it('drugie dotknięcie we wcześniejszą datę zaznacza wstecz', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(tile(1))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 1, endIdx: 5 })
  })

  it('trzecie dotknięcie zaczyna nowy zakres', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(tile(8))
    fireEvent.click(tile(2))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 2, endIdx: 2 })
  })

  it('powrót na tryb dnia zrównuje koniec z początkiem', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    fireEvent.click(tile(5))
    fireEvent.click(tile(8))
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(onRange).toHaveBeenLastCalledWith({ startIdx: 5, endIdx: 5 })
  })

  it('przeciągnięcie przewija pasek i niczego nie zaznacza', () => {
    const onRange = vi.fn()
    render(<Harness onRange={onRange} />)
    toRange()
    const strip = screen.getByTestId('day-strip')
    fireEvent.pointerDown(strip, { clientX: 200, pointerId: 1 })
    fireEvent.pointerMove(strip, { clientX: 120, pointerId: 1 })
    fireEvent.pointerUp(strip, { clientX: 120, pointerId: 1 })
    expect(onRange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/DayTimeline.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the name "Date range"`.

- [ ] **Step 3: Add the colour token**

W `src/lib/tokens.ts` zamień pierwszy wiersz obiektu `C`:

```ts
  primary: '#FF7A45', primaryPress: '#E85A2A', primarySoft: '#FFD4C0',
```

na:

```ts
  primary: '#FF7A45', primaryPress: '#E85A2A', primarySoft: '#FFD4C0',
  // Ćwierć drogi z primarySoft do primary: dni w środku zakresu mają być
  // ciemniejsze od podpowiedzi pod kursorem, a jaśniejsze od jego krańców.
  primaryRange: '#FFBEA1',
```

- [ ] **Step 4: Widen the component's imports and props**

W `src/components/DayTimeline.tsx` zamień import z `../lib/timeline`:

```ts
import {
  DAYS_COUNT, idxToDate, idxToOffset, tileState,
  type DayRange,
} from '../lib/timeline'
```

na:

```ts
import {
  DAYS_COUNT, idxToDate, idxToOffset, normalizeRange, tapRange, tileState,
  type DayRange, type RangeSelection,
} from '../lib/timeline'
```

Dopisz typ trybu nad komponentem, pod stałymi `TILE`/`GAP`/`TRACK`:

```ts
export type TimelineMode = 'day' | 'range'
```

Zamień nagłówek komponentu:

```tsx
export default function DayTimeline({
  open, onOpenChange, range, onRangeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  range: DayRange
  onRangeChange: (r: DayRange) => void
}) {
```

na:

```tsx
export default function DayTimeline({
  open, onOpenChange, mode, onModeChange, range, onRangeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  range: DayRange
  onRangeChange: (r: DayRange) => void
}) {
```

- [ ] **Step 5: Add the selection state and the mode logic**

Pod deklaracją `const [focusIdx, setFocusIdx] = useState(range.startIdx)` dopisz:

```tsx
  /** Data początkowa czekająca na swój koniec. Null = następny tap ją ustawi. */
  const [anchorIdx, setAnchorIdx] = useState<number | null>(null)
  /** Kafelek pod kursorem — tylko myszą, palec nie ma stanu „nad". */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const preview = mode === 'range' && anchorIdx !== null && hoverIdx !== null
    ? { anchorIdx, range: normalizeRange(anchorIdx, hoverIdx) }
    : null
```

Zamień funkcję `select`:

```tsx
  function select(idx: number, from: 'pointer' | 'click') {
    if (from === 'click' && Date.now() - lastAppliedAt.current < 400) return
    lastAppliedAt.current = Date.now()
    setFocusIdx(idx)
    onRangeChange({ startIdx: idx, endIdx: idx })
  }
```

na:

```tsx
  function select(idx: number, from: 'pointer' | 'click') {
    if (from === 'click' && Date.now() - lastAppliedAt.current < 400) return
    lastAppliedAt.current = Date.now()
    setFocusIdx(idx)
    if (mode === 'day') {
      setAnchorIdx(null)
      onRangeChange({ startIdx: idx, endIdx: idx })
      return
    }
    const sel: RangeSelection = { range, anchorIdx }
    const next = tapRange(sel, idx)
    setAnchorIdx(next.anchorIdx)
    onRangeChange(next.range)
  }

  /**
   * Przełącznik zmienia tylko to, jak pasek czyta dotknięcia. Wracając na dzień
   * trzeba jednak zwinąć zakres, bo mapa czyta wyłącznie zakres i inaczej
   * zostałaby przy wielu dniach mimo napisu „Dzień".
   */
  function switchMode(m: TimelineMode) {
    if (m === mode) return
    setAnchorIdx(null)
    setHoverIdx(null)
    onModeChange(m)
    if (m === 'day') onRangeChange({ startIdx: range.startIdx, endIdx: range.startIdx })
  }
```

Zamień gałąź przeciągnięcia w `onPointerUp`, żeby w trybie zakresu tylko przewijała:

```tsx
    if (drag.current.moved && liveTranslate !== null) {
      const snapped = translateToIdx(liveTranslate)
      setFocusIdx(snapped)
      onRangeChange({ startIdx: snapped, endIdx: snapped })
    }
```

na:

```tsx
    if (drag.current.moved && liveTranslate !== null) {
      const snapped = translateToIdx(liveTranslate)
      setFocusIdx(snapped)
      // W trybie dnia puszczenie paska wybiera dzień, na którym się zatrzymał —
      // tak działał od zawsze. W trybie zakresu przeciąganie ma tylko przewijać,
      // bo zaznaczanie należy do dotknięć.
      if (mode === 'day') onRangeChange({ startIdx: snapped, endIdx: snapped })
    }
```

Zamień funkcję `step`, żeby w trybie zakresu tylko przewijała:

```tsx
  function step(delta: number) {
    const next = Math.max(0, Math.min(DAYS_COUNT - 1, focusIdx + delta))
    setFocusIdx(next)
    onRangeChange({ startIdx: next, endIdx: next })
  }
```

na:

```tsx
  function step(delta: number) {
    const next = Math.max(0, Math.min(DAYS_COUNT - 1, focusIdx + delta))
    setFocusIdx(next)
    // W trybie zakresu strzałki przesuwają wyłącznie okno paska. Inaczej nie
    // dałoby się dojechać do odległej daty końcowej bez skasowania początku.
    if (mode === 'day') onRangeChange({ startIdx: next, endIdx: next })
  }
```

Zamień wyliczenie `pillLabel`:

```tsx
  const pillLabel = (() => {
    const d = idxToDate(range.startIdx)
    const offset = idxToOffset(range.startIdx)
    const dayLabel = offset === 0 ? t('map.today')
      : offset === -1 ? t('map.yesterday')
      : d.toLocaleDateString(loc, { weekday: 'long' })
    return `${dayLabel} · ${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`
  })()
```

na:

```tsx
  const pillLabel = (() => {
    const from = idxToDate(range.startIdx)
    const short = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
    // Zakres wielodniowy nie mieści nazwy dnia tygodnia, więc pokazuje same daty.
    if (range.startIdx !== range.endIdx) {
      return `${short(from)} – ${short(idxToDate(range.endIdx))}`
    }
    const offset = idxToOffset(range.startIdx)
    const dayLabel = offset === 0 ? t('map.today')
      : offset === -1 ? t('map.yesterday')
      : from.toLocaleDateString(loc, { weekday: 'long' })
    return `${dayLabel} · ${short(from)}`
  })()
```

- [ ] **Step 6: Replace the open-strip markup with the switch above it**

Zamień całą instrukcję `return (…)` z gałęzi rozwiniętego paska (wszystko od `return (` po zamykające `)` na końcu komponentu — bez wcześniejszego `if (!open) { … }`, który zostaje bez zmian) na:

```tsx
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      pointerEvents: 'auto',
    }}>
      <div style={{
        display: 'flex', padding: 3, borderRadius: 999, background: '#fff',
        border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
      }}>
        {(['day', 'range'] as const).map(m => (
          <button
            key={m}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => switchMode(m)}
            style={{
              padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: mode === m ? C.primary : 'transparent',
              color: mode === m ? '#fff' : C.ink,
              fontSize: 12, fontWeight: 800,
              transition: 'all 200ms ease',
            }}
          >
            {t(m === 'day' ? 'map.modeDay' : 'map.modeRange')}
          </button>
        ))}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        data-testid="day-strip"
        style={{
          padding: '6px 8px', borderRadius: 999, background: '#fff',
          border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
          display: 'flex', alignItems: 'center', gap: 4,
          touchAction: 'none', cursor: 'grab', userSelect: 'none',
        }}
      >
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => step(-1)}
          style={{
            flexShrink: 0, width: 20, background: 'none', border: 'none', padding: 0,
            color: INK, opacity: focusIdx > 0 ? 0.7 : 0.2,
            fontWeight: 900, fontSize: 18, cursor: focusIdx > 0 ? 'pointer' : 'default',
          }}
        >‹</button>

        <div style={{ width: TRACK, flexShrink: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', gap: GAP,
            transition: liveTranslate !== null ? 'none' : 'transform 300ms cubic-bezier(0.32,1.2,0.4,1)',
            transform: `translateX(${liveTranslate !== null ? liveTranslate : idxToTranslate(focusIdx)}px)`,
          }}>
            {Array.from({ length: DAYS_COUNT }, (_, i) => {
              const d = idxToDate(i)
              const isToday = idxToOffset(i) === 0
              const state = tileState(i, range, preview)
              // Przynależność do zakresu bije zaznaczenie „dziś" — inaczej
              // dzisiejszy kafelek w środku zakresu wyglądałby na wyjęty z niego.
              const background =
                state === 'edge' ? C.primary
                : state === 'inside' ? C.primaryRange
                : state === 'preview' ? C.primarySoft
                : isToday ? C.primarySoft
                : 'transparent'
              return (
                <button
                  key={i}
                  data-day-idx={i}
                  data-testid={`day-${i}`}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => select(i, 'click')}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(prev => (prev === i ? null : prev))}
                  style={{
                    flexShrink: 0, width: TILE, borderRadius: 14,
                    padding: '6px 0', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 1,
                    background,
                    color: state === 'edge' ? '#fff' : C.ink,
                    border: state === 'edge' ? `2px solid ${INK}` : '2px solid transparent',
                    fontSize: 11, fontWeight: 800,
                    transition: 'all 200ms ease',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
                    {isToday ? t('map.today').slice(0, 3)
                      : d.toLocaleDateString(loc, { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>
                    {d.toLocaleDateString(loc, { month: 'short' }).replace('.', '')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => step(1)}
          style={{
            flexShrink: 0, width: 20, background: 'none', border: 'none', padding: 0,
            color: INK, opacity: focusIdx < DAYS_COUNT - 1 ? 0.7 : 0.2,
            fontWeight: 900, fontSize: 18, cursor: focusIdx < DAYS_COUNT - 1 ? 'pointer' : 'default',
          }}
        >›</button>

        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onOpenChange(false)}
          aria-label="close-timeline"
          style={{
            flexShrink: 0, width: 24, color: INK, fontWeight: 900, opacity: 0.5, fontSize: 16,
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >×</button>
      </div>
    </div>
  )
```

`pointerEvents: 'auto'` przenosi się z paska na kolumnę, żeby przełącznik też łapał dotknięcia — kontener w `MapScreen` ma `pointerEvents: 'none'`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/components/DayTimeline.test.tsx`
Expected: PASS — sześć testów.

Jeśli test przeciągnięcia zawiedzie, sprawdź, czy `pointerMove` przekracza próg 8 px — w teście jest 80 px, więc `drag.current.moved` musi być `true`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tokens.ts src/components/DayTimeline.tsx src/components/DayTimeline.test.tsx
git commit -m "Przełącznik dzień/zakres dat na pasku wyboru daty"
```

---

### Task 8: Spięcie zakresu z mapą

**Files:**
- Modify: `src/screens/MapScreen.tsx`

- [ ] **Step 1: Hold the mode and pass it down**

W `src/screens/MapScreen.tsx` dopisz do importu komponentu typ trybu:

```ts
import DayTimeline, { type TimelineMode } from '../components/DayTimeline'
```

Pod stanem `range` dopisz stan trybu:

```ts
  const [tlMode, setTlMode] = useState<TimelineMode>('day')
```

Uzupełnij użycie komponentu o dwa nowe propsy:

```tsx
        <DayTimeline
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          mode={tlMode}
          onModeChange={setTlMode}
          range={range}
          onRangeChange={setRange}
        />
```

- [ ] **Step 2: Feed the range to the fetch and the card pool**

Zamień wywołanie hooka:

```ts
  const { events, loading, ready } = useEvents(fetchView, idxToOffset(dayIdx), eventsRefreshKey)
```

na:

```ts
  const { events, loading, ready } = useEvents(
    fetchView, idxToOffset(range.startIdx), idxToOffset(range.endIdx), eventsRefreshKey,
  )
```

Zamień klucz puli kart:

```ts
  const poolKey = `${[...selectedFilters].sort().join(',')}|${dayIdx}`
```

na:

```ts
  const poolKey = `${[...selectedFilters].sort().join(',')}|${range.startIdx}-${range.endIdx}`
```

- [ ] **Step 3: Make the smart link land in day mode**

Zamień rejestrację skoku na dzień z linku:

```ts
    onRegisterShowDay?.(d => setDayIdx(dateToIdx(d)))
```

na:

```ts
    // Link prowadzi do konkretnego wydarzenia, więc pokazuje jego dzień —
    // zakres z poprzedniego oglądania mapy tylko by go rozmył.
    onRegisterShowDay?.(d => {
      const idx = dateToIdx(d)
      setTlMode('day')
      setRange({ startIdx: idx, endIdx: idx })
    })
```

- [ ] **Step 4: Let the empty card widen the range**

Zamień obsługę przycisku pustej karty:

```tsx
                  onClick={() => {
                    // Acted on, so it has said its piece — a user who lands on
                    // another empty day is not told the same thing again.
                    offeredWayOutRef.current = true
                    setDayIdx(TODAY_IDX + emptyVariant.dayOffset)
                  }}
```

na:

```tsx
                  onClick={() => {
                    // Acted on, so it has said its piece — a user who lands on
                    // another empty day is not told the same thing again.
                    offeredWayOutRef.current = true
                    const target = TODAY_IDX + emptyVariant.dayOffset
                    // W trybie zakresu przycisk dokłada ten dzień do zakresu
                    // zamiast go zastępować — obietnica „zobacz: sobota (3)"
                    // zostaje dotrzymana bez wyrzucania z trybu, który user wybrał.
                    setRange(prev => tlMode === 'range'
                      ? { startIdx: Math.min(prev.startIdx, target), endIdx: Math.max(prev.endIdx, target) }
                      : { startIdx: target, endIdx: target })
                  }}
```

- [ ] **Step 5: Drop the compatibility shim**

Usuń z `MapScreen` pomocnicze `dayIdx` i `setDayIdx` dodane w Tasku 6 — cały ten blok:

```ts
  const dayIdx = range.startIdx
  const setDayIdx = (next: number | ((prev: number) => number)) => {
    setRange(prev => {
      const idx = typeof next === 'function' ? next(prev.startIdx) : next
      return { startIdx: idx, endIdx: idx }
    })
  }
```

Sprawdź, czy nic ich już nie woła:

Run: `grep -n "dayIdx\|setDayIdx" src/screens/MapScreen.tsx`
Expected: brak wyników. Jeśli coś zostało, zamień to na odczyt `range.startIdx` albo na `setRange`.

- [ ] **Step 6: Verify the build and the suite**

Run: `npx tsc -b && npm test`
Expected: kompilacja bez błędów, cała bateria testów przechodzi.

- [ ] **Step 7: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "Mapa pokazuje wydarzenia z wybranego zakresu dat"
```

---

### Task 9: Weryfikacja w działającej aplikacji

**Files:** brak zmian — to przejście przez gotową funkcję.

- [ ] **Step 1: Run the full check**

Run: `npx tsc -b && npm test`
Expected: bez błędów, wszystkie testy zielone.

- [ ] **Step 2: Start the dev server and walk the feature**

Run: `npm run dev`

Sprawdź po kolei:

1. Pigułka z datą pokazuje „Dziś · <data>", pasek otwiera się po dotknięciu.
2. Nad paskiem stoi przełącznik; „Dzień" jest aktywny, wybór dnia działa jak dotąd.
3. Po przełączeniu na „Zakres dat": pierwszy klik zaznacza jeden dzień, kursor nad kolejnymi dniami maluje jasny podgląd, drugi klik domyka zakres — środek zakresu ma ciemniejszy odcień niż podgląd.
4. Zaznaczenie wstecz: klik na 23.08, potem na 19.08 daje zakres 19–23.
5. Trzeci klik zaczyna nowy zakres.
6. Mapa po domknięciu zakresu pokazuje więcej pinów niż pojedynczy dzień.
7. Zwinięta pigułka pokazuje „19 sie – 23 sie".
8. Powrót na „Dzień" zostawia na mapie dzień początkowy.
9. Przewijanie paska przeciągnięciem działa w obu trybach i niczego nie zaznacza.

- [ ] **Step 3: Commit if anything needed fixing**

```bash
git add -A
git commit -m "Poprawki po przejściu przez zakres dat w aplikacji"
```
