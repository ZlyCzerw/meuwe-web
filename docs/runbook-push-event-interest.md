# Runbook: powiadomienia o zainteresowaniu (`push-event-interest`)

Wdrożenie funkcji, która mówi organizatorowi „X osób chce wziąć udział".
Kod jest na `staging` (commity `4c43234`..`ab53464`). Ten dokument opisuje to,
czego kod sam nie zrobi: bazę, sekrety, deploy i webhook.

Projekt i decyzja: [spec](superpowers/specs/2026-08-10-organizer-interest-notifications-design.md),
[plan](superpowers/plans/2026-08-10-organizer-interest-notifications.md).

## Zanim cokolwiek uruchomisz

**CLI jest podlinkowane do PROD.** `supabase projects list` pokazuje ●
przy `bcfhsbnbvsuxsiwmeway`, więc każda komenda **bez** `--project-ref`
poleci w produkcję. Wszystkie komendy niżej mają ten flag jawnie - nie
skracaj ich.

| środowisko | project ref | adres funkcji |
|---|---|---|
| staging | `ujzmivdgibnnncmoqoyb` | `https://ujzmivdgibnnncmoqoyb.supabase.co/functions/v1/push-event-interest` |
| PROD | `bcfhsbnbvsuxsiwmeway` | `https://bcfhsbnbvsuxsiwmeway.supabase.co/functions/v1/push-event-interest` |

## Stan zastany: staging nie ma sekretów pusha

`supabase secrets list` na obu projektach (2026-08-11):

| sekret | staging | PROD |
|---|---|---|
| `WEBHOOK_SECRET` | **brak** | jest |
| `VAPID_PUBLIC_KEY` | **brak** | jest |
| `VAPID_PRIVATE_KEY` | **brak** | jest |
| `VAPID_SUBJECT` | **brak** | jest |
| `FCM_SERVICE_ACCOUNT_JSON` | **brak** | jest |
| `CRON_SECRET` | jest | jest |

To wywraca test z planu. Bez `WEBHOOK_SECRET` na stagingu funkcja odrzuca
**każde** wywołanie webhooka:

```ts
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''
if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
  return new Response('Unauthorized', { status: 401 })
}
```

Pusty sekret to fałsz, więc warunek zapada zawsze i odpowiedź to 401,
niezależnie od tego, co wyślesz w nagłówku. Dotyczy to też `push-new-event`
i `push-new-message`, które są na stagingu wdrożone (wersje z 5.08) - czyli
webhookowe powiadomienia nigdy tam nie zadziałały. Cron ma własny sekret
(`CRON_SECRET` jest ustawiony), więc `push-event-start` i digest
uwierzytelniają się poprawnie, ale bez kluczy VAPID i tak nie podpiszą
wysyłki web push.

Masz dwie drogi. **Ścieżka A** uzupełnia sekrety na stagingu i testuje tam.
**Ścieżka B** pomija staging i idzie od razu na PROD. Ścieżka B jest szybsza,
ale testujesz na żywych organizatorach - najgorszy przypadek to jedno
mylące powiadomienie do kogoś obcego. Rekomenduję A, bo i tak przyda się
przy każdej kolejnej zmianie w pushu.

---

## Ścieżka A: staging

### Krok 0: uzupełnij sekrety

`WEBHOOK_SECRET` może być dowolny - to sekret dzielony między panelem
a funkcją, nie klucz kryptograficzny:

```bash
openssl rand -hex 32
```

Zapisz wynik, bo za chwilę wejdzie w nagłówek webhooka.

```bash
supabase secrets set --project-ref ujzmivdgibnnncmoqoyb \
  WEBHOOK_SECRET='<wynik-openssl>'
```

Do web pusha potrzebne są jeszcze klucze VAPID. **Nie kopiuj ich z PROD**:
subskrypcja w przeglądarce jest związana z kluczem publicznym użytym przy
zapisie, a staging buduje się z własnym `VITE_VAPID_PUBLIC_KEY`. Wygeneruj
osobną parę:

```bash
npx web-push generate-vapid-keys
```

```bash
supabase secrets set --project-ref ujzmivdgibnnncmoqoyb \
  VAPID_PUBLIC_KEY='<public z web-push>' \
  VAPID_PRIVATE_KEY='<private z web-push>' \
  VAPID_SUBJECT='mailto:wiktor.marc@gmail.com'
```

Ten sam klucz publiczny musi trafić do builda frontu środowiska testowego
jako `VITE_VAPID_PUBLIC_KEY` - inaczej przeglądarka zapisze subskrypcję na
inny klucz i wysyłka poleci w próżnię.

Do pusha natywnego (Android/iOS) dochodzi konto serwisowe Firebase. Tu
kopiowanie z PROD jest w porządku, bo aplikacja mobilna i tak celuje w ten
sam projekt Firebase:

```bash
supabase secrets set --project-ref ujzmivdgibnnncmoqoyb \
  FCM_SERVICE_ACCOUNT_JSON="$(cat /sciezka/do/service-account.json)"
```

Jeśli testujesz tylko na przeglądarce, ten krok możesz pominąć - funkcja
zaloguje `[fcm] FCM_SERVICE_ACCOUNT_JSON not set` i wyśle sam web push.

Sprawdź:

```bash
supabase secrets list --project-ref ujzmivdgibnnncmoqoyb
```

### Krok 1: migracja

**Dashboard → SQL Editor** projektu `ujzmivdgibnnncmoqoyb`. Wklej całą
zawartość [20260810_event_interest_counter.sql](../supabase/migrations/20260810_event_interest_counter.sql):

```sql
alter table public.events
  add column if not exists interest_notified_count integer not null default 0;
```

Migracje w tym projekcie idą ręcznie - tabela historii na PROD jest pusta,
a nazwy plików kolidują, więc `supabase db push` jest tu niebezpieczne.

Weryfikacja:

```sql
select column_name, data_type, column_default, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'events'
   and column_name = 'interest_notified_count';
```

Oczekiwane: jeden wiersz, `integer`, default `0`, `NO`.

### Krok 2: deploy funkcji

```bash
cd /Users/wiktormarc/meuwe-web
supabase functions deploy push-event-interest --project-ref ujzmivdgibnnncmoqoyb
```

Weryfikacja:

```bash
supabase functions list --project-ref ujzmivdgibnnncmoqoyb
```

Oczekiwane: `push-event-interest` ze statusem `ACTIVE`.

Kolejność ma znaczenie: kolumna przed funkcją. Odwrotnie każde dołączenie
kończy się 500, bo `select` na `interest_notified_count` nie ma czego zwrócić.

### Krok 3: webhook

**Dashboard → Database → Webhooks → Create a new hook** w projekcie
`ujzmivdgibnnncmoqoyb`:

- Name: `on_event_follow`
- Table: `event_follows` (schema `public`)
- Events: ☑ **Insert** (nic więcej)
- Type: **HTTP Request**, metoda **POST**
- URL: `https://ujzmivdgibnnncmoqoyb.supabase.co/functions/v1/push-event-interest`
- HTTP Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <service_role_key stagingu>`
  - `x-webhook-secret: <ten sam string co WEBHOOK_SECRET>`

Oba nagłówki uwierzytelniające są potrzebne i pilnują czego innego.
`Authorization` przechodzi bramkę JWT platformy, `x-webhook-secret` -
sprawdzenie wewnątrz funkcji. Brak pierwszego to 401 od platformy, brak
drugiego to 401 od funkcji.

`service_role_key`: **Settings → API → service_role**.

Weryfikacja, że trigger powstał:

```sql
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.event_follows'::regclass
   and not tgisinternal;
```

### Krok 4: test end-to-end

Konto A tworzy wydarzenie. Konta B i C dołączają - osobno, z przerwą, żeby
dało się rozdzielić powiadomienia.

| moment | licznik | oczekiwanie |
|---|---|---|
| A tworzy wydarzenie | 0 | **żadnego powiadomienia** - A obserwuje własne wydarzenie, ale się nie liczy |
| B dołącza | 1 | A dostaje „1 osoba chce wziąć udział" |
| C dołącza | 2 | A dostaje „2 osoby chcą wziąć udział" |
| D dołącza | 3 | A dostaje „3 osoby chcą wziąć udział" |
| E, F | 4, 5 | po jednym powiadomieniu |
| G, H, I, J | 6-9 | **cisza** |
| K | 10 | A dostaje „10 osób chce wziąć udział" |

Stan licznika:

```sql
select id, title, interest_notified_count
  from public.events
 where id = '<uuid-wydarzenia>';
```

Ma równać się ostatniej liczbie, o której poszło powiadomienie - po C
wartość `2`, a po dołączeniu G-J nadal `5`.

Odpowiedzi webhooka (webhooki bazy chodzą przez `pg_net`, więc lądują tu
razem z cronem):

```sql
select status_code, content::text, created
  from net._http_response
 order by created desc
 limit 10;
```

Czego szukać:
- `200` z `{"sent":1,"count":1}` - wysłane
- `200` z `{"sent":0,"reason":"creator follows own event"}` - to wywołanie
  dla twórcy, dokładnie ten przypadek, który ma być cichy
- `200` z `{"sent":0,"reason":"no milestone","count":7}` - między progami
- `200` z `{"sent":0,"reason":"creator not deliverable"}` - A ma wyłączone
  powiadomienia albo wyciszył to wydarzenie
- `401` - sekret w nagłówku webhooka nie zgadza się z `WEBHOOK_SECRET`
- `500` - brak kolumny (krok 1 nie przeszedł) albo błąd zapytania

Pełne logi: **Dashboard → Edge Functions → push-event-interest → Logs**.
CLI w wersji 2.101 nie ma podkomendy `functions logs`, więc panel jest
jedyną drogą.

Test negatywny, wart minuty: A wycisza własne wydarzenie, dołącza kolejna
osoba. Oczekiwane `reason: 'creator not deliverable'`, a licznik i tak idzie
w górę - próg uznajemy za obsłużony, żeby nie próbował się odtwarzać.

---

## Ścieżka B: PROD

Dopiero po zielonym stagingu. PROD ma komplet sekretów, więc kroku 0 nie ma.

```bash
cd /Users/wiktormarc/meuwe-web
supabase functions deploy push-event-interest --project-ref bcfhsbnbvsuxsiwmeway
supabase functions list --project-ref bcfhsbnbvsuxsiwmeway
```

Migracja: ta sama treść, w SQL Editorze projektu `bcfhsbnbvsuxsiwmeway`,
**przed** deployem funkcji.

Webhook: identyczny jak w kroku 3, z podmienionymi trzema rzeczami:

- URL: `https://bcfhsbnbvsuxsiwmeway.supabase.co/functions/v1/push-event-interest`
- `Authorization: Bearer <service_role_key PRODU>`
- `x-webhook-secret: <WEBHOOK_SECRET PRODU>` - ten już istnieje, odczytaj go
  z **Settings → Edge Functions → Secrets**; `secrets list` pokazuje tylko
  skróty, nie wartości

### Czego się spodziewać na PROD

Kolumna startuje od zera na **wszystkich** istniejących wydarzeniach, a
webhook łapie tylko nowe wiersze - dotychczasowi obserwujący nie wywołają
niczego wstecz. Konsekwencja: pierwsze powiadomienie dla starego wydarzenia
poda liczbę bieżącą, nie „1". Wydarzenie z 39 obserwującymi po dołączeniu
czterdziestego wyśle „40 osób chce wziąć udział" jako pierwszą wiadomość w
życiu. To nie jest błąd, ale organizator zobaczy skok - warto wiedzieć,
zanim ktoś zgłosi to jako usterkę.

Jeśli wolisz tego uniknąć, przed założeniem webhooka wyrównaj licznik do
stanu faktycznego - wtedy odezwie się dopiero następny próg:

```sql
update public.events e
   set interest_notified_count = sub.n
  from (
    select f.event_id, count(*) as n
      from public.event_follows f
      join public.events ev on ev.id = f.event_id
     where f.user_id <> ev.creator_id
     group by f.event_id
  ) sub
 where e.id = sub.event_id;
```

## Wycofanie

Po kolei, od najmniej inwazyjnego:

1. **Wyłącz webhook** - Dashboard → Database → Webhooks → `on_event_follow`
   → Disable. Zatrzymuje wysyłkę, zostawia wszystko inne.
2. **Usuń funkcję**, jeśli trzeba:
   ```bash
   supabase functions delete push-event-interest --project-ref ujzmivdgibnnncmoqoyb
   ```
3. **Kolumnę zostaw.** Jest `not null default 0` i nic poza tą funkcją jej
   nie czyta, więc nie przeszkadza, a jej usunięcie kasuje stan progów.

## Przy okazji: migracje z planu obecności

Jeśli i tak siadasz do SQL Editora stagingu, czekają tam dwie migracje z
drugiego planu, uruchamiane w tej kolejności:

1. [20260810_event_attendance.sql](../supabase/migrations/20260810_event_attendance.sql) - tabela z RLS
2. [20260810_detect_event_arrivals.sql](../supabase/migrations/20260810_detect_event_arrivals.sql) - funkcja wykrywająca + cron co 5 minut

Druga wymaga pierwszej i rozszerzenia `pg_cron`, które włączyło już
`20260805_cron_jobs.sql`. Scenariusz testowy jest w
[planie obecności](superpowers/plans/2026-08-10-event-attendance.md), Task 4.
