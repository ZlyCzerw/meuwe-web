# Wydarzenia z zakresu dat na jednej mapie

Data: 2026-08-20

## Problem

Mapa pokazuje wydarzenia dokładnie z jednego dnia. Kto planuje weekend albo
wyjazd na tydzień, musi przeklikać pasek dzień po dniu i za każdym razem
oglądać inną mapę. Nie da się zobaczyć, gdzie w ciągu najbliższych dwóch
tygodni coś się dzieje.

## Rozwiązanie

Nad rozwiniętym paskiem dni dochodzi przełącznik **Dzień / Zakres dat**.
W trybie zakresu użytkownik wybiera datę początkową i końcową, a mapa pokazuje
wszystkie wydarzenia, które nachodzą na ten przedział.

Tryb „Dzień" jest domyślny i zachowuje się dokładnie tak jak dotychczas — bo
w modelu danych jest zakresem o długości jednego dnia. Cała różnica między
trybami leży w tym, jak pasek reaguje na dotknięcia; mapa i zapytanie znają
tylko zakres.

## Decyzje

| Pytanie | Decyzja | Dlaczego |
|---|---|---|
| Maksymalna długość zakresu | Cały pasek, 15 dni (wczoraj → +13) | Zapytanie jest jedno niezależnie od długości; limit dołożymy, jeśli okaże się realnym problemem |
| Oznaczanie daty na mapie | Bez zmian — data i godzina są w half-sheecie | Duże, czytelne bloby są istotą mapy meuwe; plakietki by je zaśmieciły |
| Wybór na telefonie | Dwa dotknięcia (start, koniec); podgląd na hover tylko na desktopie | Przeciąganie po pasku jest już zajęte przez przewijanie i jest gestem częstszym |
| Po pierwszym dotknięciu | Mapa od razu pokazuje ten jeden dzień | Nigdy nie ma stanu, w którym pasek mówi jedno, a mapa pokazuje drugie |
| Trzecie dotknięcie | Zaczyna nowy zakres od tej daty | Zachowanie znane z kalendarzy rezerwacyjnych, w pełni odwracalne |
| Trwałość wyboru | Ulotny, ginie z zamknięciem aplikacji | Wybór dnia też jest ulotny; zapisany zakres po tygodniu byłby cały w przeszłości |
| Pobieranie danych | Jedno zapytanie z rozszerzonym oknem czasu | Zapytanie na dzień to do 15 round-tripów plus tyleż RPC na liczniki |
| Model stanu | Jeden `DayRange`; tryb to warstwa UI | Cztery zgodne ze sobą stany to cztery sposoby na rozjazd |

## Wygląd i zachowanie

### Przełącznik

Widoczny wyłącznie przy rozwiniętym pasku (po dotknięciu pigułki z datą),
znika razem z nim. Styl jak reszta kontrolek mapy: biała pigułka, obwódka
`2.5px INK`, cień `0 3px 0 INK33`, dwa segmenty. Aktywny segment wypełniony
`C.primary`, biały tekst; nieaktywny przezroczysty z tekstem `C.ink`.

Napisy: **Dzień** (lewy, domyślny) i **Zakres dat** (prawy). Nowe klucze
`map.modeDay` i `map.modeRange` w `pl`, `en`, `es`, `de`, `sl`.

### Kolory kafelków w trybie zakresu

- początek i koniec zakresu — `C.primary`, biały tekst, obwódka `INK`
  (identycznie jak dziś wybrany dzień),
- dni wewnątrz zakresu — nowy token `C.primaryRange` = `#FFBEA1`, tekst `INK`,
  bez obwódki. Ciemniejszy od `primarySoft`, wyraźnie jaśniejszy od `primary`,
- podgląd przy przechodzeniu kursorem (desktop) — `C.primarySoft` (`#FFD4C0`),
  czyli jaśniejszy niż zatwierdzony zakres; znika po zdjęciu kursora,
- **„dziś"** zachowuje dotychczasowe tło `C.primarySoft` w obu trybach, o ile
  leży poza zakresem. Gdy wpada w zakres, dostaje kolor zakresu
  (`C.primaryRange`) albo `C.primary`, jeśli jest jednym z jego końców —
  przynależność do zakresu jest ważniejsza niż zaznaczenie „dziś".

Kafelki zostają osobne, z dotychczasową przerwą 4 px. Zakres to ciąg
podświetlonych kafelków, nie zlany pasek — zlany wymagałby przebudowy layoutu
za niewielki zysk.

### Gesty

Przeciąganie po pasku znaczy „przewiń" w obu trybach; mechanika
`tlPD`/`tlPM`/`tlPU` w `MapScreen` zostaje nietknięta, łącznie z progiem 8 px
odróżniającym tapnięcie od przeciągnięcia.

W trybie zakresu tapnięcia idą po kolei:

1. nowy początek — zakres zwija się do jednego dnia,
2. koniec zakresu,
3. nowy początek — zakres liczy się od zera.

Tap we wcześniejszą datę niż początek zamienia daty miejscami. Przykład: tap na
niedzielę 23.08, potem na środę 19.08 → **od 19.08 do 23.08**, podświetlenie
obejmuje 19–23. Podgląd na hover rysuje się w obie strony tak samo.

### Zwinięta pigułka

Zakres dłuższy niż jeden dzień: `24 sie – 30 sie`, bez nazwy dnia tygodnia —
nie zmieściłaby się. Zakres jednodniowy bez zmian: `Dziś · 24 sie`.

### Strzałki po bokach paska

W trybie „Dzień" przesuwają wybrany dzień, tak jak dotychczas. W trybie „Zakres
dat" przewijają wyłącznie okno paska, nie ruszając zaznaczenia — inaczej nie
dałoby się dojechać do odległej daty końcowej bez skasowania początku.

### Powrót na „Dzień"

Koniec zakresu zrównuje się z początkiem. Na mapie zostaje dzień, od którego
zaznaczenie się zaczynało.

## Architektura

### `src/lib/timeline.ts`

Dochodzi `type DayRange = { startIdx: number; endIdx: number }` i czyste
funkcje:

- `normalizeRange(a, b)` — porządkuje daty, obsługuje zaznaczanie wstecz,
- `isInRange(idx, range)`,
- `tapRange(sel, idx)` — maszyna dotknięć: nowy początek → koniec → nowy początek,
- `tileState(idx, range, preview)` — jak wygląda kafelek: kraniec, środek, podgląd, nic,
- `rangeWindow(startOffset, endOffset, now)` → `{ dayStart, dayEnd, endTimeFloor }`.

`rangeWindow` wyprowadza z `getEvents` jedyny fragment zapytania, w którym jest
jakaś decyzja, dzięki czemu daje się przetestować bez sieci i bez atrapy
Supabase. Okno biegnie od północy pierwszego dnia do `23:59:59.999` ostatniego.
`endTimeFloor` to `now`, gdy zakres zaczyna się dziś (zakończone wydarzenia
znikają), a północ pierwszego dnia w każdym innym przypadku — czyli zakres
zaczynający się wczoraj pokazuje wczorajsze zakończone wydarzenia, tak samo jak
dziś wybranie „wczoraj".

### `src/components/DayTimeline.tsx` (nowy)

`MapScreen.tsx` ma 975 linii, a ta zmiana dokłada mu przełącznik, podgląd na
hover i logikę tapnięć. Cały pasek — zwinięta pigułka, przewijanie, przełącznik,
kafelki dni — wychodzi do osobnego komponentu:

```
{ range, onRangeChange, mode, onModeChange, open, onOpenChange }
```

`MapScreen` traci ~150 linii, a mechanika wyboru daje się testować bez Leafleta.

### `src/screens/MapScreen.tsx`

`dayIdx` znika, zostaje `range: DayRange` oraz `mode: 'day' | 'range'`.
Podział obowiązków jest ostry: **`range` sam decyduje, co się pobiera i co widać
na mapie**, a `mode` mówi wyłącznie, który segment przełącznika jest aktywny
i jak pasek reaguje na tapnięcia. Osobny stan jest konieczny, bo zakres
jednodniowy w trybie „Zakres dat" wygląda w danych identycznie jak tryb „Dzień",
a przełącznik musi pamiętać, w którym z nich jest. Żadna ścieżka pobierania
danych nie czyta `mode`.

Miejsca ustawiające dziś dzień ustawiają zakres jednodniowy: `onRegisterShowDay`
(smart-linki) i przycisk pustej karty.

`poolKey` dostaje oba końce: `${filtry}|${startIdx}-${endIdx}` — inaczej karty
pod mapą trzymałyby pulę z poprzedniego zakresu.

### `src/lib/supabase.ts`

`getEvents(lat, lng, km, dayOffsetStart, dayOffsetEnd = dayOffsetStart)`.
Okno czasu bierze z `rangeWindow`. Domyślna wartość drugiego parametru sprawia,
że wywołania jednodniowe zachowują się co do znaku tak jak dotychczas.

### `src/hooks/useEvents.ts`

`useEvents(view, startOffset, endOffset, refreshKey)`. Klucz zapytania oraz
wykrywanie zmiany dnia (dziś `dayInState`) kluczują się parą offsetów — zmiana
dowolnego końca zakresu czyści cache w tym samym renderze, więc na mapie nie
zostaje ani jedna klatka z pinami spoza nowego zakresu. Scalanie po widoku,
odświeżanie co 5 minut i kanał realtime bez zmian.

### Pusta karta

Wariant `nextDay` proponuje dziś przeskok na najbliższy dzień, w którym coś
jest. W trybie zakresu ten przycisk **rozszerza zakres** tak, by objął
sugerowany dzień, zamiast przeskakiwać — obietnica „zobacz: sobota (3)" zostaje
dotrzymana bez wyprowadzania użytkownika z trybu, który sam wybrał. Warianty
`wider`, `nothing` i `unknown` bez zmian.

## Błędy i przypadki brzegowe

Nieudane zapytanie nadal zwraca `null`, a nie pustą tablicę, więc mapa zachowuje
piny, które już ma.

`MAP_EVENT_LIMIT` (1500 wierszy, sortowanie po `created_at`) zostaje nietknięty.
Przy 15 dniach w bardzo gęstym mieście może uciąć najstarsze wpisy — przyjęte
świadomie, zgodnie z decyzją o braku limitu długości zakresu.

Piny publiczne klastrują się po strefie 3×3 m bez zmian, więc kilka wydarzeń
w tym samym miejscu z różnych dni trafia do istniejącego pickera.

## Testy

- **`src/lib/timeline.test.ts`** (istnieje): `normalizeRange` przy zaznaczaniu
  wstecz, przy równych datach i na krańcach osi; `isInRange`; `rangeWindow` —
  zakres zaczynający się dziś chowa zakończone, zaczynający się wczoraj ich nie
  chowa, zakres wielodniowy kończy się o 23:59:59.999 ostatniego dnia.
- **`src/components/DayTimeline.test.tsx`** (nowy): sekwencja tapnięć
  start → koniec → nowy start; zaznaczanie wstecz; przełączenie na „Dzień"
  zrównuje końce; przeciągnięcie powyżej progu 8 px przewija i **nie** zaznacza.
- **`src/hooks/useEvents.test.tsx`** (rozszerzenie): zmiana samego końca zakresu
  czyści piny w tym samym renderze i wysyła nowe zapytanie; odpowiedź na
  poprzedni zakres zostaje odrzucona jako nieaktualna.
- **`src/locales/parity.test.ts`** pilnuje sam, żeby `map.modeDay`
  i `map.modeRange` istniały we wszystkich pięciu językach.

Weryfikacja przed uznaniem pracy za skończoną: `npx tsc -b` oraz `npm test`.

## Poza zakresem

Świadomie pominięte: zapis wyboru w `localStorage`, plakietki z datą na pinach,
limit długości zakresu, zmiany w klastrowaniu, powiadomieniach i eksporcie do
kalendarza.

## Znane ograniczenie

`EventPickerModal` pokazuje przy każdym wydarzeniu same godziny, bez daty.
W trybie zakresu klaster w jednym miejscu może zebrać wydarzenia z kilku dni
i lista będzie wyglądać jak kilka wpisów `19:00-23:00`. Odnotowane świadomie —
nie jest to zadanie w tej zmianie.
