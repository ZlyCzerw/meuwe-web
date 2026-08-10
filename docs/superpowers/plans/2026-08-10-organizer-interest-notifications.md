# Powiadomienia dla organizatora o zainteresowaniu - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizator dostaje powiadomienie „X osób chce wziąć udział w Twoim wydarzeniu" przy pierwszych pięciu osobach z osobna, a potem tylko przy kolejnych progach.

**Architecture:** Webhook bazy na `INSERT` do `event_follows` woła nową funkcję edge, dokładnie tak jak istniejący webhook dla nowych wiadomości. Cała decyzja o tym, czy wysyłać, siedzi w czystej funkcji progów; idempotencję zapewnia kolumna na `events` z ostatnią powiadomioną liczbą, podnoszona warunkowo, żeby wyścig rozstrzygała baza.

**Tech Stack:** Supabase Edge Functions (Deno), PostgREST, Vitest, web push + FCM.

**Specyfikacja:** [2026-08-10-organizer-interest-notifications-design.md](../specs/2026-08-10-organizer-interest-notifications-design.md)

---

## UWAGA przed startem

Moduły w `supabase/functions/_shared/` są testowane **vitestem z projektu webowego**, nie `deno test` - poza `fcm.test.ts`, który jest wykluczony w `vitest.config.ts`. Nowe testy pisz więc pod vitest, z importami bez rozszerzenia (`from './interest'`), tak jak `audience.test.ts`.

Kod produkcyjny funkcji edge importuje z rozszerzeniem `.ts` (wymóg Deno) - to normalne, że test i moduł różnią się stylem importu w tym repo.

Testy uruchamiamy z wykluczeniem worktree zadań w tle:

```bash
npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

---

## File Structure

| Plik | Odpowiedzialność |
|---|---|
| `supabase/functions/_shared/interest.ts` | nowy: drabinka progów, czysta funkcja |
| `supabase/functions/_shared/interest.test.ts` | nowy: testy drabinki |
| `supabase/functions/_shared/notif-i18n.ts` | zmiana: typ `interest`, tytuł w 5 językach, treść z liczbą |
| `supabase/functions/_shared/notif-i18n.test.ts` | zmiana: testy odmiany liczby mnogiej |
| `supabase/migrations/20260810_event_interest_counter.sql` | nowy: kolumna idempotencji |
| `supabase/functions/push-event-interest/index.ts` | nowy: fan-out do organizatora |
| `docs/push-notifications-setup.md` | zmiana: instrukcja założenia webhooka |

---

## Task 1: Drabinka progów

**Files:**
- Create: `supabase/functions/_shared/interest.ts`
- Create: `supabase/functions/_shared/interest.test.ts`

- [ ] **Step 1: Napisz padające testy**

Utwórz `supabase/functions/_shared/interest.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { interestMilestones, shouldNotifyInterest } from './interest'

describe('interestMilestones', () => {
  // Na początku każda osoba jest informacją.
  it('counts every one of the first five', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(interestMilestones(n)).toBe(true)
  })

  it('goes quiet between five and ten', () => {
    for (const n of [6, 7, 8, 9]) expect(interestMilestones(n)).toBe(false)
  })

  it('speaks up on the ladder', () => {
    for (const n of [10, 15, 20, 30, 40, 50, 70, 100]) expect(interestMilestones(n)).toBe(true)
  })

  it('says nothing between the rungs', () => {
    for (const n of [11, 25, 45, 60, 90, 99]) expect(interestMilestones(n)).toBe(false)
  })

  it('settles into every fiftieth past a hundred', () => {
    expect(interestMilestones(150)).toBe(true)
    expect(interestMilestones(200)).toBe(true)
    expect(interestMilestones(110)).toBe(false)
    expect(interestMilestones(175)).toBe(false)
  })

  it('has nothing to say about nobody', () => {
    expect(interestMilestones(0)).toBe(false)
  })
})

describe('shouldNotifyInterest', () => {
  it('fires when a new rung is reached', () => {
    expect(shouldNotifyInterest(0, 1)).toBe(true)
    expect(shouldNotifyInterest(5, 10)).toBe(true)
  })

  // Two people joining at once both compute the same count; only the first
  // gets to record it, and the second must stay quiet.
  it('does not repeat a rung already announced', () => {
    expect(shouldNotifyInterest(5, 5)).toBe(false)
  })

  // Someone unfollowed and rejoined — the ladder does not go back down.
  it('stays quiet when the count fell and climbed back', () => {
    expect(shouldNotifyInterest(15, 12)).toBe(false)
    expect(shouldNotifyInterest(15, 15)).toBe(false)
  })
})
```

- [ ] **Step 2: Uruchom i potwierdź, że padają**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run supabase/functions/_shared/interest.test.ts
```

Oczekiwane: FAIL, nie da się rozwiązać importu `./interest`.

- [ ] **Step 3: Napisz implementację**

Utwórz `supabase/functions/_shared/interest.ts`:

```ts
// Kiedy organizator ma usłyszeć, że ktoś się wybiera na jego wydarzenie.
//
// Na początku każda osoba jest informacją; przy dużym wydarzeniu liczy się już
// tylko rząd wielkości. Trzydzieści powiadomień o trzydziestu osobach kończy
// się wyciszeniem aplikacji, więc drabinka rzednie wraz ze wzrostem.

const LADDER = [10, 15, 20, 30, 40, 50, 70, 100]

export function interestMilestones(count: number): boolean {
  if (count <= 0) return false
  if (count <= 5) return true
  if (count <= 100) return LADDER.includes(count)
  return count % 50 === 0
}

/**
 * `notifiedAt` to ostatnia liczba, o której powiadomiono, trzymana na
 * events.interest_notified_count. Porównanie z nią, zamiast samego progu,
 * załatwia dwa równoczesne dołączenia: oba policzą tę samą wartość, ale tylko
 * pierwsze zdąży ją zapisać. Licznik nigdy nie schodzi w dół, więc odejście i
 * powrót obserwującego nie wysyła powiadomienia o tym samym progu drugi raz.
 */
export function shouldNotifyInterest(notifiedAt: number, count: number): boolean {
  return count > notifiedAt && interestMilestones(count)
}
```

- [ ] **Step 4: Uruchom testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run supabase/functions/_shared/interest.test.ts
```

Oczekiwane: PASS, 9 testów.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/interest.ts supabase/functions/_shared/interest.test.ts
git commit -m "Thin the ladder of interest notifications as a crowd grows"
```

---

## Task 2: Treść powiadomienia z liczbą

**Files:**
- Modify: `supabase/functions/_shared/notif-i18n.ts`
- Modify: `supabase/functions/_shared/notif-i18n.test.ts`

- [ ] **Step 1: Napisz padające testy**

Dopisz na końcu `supabase/functions/_shared/notif-i18n.test.ts`:

```ts
describe('interestBody', () => {
  // Polski ma trzy formy: 1, 2-4 i reszta, z wyjątkiem nastek.
  it('inflects Polish through all three plural forms', () => {
    expect(interestBody(1, 'pl')).toBe('1 osoba chce wziąć udział')
    expect(interestBody(3, 'pl')).toBe('3 osoby chcą wziąć udział')
    expect(interestBody(7, 'pl')).toBe('7 osób chce wziąć udział')
    expect(interestBody(22, 'pl')).toBe('22 osoby chcą wziąć udział')
    expect(interestBody(13, 'pl')).toBe('13 osób chce wziąć udział')
  })

  // Słoweński ma liczbę podwójną.
  it('uses the Slovene dual', () => {
    expect(interestBody(1, 'sl')).toBe('1 oseba se odpravlja')
    expect(interestBody(2, 'sl')).toBe('2 osebi se odpravljata')
    expect(interestBody(3, 'sl')).toBe('3 osebe se odpravljajo')
    expect(interestBody(9, 'sl')).toBe('9 oseb se odpravlja')
  })

  it('keeps the simple languages simple', () => {
    expect(interestBody(1, 'en')).toBe('1 person is coming')
    expect(interestBody(4, 'en')).toBe('4 people are coming')
    expect(interestBody(1, 'de')).toBe('1 Person kommt')
    expect(interestBody(4, 'de')).toBe('4 Personen kommen')
    expect(interestBody(1, 'es')).toBe('1 persona va a asistir')
    expect(interestBody(4, 'es')).toBe('4 personas van a asistir')
  })

  it('has a title for the new type in every language', () => {
    for (const lang of ['pl', 'en', 'es', 'de', 'sl'] as const) {
      expect(NOTIF_TEXT.interest.title![lang].length).toBeGreaterThan(0)
    }
  })
})
```

Uzupełnij import na górze pliku testowego o `interestBody` i `NOTIF_TEXT`, jeśli któregoś brakuje.

- [ ] **Step 2: Uruchom i potwierdź, że padają**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run supabase/functions/_shared/notif-i18n.test.ts
```

Oczekiwane: FAIL, `interestBody` nie istnieje.

- [ ] **Step 3: Rozszerz typ i tabelę tytułów**

W `supabase/functions/_shared/notif-i18n.ts` zamień deklarację typu:

```ts
export type NotifType = 'new_event' | 'event_start' | 'update' | 'message' | 'interest'
```

`NOTIF_TEXT` jest typu `Record<NotifType, ...>`, więc kompilator zażąda nowego wpisu. Dopisz go do obiektu:

```ts
  interest: {
    title: {
      pl: 'Ktoś wybiera się na Twoje wydarzenie',
      en: 'Someone is coming to your event',
      es: 'Alguien va a tu evento',
      de: 'Jemand kommt zu deinem Event',
      sl: 'Nekdo pride na tvoj dogodek',
    },
  },
```

- [ ] **Step 4: Dopisz treść z liczbą**

Na końcu `supabase/functions/_shared/notif-i18n.ts`:

```ts
// Treść zawiera liczbę, więc nie mieści się w NOTIF_TEXT — ta tablica z
// założenia trzyma wyłącznie napisy bez części zmiennych. Odmiana idzie per
// język, bo kategorie liczby mnogiej się nie pokrywają: polski ma trzy formy,
// słoweński cztery z liczbą podwójną, angielski dwie.

function plPeople(n: number): string {
  if (n === 1) return '1 osoba chce wziąć udział'
  const mod10 = n % 10
  const mod100 = n % 100
  const few = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
  return few ? `${n} osoby chcą wziąć udział` : `${n} osób chce wziąć udział`
}

function slPeople(n: number): string {
  const mod100 = n % 100
  if (mod100 === 1) return `${n} oseba se odpravlja`
  if (mod100 === 2) return `${n} osebi se odpravljata`
  if (mod100 === 3 || mod100 === 4) return `${n} osebe se odpravljajo`
  return `${n} oseb se odpravlja`
}

export function interestBody(count: number, lang: Lang): string {
  switch (lang) {
    case 'pl': return plPeople(count)
    case 'sl': return slPeople(count)
    case 'de': return count === 1 ? '1 Person kommt' : `${count} Personen kommen`
    case 'es': return count === 1 ? '1 persona va a asistir' : `${count} personas van a asistir`
    default:  return count === 1 ? '1 person is coming' : `${count} people are coming`
  }
}
```

- [ ] **Step 5: Uruchom testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run supabase/functions/_shared/notif-i18n.test.ts
```

Oczekiwane: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/notif-i18n.ts supabase/functions/_shared/notif-i18n.test.ts
git commit -m "Count people in five languages without mangling the grammar"
```

---

## Task 3: Kolumna idempotencji

**Files:**
- Create: `supabase/migrations/20260810_event_interest_counter.sql`

- [ ] **Step 1: Napisz migrację**

```sql
-- Ostatnia liczba obserwujących, o której powiadomiono twórcę wydarzenia.
--
-- Bez tego dwa równoczesne dołączenia policzyłyby tę samą wartość i wysłały
-- dwa powiadomienia o tym samym progu. Podnoszenie MUSI iść warunkowo
-- (where interest_notified_count < :nowy), żeby wyścig rozstrzygała baza,
-- a nie kolejność wywołań funkcji edge.
--
-- Licznik nigdy nie schodzi w dół: odejście obserwującego jest ciche, więc
-- ponowne wejście na ten sam próg nie wysyła drugiego powiadomienia.

alter table public.events
  add column if not exists interest_notified_count integer not null default 0;
```

- [ ] **Step 2: Zastosuj na stagingu**

Wklej do Supabase Dashboard → SQL Editor na **stagingu** i uruchom. Migracje w tym projekcie idą ręcznie - tabela historii migracji jest na PROD pusta, a nazwy plików kolidują.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260810_event_interest_counter.sql
git commit -m "Remember which interest milestone was already announced"
```

---

## Task 4: Funkcja edge

**Files:**
- Create: `supabase/functions/push-event-interest/index.ts`

- [ ] **Step 1: Napisz funkcję**

Utwórz `supabase/functions/push-event-interest/index.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { sendFcmToMany } from '../_shared/fcm.ts'
import { NOTIF_TEXT, interestBody, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
import { shouldNotifyInterest } from '../_shared/interest.ts'
import { filterDeliverable } from '../_shared/recipients.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let record: Record<string, unknown>
  try {
    const body = await req.json()
    record = body.record ?? body
  } catch (e) {
    console.error('[push-event-interest] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId = record.event_id as string
  const followerId = record.user_id as string
  if (!eventId || !followerId) return new Response('Bad Request', { status: 400 })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: event, error: evErr } = await admin
    .from('events')
    .select('id, title, creator_id, interest_notified_count')
    .eq('id', eventId)
    .single()
  if (evErr || !event) {
    console.error('[push-event-interest] event lookup failed:', evErr)
    return new Response(JSON.stringify({ error: 'event lookup failed' }), { status: 500 })
  }

  // createEvent zapisuje twórcę jako obserwującego własnego wydarzenia i inne
  // funkcje na tym polegają. Nie liczy się jednak do chętnych — bez tego każdy
  // organizator dostałby "1 osoba chce wziąć udział" o sobie samym, sekundę po
  // utworzeniu wydarzenia.
  if (followerId === event.creator_id) {
    return new Response(JSON.stringify({ sent: 0, reason: 'creator follows own event' }), { status: 200 })
  }

  const { count, error: cntErr } = await admin
    .from('event_follows')
    .select('user_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('user_id', event.creator_id)
  if (cntErr || count === null) {
    console.error('[push-event-interest] follower count failed:', cntErr)
    return new Response(JSON.stringify({ error: 'count failed' }), { status: 500 })
  }

  if (!shouldNotifyInterest(event.interest_notified_count ?? 0, count)) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no milestone', count }), { status: 200 })
  }

  // Ta sama bramka co reszta powiadomień: push_enabled i wyciszenia wydarzenia.
  const { ids: targetIds, langByUser } = await filterDeliverable(admin, [event.creator_id], { eventId })
  if (targetIds.length === 0) {
    // Twórca wyciszył albo nie chce powiadomień — próg i tak uznajemy za
    // obsłużony, żeby kolejne dołączenie nie próbowało go ponownie.
    await admin.from('events')
      .update({ interest_notified_count: count })
      .eq('id', eventId).lt('interest_notified_count', count)
    return new Response(JSON.stringify({ sent: 0, reason: 'creator not deliverable' }), { status: 200 })
  }

  const lang: Lang = langByUser.get(event.creator_id) ?? 'en'
  const payload = {
    title: NOTIF_TEXT.interest.title![lang],
    body: interestBody(count, lang),
    type: 'interest' as const,
    eventId,
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key, user_id')
    .in('user_id', targetIds)
  if (subs && subs.length > 0) {
    for (const [, langSubs] of groupSubsByLang(subs, langByUser)) {
      await sendToMany(langSubs, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, admin)
    }
  }

  const { data: devices } = await admin
    .from('push_devices')
    .select('fcm_token, user_id')
    .in('user_id', targetIds)
  if (devices && devices.length > 0) {
    await sendFcmToMany(
      (devices as { fcm_token: string }[]).map(d => d.fcm_token),
      payload,
      admin,
    )
  }

  // Warunkowo: przy dwóch równoczesnych dołączeniach tylko jedno podniesie próg.
  await admin.from('events')
    .update({ interest_notified_count: count })
    .eq('id', eventId).lt('interest_notified_count', count)

  return new Response(JSON.stringify({ sent: (subs ?? []).length, count }), { status: 200 })
})
```

- [ ] **Step 2: Sprawdź typy funkcji pod Deno**

```bash
cd /Users/wiktormarc/meuwe-web && deno check supabase/functions/push-event-interest/index.ts
```

Oczekiwane: bez błędów. Jeśli `deno` nie jest zainstalowane, pomiń - ten katalog nie wchodzi do builda webowego, a `npx tsc -b` go nie obejmuje.

- [ ] **Step 3: Uruchom testy jednostkowe współdzielonych modułów**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: wszystko zielone.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-event-interest/index.ts
git commit -m "Tell an organizer that people are coming, at milestones"
```

---

## Task 5: Wdrożenie i webhook

**Files:**
- Modify: `docs/push-notifications-setup.md`

- [ ] **Step 1: Wdróż funkcję na staging**

```bash
supabase functions deploy push-event-interest --project-ref <staging-ref>
```

- [ ] **Step 2: Załóż webhook na stagingu**

Supabase Dashboard → Database → Webhooks → Create new hook:

- Table: `event_follows`
- Events: `INSERT`
- Type: HTTP Request, metoda `POST`
- URL: `https://<staging-ref>.supabase.co/functions/v1/push-event-interest`
- HTTP Headers: `x-webhook-secret` z wartością sekretu `WEBHOOK_SECRET`

- [ ] **Step 3: Dopisz to do dokumentacji**

W `docs/push-notifications-setup.md`, w sekcji o webhookach, dodaj trzeci wpis:

```markdown
### Webhook 3: Zainteresowanie wydarzeniem

- Table: `event_follows`
- Events: `INSERT`
- Webhook URL: `https://bcfhsbnbvsuxsiwmeway.supabase.co/functions/v1/push-event-interest`
- Header: `x-webhook-secret: <WEBHOOK_SECRET>`

Bez tego wpisu funkcja nigdy nie zostanie wywołana i nikt tego nie zauważy —
konfiguracja webhooków żyje w panelu, poza migracjami i poza kontrolą wersji.
```

- [ ] **Step 4: Sprawdź ścieżkę end-to-end na stagingu**

Konto A tworzy wydarzenie. Konta B i C je obserwują. Oczekiwane: A dostaje dwa powiadomienia, przy 1 i przy 2 osobie, i **nie** dostaje żadnego o sobie samym w chwili utworzenia wydarzenia. Po dołączeniu czwartej i piątej osoby przychodzą kolejne dwa, a potem cisza aż do dziesiątej.

Sprawdź w logach funkcji, że wywołanie dla twórcy kończy się `reason: 'creator follows own event'`.

- [ ] **Step 5: Commit**

```bash
git add docs/push-notifications-setup.md
git commit -m "Write down the webhook nobody would otherwise know to create"
```

---

## Weryfikacja końcowa

- [ ] `npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'` zielone
- [ ] Ścieżka end-to-end z Task 5 zachowuje się zgodnie z opisem
- [ ] `select id, interest_notified_count from events where id = '<test>'` pokazuje liczbę zgodną z ostatnim wysłanym progiem
- [ ] Webhook założony na stagingu; na PROD **dopiero po** akceptacji wyników ze stagingu
- [ ] **Nie pushuj bez zgody.** Praca na `staging`, `git push` po akceptacji.
