# Czy użytkownik dotarł na wydarzenie - projekt

**Status:** zatwierdzony w rozmowie 2026-08-10, czeka na plan wdrożenia.

## Po co

Trzy zastosowania, wskazane przez właściciela produktu: statystyki dla organizatora, sygnał wiarygodności wydarzeń i historia „byłem tu" dla samego użytkownika. Żadne z nich nie potrzebuje czasu rzeczywistego ani powiadomienia w chwili dotarcia, więc projekt **świadomie nie sięga po lokalizację w tle** - unika uprawnienia `ACCESS_BACKGROUND_LOCATION`, osobnego uzasadnienia w obu sklepach i kosztu baterii.

Na tym etapie licznik **nie trafia na front**. Dane zbieramy do odczytu przez właściciela produktu w panelu Supabase; widok dla organizatora to osobna decyzja na później, gdy będzie wiadomo, czy dane są wiarygodne.

## Stan obecny i dlaczego blokuje

Serwerowa kopia pozycji użytkownika jest dziś zamrożona. Efekt w [App.tsx:589](../../../src/App.tsx#L589) ma zależności `[session?.user.id, !!userPos]` - drugi element to boolean, który przeskakuje z `false` na `true` raz i nigdy się nie zmienia, bo `setUserPos` nigdy nie ustawia `null`. Efekt nie uruchamia się ponownie, a domknięcie w `setInterval` trzyma **pierwszy** obiekt pozycji do końca życia komponentu. Co pięć minut idzie do bazy zapis z tymi samymi współrzędnymi co przy starcie.

Wykrywanie dotarcia z takiej pozycji byłoby bez sensu, więc naprawa zapisu jest warunkiem wstępnym, a nie osobnym życzeniem.

## Architektura

Orzeka **serwer**, nie klient. Aplikacja niczego nie deklaruje - rzetelnie zapisuje swoją pozycję, a wniosek „ten człowiek jest na miejscu" wyciąga zaplanowane zadanie w bazie. To wybór pod kątem wiarygodności: klientowi nie wolno wierzyć na słowo, gdy dane mają służyć za sygnał antyspamowy.

Konsekwencja: rozdzielczość wykrywania równa się świeżości zapisu pozycji. Bardzo krótka wizyta przy zamkniętej aplikacji umknie - i to jest akceptowane, bo lukę domyka pytanie następnego dnia.

### 1. Zapis pozycji

Decyzja „zapisywać czy nie" wychodzi do czystej funkcji w `src/lib/location.ts`, testowalnej bez Reacta:

```ts
export const MOVE_THRESHOLD_M = 100
export const MIN_WRITE_INTERVAL_MS = 60_000
export const HEARTBEAT_MS = 5 * 60_000

export function shouldWriteLocation(ctx: {
  next: { lat: number; lng: number }
  last: { lat: number; lng: number } | null
  lastWrittenAt: number | null
  now: number
}): boolean
```

Reguła: pisz, gdy nic jeszcze nie zapisano; albo gdy użytkownik przesunął się o co najmniej `MOVE_THRESHOLD_M`, a od ostatniego zapisu minęło `MIN_WRITE_INTERVAL_MS`; albo gdy od ostatniego zapisu minęło `HEARTBEAT_MS`, niezależnie od ruchu.

Bicie serca zostaje, bo ten sam RPC ustawia `last_seen_at`, od którego zależy 30-dniowy filtr aktywności w fan-oucie powiadomień.

W `App.tsx` jedna ścieżka wywołania obsługuje oba przypadki. Ostatnio zapisana pozycja i jej czas żyją w refach, nie w domknięciu, więc ani nowy odczyt GPS, ani tik zegara nie mogą wysłać nieaktualnej wartości:

- przy każdym nowym `userPos` - sprawdź i ewentualnie zapisz,
- co 60 s - sprawdź i ewentualnie zapisz (to daje bicie serca w bezruchu).

Zależności efektu to współrzędne, nie boolean.

Nic nie zmienia się w RPC `update_my_location` ani w uprawnieniach kolumn - `last_lat`, `last_lng` i `last_seen_at` pozostają ukryte przed odczytem innych użytkowników.

### 2. Tabela obecności

```sql
create table if not exists public.event_attendance (
  user_id     uuid references auth.users on delete cascade not null,
  event_id    uuid references public.events on delete cascade not null,
  attended    boolean not null,
  source      text not null check (source in ('auto', 'self')),
  recorded_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
```

Jeden wiersz na parę użytkownik-wydarzenie. `attended = false` jest pełnoprawną odpowiedzią, nie brakiem danych: zapisuje „pytaliśmy, nie dotarł" i zamyka temat, żeby nie pytać drugi raz.

Deklaracja użytkownika ma pierwszeństwo nad automatem. Automat wstawia z `on conflict do nothing`, samodeklaracja nadpisuje każdy istniejący wiersz.

RLS: właściciel czyta i pisze wyłącznie swoje wiersze, i wyłącznie ze `source = 'self'`. Nikt poza właścicielem nie odczyta ani jednego wiersza - organizator też nie. Automatyczne wykrywanie działa jako `security definer`, więc RLS go nie dotyczy.

```sql
alter table public.event_attendance enable row level security;

create policy "own attendance select" on public.event_attendance
  for select using (auth.uid() = user_id);

create policy "own attendance insert" on public.event_attendance
  for insert with check (auth.uid() = user_id and source = 'self');

create policy "own attendance update" on public.event_attendance
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and source = 'self');
```

### 3. Wykrywanie automatyczne

Bez nowej funkcji edge. Wszystkie dane są w Postgresie, odległość liczy się w SQL, a `pg_cron` jest już w projekcie skonfigurowany ([20260805_cron_jobs.sql](../../../supabase/migrations/20260805_cron_jobs.sql)). Funkcja `security definer`, uruchamiana co 5 minut:

- wydarzenia trwające teraz: od 30 minut przed `start_time` do `end_time`,
- ich obserwujący z `event_follows`,
- pozycja obserwującego z `profiles`, pod warunkiem że `last_seen_at` jest z ostatnich **15 minut**,
- odległość haversine od pinu wydarzenia mniejsza lub równa **150 m**,
- wstaw `attended = true, source = 'auto'`, `on conflict do nothing`.

Warunek świeżości jest częścią reguły, nie optymalizacją. Bez niego ktoś, kto był pod tym adresem po południu i zamknął aplikację, zostałby policzony jako obecny na wieczornym wydarzeniu w tym samym miejscu.

Wydarzenia prywatne obejmuje ta sama reguła - mają obserwujących i dotarcie znaczy dla nich to samo.

### 4. Pytanie następnego dnia

Wybór wydarzenia to czysta funkcja w `src/lib/attendanceAsk.ts`, testowalna bez UI: spośród obserwowanych wydarzeń bierze te, które skończyły się przed dzisiejszym dniem kalendarzowym i nie wcześniej niż 48 godzin temu, i o które jeszcze nie pytaliśmy (brak wiersza ze `source = 'self'`). Zwraca co najwyżej jedno - to, które skończyło się najpóźniej.

Modal pokazuje się przy otwarciu aplikacji, na wolnym ekranie (ten sam `isScreenClear`, którego używają nudge instalacyjny i pytanie o powiadomienia), najwyżej raz na jedno otwarcie. Odpowiedź zapisuje wiersz ze `source = 'self'` i `attended` zgodnie z wyborem.

Treść, neutralna płciowo we wszystkich pięciu językach:

| klucz | pl | en |
|---|---|---|
| `attendance.title` | Mamy nadzieję, że było fajnie | Hope it was good |
| `attendance.question` | Czy udało się dotrzeć na wydarzenie {{title}}? | Did you make it to {{title}}? |
| `attendance.yes` | Tak | Yes |
| `attendance.no` | Nie | No |

Polskie sformułowanie jest bezosobowe celowo - „czy udało się dotrzeć" zamiast „czy dotarłeś/dotarłaś". To samo dotyczy pozostałych języków: żadnych form rodzajowych.

## Skąd bierze się pokrycie

Automat łapie tego, kto ma otwartą aplikację będąc na miejscu - bo tylko wtedy powstaje świeży zapis pozycji, na którym opiera się cron. Nie jest to tak wąskie, jak brzmi: powiadomienie o starcie wydarzenia trafia dokładnie do obserwujących i dokładnie w chwili, gdy zmierzają na miejsce, a jego dotknięcie otwiera aplikację. Ludzie, których chcemy policzyć, są więc systematycznie kierowani do otwarcia apki w okolicy pinu.

Nie wymaga to żadnego dodatkowego kodu ponad to, co opisano wyżej. Poprawiony zapis pozycji wysyła pierwszy odczyt natychmiast po starcie aplikacji, więc nawet trzydziestosekundowe zajrzenie do meuwe zostawia ślad, który cron zobaczy w ciągu pięciu minut.

Resztę domyka pytanie następnego dnia.

### Co mierzymy, zanim dołożymy cokolwiek

Po pierwszych tygodniach danych sprawdzamy dla zakończonych wydarzeń: jaki odsetek obserwujących ma wiersz obecności w ogóle, i jak dzieli się on na `auto` i `self`. Duża przewaga `self` nad `auto` znaczy, że automat nie łapie ludzi i warto sięgnąć po wariant odłożony niżej. Wysoki udział `auto` znaczy, że nie ma czego dokładać.

## Odrzucone i odłożone

**Cichy push po pozycję - odrzucone.** Rozważaliśmy wysłanie do obserwujących niewidocznego pinga (np. 15 minut po starcie), na który klient odesłałby swoją pozycję. Ping da się wysłać, ale klient nie odda z niego lokalizacji, z trzech niezależnych powodów:

- na webie `navigator.geolocation` nie istnieje w service workerze, a push budzi właśnie jego - Geolocation API jest wystawione wyłącznie w kontekście okna, więc żadne uprawnienie tego nie zmieni;
- na Androidzie odczyt lokalizacji poza pierwszym planem wymaga `ACCESS_BACKGROUND_LOCATION` (od Androida 10), a obudzenie pushem nie jest z tego zwolnieniem; przy zabitej aplikacji JS w ogóle się nie uruchomi, bo plugin podaje wiadomość do JS tylko przy żywej apce albo po dotknięciu powiadomienia;
- na iOS silent push jest budżetowany i bywa opóźniony albo pominięty, a odczyt lokalizacji w tle wymaga autoryzacji „Always"; Apple odrzuca aplikacje używające cichych pushy do zbierania lokalizacji.

Wszystkie trzy prowadzą do uprawnienia, którego ten projekt świadomie unika. Temat jest zamknięty i nie wymaga ponownej analizy.

**Widoczny ping 15 minut po starcie - odłożone.** Powiadomienie „Jesteś na miejscu?", którego dotknięcie otwiera aplikację na pierwszym planie i pozwala odczytać pozycję na istniejącym uprawnieniu. Działa i jest dokładniejsze niż pytanie następnego dnia, bo opiera się na pozycji, a nie na pamięci sprzed doby.

Nie wchodzi do pierwszej wersji, bo to drugie powiadomienie o tym samym wydarzeniu, kwadrans po „Wydarzenie zaraz się zaczyna" - przy trzech obserwowanych rzeczach jednego wieczoru robi się hałas. Dokładanie go, zanim wiemy, że obecny mechanizm nie wystarcza, to hałas na kredyt.

Wracamy do niego, jeśli pomiar opisany wyżej pokaże, że automat łapie mniejszość obecnych.

## Czego ten projekt nie robi

Nie pokazuje niczego organizatorowi. Nie zbiera historii pozycji - `profiles` trzyma jedną, ostatnią, tak jak dziś. Nie działa przy zamkniętej aplikacji, i to jest cena za brak lokalizacji w tle, nie niedopatrzenie. Nie dotyka powiadomień o zainteresowaniu wydarzeniem, które są osobnym projektem.

## Testy

Czyste funkcje `shouldWriteLocation` i `pickAttendanceAsk` pokrywamy testami jednostkowymi - to w nich siedzą wszystkie decyzje. Funkcję SQL sprawdzamy na stagingu: wstawiamy profil z pozycją 100 m od pinu i drugi 500 m od pinu, uruchamiamy funkcję ręcznie, potwierdzamy jeden wiersz. Osobno test warunku świeżości: profil w promieniu, ale z `last_seen_at` sprzed godziny, nie może zostać policzony.

## Ryzyka

Zgrubna lokalizacja. Watch chodzi z `enableHighAccuracy: false`, więc w gęstej zabudowie błąd bywa rzędu 50-100 m. Próg 150 m to świadomy kompromis; przy zbyt wielu fałszywych trafieniach obniżamy go po zebraniu pierwszych danych, a nie przed.

Prywatność. Wiersz obecności to zapis, że dana osoba była w danym miejscu o danej porze. RLS zamyka go przed wszystkimi poza właścicielem, ale odczyt przez panel Supabase omija RLS - to świadoma decyzja właściciela produktu na czas zbierania danych i wymaga zgodności z polityką prywatności przed jakimkolwiek udostępnieniem tych liczb na zewnątrz.
