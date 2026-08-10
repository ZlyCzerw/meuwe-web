# Powiadomienia o eventach: doprowadzić kierowanie do specyfikacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Powiadomienia o nowych i rozpoczynających się wydarzeniach mają trafiać dokładnie do tych, których zainteresowania pokrywają się z tagami wydarzenia i którzy są w SWOIM promieniu od ostatniej znanej lokalizacji - a każda awaria po drodze ma być widoczna, nie połknięta.

**Architecture:** Reguła doboru odbiorców (`selectEventAudience`) jest już czysta i przetestowana; problemy leżą wokół niej - w danych wejściowych (tagi, promień) i w obsłudze błędów. Plan nie przepisuje reguły, tylko domyka trzy szczeliny: kategoria wydarzenia dołącza do tagów, przycisk na mapie przestaje po cichu rozszerzać promień powiadomień, a nieudane zapytanie o profile przestaje wyglądać jak „nikt nie pasuje".

**Tech Stack:** Supabase Edge Functions (Deno), PostgREST, React + TypeScript, Vitest.

---

## Jak to działa dzisiaj

Ścieżka jest jedna dla obu powiadomień. `push-new-event` odpala webhook bazy przy INSERT do `events`; `push-event-start` odpala `pg_cron` co 5 minut i bierze wydarzenia startujące w najbliższych 5 minutach, które nie mają jeszcze `start_notified_at`.

Obie funkcje robią to samo:

1. Pobierają kandydatów jednym zapytaniem:
   `profiles` gdzie `push_enabled = true` AND `last_lat IS NOT NULL` AND `last_lng IS NOT NULL` AND `last_seen_at >= dzisiaj - 30 dni`.
2. Pobierają tagi wydarzenia z `event_tags`.
3. Przepuszczają przez `selectEventAudience` ([audience.ts:57](../../../supabase/functions/_shared/audience.ts#L57)):
   - jeśli wydarzenie ma tagi: zostaje ten, kogo `interests` przecina się z tagami;
   - promień: `min(radius_km ?? 10, 50)` km, dystans liczony haversine od `last_lat/last_lng` do wydarzenia;
   - `push-new-event` wyklucza twórcę, `push-event-start` nie.
4. Zawężają wynik przez `filterDeliverable`: jeszcze raz `push_enabled = true` plus wyciszenia tego wydarzenia (`notification_mutes`).
5. Wysyłają web push do `push_subscriptions` i FCM do `push_devices`.

Lokalizacja bierze się z RPC `update_my_location` (SECURITY DEFINER), wołanego przez klienta przy pierwszym fixie GPS i potem co 5 minut. Ten sam RPC ustawia `last_seen_at`, więc „aktywność" i „lokalizacja" to w praktyce jedno zdarzenie.

### Co odbiega od specyfikacji

| # | Rzecz | Skutek |
|---|---|---|
| A | `handleNotifyHere` ([MapScreen.tsx:383](../../../src/screens/MapScreen.tsx#L383)) zapisuje `radius_km = min(50, max(obecny, ceil(promień widoku mapy)))` | Przycisk „Powiadom mnie, gdy coś się tu pojawi" po cichu rozszerza promień powiadomień do rozmiaru kadru. Nigdy nie zwęża. Na PROD **10 z 19** kont z włączonym pushem siedzi dokładnie na 50 km. |
| B | `if (tags.length > 0)` w `selectEventAudience` | Wydarzenie bez tagów pomija filtr zainteresowań i idzie do **wszystkich** w promieniu. Na PROD 1 z 20 ostatnich wydarzeń jest w tym stanie. |
| C | Filtr patrzy wyłącznie na `event_tags`, nigdy na `events.category` | Dziś zgodne, bo `CreateSheet` wysyła `category: tags[0]` i wszystkie tagi. Każda inna droga wstawienia (scraper, SQL, panel) daje kategorię bez wierszy w `event_tags` i wpada w przypadek B. |
| D | Dwa ciche warunki wstępne: brak lokalizacji i `last_seen_at` starsze niż 30 dni | Konto nigdy nie dostaje powiadomień, a UI nigdzie tego nie mówi. Panel profilu pokazuje „Powiadomienia włączone". |
| E | Błąd zapytania o profile jest logowany i ignorowany | `push-new-event` zwraca 200 `{sent: 0, reason: 'no matching users'}`, `push-event-start` w ogóle nie sprawdza błędu **i stempluje `start_notified_at`** - wydarzenie zostaje na zawsze oznaczone jako powiadomione. |
| F | Zapytanie o profile bez `.limit()` | PostgREST tnie po 1000 wierszach. Dziś nieszkodliwe, przy 1000+ kontach ucina odbiorców bez śladu. |
| G | `push-event-start` nie wyklucza twórcy, `push-new-event` wyklucza | Twórca dostaje powiadomienie o starcie własnego wydarzenia. Prawdopodobnie celowe, ale nigdzie nie zapisane. |

To, czego **nie** dało się sprawdzić z repo: czy webhook bazy dla `push-new-event` jest podpięty (konfiguracja żyje w dashboardzie, nie w migracjach) oraz zawartość `last_lat`/`last_seen_at` (kolumny ukryte przed kluczem anon).

---

## File Structure

| Plik | Odpowiedzialność | Zmiana |
|---|---|---|
| `supabase/functions/_shared/audience.ts` | reguła doboru odbiorców | kategoria jako tag zapasowy |
| `supabase/functions/_shared/audience.test.ts` | testy reguły | przypadki dla kategorii i braku tagów |
| `supabase/functions/push-new-event/index.ts` | fan-out nowego wydarzenia | przekazuje kategorię, przestaje połykać błąd profili |
| `supabase/functions/push-event-start/index.ts` | fan-out startu | to samo + nie stempluje po awarii |
| `src/screens/MapScreen.tsx` | przycisk „powiadom mnie tutaj" | przestaje rozszerzać promień do kadru |

---

## Task 1: Awaria zapytania o profile przestaje wyglądać jak „nikt nie pasuje"

Najpilniejsze, bo jako jedyne potrafi **trwale** zgubić powiadomienie: `push-event-start` stempluje `start_notified_at` niezależnie od tego, czy dobór odbiorców w ogóle się udał.

**Files:**
- Modify: `supabase/functions/push-new-event/index.ts:81-90`
- Modify: `supabase/functions/push-event-start/index.ts:54-61`

- [ ] **Step 1: Zatrzymaj wysyłkę nowego wydarzenia przy błędzie profili**

W `supabase/functions/push-new-event/index.ts` zamień blok zapytania o profile na:

```ts
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, interests, radius_km, last_lat, last_lng')
    .eq('push_enabled', true)
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    .limit(10000)

  // A failed audience query used to be logged and then walked past, so the
  // function answered 200 "no matching users" — indistinguishable from a
  // genuinely empty neighbourhood, and invisible in the dashboard.
  if (profErr) {
    console.error('[push-new-event] profiles error:', profErr)
    return new Response(JSON.stringify({ error: 'audience query failed' }), { status: 500 })
  }
  console.log(`[push-new-event] active profiles with location: ${(profiles ?? []).length}`)
```

- [ ] **Step 2: To samo dla startu wydarzenia, plus nie stempluj po awarii**

W `supabase/functions/push-event-start/index.ts` zamień zapytanie o profile na:

```ts
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, interests, radius_km, last_lat, last_lng')
    .eq('push_enabled', true)
    .not('last_lat', 'is', null)
    .not('last_lng', 'is', null)
    .gte('last_seen_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    .limit(10000)

  // Without this the loop below ran on an empty audience and still stamped
  // start_notified_at on every event — marking as "notified" a batch nobody was
  // ever told about, which the next cron run would never retry.
  if (profErr) {
    console.error('[push-event-start] profiles error:', profErr)
    return new Response(JSON.stringify({ error: 'audience query failed' }), { status: 500 })
  }
```

- [ ] **Step 3: Sprawdź, że funkcje nadal się kompilują pod Deno**

```bash
cd /Users/wiktormarc/meuwe-web && deno check supabase/functions/push-new-event/index.ts supabase/functions/push-event-start/index.ts
```

Oczekiwane: `Check file:///...` bez błędów. Jeśli `deno` nie jest zainstalowane, pomiń - te pliki nie wchodzą do builda web.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-new-event/index.ts supabase/functions/push-event-start/index.ts
git commit -m "Stop reading a failed audience query as an empty neighbourhood"
```

---

## Task 2: Kategoria wydarzenia liczy się jak tag

Domyka B i C naraz: wydarzenie zawsze ma co najmniej jeden tag do porównania, więc filtr zainteresowań przestaje się wyłączać.

**Files:**
- Modify: `supabase/functions/_shared/audience.ts:33-66`
- Modify: `supabase/functions/_shared/audience.test.ts`
- Modify: `supabase/functions/push-new-event/index.ts:71-75`
- Modify: `supabase/functions/push-event-start/index.ts:80-83`

- [ ] **Step 1: Napisz padające testy**

Na końcu `supabase/functions/_shared/audience.test.ts` dopisz:

```ts
Deno.test('category counts as a tag, so interests still decide', () => {
  const profiles: AudienceProfile[] = [
    { id: 'muzyk', interests: ['music'], radius_km: 20, last_lat: 50, last_lng: 22 },
    { id: 'sportowiec', interests: ['sport'], radius_km: 20, last_lat: 50, last_lng: 22 },
  ]
  const ids = selectEventAudience({
    isPrivate: false, tags: [], category: 'music', profiles, lat: 50, lng: 22,
  })
  assertEquals(ids, ['muzyk'])
})

Deno.test('an event with neither tags nor category still reaches the neighbourhood', () => {
  const profiles: AudienceProfile[] = [
    { id: 'ktokolwiek', interests: ['sport'], radius_km: 20, last_lat: 50, last_lng: 22 },
  ]
  const ids = selectEventAudience({
    isPrivate: false, tags: [], category: null, profiles, lat: 50, lng: 22,
  })
  assertEquals(ids, ['ktokolwiek'])
})
```

- [ ] **Step 2: Uruchom i potwierdź, że padają**

```bash
cd /Users/wiktormarc/meuwe-web && deno test supabase/functions/_shared/audience.test.ts
```

Oczekiwane: FAIL - `category` nie jest znanym polem opcji.

- [ ] **Step 3: Dodaj kategorię do reguły**

W `supabase/functions/_shared/audience.ts` zamień sygnaturę i ciało filtra:

```ts
export function selectEventAudience(opts: {
  isPrivate: boolean
  tags: string[]
  /**
   * The event's own category. It is the first tag the creator picked, but it
   * lives in its own column and every other insertion path (the scraper, SQL,
   * an admin tool) sets it without writing event_tags rows. Without it here, a
   * tagless event skipped the interest check entirely and went to everyone in
   * range — the opposite of what the tags are for.
   */
  category?: string | null
  profiles: AudienceProfile[]
  lat: number
  lng: number
  creatorId?: string | null
  /** Followers of this event — the only geo-independent audience. */
  followerIds?: string[]
  /** True when the creator triggered the notification themselves. */
  excludeCreator?: boolean
}): string[] {
  const {
    isPrivate, tags, category = null, profiles, lat, lng,
    creatorId = null, followerIds = [], excludeCreator = false,
  } = opts

  if (isPrivate) {
    const ids = new Set(followerIds)
    if (creatorId) ids.add(creatorId)
    if (excludeCreator && creatorId) ids.delete(creatorId)
    return [...ids]
  }

  const topics = tags.length > 0 ? tags : (category ? [category] : [])

  return profiles.filter((p) => {
    if (excludeCreator && p.id === creatorId) return false
    if (topics.length > 0) {
      const interests = p.interests ?? []
      if (!interests.some((i) => topics.includes(i))) return false
    }
    const radius = Math.min(p.radius_km ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    return haversineKm(p.last_lat, p.last_lng, lat, lng) <= radius
  }).map((p) => p.id)
}
```

- [ ] **Step 4: Uruchom testy**

```bash
cd /Users/wiktormarc/meuwe-web && deno test supabase/functions/_shared/audience.test.ts
```

Oczekiwane: PASS.

- [ ] **Step 5: Podaj kategorię z obu funkcji**

W `supabase/functions/push-new-event/index.ts` webhook niesie już kolumnę, więc wystarczy ją odczytać. Pod `const creatorId = ...` dopisz:

```ts
  const category = (record.category as string | null) ?? null
```

i przekaż do wywołania:

```ts
  const audienceIds = selectEventAudience({
    isPrivate: false,
    tags,
    category,
    profiles: (profiles ?? []) as AudienceProfile[],
    lat: eventLat,
    lng: eventLng,
    creatorId,
    excludeCreator: true,
  })
```

W `supabase/functions/push-event-start/index.ts` dociągnij kolumnę w zapytaniu o wydarzenia:

```ts
    .select('id, title, lat, lng, is_private, creator_id, category')
```

i przekaż ją dalej:

```ts
    const audienceIds = selectEventAudience({
      isPrivate: event.is_private,
      tags,
      category: event.category ?? null,
      profiles: (profiles ?? []) as AudienceProfile[],
      lat: event.lat,
      lng: event.lng,
      creatorId: event.creator_id,
      followerIds,
    })
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/audience.ts supabase/functions/_shared/audience.test.ts supabase/functions/push-new-event/index.ts supabase/functions/push-event-start/index.ts
git commit -m "Let the event's own category stand in for missing tags"
```

---

## Task 3: Przycisk na mapie przestaje po cichu rozszerzać promień powiadomień

**Files:**
- Modify: `src/screens/MapScreen.tsx:378-387`

- [ ] **Step 1: Zawęź zapis do odległości punktu, nie do rozmiaru kadru**

W `src/screens/MapScreen.tsx`, w `handleNotifyHere`, zamień zapis promienia na:

```ts
  async function handleNotifyHere() {
    if (!session) { onAuthNeeded(); return }
    await enablePushOnThisDevice(session.user.id)
    // Only far enough to cover the spot the user pointed at. This used to widen
    // to the whole viewport, which on a pulled-back map meant the maximum every
    // time — a notification setting the user never chose, silently replacing the
    // one they did. It still only ever widens, and never past what they asked
    // for by pressing this.
    const spotKm = userPos
      ? Math.ceil(haversineKm(userPos.lat, userPos.lng, eventsPos.lat, eventsPos.lng))
      : 0
    await db.updateProfile({
      id: session.user.id,
      push_enabled: true,
      radius_km: Math.min(MAX_MAP_KM, Math.max(profile?.radius_km ?? 0, spotKm)),
    })
    setNotifyDone(true)
  }
```

- [ ] **Step 2: Typecheck, lint i testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc -b && npx eslint src/screens/MapScreen.tsx && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: `tsc -b` bez wyjścia, eslint bez nowych błędów, wszystkie testy PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "Stop a map button from quietly maxing out the notification radius"
```

---

## Task 4: DECYZJA - co zrobić z kontami, które już mają rozszerzony promień

Task 3 zatrzymuje krwawienie, ale **nie cofa** tego, co już zapisano. Na PROD 10 z 19 kont z pushem stoi na 50 km i nie wiadomo, ile z nich wybrało to samo, a ile dostało od przycisku albo od onboardingu (`radiusFromNearest` zwraca 50, gdy w pobliżu nic nie znaleziono).

**Nie wykonuj bez decyzji.** Trzy opcje:

**A. Nic nie ruszać.** 50 km to nadal legalne ustawienie i użytkownik może je zmienić suwakiem. Koszt: ludzie dalej dostają powiadomienia z drugiego końca województwa i nie wiedzą dlaczego.

**B. Zresetować do domyślnych 10 km tym, którzy nigdy nie dotknęli suwaka.** Nie da się tego odróżnić - nie ma kolumny „kto to ustawił". Wymagałoby migracji dodającej `radius_source` i dopiero potem sprzątania. Uczciwe, ale to osobny projekt.

**C. Powiedzieć wprost w panelu profilu.** Suwak pokazuje wartość, ale nie mówi, że sięga 50 km. Dodać pod nim jedno zdanie z realnym zasięgiem, żeby użytkownik zobaczył, co ma ustawione, i sam zdecydował.

Rekomendacja: **C**, bo naprawia świadomość bez zgadywania cudzych intencji.

---

## Task 5: Powiedz użytkownikowi, gdy powiadomienia nie mają jak zadziałać

Dwa ciche warunki wstępne (D): brak lokalizacji i brak zainteresowań. Konto w tym stanie widzi „Powiadomienia włączone" i nie dostaje nic.

**Files:**
- Modify: `src/screens/ProfilePanel.tsx`
- Modify: `src/locales/{pl,en,de,es,sl}.ts`

- [ ] **Step 1: Ustal warunek**

W `src/screens/ProfilePanel.tsx`, obok `pushState`, dopisz:

```tsx
  // Notifications can be "on" and still be unable to reach anyone: the fan-out
  // measures from profiles.last_lat/lng, and matches the event's tags against
  // these interests. Either one missing means silence, and nothing on this
  // screen said so.
  const pushCannotReach = pushState === 'on' && (picked.length === 0)
```

- [ ] **Step 2: Pokaż to pod wierszem powiadomień**

Pod komponentem `<NotificationSetting …/>` dodaj:

```tsx
  {pushCannotReach && (
    <div style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft, padding: '0 4px 8px' }}>
      {t('profile.pushNoInterests')}
    </div>
  )}
```

- [ ] **Step 3: Dopisz klucz do pięciu tłumaczeń**

W `src/locales/pl.ts`, w sekcji `profile`:

```ts
    pushNoInterests: 'Wybierz zainteresowania, inaczej nie mamy o czym powiadamiać.',
```

`en`: `'Pick some interests, or there is nothing we can notify you about.'`
`de`: `'Wähle Interessen aus, sonst können wir dich über nichts benachrichtigen.'`
`es`: `'Elige intereses, o no habrá nada de lo que avisarte.'`
`sl`: `'Izberi zanimanja, sicer te nimamo o čem obvestiti.'`

- [ ] **Step 4: Testy i commit**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc -b && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
git add src/screens/ProfilePanel.tsx src/locales
git commit -m "Say when notifications are on but have nothing to match"
```

---

## Weryfikacja końcowa

- [ ] **Kod**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc -b && npx eslint src && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

- [ ] **Deploy funkcji na staging i sprawdzenie logów**

```bash
supabase functions deploy push-new-event push-event-start --project-ref <staging-ref>
```

Utwórz na staging wydarzenie z jednym tagiem, którego NIE masz w zainteresowaniach, i drugie z tagiem, który masz. Pierwsze nie ma przyjść, drugie ma. W logach funkcji sprawdź linię `audience: N, deliverable: M`.

- [ ] **Sprawdzenie webhooka** (poza repo)

Dashboard → Database → Webhooks: potwierdź, że hook na INSERT do `events` wskazuje na `push-new-event`. Ta konfiguracja nie jest w migracjach i nikt jej nie wersjonuje.

- [ ] **Nie pushuj bez zgody.** Praca na `staging`, `git push` po akceptacji.
