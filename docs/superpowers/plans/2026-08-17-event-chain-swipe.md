# Event Chain Swipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From an open event card, a horizontal swipe (mobile) or a chevron/arrow key (desktop) moves the map to a nearby event and opens its card, and the opposite direction walks back along exactly the path already taken.

**Architecture:** All the decision-making lives in one pure module, `src/lib/eventChain.ts`, behind a `ChainStrategy` interface — swapping the mechanism is one file, and the card and the map never learn any geography. A `useEventChain` hook holds the walk as React state; `useCardDrag` (with its arithmetic in the pure `src/lib/cardDrag.ts`) turns touches into steps; `App` owns three independent chains — one for the map, one each for My Events and Followed Events.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + @testing-library/react, Leaflet, react-i18next.

**Spec:** `docs/superpowers/specs/2026-08-17-event-chain-swipe-design.md`

---

## Conventions for every task

- Run one test file with `npx vitest run <path>`. Run everything with `npm test`.
- Type-check with `npx tsc -b` — **not** `--noEmit`. Cloudflare's build is stricter than a bare check, and `tsc -b` is what `npm run build` runs.
- Lint touched files with `npx eslint <paths>`.
- Comments in this codebase explain **why**, in Polish or English matching the file's neighbours. Do not add comments that restate the code.
- Commit messages are plain descriptive sentences, no `feat:`/`fix:` prefixes (see `git log`). **Never add a `Co-Authored-By` trailer.**
- Every user-visible string goes through `t('...')` and must exist in all five locales.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `src/lib/eventChain.ts` | The chain: `Chain` type, `step` (walks the path, knows no geography), `geoStrategy`, `listStrategy`. Pure, no React. |
| `src/lib/eventChain.test.ts` | Every rule from the spec, as tests. |
| `src/lib/cardDrag.ts` | Axis lock and commit threshold, as pure functions. |
| `src/lib/cardDrag.test.ts` | Thresholds and direction mapping. |
| `src/hooks/useEventChain.ts` | Holds a `Chain`; start / close / replace / canGo / go, plus the `poolKey` reset. |
| `src/hooks/useEventChain.test.tsx` | Reset behaviour and the walk, through the hook. |
| `src/hooks/useCardDrag.ts` | Touch handlers → axis → offset → commit. React glue only. |
| `src/components/ChainArrow.tsx` | The chevron. |
| `src/components/ChainArrow.test.tsx` | Label, disabled state, click. |

**Modify**

| File | Change |
|---|---|
| `src/screens/EventSheet.tsx` | Shell/card split, horizontal drag, chevrons, arrow keys. |
| `src/screens/event/EventPhotoStrip.tsx` | `data-no-hswipe` on the photo frame. |
| `src/screens/MapScreen.tsx` | `onPoolChange(events, poolKey)`. |
| `src/screens/MyEventsScreen.tsx` | `onOpenEvent(ev, ordered)`. |
| `src/screens/FollowedEventsScreen.tsx` | `onOpenEvent(ev, ordered)`. |
| `src/App.tsx` | Three chains replace three `useState` selections. |
| `src/index.css` | `.event-sheet` / `.event-sheet-card` split, desktop `left: 76px`. |
| `src/locales/{pl,en,es,de,sl}.ts` | `event.chainNext`, `event.chainPrev`. |
| `src/locales/parity.test.ts` | Both keys added to `NEW_EVENT_KEYS`. |

---

## Task 1: The chain type and the walk

`step` is the whole mechanics of movement and deliberately knows nothing about
geography — that is what makes the mechanism swappable. This task builds it with
a hand-written test strategy, so the walk is proven before any distance maths
exists.

**Files:**
- Create: `src/lib/eventChain.ts`
- Create: `src/lib/eventChain.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/eventChain.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { startChain, step, currentOf, type Chain, type ChainStrategy } from './eventChain'
import type { EventWithMeta } from './types'

let idc = 0
function ev(over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id: `e${idc++}`,
    lat: 50.0, lng: 22.0,
    start_time: '2026-08-17T10:00:00.000Z',
    end_time: '2026-08-17T12:00:00.000Z',
    is_private: false,
    ...over,
  } as EventWithMeta
}

/** Strategia-atrapa: zawsze podaje kolejne wydarzenie z podanej kolejki. */
function queueStrategy(east: EventWithMeta[], west: EventWithMeta[]): ChainStrategy {
  const q = { east: [...east], west: [...west] }
  return { extend: (_c, _pool, dir) => q[dir].shift() ?? null }
}

describe('step', () => {
  it('starts with the anchor alone', () => {
    const a = ev({ id: 'a' })
    const c = startChain(a)
    expect(c.path.map(e => e.id)).toEqual(['a'])
    expect(c.cursor).toBe(0)
    expect(c.anchorIdx).toBe(0)
    expect(currentOf(c).id).toBe('a')
  })

  it('appends eastward and moves the cursor with it', () => {
    const s = queueStrategy([ev({ id: 'b' }), ev({ id: 'c' })], [])
    let c: Chain = startChain(ev({ id: 'a' }))
    c = step(c, [], 'east', s)!
    c = step(c, [], 'east', s)!
    expect(c.path.map(e => e.id)).toEqual(['a', 'b', 'c'])
    expect(currentOf(c).id).toBe('c')
    expect(c.anchorIdx).toBe(0)
  })

  it('walks back over ground already covered without asking the strategy', () => {
    const s = queueStrategy([ev({ id: 'b' })], [])
    let c: Chain = startChain(ev({ id: 'a' }))
    c = step(c, [], 'east', s)!
    c = step(c, [], 'west', s)!
    expect(currentOf(c).id).toBe('a')
    expect(c.path.map(e => e.id)).toEqual(['a', 'b'])
    // Powrót na wschód wraca do b, nie dokleja nowego — kolejka jest pusta,
    // a mimo to krok się udaje.
    c = step(c, [], 'east', s)!
    expect(currentOf(c).id).toBe('b')
  })

  it('prepends westward and carries the anchor index with it', () => {
    const s = queueStrategy([], [ev({ id: 'z' })])
    let c: Chain = startChain(ev({ id: 'a' }))
    c = step(c, [], 'west', s)!
    expect(c.path.map(e => e.id)).toEqual(['z', 'a'])
    expect(c.cursor).toBe(0)
    expect(c.anchorIdx).toBe(1)
  })

  it('returns null when the strategy has nothing left', () => {
    const s = queueStrategy([], [])
    const c = startChain(ev({ id: 'a' }))
    expect(step(c, [], 'east', s)).toBeNull()
    expect(step(c, [], 'west', s)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: FAIL — `Failed to resolve import "./eventChain"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/eventChain.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventChain.ts src/lib/eventChain.test.ts
git commit -m "Teach a path to grow from both ends of the event you opened"
```

---

## Task 2: The first step points at a compass direction

**Files:**
- Modify: `src/lib/eventChain.ts`
- Modify: `src/lib/eventChain.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/eventChain.test.ts`:

```ts
import { geoStrategy, MAX_JUMP_KM } from './eventChain'

/** ~1 km na tej szerokości; wystarczy, by punkty były rozróżnialne. */
const KM = 0.014

describe('geoStrategy — the first step on a side', () => {
  it('goes east to the nearest event with a greater longitude', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const nearWest = ev({ id: 'w', lng: 22.0 - KM })
    const farEast = ev({ id: 'far', lng: 22.0 + 4 * KM })
    const nearEast = ev({ id: 'near', lng: 22.0 + 2 * KM })
    const c = step(startChain(a), [a, nearWest, farEast, nearEast], 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('near')
  })

  it('goes west to the nearest event with a smaller longitude', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const nearEast = ev({ id: 'e', lng: 22.0 + KM })
    const nearWest = ev({ id: 'near', lng: 22.0 - 2 * KM })
    const farWest = ev({ id: 'far', lng: 22.0 - 5 * KM })
    const c = step(startChain(a), [a, nearEast, nearWest, farWest], 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('near')
  })

  it('reports the end of the chain when the half plane is empty', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const onlyWest = ev({ id: 'w', lng: 22.0 - KM })
    expect(step(startChain(a), [a, onlyWest], 'east', geoStrategy)).toBeNull()
  })

  // Kotwica siedzi na wschodnim końcu ścieżki dopiero rozciągniętej na zachód,
  // więc pierwszy krok na wschód nadal ma znaczenie kierunkowe.
  it('still applies the half plane to the untouched side', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const w = ev({ id: 'w', lng: 22.0 - KM })
    const e = ev({ id: 'e', lng: 22.0 + KM })
    let c = step(startChain(a), [a, w, e], 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('w')
    c = step(c, [a, w, e], 'east', geoStrategy)!     // wraca do kotwicy
    expect(currentOf(c).id).toBe('a')
    c = step(c, [a, w, e], 'east', geoStrategy)!     // pierwszy krok na wschód
    expect(currentOf(c).id).toBe('e')
  })

  it('exposes the jump ceiling as a constant', () => {
    expect(MAX_JUMP_KM).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: FAIL — `geoStrategy` and `MAX_JUMP_KM` are not exported.

- [ ] **Step 3: Write minimal implementation**

Add to the top of `src/lib/eventChain.ts`, after the existing import:

```ts
import { haversineKm } from './geo'
```

Append to `src/lib/eventChain.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventChain.ts src/lib/eventChain.test.ts
git commit -m "Let the first swipe mean a direction of the compass"
```

---

## Task 3: Every later step is a nearest-neighbour hop

**Files:**
- Modify: `src/lib/eventChain.test.ts`

The implementation from Task 2 already covers this — `firstOnThisSide` is false
once a side has been extended. This task pins the behaviour down with tests so a
future change to the strategy cannot quietly lose it.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/eventChain.test.ts`:

```ts
describe('geoStrategy — later steps', () => {
  // Po pierwszym kroku sznurek przestaje pytać o kierunek świata: idzie tam,
  // gdzie najbliżej, choćby to było z powrotem na zachód od kotwicy.
  it('drops the half plane once a side has been walked', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const e1 = ev({ id: 'e1', lng: 22.0 + KM })
    // Bliżej e1 niż cokolwiek na wschodzie, ale na zachód od kotwicy — więc
    // pierwszy krok go nie tknął.
    const behind = ev({ id: 'behind', lng: 22.0 - 0.2 * KM })
    const e2 = ev({ id: 'e2', lng: 22.0 + 9 * KM })
    const pool = [a, e1, behind, e2]
    let c = step(startChain(a), pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('e1')
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('behind')
  })

  it('never returns to an event already on the path', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const b = ev({ id: 'b', lng: 22.0 + KM })
    const pool = [a, b]
    const c = step(startChain(a), pool, 'east', geoStrategy)!
    expect(step(c, pool, 'east', geoStrategy)).toBeNull()
  })

  // Wydarzenia w jednym lokalu leżą 0 km od siebie, więc wychodzą jako
  // pierwsze — swipe przewija cały lokal, zanim ruszy dalej. To nie jest
  // przypadek szczególny, tylko konsekwencja reguły odległości.
  it('reads through co-located events before moving on', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const same1 = ev({ id: 's1', lng: 22.0 + 1e-7 })
    const same2 = ev({ id: 's2', lng: 22.0 + 2e-7 })
    const away = ev({ id: 'away', lng: 22.0 + 3 * KM })
    const pool = [a, same1, same2, away]
    let c = step(startChain(a), pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('s1')
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('s2')
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('away')
  })

  it('ends the chain rather than jumping further than the ceiling', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    // ~86 km na wschód przy 50. równoleżniku — ponad MAX_JUMP_KM.
    const far = ev({ id: 'far', lng: 22.0 + 1.2 })
    expect(step(startChain(a), [a, far], 'east', geoStrategy)).toBeNull()
  })

  it('retraces the exact events it walked, in order', () => {
    const a = ev({ id: 'a', lng: 22.0 })
    const b = ev({ id: 'b', lng: 22.0 + KM })
    const c2 = ev({ id: 'c', lng: 22.0 + 2 * KM })
    const pool = [a, b, c2]
    let c = step(startChain(a), pool, 'east', geoStrategy)!
    c = step(c, pool, 'east', geoStrategy)!
    expect(currentOf(c).id).toBe('c')
    c = step(c, pool, 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('b')
    c = step(c, pool, 'west', geoStrategy)!
    expect(currentOf(c).id).toBe('a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: These five may already PASS. If any fails, the Task 2 implementation is
wrong — fix `eventChain.ts`, not the test.

- [ ] **Step 3: Run the whole file**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/eventChain.test.ts
git commit -m "Pin down where the chain goes after the first step"
```

---

## Task 4: The list strategy

**Files:**
- Modify: `src/lib/eventChain.ts`
- Modify: `src/lib/eventChain.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/eventChain.test.ts`:

```ts
import { listStrategy } from './eventChain'

describe('listStrategy', () => {
  const a = ev({ id: 'a' }), b = ev({ id: 'b' }), c3 = ev({ id: 'c' })
  const pool = [a, b, c3]

  it('moves to the next row', () => {
    const c = step(startChain(b), pool, 'east', listStrategy)!
    expect(currentOf(c).id).toBe('c')
  })

  it('moves to the previous row', () => {
    const c = step(startChain(b), pool, 'west', listStrategy)!
    expect(currentOf(c).id).toBe('a')
  })

  it('stops at both ends of the list', () => {
    expect(step(startChain(c3), pool, 'east', listStrategy)).toBeNull()
    expect(step(startChain(a), pool, 'west', listStrategy)).toBeNull()
  })

  // Lista może się odświeżyć pod otwartą kartą; wtedy lepiej zatrzymać sznurek
  // niż zaprowadzić go tam, gdzie już był.
  it('stops rather than revisiting', () => {
    const c = step(startChain(a), pool, 'east', listStrategy)!
    expect(step(c, [a, b, a], 'east', listStrategy)).toBeNull()
  })

  it('stops when the current event has left the list', () => {
    expect(step(startChain(ev({ id: 'gone' })), pool, 'east', listStrategy)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: FAIL — `listStrategy` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/eventChain.ts`:

```ts
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
    if (!next) return null
    return chain.path.some(e => e.id === next.id) ? null : next
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/eventChain.test.ts`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventChain.ts src/lib/eventChain.test.ts
git commit -m "Walk the saved lists by row instead of by distance"
```

---

## Task 5: The gesture arithmetic

**Files:**
- Create: `src/lib/cardDrag.ts`
- Create: `src/lib/cardDrag.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/cardDrag.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveAxis, commitDir, AXIS_LOCK_PX, COMMIT_MIN_PX } from './cardDrag'

describe('resolveAxis', () => {
  it('holds off until the finger has actually travelled', () => {
    expect(resolveAxis(4, 4)).toBe('none')
    expect(resolveAxis(AXIS_LOCK_PX - 1, 0)).toBe('none')
  })

  it('calls the dominant direction', () => {
    expect(resolveAxis(-40, 6)).toBe('horizontal')
    expect(resolveAxis(6, 40)).toBe('vertical')
  })

  // Remis idzie na pion: karta jest przede wszystkim szufladą, a sznurek
  // dodatkiem. Niepewny gest ma podnosić kartę, nie zmieniać wydarzenie.
  it('gives a tie to the vertical axis', () => {
    expect(resolveAxis(20, 20)).toBe('vertical')
  })
})

describe('commitDir', () => {
  it('needs a real quarter of the card', () => {
    expect(commitDir(-90, 400)).toBeNull()      // 25% z 400 to 100
    expect(commitDir(-110, 400)).toBe('east')
  })

  // Palec w lewo odsuwa kartę w lewo, więc następna nadchodzi z prawej — czyli
  // ze wschodu.
  it('reads a leftward swipe as east and a rightward one as west', () => {
    expect(commitDir(-200, 400)).toBe('east')
    expect(commitDir(200, 400)).toBe('west')
  })

  it('keeps a floor under the threshold on a narrow card', () => {
    expect(commitDir(-(COMMIT_MIN_PX - 1), 100)).toBeNull()
    expect(commitDir(-COMMIT_MIN_PX, 100)).toBe('east')
  })

  it('is null when the finger barely moved', () => {
    expect(commitDir(0, 400)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cardDrag.test.ts`
Expected: FAIL — `Failed to resolve import "./cardDrag"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/cardDrag.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cardDrag.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardDrag.ts src/lib/cardDrag.test.ts
git commit -m "Decide which way a finger went before acting on it"
```

---

## Task 6: The chain as React state

**Files:**
- Create: `src/hooks/useEventChain.ts`
- Create: `src/hooks/useEventChain.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useEventChain.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEventChain } from './useEventChain'
import { geoStrategy } from '../lib/eventChain'
import type { EventWithMeta } from '../lib/types'

let idc = 0
function ev(over: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    id: `e${idc++}`, lat: 50.0, lng: 22.0,
    start_time: '2026-08-17T10:00:00.000Z',
    end_time: '2026-08-17T12:00:00.000Z',
    is_private: false, ...over,
  } as EventWithMeta
}

const a = ev({ id: 'a', lng: 22.0 })
const b = ev({ id: 'b', lng: 22.014 })
const c = ev({ id: 'c', lng: 22.028 })
const POOL = [a, b, c]

describe('useEventChain', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    expect(result.current.current).toBeNull()
    expect(result.current.canGo('east')).toBe(false)
  })

  // Wynik zbieramy do pola obiektu, a nie do `let`: TypeScript zawęża zmienną
  // do typu wartości początkowej i nie widzi przypisania z wnętrza act().
  it('walks and reports where it landed', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    expect(result.current.current?.id).toBe('a')
    const got: { at: EventWithMeta | null } = { at: null }
    act(() => { got.at = result.current.go('east') })
    expect(got.at?.id).toBe('b')
    expect(result.current.current?.id).toBe('b')
  })

  it('returns null and stays put at the end of the chain', () => {
    const { result } = renderHook(() => useEventChain([a], geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    const got: { at: EventWithMeta | null } = { at: a }
    act(() => { got.at = result.current.go('east') })
    expect(got.at).toBeNull()
    expect(result.current.current?.id).toBe('a')
  })

  it('forgets everything when the card closes', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    act(() => { result.current.close() })
    expect(result.current.current).toBeNull()
  })

  it('swaps the current event in place without disturbing the path', () => {
    const { result } = renderHook(() => useEventChain(POOL, geoStrategy, 'k'))
    act(() => { result.current.start(a) })
    act(() => { result.current.go('east') })
    act(() => { result.current.replace({ ...b, title: 'Zmieniony' } as EventWithMeta) })
    expect(result.current.current?.title).toBe('Zmieniony')
    // Ścieżka stoi: powrót nadal trafia w kotwicę.
    act(() => { result.current.go('west') })
    expect(result.current.current?.id).toBe('a')
  })

  // Zmiana filtrów albo dnia wymienia pulę pod sznurkiem. Karta zostaje na
  // ekranie, ale historia odwiedzonych traci sens.
  it('collapses to the open event when the pool is replaced', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useEventChain(POOL, geoStrategy, key),
      { initialProps: { key: 'filters:|day:1' } },
    )
    act(() => { result.current.start(a) })
    act(() => { result.current.go('east') })
    expect(result.current.current?.id).toBe('b')

    rerender({ key: 'filters:party|day:1' })
    expect(result.current.current?.id).toBe('b')   // karta nie mruga
    // b jest nową kotwicą, więc zachód znowu znaczy kierunek świata: a leży
    // na zachód od b i jest jedynym kandydatem.
    act(() => { result.current.go('west') })
    expect(result.current.current?.id).toBe('a')
  })

  it('leaves a closed chain closed when the pool changes', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useEventChain(POOL, geoStrategy, key),
      { initialProps: { key: 'k1' } },
    )
    rerender({ key: 'k2' })
    expect(result.current.current).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useEventChain.test.tsx`
Expected: FAIL — `Failed to resolve import "./useEventChain"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/hooks/useEventChain.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useEventChain.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEventChain.ts src/hooks/useEventChain.test.tsx
git commit -m "Hold the walk in state and reset it when the pool is swapped"
```

---

## Task 7: The touch handlers

**Files:**
- Create: `src/hooks/useCardDrag.ts`

No test file: this hook is React glue over `cardDrag.ts`, which is already
covered. The behaviour it adds — binding to touch events — is exercised through
`EventSheet` in Task 10.

- [ ] **Step 1: Write the implementation**

Create `src/hooks/useCardDrag.ts`:

```ts
import { useRef, useState } from 'react'
import { resolveAxis, commitDir, type Axis } from '../lib/cardDrag'
import type { Dir } from '../lib/eventChain'

/**
 * 'ignored' nie wychodzi z resolveAxis — to gest poziomy, który zaczął się nad
 * czymś, co samo przewija się w poziomie (kadr zdjęcia, pasek tagów). Nie jest
 * ani sznurkiem, ani snapem: ma po prostu przelecieć obok.
 */
type Locked = Axis | 'ignored'

export function useCardDrag({ enabled, onCommitX, onCommitY }: {
  /** Czy sznurek w ogóle działa w tym stanie karty (np. nie pod czatem). */
  enabled: boolean
  onCommitX: (dir: Dir) => void
  onCommitY: (dy: number) => void
}) {
  const [dx, setDx] = useState(0)
  const g = useRef<{ x: number; y: number; axis: Locked; blocked: boolean } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    const target = e.target as HTMLElement
    g.current = {
      x: t.clientX, y: t.clientY, axis: 'none',
      blocked: !!target.closest?.('[data-no-hswipe]'),
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = g.current
    if (!s) return
    const t = e.touches[0]
    const ddx = t.clientX - s.x
    const ddy = t.clientY - s.y
    if (s.axis === 'none') {
      const axis = resolveAxis(ddx, ddy)
      if (axis === 'none') return
      s.axis = axis === 'horizontal' && (!enabled || s.blocked) ? 'ignored' : axis
    }
    if (s.axis !== 'horizontal') return
    setDx(ddx)
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = g.current
    g.current = null
    if (!s) return
    const t = e.changedTouches[0]
    if (s.axis === 'vertical') { onCommitY(t.clientY - s.y); return }
    if (s.axis !== 'horizontal') return
    const width = (e.currentTarget as HTMLElement).clientWidth || window.innerWidth
    const dir = commitDir(t.clientX - s.x, width)
    if (dir) onCommitX(dir)
    // Wraca do zera niezależnie od tego, czy krok się udał. Ten sam sprężysty
    // powrót bez zmiany treści pod spodem jest jedynym sygnałem, że sznurek
    // się skończył.
    setDx(0)
  }

  return {
    dx,
    bind: { onTouchStart, onTouchMove, onTouchEnd },
    /** Podczas ciągnięcia bez przejścia, po puszczeniu z przejściem do zera. */
    transition: dx === 0 ? 'transform 220ms cubic-bezier(0.32,1.2,0.4,1)' : 'none',
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no output (success).

- [ ] **Step 3: Lint**

Run: `npx eslint src/hooks/useCardDrag.ts src/lib/cardDrag.ts`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCardDrag.ts
git commit -m "Let the card follow the finger without losing the snaps"
```

---

## Task 8: The chevron and its words

**Files:**
- Create: `src/components/ChainArrow.tsx`
- Create: `src/components/ChainArrow.test.tsx`
- Modify: `src/locales/pl.ts`, `en.ts`, `es.ts`, `de.ts`, `sl.ts`
- Modify: `src/locales/parity.test.ts:8-11`

- [ ] **Step 1: Write the failing test**

Create `src/components/ChainArrow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChainArrow from './ChainArrow'

describe('ChainArrow', () => {
  it('is reachable by its label', () => {
    render(<ChainArrow dir="right" disabled={false} label="Następne wydarzenie obok" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Następne wydarzenie obok' })).toBeInTheDocument()
  })

  it('reports a click', () => {
    const onClick = vi.fn()
    render(<ChainArrow dir="left" disabled={false} label="Poprzednie" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Poprzednie' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Koniec sznurka wygasza daszek, ale go nie usuwa: znikający i wracający
  // przycisk przesuwałby wszystko dookoła.
  it('does not fire at the end of the chain', () => {
    const onClick = vi.fn()
    render(<ChainArrow dir="left" disabled label="Poprzednie" onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Poprzednie' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ChainArrow.test.tsx`
Expected: FAIL — `Failed to resolve import "./ChainArrow"`.

- [ ] **Step 3: Write the component**

Create `src/components/ChainArrow.tsx`:

```tsx
import { INK } from '../lib/tokens'

/**
 * Sam daszek, bez nóżki — obok karty, nie na niej, więc nie może wyglądać jak
 * przycisk. Rysunek 12x20 w polu dotyku 44x44: oko widzi cienką kreskę, palec
 * trafia w cel.
 */
export default function ChainArrow({ dir, disabled, label, onClick }: {
  dir: 'left' | 'right'
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 44, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: 0,
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'opacity 180ms ease',
      }}
    >
      <svg
        width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden
        style={{ transform: dir === 'left' ? 'none' : 'scaleX(-1)' }}
      >
        <path d="M10 1L2 10l8 9" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ChainArrow.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Add the two keys to all five locales**

In each file, insert the two lines directly after `photoNext` inside the `event`
block — `src/locales/pl.ts:66`, `en.ts:68`, `es.ts:68`, `de.ts:68`, `sl.ts:68`.

`src/locales/pl.ts`:
```ts
    chainPrev: 'Poprzednie wydarzenie obok',
    chainNext: 'Następne wydarzenie obok',
```

`src/locales/en.ts`:
```ts
    chainPrev: 'Previous event nearby',
    chainNext: 'Next event nearby',
```

`src/locales/es.ts`:
```ts
    chainPrev: 'Evento cercano anterior',
    chainNext: 'Siguiente evento cercano',
```

`src/locales/de.ts`:
```ts
    chainPrev: 'Vorherige Veranstaltung in der Nähe',
    chainNext: 'Nächste Veranstaltung in der Nähe',
```

`src/locales/sl.ts`:
```ts
    chainPrev: 'Prejšnji dogodek v bližini',
    chainNext: 'Naslednji dogodek v bližini',
```

- [ ] **Step 6: Extend the parity guard**

In `src/locales/parity.test.ts`, replace the `NEW_EVENT_KEYS` array:

```ts
const NEW_EVENT_KEYS = [
  'attend', 'attending', 'readMore', 'readLess',
  'backToEvent', 'photoPrev', 'photoNext', 'sendMessage',
  'chainPrev', 'chainNext',
] as const
```

- [ ] **Step 7: Run the locale tests**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: PASS — 5 tests (one per locale).

- [ ] **Step 8: Commit**

```bash
git add src/components/ChainArrow.tsx src/components/ChainArrow.test.tsx src/locales
git commit -m "Draw the caret that points at the next event nearby"
```

---

## Task 9: Fence off the photo frame

The photo frame and the tag bar inside it already own the horizontal axis. One
attribute on the frame covers both, because the tag bar is rendered inside it.

**Files:**
- Modify: `src/screens/event/EventPhotoStrip.tsx:70-77`

- [ ] **Step 1: Add the attribute**

Change the frame's opening tag from:

```tsx
    <div
      data-testid="photo-frame"
      style={{
```

to:

```tsx
    <div
      data-testid="photo-frame"
      // Kadr i pasek tagów przewijają się w poziomie same. Sznurek wydarzeń
      // trzyma się od nich z daleka; pionowe snapy działają tu jak wszędzie.
      data-no-hswipe
      style={{
```

- [ ] **Step 2: Check nothing broke**

Run: `npx vitest run src/screens/event/EventPhotoStrip.test.tsx`
Expected: PASS — unchanged count.

- [ ] **Step 3: Commit**

```bash
git add src/screens/event/EventPhotoStrip.tsx
git commit -m "Keep the chain away from the axis the photos already use"
```

---

## Task 10: The card gets a shell, a drag and two carets

This is the largest single edit. Read the whole task before starting.

**Files:**
- Modify: `src/index.css:26-41`
- Modify: `src/screens/EventSheet.tsx`

- [ ] **Step 1: Split the CSS**

Replace `src/index.css:26` and the `@media(min-width:768px)` block at lines
33-41 with:

```css
/* Powłoka trzyma pozycję i wysokość, karta — biel i zaokrąglenia. Rozdzielone,
   bo karta musi przycinać zawartość (overflow:hidden), a daszki sznurka leżą
   obok niej i inaczej zniknęłyby razem z przycięciem. */
.event-sheet{left:0;right:0;bottom:0}
.event-sheet-card{background:#fff;border-radius:32px 32px 0 0;box-shadow:0 -8px 32px rgba(45,43,42,.12)}

/* Od tabletu w górę pełna szerokość nie ma sensu: zdjęcie 16:9 rośnie razem
   z kartą, więc na 1280 px kadr miał 1240×698 px i sam zjadał ekran. Karta
   staje się kolumną odklejoną od lewej krawędzi — mapa zostaje widoczna po
   prawej, gdzie i tak są przyciski zoomu. Odstęp od lewej to 76 px, a nie 24:
   tyle potrzebuje lewy daszek sznurka. max-height pilnuje, żeby tryb full
   (93%) nie wyszedł ponad górną krawędź po dodaniu dolnego marginesu. */
@media(min-width:768px){
  .event-sheet{
    left:76px;right:auto;bottom:24px;
    width:clamp(320px,38vw,440px);
    max-height:calc(100% - 48px)
  }
  .event-sheet-card{
    border-radius:28px;
    box-shadow:0 8px 32px rgba(45,43,42,.18)
  }
}
```

- [ ] **Step 2: Add the new props to EventSheet**

In `src/screens/EventSheet.tsx`, add to the imports:

```tsx
import ChainArrow from '../components/ChainArrow'
import { useCardDrag } from '../hooks/useCardDrag'
import type { Dir } from '../lib/eventChain'
```

Add to the destructured props (after `onChatOpenChange`):

```tsx
  onChainStep,
  chainCanGo,
```

and to the prop types (after `onChatOpenChange?: (open: boolean) => void`):

```tsx
  /** Krok po sznurku wydarzeń. Brak = karta stoi sama, bez strzałek i swipe'u. */
  onChainStep?: (dir: Dir) => void
  chainCanGo?: (dir: Dir) => boolean
```

- [ ] **Step 3: Wire the drag**

Replace the existing `onTS`/`onTE` pair (currently `src/screens/EventSheet.tsx:362-377`)
with the vertical handler alone plus the hook:

```tsx
  function onVertical(dy: number) {
    if (dy > 80) {
      if (snap === 'full') setSnap('half')
      else if (snap === 'half') setSnap('peek')
      else onClose()
    } else if (dy < -80) {
      if (snap === 'peek') setSnap('half')
      else if (snap === 'half') setSnap('full')
    }
  }

  const drag = useCardDrag({
    // Czat leży na całej karcie i ma własne przewijanie; sznurek pod nim
    // milczy.
    enabled: !!onChainStep && !chatOpen,
    onCommitX: dir => onChainStep?.(dir),
    // W trybie full lista przewija się natywnie i pionowy gest do niej należy —
    // dokładnie jak przed sznurkiem.
    onCommitY: dy => { if (!isFull) onVertical(dy) },
  })
```

- [ ] **Step 4: Rebind the handlers**

The drag handle (currently `src/screens/EventSheet.tsx:398`) keeps a
vertical-only binding. Replace:

```tsx
      <div onTouchStart={onTS} onTouchEnd={onTE} style={{ flexShrink: 0, position: 'relative' }}>
```

with:

```tsx
      <div {...drag.bind} style={{ flexShrink: 0, position: 'relative' }}>
```

The peek body (currently line 411) gains the same binding — replace:

```tsx
          <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
```

with:

```tsx
          <div {...drag.bind} style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
```

The scrolling list (currently lines 436-442) binds unconditionally — replace:

```tsx
              onTouchStart={!isFull ? onTS : undefined}
              onTouchEnd={!isFull ? onTE : undefined}
```

with:

```tsx
              {...drag.bind}
```

- [ ] **Step 5: Restructure the root into shell + card**

Replace the root element (currently lines 392-397) — the opening of the returned
JSX — with:

```tsx
    <div className="event-sheet" style={{
      position: 'absolute', height: sheetHeight,
      transition: 'height 380ms cubic-bezier(0.32,1.4,0.4,1)',
      zIndex: 40,
    }}>
      <div className="event-sheet-card" style={{
        height: '100%',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        // Treść jedzie za palcem; po puszczeniu wraca do zera niezależnie od
        // tego, czy wydarzenie się zmieniło.
        transform: `translateX(${drag.dx}px)`,
        transition: drag.transition,
      }}>
```

Close the new inner `<div>` immediately before the final `</div>` of the
component's return — the closing tag order becomes `…</div></div>\n  )`.

Note that `background: '#fff'` moves out of the inline style; `.event-sheet-card`
now carries it.

- [ ] **Step 6: Add the carets**

Immediately after the closing `</div>` of `.event-sheet-card` (still inside the
shell), add:

```tsx
      {isDesktop && onChainStep && (
        <>
          <div style={{ position: 'absolute', left: -44, top: '50%', transform: 'translateY(-50%)', zIndex: 41 }}>
            <ChainArrow
              dir="left" label={t('event.chainPrev')}
              disabled={!chainCanGo?.('west')}
              onClick={() => onChainStep('west')}
            />
          </div>
          <div style={{ position: 'absolute', right: -44, top: '50%', transform: 'translateY(-50%)', zIndex: 41 }}>
            <ChainArrow
              dir="right" label={t('event.chainNext')}
              disabled={!chainCanGo?.('east')}
              onClick={() => onChainStep('east')}
            />
          </div>
        </>
      )}
```

Add the desktop check next to the other derived values (near
`src/screens/EventSheet.tsx:254`, beside `const isFull = snap === 'full'`):

```tsx
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
```

- [ ] **Step 7: Add the arrow keys**

Add after the existing effects (after the scroll-reset effect at
`src/screens/EventSheet.tsx:320-322`):

```tsx
  // App podaje onChainStep jako świeżo domkniętą funkcję przy każdym renderze.
  // Przez ref nasłuch podpina się raz, zamiast odpinać i podpinać w kółko.
  const chainStepRef = useRef(onChainStep)
  useEffect(() => { chainStepRef.current = onChainStep }, [onChainStep])

  // Strzałki klawiatury robią to samo, co daszki — ale nie wtedy, gdy ktoś
  // pisze wiadomość albo patrzy na warstwę leżącą nad kartą.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const stepFn = chainStepRef.current
      if (!stepFn) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (chatOpen || photoModal !== null || notifyReason || calendarChooser) return
      e.preventDefault()
      stepFn(e.key === 'ArrowLeft' ? 'east' : 'west')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen, photoModal, notifyReason, calendarChooser])
```

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc -b`
Expected: no output.

Run: `npx eslint src/screens/EventSheet.tsx src/components/ChainArrow.tsx src/hooks/useCardDrag.ts`
Expected: no output.

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: PASS. `EventSheet` has no test file of its own; the neighbouring
`EventPhotoStrip`, `EventChatPanel` and `PhotoLightbox` tests must stay green.

- [ ] **Step 10: Commit**

```bash
git add src/index.css src/screens/EventSheet.tsx
git commit -m "Give the card a swipe, two carets and room to show them"
```

---

## Task 11: The map hands its pool up

**Files:**
- Modify: `src/screens/MapScreen.tsx:43-81` (props), and after `visibleEvents` at line 196-201

- [ ] **Step 1: Add the prop**

In the destructured props of `MapScreen` (after `onRegisterFlyToSpot`), add:

```tsx
  onPoolChange,
```

and in the prop types (after `onRegisterFlyToSpot?: (fn: ...) => void`):

```tsx
  /**
   * Wydarzenia, po których może chodzić sznurek, razem z podpisem tego, z czego
   * są zbudowane. Zmiana podpisu — inny filtr, inny dzień — resetuje sznurek.
   */
  onPoolChange?: (events: EventWithMeta[], poolKey: string) => void
```

- [ ] **Step 2: Publish the pool**

Directly after the `visibleEvents` memo (`src/screens/MapScreen.tsx:196-201`), add:

```tsx
  const poolKey = `${[...selectedFilters].sort().join(',')}|${dayIdx}`
  useEffect(() => {
    onPoolChange?.(visibleEvents, poolKey)
  }, [visibleEvents, poolKey]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b`
Expected: no output.

Run: `npx eslint src/screens/MapScreen.tsx`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "Let the map say what is on it and what shaped that answer"
```

---

## Task 12: The lists hand theirs up too

**Files:**
- Modify: `src/screens/MyEventsScreen.tsx:29,90,91`
- Modify: `src/screens/FollowedEventsScreen.tsx:29,89,90`

- [ ] **Step 1: Widen the callback in MyEventsScreen**

Change `src/screens/MyEventsScreen.tsx:29` from:

```tsx
  onOpenEvent: (ev: EventWithMsgCount) => void
```

to:

```tsx
  /** Lista w kolejności wyświetlania — po niej chodzi sznurek w tym ekranie. */
  onOpenEvent: (ev: EventWithMsgCount, ordered: EventWithMsgCount[]) => void
```

- [ ] **Step 2: Build the ordered list**

Directly after the three section filters (`src/screens/MyEventsScreen.tsx:59-61`), add:

```tsx
  const ordered = [...live, ...upcoming, ...ended]
```

- [ ] **Step 3: Pass it through**

Change `src/screens/MyEventsScreen.tsx:90-91` from:

```tsx
                onClick={() => onOpenEvent(ev)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenEvent(ev) }}
```

to:

```tsx
                onClick={() => onOpenEvent(ev, ordered)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenEvent(ev, ordered) }}
```

- [ ] **Step 4: Repeat for FollowedEventsScreen**

Change `src/screens/FollowedEventsScreen.tsx:29` from:

```tsx
  onOpenEvent: (ev: EventWithMsgCount) => void
```

to:

```tsx
  /** Lista w kolejności wyświetlania — po niej chodzi sznurek w tym ekranie. */
  onOpenEvent: (ev: EventWithMsgCount, ordered: EventWithMsgCount[]) => void
```

Directly after `src/screens/FollowedEventsScreen.tsx:58-60`, add:

```tsx
  const ordered = [...live, ...upcoming, ...ended]
```

Change `src/screens/FollowedEventsScreen.tsx:89-90` from:

```tsx
                onClick={() => onOpenEvent(ev)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenEvent(ev) }}
```

to:

```tsx
                onClick={() => onOpenEvent(ev, ordered)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenEvent(ev, ordered) }}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no output. `App.tsx` still passes one-argument handlers, and
TypeScript accepts a handler that ignores an argument it is offered. Task 13
starts using the second one.

- [ ] **Step 6: Commit**

```bash
git add src/screens/MyEventsScreen.tsx src/screens/FollowedEventsScreen.tsx
git commit -m "Have the saved lists say what order they are in"
```

---

## Task 13: Three chains in App

`selEvent`, `myEventSelected` and `followedEventSelected` stop being independent
`useState` values and become the `current` of three chains. Two sources of truth
about which event is open would drift; the touched call sites are the price of
not having them.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the imports and the pool state**

Add to the imports at the top of `src/App.tsx`:

```tsx
import { useEventChain } from './hooks/useEventChain'
import { geoStrategy, listStrategy } from './lib/eventChain'
```

- [ ] **Step 2: Replace the three selection states**

Replace `src/App.tsx:66`:

```tsx
  const [selEvent, setSelEvent] = useState<EventWithMeta | null>(null)
```

with:

```tsx
  // Pula sznurka mapowego przychodzi z MapScreen: to, co widać jako piny, po
  // filtrach. `mapPoolKey` mówi, z czego jest zbudowana — jego zmiana kasuje
  // przebytą trasę, zostawiając otwartą kartę jako nową kotwicę.
  const [mapPool, setMapPool] = useState<EventWithMeta[]>([])
  const [mapPoolKey, setMapPoolKey] = useState('')
  const mapChain = useEventChain(mapPool, geoStrategy, mapPoolKey)
  const selEvent = mapChain.current
```

Replace `src/App.tsx:76-77`:

```tsx
  const [myEventSelected, setMyEventSelected] = useState<EventWithMeta | null>(null)
  const [followedEventSelected, setFollowedEventSelected] = useState<EventWithMeta | null>(null)
```

with:

```tsx
  // Ekrany listowe mają własne pule i własną definicję „obok": sąsiedni wiersz,
  // nie sąsiednie miejsce. Filtrów tam nie ma, więc klucz puli jest stały.
  const [myPool, setMyPool] = useState<EventWithMeta[]>([])
  const [followedPool, setFollowedPool] = useState<EventWithMeta[]>([])
  const myChain = useEventChain(myPool, listStrategy, 'list')
  const followedChain = useEventChain(followedPool, listStrategy, 'list')
  const myEventSelected = myChain.current
  const followedEventSelected = followedChain.current
```

- [ ] **Step 3: Replace every setter call site**

Nine sites. Work through them in order — line numbers are from before this task's
edits, so search for the code rather than trusting the number.

`src/App.tsx:251` — closing every layer on a history pop:
```tsx
        setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
```
becomes
```tsx
        mapChain.close(); myChain.close(); followedChain.close()
```

`src/App.tsx:309` — the deep link opens a card:
```tsx
    setSelEvent(deepLinkEvent)
```
becomes
```tsx
    mapChain.start(deepLinkEvent)
```

`src/App.tsx:509` — a push notification opens a card:
```tsx
          db.getEventById(eventId).then(ev => { if (ev) setSelEvent(ev) })
```
becomes
```tsx
          db.getEventById(eventId).then(ev => { if (ev) mapChain.start(ev) })
```

`src/App.tsx:728,730` — restoring the saved navigation:
```tsx
              db.getEventById(saved.myEventId).then(ev => { setMyEventSelected(ev || null); setScreen(saved.screen) })
```
becomes
```tsx
              db.getEventById(saved.myEventId).then(ev => {
                if (ev) myChain.start(ev); else myChain.close()
                setScreen(saved.screen)
              })
```
and the `followedEventId` line the same way with `followedChain`.

`src/App.tsx:901` and `src/App.tsx:912`:
```tsx
    setSelEvent(null)
```
becomes
```tsx
    mapChain.close()
```
and
```tsx
    setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
```
becomes
```tsx
    mapChain.close(); myChain.close(); followedChain.close()
```

`src/App.tsx:995,1000,1007` — the three `setSelEvent(null)` inside the MapScreen
callbacks each become `mapChain.close()`.

`src/App.tsx:1013` — opening from a pin:
```tsx
            setSelEvent(ev); setCreateOpen(false); setProfileOpen(false)
```
becomes
```tsx
            mapChain.start(ev); setCreateOpen(false); setProfileOpen(false)
```

`src/App.tsx:1126` — an edit was saved. This one must **not** reset the walk:
```tsx
          setSelEvent(updated)
```
becomes
```tsx
          mapChain.replace(updated)
```

- [ ] **Step 4: Feed the map pool**

On the `<MapScreen …>` element, add next to `onRegisterFlyToSpot`:

```tsx
        onPoolChange={(events, key) => { setMapPool(events); setMapPoolKey(key) }}
```

- [ ] **Step 5: Feed the list pools and start their chains**

In the `MyEventsScreen` element (`src/App.tsx:1039-1043`), replace:

```tsx
            onOpenEvent={ev => {
              setMyEventSelected({ ...ev, distKm: 0, distStr: '' })
              flyToFnRef.current?.(ev.lat, ev.lng)
              window.history.pushState({ layer: 'event' }, '')
            }}
```

with:

```tsx
            onOpenEvent={(ev, ordered) => {
              setMyPool(ordered.map(e => ({ ...e, distKm: 0, distStr: '' })))
              myChain.start({ ...ev, distKm: 0, distStr: '' })
              flyToFnRef.current?.(ev.lat, ev.lng)
              window.history.pushState({ layer: 'event' }, '')
            }}
```

Do the same in the `FollowedEventsScreen` element (`src/App.tsx:1102-1105`) with
`setFollowedPool` and `followedChain`.

- [ ] **Step 6: Give each EventSheet its chain**

Add these two props to the **My Events** sheet (`src/App.tsx:1050-1064`):

```tsx
          onChainStep={dir => { const next = myChain.go(dir); if (next) flyToFnRef.current?.(next.lat, next.lng) }}
          chainCanGo={myChain.canGo}
```

To the **Followed Events** sheet (`src/App.tsx:1065-1079`):

```tsx
          onChainStep={dir => { const next = followedChain.go(dir); if (next) flyToFnRef.current?.(next.lat, next.lng) }}
          chainCanGo={followedChain.canGo}
```

To the **map** sheet (`src/App.tsx:1080-1094`):

```tsx
          onChainStep={dir => { const next = mapChain.go(dir); if (next) flyToFnRef.current?.(next.lat, next.lng) }}
          chainCanGo={mapChain.canGo}
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc -b`
Expected: no output. If it complains that `selEvent` is possibly null inside
`onLocate` at line 1087, that guard already exists (`{!isOverlay && selEvent && …}`)
— hoist to a local `const ev = selEvent` inside the block if TypeScript cannot
narrow through the closure.

Run: `npx eslint src/App.tsx`
Expected: no output.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS, including `src/screens/ProfilePanel.push.test.tsx` and the
`useEvents` tests.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "Make the open event the place the walk happens to be"
```

---

## Task 14: See it working

**Files:** none — verification only.

- [ ] **Step 1: Full green**

Run: `npm test`
Expected: PASS, no failures.

Run: `npx tsc -b`
Expected: no output.

Run: `npx eslint src/lib/eventChain.ts src/lib/cardDrag.ts src/hooks src/components/ChainArrow.tsx src/screens/EventSheet.tsx src/screens/MapScreen.tsx src/screens/MyEventsScreen.tsx src/screens/FollowedEventsScreen.tsx src/App.tsx`
Expected: no output.

- [ ] **Step 2: Start the preview**

Use the `preview_start` tool with `{ name: "dev" }`. If `.claude/launch.json`
does not exist yet, create it first:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

- [ ] **Step 3: Check the desktop layout**

Resize to the desktop preset. Open an event by clicking a pin. Confirm with
`read_page` that two buttons labelled from `event.chainPrev` / `event.chainNext`
exist, and with a screenshot that both carets sit beside the card, not on it,
and that the card is no longer flush against the left edge.

- [ ] **Step 4: Check the walk**

Click the right caret. Confirm the card's title changes and the map recentres.
Click the left caret; confirm the title returns to the first event. Press
`ArrowRight` then `ArrowLeft` and confirm the same. Check
`read_console_messages` for errors after each.

- [ ] **Step 5: Check the mobile gesture area**

Resize to the mobile preset and reload. Confirm with `read_page` that the carets
are gone and the card is full width. (The touch gesture itself cannot be driven
from the browser tools — the desktop carets and the arrow keys exercise the same
`onChainStep` path, and the drag arithmetic is covered by `cardDrag.test.ts`.)

- [ ] **Step 6: Commit nothing, report**

Report the screenshots and the console state. If anything is wrong, fix it in
the file that owns the behaviour and re-run steps 1-5.

---

## Self-Review Notes

Checked against the spec, section by section:

- **Chain model** — Tasks 1-3. `anchorIdx`, both-ended growth, the retrace.
- **Geographic strategy** — Task 2 (half plane) and Task 3 (nearest hop, 50 km,
  no revisits, co-located events).
- **Scope / list strategy** — Task 4, wired in Tasks 12-13.
- **Pool** — Task 11 publishes `visibleEvents`, which is already filter-aware.
- **Resetting** — Task 6 (`poolKey` collapse), Task 11 (the key itself),
  Task 13 (`close()` on every exit path).
- **Back button** — Task 13 adds no `pushState` in `onChainStep`; the existing
  entry pushed at open time still closes the card in one press.
- **Gesture** — Tasks 5, 7, 9, 10.
- **Desktop** — Tasks 8, 10 (shell split, `left: 76px`, arrow keys).
- **i18n** — Task 8, all five locales plus the parity guard.
- **Testing** — Tasks 1-6, 8; end-to-end check in Task 14.

Names used consistently throughout: `Chain`, `Dir`, `ChainStrategy`,
`startChain`, `step`, `currentOf`, `geoStrategy`, `listStrategy`, `MAX_JUMP_KM`,
`resolveAxis`, `commitDir`, `useEventChain` (`current` / `start` / `close` /
`replace` / `canGo` / `go`), `useCardDrag` (`dx` / `bind` / `transition`),
`ChainArrow`, `onPoolChange`, `onChainStep`, `chainCanGo`, `data-no-hswipe`.
