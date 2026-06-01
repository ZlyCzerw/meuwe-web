# Poprawa odporności scrapera lagenda.org

**Data:** 2026-06-01
**Status:** zatwierdzony design
**Zakres:** `scripts/event-sync/` — wyłącznie źródło lagenda.org

## Kontekst

Scraper `event-sync` pobiera wydarzenia z lagenda.org (HTML) i generuje plik SQL
wstawiany ręcznie do Supabase. Parsowanie opiera się na konkretnych klasach CSS
(`div.small-post`, `h4.title a`, `span.date-display-single`, `div.group-datos p`).
Każda zmiana struktury HTML cicho psuje import — błędy są łapane per event i
połykane, więc przebieg „udaje się" z 0 lub niepełnymi danymi.

Badanie żywej strony (2026-06-01) wykazało:

- **Brak** schema.org `Event` JSON-LD. Eventy są typu `Product` z minimalnym
  microdata (`itemprop="name"`, `image`, `url`, `aggregateRating`).
- **Są stabilne tagi `og:`** — `og:title`, `og:description`, `og:image`, `og:url`.
- **BreadcrumbList JSON-LD** podaje kategorie niezawodnie.
- **Data** jest tylko w karcie listingu; **godzina + venue** tylko w wolnym
  tekście opisu (regex).
- Tabela `events` ma kolumnę `photos text[]`, której scraper nie wypełnia.

## Cele

1. **Odporność selektorów** — pojedyncza zmiana HTML nie wywala ekstrakcji pola.
2. **Jakość ekstrakcji** — czystsze dane (`og:`), obrazek, pewne kategorie,
   poprawna strefa czasowa.
3. **Walidacja, która nie wyrzuca eventów za braki** — brakujące pola są
   uzupełniane domyślnymi wartościami, nie powodują pominięcia.
4. **Wykrywanie regresji** — testy na fixtures wyłapią zmiany HTML.

## Poza zakresem (non-goals)

- Dodawanie nowych źródeł (Ticketmaster itd.) — osobna praca.
- Automatyczne ładowanie SQL do bazy — pozostaje krok ręczny.
- Headless browser / renderowanie JS — strona to statyczny HTML.

## Architektura

Zachowujemy modułową strukturę. Dochodzą trzy moduły bezstanowe i reużywalne:

```
scripts/event-sync/
├── extract.ts      (NOWE)  helpery warstwowej ekstrakcji (cheerio in → wartość)
├── normalize.ts    (NOWE)  RawEvent → { event, warnings }, uzupełnia braki
├── timezone.ts     (NOWE)  canaryOffsetHours(date) via Intl
├── lagenda.ts      (zmiana) fetchDetail używa extract.ts, dodaje imageUrl
├── types.ts        (zmiana) RawEvent.imageUrl?, MeuweEvent.photos
├── sql.ts          (zmiana) INSERT z kolumną photos
├── index.ts        (zmiana) timezone fix, normalize, podsumowanie przebiegu
├── __fixtures__/   (NOWE)  listing.html, detail.html (realny HTML)
└── lagenda.test.ts (NOWE)  testy vitest
```

Każdy moduł ma jedno zadanie i daje się testować w izolacji:

- `extract.ts` — czyste funkcje `($: CheerioAPI, ...) => wartość`. Bez sieci.
- `normalize.ts` — czysta transformacja `RawEvent → RawEvent + warnings`. Bez sieci.
- `timezone.ts` — czysta funkcja `Date → number`. Bez sieci.

## Ekstrakcja per pole (łańcuchy fallback)

Każdy helper próbuje strategii w kolejności i zwraca pierwszą, która zadziała.

| Pole | Kolejność prób | Domyślna |
|------|----------------|----------|
| title | `og:title` → `itemprop="name"` → `h1` → tytuł z listingu | tytuł z listingu |
| description | `og:description` → akapity `group-datos` → długi `<p>` (>40 zn.) | `"{title}. {city}."` |
| image | `og:image` → `itemprop="image"` | brak (puste `photos`) |
| categories | BreadcrumbList JSON-LD `itemListElement[].item.name` → linki `/categoria/` | `[]` |
| startHour | regex `HH:MM` w opisie | `'19:00'` |
| endHour | regex (jeśli obecny) | start + 2h |
| venueName | regex z opisu (po godzinie) | nazwa miasta |
| coords | geocode: Nominatim → słownik gmin → środek Teneryfy | środek Teneryfy |

## Zasada „nigdy nie wyrzucaj za braki"

`normalize.ts` jest jedynym miejscem decydującym o losie eventu:

- Każde brakujące/puste pole → domyślna wartość z tabeli wyżej. **Pusty opis,
  brak obrazka, brak godziny czy venue NIE powodują pominięcia.**
- **Jedyny twardy wymóg: data.** `start_time`/`end_time` to NOT NULL i bez daty
  nie da się umieścić eventu na osi czasu. Jeśli daty nie da się sparsować →
  event pominięty, ale z **głośnym logiem** i ujęty w podsumowaniu (nie po cichu).
- `normalize` zwraca listę `warnings` (np. `"default-time"`, `"island-center-coords"`,
  `"empty-description"`), które `index.ts` zlicza do podsumowania.

`toMeuweEvent` w `index.ts` przestaje rzucać wyjątkiem dla braków danych —
geokodowanie już ma graceful fallback, a reszta przechodzi przez `normalize`.

## Poprawka strefy czasowej

Obecnie zahardkodowane `utcOffsetHours = 1`. Zimą Wyspy Kanaryjskie są w UTC+0
(WET), latem UTC+1 (WEST) — czyli zimowe eventy mają błąd +1h.

`timezone.ts` liczy offset z IANA `Atlantic/Canary` dla daty eventu, używając
`Intl.DateTimeFormat` z `timeZoneName: 'shortOffset'` (lub formatToParts).
`index.ts` woła `canaryOffsetHours(eventDate)` zamiast stałej.

## Obrazek

`RawEvent.imageUrl?` niesie `og:image`. `toMeuweEvent` mapuje go na
`MeuweEvent.photos: string[]` (tablica z jednym URL-em lub pusta). `sql.ts`
dodaje kolumnę `photos` do `INSERT` (literał tablicy Postgres, np.
`ARRAY['https://...']::text[]` lub `'{}'` gdy brak).

## Testy (wykrywanie regresji)

Realny HTML zapisany do `__fixtures__/` (`listing.html`, `detail.html` — już
pobrane podczas badania). `lagenda.test.ts` (vitest) pokrywa:

- `parseLagendaDate` — formaty `Sáb, 30/05/26`, `30/05/2026`, brak daty.
- helpery `extract.ts` — title/description/image/categories na fixture'ach.
- `canaryOffsetHours` — data zimowa (UTC+0) i letnia (UTC+1).
- `normalizeEvent` — uzupełnianie domyślnych, brak daty → pominięcie + warning.

Gdy lagenda zmieni HTML i fixture przestanie pasować — test padnie, awaria
przestaje być cicha.

## Podsumowanie przebiegu (logi)

Na końcu `index.ts`:

```
Zebrano:   N raw events
Zachowano: M (K pominięto — brak daty)
Fallbacki: 12× domyślna godzina, 3× współrzędne środka wyspy, 1× pusty opis
```

## Ryzyka / kompromisy

- **Godzina i venue** pozostają z natury kruche (tylko wolny tekst opisu) —
  fallback łagodzi skutki, ale nie da się tego w pełni „naprawić" bez danych
  strukturalnych, których strona nie udostępnia.
- **Data z listingu** to wciąż jeden selektor CSS — test na fixture jest tu
  główną siatką bezpieczeństwa.
- Fixtures trzeba będzie odświeżyć, jeśli świadomie zmienimy parsowanie — to
  akceptowalny koszt za wykrywanie regresji.
```
