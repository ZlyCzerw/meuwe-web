# Obecność na wydarzeniu - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbierać informację o tym, czy obserwujący dotarł na wydarzenie - automatycznie z pozycji zapisanej w trakcie jego trwania, a resztę uzupełniać pytaniem następnego dnia.

**Architecture:** Klient niczego nie deklaruje, tylko rzetelnie zapisuje pozycję; wniosek wyciąga zaplanowane zadanie SQL w bazie. Naprawa zapisu pozycji jest warunkiem wstępnym, bo dziś serwerowa kopia zamarza na pierwszym odczycie GPS. Nowa tabela trzyma jeden wiersz na parę użytkownik-wydarzenie, a deklaracja użytkownika nadpisuje automat.

**Tech Stack:** React 19 + TypeScript, Vitest, Supabase (PostgREST, RLS, `pg_cron`), Capacitor.

**Specyfikacja:** [2026-08-10-event-attendance-design.md](../specs/2026-08-10-event-attendance-design.md)

---

## UWAGA przed startem

W drzewie roboczym leżą **niezacommitowane zmiany z innej sesji** (praca nad listingiem iOS): `index.html`, `src/lib/appConfig.ts`, `src/components/StoreBadge*`, `src/components/landing/sections/DownloadCTASection.tsx` oraz **wszystkie pięć plików tłumaczeń**. Zadanie 6 dopisuje klucze do tłumaczeń - dopisuj je, nigdy nie nadpisuj pliku w całości i nie cofaj cudzych zmian. Przed commitem sprawdź `git diff --cached`, czy nie wciągnąłeś cudzej pracy.

Testy uruchamiamy z wykluczeniem worktree zadań w tle, bo Claude Code trzyma je wewnątrz repo:

```bash
npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Typy sprawdzamy przez `npx tsc -b`. Samo `npx tsc --noEmit` w tym repo **nic nie sprawdza** - root `tsconfig.json` ma `"files": []` i tylko referencje.

---

## File Structure

| Plik | Odpowiedzialność |
|---|---|
| `src/lib/location.ts` | nowy: decyzja „zapisywać pozycję czy nie", czysta funkcja |
| `src/lib/location.test.ts` | nowy: testy tej decyzji |
| `src/App.tsx` | zmiana: zapis pozycji sterowany refami zamiast zamrożonego domknięcia; osadzenie modala |
| `supabase/migrations/20260810_event_attendance.sql` | nowy: tabela + RLS |
| `supabase/migrations/20260810_detect_event_arrivals.sql` | nowy: funkcja wykrywająca + cron |
| `src/lib/attendanceAsk.ts` | nowy: wybór wydarzenia do zapytania, czysta funkcja |
| `src/lib/attendanceAsk.test.ts` | nowy: testy tego wyboru |
| `src/lib/supabase.ts` | zmiana: odczyt kandydatów i zapis odpowiedzi |
| `src/components/AttendanceAskModal.tsx` | nowy: modal „czy udało się dotrzeć" |
| `src/lib/overlays.ts` | zmiana: nowa warstwa musi być w `OverlayFlags` |
| `src/locales/{pl,en,de,es,sl}.ts` | zmiana: teksty modala |

---

## Task 1: Decyzja o zapisie pozycji

**Files:**
- Create: `src/lib/location.ts`
- Create: `src/lib/location.test.ts`

- [ ] **Step 1: Napisz padające testy**

Utwórz `src/lib/location.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldWriteLocation, MOVE_THRESHOLD_M, HEARTBEAT_MS } from './location'

const NOW = 1_700_000_000_000
const HERE = { lat: 50.0413, lng: 21.9990 }
// ~220 m north of HERE: 0.002 degrees of latitude is about 222 m.
const THERE = { lat: 50.0433, lng: 21.9990 }
// ~55 m north of HERE, under the movement threshold.
const NEARBY = { lat: 50.0418, lng: 21.9990 }

describe('shouldWriteLocation', () => {
  it('writes the first position it is ever given', () => {
    expect(shouldWriteLocation({ next: HERE, last: null, now: NOW })).toBe(true)
  })

  it('writes once the user has actually moved', () => {
    const last = { ...HERE, at: NOW - 120_000 }
    expect(shouldWriteLocation({ next: THERE, last, now: NOW })).toBe(true)
  })

  // GPS jitter fires the watch far more often than the fan-out needs.
  it('does not write a movement that lands within a minute of the last write', () => {
    const last = { ...HERE, at: NOW - 10_000 }
    expect(shouldWriteLocation({ next: THERE, last, now: NOW })).toBe(false)
  })

  it('ignores a wobble smaller than the threshold', () => {
    const last = { ...HERE, at: NOW - 120_000 }
    expect(shouldWriteLocation({ next: NEARBY, last, now: NOW })).toBe(false)
  })

  // The same write refreshes last_seen_at, which the fan-out reads as "this
  // account is active", so standing still must not let it go stale.
  it('writes on the heartbeat even when nothing moved', () => {
    const last = { ...HERE, at: NOW - HEARTBEAT_MS - 1 }
    expect(shouldWriteLocation({ next: HERE, last, now: NOW })).toBe(true)
  })

  it('stays quiet between heartbeats when nothing moved', () => {
    const last = { ...HERE, at: NOW - 120_000 }
    expect(shouldWriteLocation({ next: HERE, last, now: NOW })).toBe(false)
  })

  it('states its threshold in metres, so callers can reason about it', () => {
    expect(MOVE_THRESHOLD_M).toBe(100)
  })
})
```

- [ ] **Step 2: Uruchom i potwierdź, że padają**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/lib/location.test.ts
```

Oczekiwane: FAIL, nie da się rozwiązać importu `./location`.

- [ ] **Step 3: Napisz implementację**

Utwórz `src/lib/location.ts`:

```ts
import { haversineKm } from './geo'

// When the server copy of the user's position is worth rewriting.
//
// It used to be rewritten every five minutes with whatever value the effect
// closed over on its first run — which never changed, because the effect
// depended on `!!userPos` rather than on the position itself. The map followed
// the user while the fan-out measured from wherever they opened the app.

/** Below this the fan-out would reach the same events anyway. */
export const MOVE_THRESHOLD_M = 100
/** The watch fires on jitter; one write a minute is plenty. */
export const MIN_WRITE_INTERVAL_MS = 60_000
/** The same write refreshes last_seen_at, so standing still still reports in. */
export const HEARTBEAT_MS = 5 * 60_000

export interface WrittenLocation { lat: number; lng: number; at: number }

export function shouldWriteLocation(ctx: {
  next: { lat: number; lng: number }
  last: WrittenLocation | null
  now: number
}): boolean {
  if (!ctx.last) return true
  const since = ctx.now - ctx.last.at
  if (since >= HEARTBEAT_MS) return true
  if (since < MIN_WRITE_INTERVAL_MS) return false
  const movedM = haversineKm(ctx.last.lat, ctx.last.lng, ctx.next.lat, ctx.next.lng) * 1000
  return movedM >= MOVE_THRESHOLD_M
}
```

- [ ] **Step 4: Uruchom testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/lib/location.test.ts
```

Oczekiwane: PASS, 7 testów.

- [ ] **Step 5: Commit**

```bash
git add src/lib/location.ts src/lib/location.test.ts
git commit -m "Decide when the server copy of a position is worth rewriting"
```

---

## Task 2: Odmrożenie zapisu pozycji

**Files:**
- Modify: `src/App.tsx` (import, refy, efekt zapisu w okolicach linii 587-597)

- [ ] **Step 1: Dodaj import**

W `src/App.tsx`, obok pozostałych importów z `./lib`:

```ts
import { shouldWriteLocation, type WrittenLocation } from './lib/location'
```

- [ ] **Step 2: Dodaj refy obok istniejących**

`sessionRef` już istnieje w tym pliku. Dopisz obok niego:

```tsx
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => { userPosRef.current = userPos }, [userPos])
  const lastWrittenPosRef = useRef<WrittenLocation | null>(null)
```

- [ ] **Step 3: Zamień efekt zapisu**

Zastąp cały blok „Aktualizuj lokalizację w profilu co 5 minut" (`src/App.tsx:587-597`) tym:

```tsx
  // The server copy of the user's position — what the fan-out and the arrival
  // detection measure from.
  //
  // This used to depend on `!!userPos`: a boolean that flips false→true once
  // and never back, because setUserPos is never called with null. The effect
  // therefore ran once and its interval kept rewriting the position from the
  // first GPS fix for the rest of the session. Everything now goes through
  // refs, so neither a new fix nor a timer tick can send a stale value.
  const writeLocation = useCallback(() => {
    const uid = sessionRef.current?.user.id
    const next = userPosRef.current
    if (!uid || !next) return
    const now = Date.now()
    if (!shouldWriteLocation({ next, last: lastWrittenPosRef.current, now })) return
    lastWrittenPosRef.current = { lat: next.lat, lng: next.lng, at: now }
    db.updateProfileLocation(uid, next.lat, next.lng)
  }, [])

  // A different account must not inherit the previous one's rate limit.
  useEffect(() => { lastWrittenPosRef.current = null }, [session?.user.id])

  // Two callers, one decision: a fresh fix, and a timer for standing still.
  useEffect(() => { writeLocation() }, [userPos, session?.user.id, writeLocation])
  useEffect(() => {
    const id = setInterval(writeLocation, 60_000)
    return () => clearInterval(id)
  }, [writeLocation])
```

Upewnij się, że `useCallback` jest w imporcie z `react` na górze pliku.

- [ ] **Step 4: Typy, lint i testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc -b && npx eslint src/App.tsx && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: `tsc -b` bez wyjścia; eslint bez **nowych** błędów (plik ma zastane `no-empty` i jedno `no-unused-vars` — policz je przed zmianą i po); testy PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "Send the position the user is at, not the one they started from"
```

---

## Task 3: Tabela obecności

**Files:**
- Create: `supabase/migrations/20260810_event_attendance.sql`

- [ ] **Step 1: Napisz migrację**

```sql
-- Kto dotarł na wydarzenie.
--
-- Jeden wiersz na parę użytkownik-wydarzenie. `attended = false` jest pełną
-- odpowiedzią, nie brakiem danych: zapisuje "pytaliśmy, nie dotarł" i zamyka
-- temat, żeby modal nie zapytał drugi raz.
--
-- Deklaracja użytkownika ma pierwszeństwo nad automatem: wykrywanie wstawia
-- z ON CONFLICT DO NOTHING, a samodeklaracja nadpisuje istniejący wiersz.

create table if not exists public.event_attendance (
  user_id     uuid references auth.users on delete cascade not null,
  event_id    uuid references public.events on delete cascade not null,
  attended    boolean not null,
  source      text not null check (source in ('auto', 'self')),
  recorded_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_event_attendance_event on public.event_attendance (event_id);

alter table public.event_attendance enable row level security;

-- Wiersz obecności mówi, że dana osoba była w danym miejscu o danej porze.
-- Czyta go wyłącznie jej właściciel — organizator też nie. Wykrywanie
-- automatyczne działa jako SECURITY DEFINER, więc RLS go nie dotyczy.
create policy "own attendance select" on public.event_attendance
  for select using (auth.uid() = user_id);

create policy "own attendance insert" on public.event_attendance
  for insert with check (auth.uid() = user_id and source = 'self');

create policy "own attendance update" on public.event_attendance
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and source = 'self');
```

- [ ] **Step 2: Zastosuj na stagingu**

Migracje w tym projekcie idą ręcznie przez Supabase Dashboard → SQL Editor, bo tabela historii migracji jest na PROD pusta, a nazwy plików kolidują (`supabase db push` nie jest tu bezpieczne). Wklej treść i uruchom **najpierw na stagingu**.

- [ ] **Step 3: Sprawdź, że RLS działa**

W SQL Editorze stagingu, jako `authenticated` z podstawionym `auth.uid()`, spróbuj odczytać cudzy wiersz — ma nie wrócić nic. Wstawienie wiersza ze `source = 'auto'` z poziomu klienta ma zostać odrzucone przez politykę.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260810_event_attendance.sql
git commit -m "Add the table that records who reached an event"
```

---

## Task 4: Wykrywanie automatyczne

**Files:**
- Create: `supabase/migrations/20260810_detect_event_arrivals.sql`

- [ ] **Step 1: Napisz migrację**

```sql
-- Wykrywanie dotarcia na wydarzenie.
--
-- To jest próbkowanie, nie ciągły pomiar: profiles trzyma JEDNĄ, ostatnią
-- pozycję, więc kto wrócił do domu, ma w bazie dom. Zadanie pyta co 5 minut
-- "czy pozycja, którą trzymam teraz, wskazuje na to wydarzenie".
--
-- Dwie pary warunków robią różne rzeczy:
--   1. zakres przebiegu — które wydarzenia w ogóle oglądamy. Kwadrans po końcu
--      to ogon, żeby ostatnie minuty wydarzenia zdążyły zostać spróbkowane:
--      ostatnie próbkowanie przed końcem może wypaść 5 minut przed nim.
--   2. reguła zaliczania — czy trzymana pozycja POWSTAŁA w trakcie wydarzenia.
--      Przywiązanie do okna wydarzenia, a nie do "ostatnich N minut od teraz",
--      jest celowe: to drugie wiąże regułę z przypadkową chwilą uruchomienia
--      crona i gubi ludzi, którzy zamknęli aplikację między przebiegami.
--
-- last_seen_at NIE jest "ostatnią aktywnością" — update_my_location ustawia je
-- w jednym zapisie razem ze współrzędnymi, więc jest znacznikiem czasu tej
-- konkretnej pozycji. Dlatego to do niego przywiązany jest warunek czasowy.

create or replace function public.detect_event_arrivals()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_attendance (user_id, event_id, attended, source)
  select f.user_id, e.id, true, 'auto'
    from public.events e
    join public.event_follows f on f.event_id = e.id
    join public.profiles p on p.id = f.user_id
   where e.start_time - interval '30 minutes' <= now()
     and e.end_time   >= now() - interval '15 minutes'
     and p.last_lat is not null
     and p.last_lng is not null
     and p.last_seen_at >= e.start_time - interval '30 minutes'
     and p.last_seen_at <= e.end_time
     and 2 * 6371000 * asin(sqrt(
           power(sin(radians(e.lat - p.last_lat) / 2), 2)
           + cos(radians(p.last_lat)) * cos(radians(e.lat))
             * power(sin(radians(e.lng - p.last_lng) / 2), 2)
         )) <= 150
  on conflict (user_id, event_id) do nothing;
$$;

revoke all on function public.detect_event_arrivals() from public, anon, authenticated;

select cron.schedule(
  'detect-event-arrivals',
  '*/5 * * * *',
  $job$ select public.detect_event_arrivals(); $job$
);
```

- [ ] **Step 2: Zastosuj na stagingu i sprawdź na czterech profilach**

Uruchom migrację na stagingu. Potem stwórz jedno wydarzenie trwające teraz i cztery profile obserwujące, i wywołaj `select public.detect_event_arrivals();` ręcznie:

| profil | pozycja | `last_seen_at` | oczekiwanie |
|---|---|---|---|
| A | 100 m od pinu | w oknie | wiersz powstaje |
| B | 500 m od pinu | w oknie | brak wiersza |
| C | 100 m od pinu | 3 h przed startem | brak wiersza |
| D | 100 m od pinu | 20 min przed startem | wiersz powstaje |

Profil C jest najważniejszy: odróżnia „był tu wcześniej i pozycja zamarzła" od „jest tu teraz". Jeśli C dostanie wiersz, warunek okna jest zepsuty.

- [ ] **Step 3: Sprawdź ogon**

Ustaw wydarzeniu `end_time` na 2 minuty temu, profilowi `last_seen_at` na 4 minuty temu i uruchom funkcję. Wiersz ma powstać — to jest dokładnie ten przypadek, dla którego istnieje kwadrans w pierwszej parze warunków.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260810_detect_event_arrivals.sql
git commit -m "Sample followers' positions against the events they are at"
```

---

## Task 5: Wybór wydarzenia do zapytania

**Files:**
- Create: `src/lib/attendanceAsk.ts`
- Create: `src/lib/attendanceAsk.test.ts`

- [ ] **Step 1: Napisz padające testy**

Utwórz `src/lib/attendanceAsk.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickAttendanceAsk, type AskCandidate } from './attendanceAsk'

const NOW = new Date('2026-08-10T12:00:00Z')

const candidate = (over: Partial<AskCandidate> & { eventId: string }): AskCandidate => ({
  title: 'Koncert', endTime: '2026-08-09T21:00:00Z', answered: false, ...over,
})

describe('pickAttendanceAsk', () => {
  it('asks about an event that ended yesterday', () => {
    const c = candidate({ eventId: 'wczoraj' })
    expect(pickAttendanceAsk([c], NOW)).toEqual(c)
  })

  // Today is not "the next day" yet — the evening is not over.
  it('leaves today alone', () => {
    const c = candidate({ eventId: 'dzis', endTime: '2026-08-10T09:00:00Z' })
    expect(pickAttendanceAsk([c], NOW)).toBeNull()
  })

  it('gives up on anything older than two days', () => {
    const c = candidate({ eventId: 'stare', endTime: '2026-08-07T21:00:00Z' })
    expect(pickAttendanceAsk([c], NOW)).toBeNull()
  })

  it('never asks twice about the same event', () => {
    const c = candidate({ eventId: 'juz-odpowiedziane', answered: true })
    expect(pickAttendanceAsk([c], NOW)).toBeNull()
  })

  it('asks about the most recent one when several qualify', () => {
    const older = candidate({ eventId: 'wczesniej', endTime: '2026-08-09T14:00:00Z' })
    const newer = candidate({ eventId: 'pozniej', endTime: '2026-08-09T22:00:00Z' })
    expect(pickAttendanceAsk([older, newer], NOW)?.eventId).toBe('pozniej')
  })

  it('has nothing to ask about when nothing is followed', () => {
    expect(pickAttendanceAsk([], NOW)).toBeNull()
  })
})
```

- [ ] **Step 2: Uruchom i potwierdź, że padają**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/lib/attendanceAsk.test.ts
```

Oczekiwane: FAIL, nie da się rozwiązać importu `./attendanceAsk`.

- [ ] **Step 3: Napisz implementację**

Utwórz `src/lib/attendanceAsk.ts`:

```ts
// Które zakończone wydarzenie zasługuje na pytanie "czy udało się dotrzeć".
//
// Pytamy nazajutrz, nie zaraz po końcu: wieczór jeszcze trwa, a pytanie w jego
// trakcie brzmiałoby jak zarzut. Po dwóch dobach pamięć przestaje być warta
// zapisu, więc temat cichnie sam.

/** Dwie doby to tyle, ile warta jest taka odpowiedź. */
export const ASK_MAX_AGE_MS = 48 * 60 * 60 * 1000

export interface AskCandidate {
  eventId: string
  title: string
  /** ISO 8601. */
  endTime: string
  /** Czy użytkownik już sam odpowiedział o tym wydarzeniu. */
  answered: boolean
}

function startOfToday(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

export function pickAttendanceAsk(candidates: AskCandidate[], now: Date): AskCandidate | null {
  const dayStart = startOfToday(now).getTime()
  const oldest = now.getTime() - ASK_MAX_AGE_MS

  const eligible = candidates.filter(c => {
    if (c.answered) return false
    const end = new Date(c.endTime).getTime()
    if (!Number.isFinite(end)) return false
    return end < dayStart && end >= oldest
  })

  if (eligible.length === 0) return null
  return eligible.reduce((best, c) =>
    new Date(c.endTime).getTime() > new Date(best.endTime).getTime() ? c : best)
}
```

- [ ] **Step 4: Uruchom testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/lib/attendanceAsk.test.ts
```

Oczekiwane: PASS, 6 testów.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attendanceAsk.ts src/lib/attendanceAsk.test.ts
git commit -m "Pick the one ended event worth asking about"
```

---

## Task 6: Modal następnego dnia

**Files:**
- Modify: `src/lib/supabase.ts` (dwie nowe metody `db`)
- Create: `src/components/AttendanceAskModal.tsx`
- Modify: `src/lib/overlays.ts`
- Modify: `src/App.tsx`
- Modify: `src/locales/pl.ts`, `en.ts`, `de.ts`, `es.ts`, `sl.ts`

- [ ] **Step 1: Dodaj odczyt kandydatów i zapis odpowiedzi**

W `src/lib/supabase.ts`, w obiekcie `db`, dopisz obie metody:

```ts
  /**
   * Zakończone wydarzenia, które użytkownik obserwuje, wraz z informacją, czy
   * już sam odpowiedział. Dwa zapytania zamiast joina: PostgREST nie zagnieżdża
   * tabeli, do której filtr idzie po innym użytkowniku.
   */
  async getAttendanceCandidates(uid: string): Promise<AskCandidate[]> {
    const since = new Date(Date.now() - ASK_MAX_AGE_MS).toISOString()
    const { data: follows, error } = await supabase
      .from('event_follows')
      .select('event_id, events!inner(id, title, end_time)')
      .eq('user_id', uid)
      .gte('events.end_time', since)
      .lte('events.end_time', new Date().toISOString())
    if (error) { console.error('[attendance] follows query failed:', error); return [] }

    const rows = (follows ?? []) as unknown as {
      event_id: string
      events: { title: string; end_time: string }
    }[]
    if (rows.length === 0) return []

    const { data: answers } = await supabase
      .from('event_attendance')
      .select('event_id, source')
      .eq('user_id', uid)
      .in('event_id', rows.map(r => r.event_id))
    const answered = new Set(
      ((answers ?? []) as { event_id: string; source: string }[])
        .filter(a => a.source === 'self')
        .map(a => a.event_id),
    )

    return rows.map(r => ({
      eventId: r.event_id,
      title: r.events.title,
      endTime: r.events.end_time,
      answered: answered.has(r.event_id),
    }))
  },

  /** Deklaracja użytkownika nadpisuje automat — on wie lepiej. */
  async recordAttendance(eventId: string, attended: boolean) {
    const sess = await this.getSession()
    if (!sess) return { error: { message: 'not authenticated' } }
    return supabase.from('event_attendance').upsert(
      {
        user_id: sess.user.id,
        event_id: eventId,
        attended,
        source: 'self',
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' },
    )
  },
```

Dopisz import na górze pliku:

```ts
import { ASK_MAX_AGE_MS, type AskCandidate } from './attendanceAsk'
```

- [ ] **Step 2: Dopisz teksty do pięciu tłumaczeń**

**Dopisuj, nie nadpisuj plików** — leżą w nich niezacommitowane zmiany innej sesji.

W `src/locales/pl.ts` dodaj nową sekcję najwyższego poziomu obok `pushAsk`:

```ts
  attendance: {
    title: 'Mamy nadzieję, że było fajnie',
    question: 'Czy udało się dotrzeć na wydarzenie {{title}}?',
    yes: 'Tak',
    no: 'Nie',
  },
```

Polskie sformułowanie jest bezosobowe celowo: „czy udało się dotrzeć", nigdy „czy dotarłeś/dotarłaś". To samo w pozostałych językach — żadnych form rodzajowych.

`src/locales/en.ts`:

```ts
  attendance: {
    title: 'Hope it was good',
    question: 'Did you make it to {{title}}?',
    yes: 'Yes',
    no: 'No',
  },
```

`src/locales/de.ts`:

```ts
  attendance: {
    title: 'Wir hoffen, es war schön',
    question: 'Hat es zu {{title}} geklappt?',
    yes: 'Ja',
    no: 'Nein',
  },
```

`src/locales/es.ts`:

```ts
  attendance: {
    title: 'Esperamos que estuviera bien',
    question: '¿Se pudo llegar a {{title}}?',
    yes: 'Sí',
    no: 'No',
  },
```

`src/locales/sl.ts`:

```ts
  attendance: {
    title: 'Upamo, da je bilo lepo',
    question: 'Ali je uspelo priti na {{title}}?',
    yes: 'Da',
    no: 'Ne',
  },
```

- [ ] **Step 3: Napisz modal**

Utwórz `src/components/AttendanceAskModal.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'

// Pytanie zadawane nazajutrz o obserwowane wydarzenie, które się skończyło.
// Odpowiedź "nie" jest tak samo wartościowa jak "tak": zapisuje fakt i zamyka
// temat, więc modal nie wróci z tym samym wydarzeniem.

export default function AttendanceAskModal({
  title,
  onAnswer,
}: {
  title: string
  onAnswer: (attended: boolean) => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  function answer(attended: boolean) {
    setBusy(true)
    onAnswer(attended)
  }

  const button: React.CSSProperties = {
    flex: 1, padding: '14px', borderRadius: 999, fontSize: 16, fontWeight: 800,
    border: `2.5px solid ${INK}`, cursor: busy ? 'default' : 'pointer',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 320,
      background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
        padding: '28px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
        animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
      }}>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t('attendance.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t('attendance.question', { title })}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => answer(false)} disabled={busy}
            style={{ ...button, background: '#fff', color: C.ink }}>
            {t('attendance.no')}
          </button>
          <button onClick={() => answer(true)} disabled={busy}
            style={{ ...button, background: C.primary, color: '#fff' }}>
            {t('attendance.yes')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Zarejestruj nową warstwę**

W `src/lib/overlays.ts` dopisz pole do `OverlayFlags` (pola są wymagane celowo — kompilator zmusi każdego wołającego do zadeklarowania stanu nowej warstwy):

```ts
  attendanceAskOpen: boolean
```

i do `isScreenClear`:

```ts
    && !f.attendanceAskOpen
```

- [ ] **Step 5: Osadź w App**

Rozdziel **dane** od **widoczności** — dokładnie tak, jak robi to pytanie o powiadomienia. Gdyby flaga warstwy była liczona z samego kandydata, `isScreenClear()` zwracałby fałsz w chwili, gdy modal ma się pokazać, i nie pokazałby się nigdy.

W `src/App.tsx` dodaj obok pozostałych:

```tsx
  const [attendanceCandidate, setAttendanceCandidate] = useState<AskCandidate | null>(null)
  const [attendanceAskOpen, setAttendanceAskOpen] = useState(false)
  const attendanceFetchedRef = useRef(false)
```

Dopisz `attendanceAskOpen` do obiektu przekazywanego do `isScreenClear` (obok `pushAskOpen`) — kompilator wskaże to miejsce, jeśli je pominiesz.

Efekt pierwszy pobiera kandydata raz na uruchomienie aplikacji:

```tsx
  // Raz na uruchomienie: wybierz jedno zakończone wydarzenie z wczoraj.
  useEffect(() => {
    if (!session || screen !== 'map' || attendanceFetchedRef.current) return
    attendanceFetchedRef.current = true
    db.getAttendanceCandidates(session.user.id).then(candidates => {
      setAttendanceCandidate(pickAttendanceAsk(candidates, new Date()))
    })
  }, [session?.user.id, screen]) // eslint-disable-line react-hooks/exhaustive-deps
```

Efekt drugi czeka na wolny ekran, tym samym sondowaniem co pozostałe karty wchodzące bez zaproszenia:

```tsx
  useEffect(() => {
    if (!attendanceCandidate || attendanceAskOpen) return
    const id = setInterval(() => {
      if (screenIsClear()) setAttendanceAskOpen(true)
    }, 10_000)
    return () => clearInterval(id)
  }, [attendanceCandidate, attendanceAskOpen]) // eslint-disable-line react-hooks/exhaustive-deps
```

Wyrenderuj modal obok pozostałych:

```tsx
      {attendanceAskOpen && attendanceCandidate && session && (
        <AttendanceAskModal
          title={attendanceCandidate.title}
          onAnswer={attended => {
            db.recordAttendance(attendanceCandidate.eventId, attended)
            setAttendanceAskOpen(false)
            setAttendanceCandidate(null)
          }}
        />
      )}
```

Dopisz importy:

```ts
import AttendanceAskModal from './components/AttendanceAskModal'
import { pickAttendanceAsk, type AskCandidate } from './lib/attendanceAsk'
```

- [ ] **Step 6: Typy, lint i testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc -b && npx eslint src && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: wszystko przechodzi. Jeśli `tsc -b` wskazuje brakujące pole `attendanceAskOpen` w innym miejscu — to działa zabezpieczenie z `overlays.ts`, uzupełnij je tam.

- [ ] **Step 7: Sprawdź w przeglądarce**

```bash
npx vitest run src/lib/attendanceAsk.test.ts
```

Podgląd uruchamiaj przez `preview_start` z konfiguracją `meuwe-web-staging`, nigdy przez `npm run dev` w Bashu. Modal wymaga zalogowania i obserwowanego wydarzenia zakończonego wczoraj, więc na stagingu wstaw takie wydarzenie ręcznie i dodaj wiersz do `event_follows`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase.ts src/components/AttendanceAskModal.tsx src/lib/overlays.ts src/App.tsx src/locales
git commit -m "Ask, the next day, whether they made it"
```

Sprawdź `git diff --cached src/locales`, czy nie wciągnąłeś cudzych niezacommitowanych zmian.

---

## Weryfikacja końcowa

- [ ] `npx tsc -b` bez wyjścia
- [ ] `npx eslint src` bez nowych błędów wobec stanu sprzed planu
- [ ] `npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'` w całości zielone
- [ ] Cztery profile testowe z Task 4 dają oczekiwany wynik na stagingu
- [ ] Po dobie na stagingu: `select source, count(*) from event_attendance group by source` pokazuje wiersze `auto`
- [ ] **Nie pushuj bez zgody.** Praca na `staging`, `git push` po akceptacji.
