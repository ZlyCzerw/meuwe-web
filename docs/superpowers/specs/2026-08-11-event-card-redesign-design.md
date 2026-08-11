# Karta wydarzenia — nowy front - projekt

**Status:** zatwierdzony w rozmowie 2026-08-11, czeka na plan wdrożenia.

Wzorzec wizualny: `meuwe-karta-wydarzenia-standalone.html` (makieta dostarczona przez właściciela produktu). Zmienia się wyłącznie warstwa prezentacji i kolejność sekcji. **Żadna funkcja nie znika**: obserwowanie wraz z `FollowNotifyModal` i `pushAsk`, kalendarz z `CalendarChooserModal` i podpowiedzią „Inny kalendarz", udostępnianie, czat w czasie rzeczywistym, pasek obserwujących, tryb `peek`, `computeStatus`, dystans, Edytuj/Zakończ dla twórcy, toasty.

## Po co

Obecna karta ([EventSheet.tsx](../../../src/screens/EventSheet.tsx)) upycha status, czas, dystans, trasę i trzy okrągłe przyciski w jednym rzędzie nad zdjęciem. Najważniejsze akcje mają 44 px i żadnej etykiety — trzeba zgadywać, co robi serce, a co strzałka. Makieta rozwiązuje to trzykolumnowym rzędem akcji z podpisami i grupuje fakty (data, miejsce) w jedną kartę, którą da się objąć wzrokiem.

Przy okazji naprawiamy zgłoszony wprost błąd: przycisk zamykania pełnoekranowego podglądu zdjęcia nachodzi na górny pasek systemowy i jest nieklikalny.

## Decyzje podjęte w rozmowie

1. **„Wezmę udział" to obecne „Obserwuj"** — ta sama funkcja (`db.followEvent` / `db.unfollowEvent`), nowa etykieta i ikona. Bez zmian w bazie.
2. **Pasek obserwujących ląduje na zdjęciu**, w lewym górnym rogu.
3. **Bez zdjęcia** karta pokazuje ten sam kadr 16:9 wypełniony gradientem w kolorze kategorii — układ się nie rusza.
4. **Czat po rozwinięciu** zajmuje wszystko poniżej cienkiego paska z tytułem i powrotem.
5. **Wysokość trybu half wynika z pomiaru zawartości**, nie z procentu.
6. **Sprzętowy „wstecz" na Androidzie zamyka czat**, nie całą kartę.

### Dlaczego „Wezmę udział" nie koliduje z `event_attendance`

Tabela `event_attendance` ([spec](2026-08-10-event-attendance-design.md)) odpowiada na pytanie **po fakcie** — „czy udało się dotrzeć", zadawane nazajutrz przez `AttendanceAskModal`. Nowa etykieta obserwowania to **deklaracja przed**. Te dwie rzeczy się nie wykluczają, tylko domykają parę: kto zadeklarował udział, tego nazajutrz pytamy, czy dotarł. Pytanie robi się bardziej zrozumiałe, nie mniej.

Warto mieć świadomość jednego przesunięcia znaczenia: dziś ktoś klika serce, żeby *dostawać wiadomości*; po zmianie ten sam klik brzmi jak *zobowiązanie*. To świadomy wybór właściciela produktu — obserwowanie w meuwe i tak niemal zawsze oznacza zamiar pójścia.

## Podział pliku

`EventSheet.tsx` ma dziś 798 linii i trzyma wszystko naraz. Carousel ze scroll-snapem, pasek tagów, składany opis i czat-nakładka dołożyłyby do tego ~300 linii. Rozbicie na jednostki o jednej odpowiedzialności:

| plik | odpowiedzialność | zależy od |
|---|---|---|
| `screens/EventSheet.tsx` | dane, snapy, modale, orkiestracja | wszystkich poniżej |
| `screens/event/EventPhotoStrip.tsx` | carousel, pasek tagów, pasek obserwujących, ×, kadr zastępczy | `TagChip`, `OrganicBlob`, `BlobFace` |
| `screens/event/PhotoLightbox.tsx` | podgląd pełnoekranowy z przewijaniem | — |
| `screens/event/EventChatPanel.tsx` | lista wiadomości, pole wpisywania, pasek powrotu | `authorLabel` |
| `components/ActionRow.tsx` | trzykolumnowy rząd akcji | `C`, `INK`, `F` |

Każdy z nowych plików da się zrozumieć bez czytania pozostałych i przetestować osobno. Logika przenosi się bez zmian — to przeprowadzka, nie przepisanie.

## Tryb half

```
╭──────── uchwyt ────────╮
│ ┌──────────────────────────┐ │
│ │ (◐◑◒) 3 obserwują    [×] │ │  ← pasek obserwujących lewy górny róg
│ │  ‹    ZDJĘCIE 16:9    ›  │ │
│ │          • • •           │ │
│ │ [sztuka][muzyka][wystawa]→│ │  ← wszystkie tagi, przewijalne
│ └──────────────────────────┘ │
│ Pejzaż w malarstwie [wkrótce]│
│ ┌ cream ──────────────────┐  │
│ │ 📅 4 sierpnia (poniedziałek)│
│ │    19:00 – 21:00         │  │
│ │ ─────────────────────────│  │
│ │ 📍 Muzeum Okręgowe       │  │
│ │    1,2 km od Ciebie [Trasa]│ │
│ └──────────────────────────┘  │
│ ┌ cream ──────────────────┐  │
│ │  (✓)      (📅)      (↗)  │  │
│ │ Wezmę   Dodaj do   Udo-  │  │
│ │ udział  kalendarza stępnij│  │
│ └──────────────────────────┘  │
```

### Wysokość wynika z pomiaru

Zawartość trybu half ma **stałą wysokość ~480 px**, nie stały udział w ekranie. Procent zawsze gdzieś zawiedzie: 480 px to 61% iPhone'a 15, ale 72% iPhone'a SE. Za mały procent utnie rząd akcji; za duży zostawi pustkę i zasłoni mapę.

Dlatego `ResizeObserver` mierzy naturalną wysokość zawartości, a karta dostaje:

```
clamp(320px, uchwyt + zmierzona zawartość + env(safe-area-inset-bottom), 78vh)
```

Konsekwencje, wszystkie pożądane:

- half **nigdy się nie przewija** — mieści się co do piksela,
- dzięki temu **każde przewinięcie w half jednoznacznie znaczy „rozwiń do full"**, bez progów i zgadywania,
- na bardzo małym ekranie `78vh` wygrywa i zawartość może zostać ucięta — wtedy przewinięcie rozwija do full, czyli zachowanie degraduje się sensownie.

Mierzymy realnie renderowaną zawartość — `ResizeObserver` siedzi na kontenerze sekcji half, bez elementu-widma poza ekranem. Wysokość karty w stanie `half` to stan Reacta aktualizowany z obserwatora, więc dwuwierszowy tytuł, ósmy tag czy pojawienie się paska obserwujących natychmiast dopasowują kartę.

Tryby `peek` (130 px) i `full` (93%) zostają bez zmian.

### Carousel zdjęć

Natywny scroll-snap zamiast ręcznego liczenia dotyku:

```
overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth
```

Każde zdjęcie to `flex: 0 0 100%` z `scroll-snap-align: center`. Swipe z rozpędem dostajemy od przeglądarki za darmo, `photoIdx` liczymy z `scrollLeft` w `onScroll`, a strzałki `‹ ›` wołają `scrollTo`. Kropki pod spodem pozostają klikalne.

Uchwyt karty ma własne handlery `onTouchStart`/`onTouchEnd` i siedzi nad zdjęciem, więc gest poziomy na zdjęciu i pionowy na uchwycie się nie gryzą.

### Pasek obserwujących na zdjęciu

Lewy górny róg kadru: do trzech awatarów 22 px zachodzących na siebie, obok liczba w formie skróconej. Pod paskiem gradient przyciemniający od góry, żeby awatary były czytelne na jasnym zdjęciu. Gdy nikt nie obserwuje — pasek znika w całości.

Zajmuje osobny róg niż `×`, więc kolizji nie ma nawet przy trzech awatarach.

### Kadr bez zdjęcia

Ten sam kontener 16:9, w środku gradient w kolorze kategorii (`TAG_META[category].color`) plus `OrganicBlob` z `BlobFace` — ten sam język wizualny co pinezka na mapie. Pasek tagów, pasek obserwujących i `×` zostają na swoich miejscach.

### Pasek tagów

Wszystkie tagi wydarzenia, przewijalne poziomo, przyklejone do dolnej krawędzi kadru, na gradiencie przyciemniającym. Bez skracania do trzech i bez `+N` — właściciel produktu chce widzieć komplet.

`TagChip` dostaje opcjonalny prop `outlined`, który dokłada obrys 2 px w kolorze `INK`. Bez obrysu chipy w jasnych kolorach (`kids`, `nature`) znikają na jasnym zdjęciu. Jeden komponent obsługuje oba zastosowania — bez duplikatu.

## Tryb full — kolejne sekcje

Zawartość trybu half przewija się do góry, pod nią kolejno:

1. **Opis** — do 350 znaków, cięty na granicy słowa, `Czytaj więcej` rozwija całość, `Zwiń` składa z powrotem. Krótszy opis nie dostaje żadnego przycisku.
2. **Dodane przez** — awatar, nazwa autora, plakietka „Moderator" dla własnego wydarzenia.
3. **Edytuj / Zakończ** — tylko twórca, tylko gdy wydarzenie niezakończone.
4. **Czat wydarzenia** — zwinięta karta z licznikiem wiadomości i awatarami rozmówców.

Pasek obserwujących **nie powtarza się** tutaj — jego miejsce jest na zdjęciu.

## Czat

### Stany

| stan | wygląd |
|---|---|
| half | karta-zajawka na dole, klik → full + czat otwarty |
| full, zwinięty | karta-zajawka na końcu przewijanej treści |
| full, otwarty | nakładka `inset: 0` wewnątrz karty, pod paskiem tytułu |

Pasek nad otwartym czatem: `‹` powrót, tytuł wydarzenia (ucinany wielokropkiem), licznik wiadomości. Zawsze wiadomo, w którym wydarzeniu się jest.

Wiadomości przewijają się do najnowszej przy otwarciu i przy każdej nowej. Pole wpisywania przypięte do dołu. Powrót nie gubi pozycji przewijania treści wydarzenia pod spodem.

Stan `chatFocused` (dzisiejszy podział 50/30) znika; wchodzi `chatOpen`.

### „Wstecz" na Androidzie

Czat staje się **warstwą w istniejącym stosie** `App.tsx`, a nie bytem osobnym. Wszystkie warstwy zamyka dziś jeden handler `popstate` ([App.tsx:238](../../../src/App.tsx#L238)), a `CapApp.addListener('backButton')` woła `history.back()`, gdy cokolwiek jest otwarte. Czat wpina się dokładnie tam:

1. `App` dostaje stan `eventChatOpen`.
2. Trafia do `navLayersRef` (i do listy zależności efektu, który go odświeża).
3. W `onPopState` sprawdzany **po `authModal`, a przed `selEvent`** — logowanie otwiera się nad czatem, czat nad wydarzeniem.
4. W warunku `layerOpen` obsługi `backButton` dochodzi `s.eventChatOpen`.
5. `EventSheet` staje się w tej sprawie sterowany: dostaje `chatOpen` i `onChatOpenChange`. Otwarcie → `App` ustawia stan i robi `pushState({ layer: 'eventChat' })`. Zamknięcie strzałką `‹` → `history.back()`, tak samo jak każde inne zamknięcie warstwy w tej aplikacji.
6. Zniknięcie wydarzenia zeruje `eventChatOpen`, żeby stan nie przeciekł na następne otwarcie.

Wpis w historii jest zdejmowany przez to samo `history.back()`, więc historia zostaje zrównoważona. Przycisk `×` karty nie jest osiągalny przy otwartym czacie (nakładka go zasłania), więc nie ma ścieżki, w której jedno `back()` miałoby zamknąć dwie rzeczy naraz.

Trzy instancje `EventSheet` w `App.tsx` (mapa, moje wydarzenia, obserwowane) dzielą jeden stan — w danej chwili zamontowana jest najwyżej jedna.

## Poprawka podglądu pełnoekranowego

Przycisk zamykania: `top: 20` → `top: calc(env(safe-area-inset-top, 0px) + 72px)`, prawa krawędź bez zmian. Wzorzec `env(safe-area-inset-*)` jest w projekcie ustalony ([ProfilePanel.tsx:208](../../../src/screens/ProfilePanel.tsx#L208), [AccountPanel.tsx:64](../../../src/screens/AccountPanel.tsx#L64)).

Podgląd dostaje ten sam scroll-snap co carousel w karcie, więc zdjęcia przewijają się także na pełnym ekranie. Strzałki `‹ ›` zostają dla myszy.

## Teksty

Nowe klucze w `pl`, `en`, `es`, `de`, `sl`:

| klucz | pl |
|---|---|
| `event.attend` | Wezmę udział |
| `event.attending` | Biorę udział |
| `event.readMore` | Czytaj więcej |
| `event.readLess` | Zwiń |
| `event.backToEvent` | Wróć do wydarzenia (aria) |
| `event.photoPrev` | Poprzednie zdjęcie (aria) |
| `event.photoNext` | Następne zdjęcie (aria) |

Istniejące, użyte bez zmian: `calendar.add`, `share.share`, `event.directions`, `event.organizer`, `event.conversation`, `event.messageCount`, `follow.*`.

Żaden tekst nie trafia do kodu na sztywno.

## Testy

Nowe testy jednostkowe (Vitest, wzorem `AttendanceAskModal.test.tsx`):

- **`truncateDescription`** — czysta funkcja w `lib/text.ts`: krótki tekst wraca bez zmian; długi ucięty na granicy słowa; nigdy nie przekracza 350 znaków; brak opisu nie wywraca.
- **`EventPhotoStrip`** — bez zdjęć renderuje kadr zastępczy; z trzema zdjęciami renderuje trzy slajdy; pasek tagów pokazuje wszystkie tagi; brak obserwujących ukrywa pasek.
- **`EventSheet` — warstwa czatu** — otwarcie woła `onChatOpenChange(true)`; strzałka powrotu woła `history.back()`.

Weryfikacja wizualna przez podgląd w przeglądarce: half na wąskim i szerokim ekranie, karta bez zdjęcia, karta z ośmioma tagami, czat otwarty, podgląd pełnoekranowy z widocznym przyciskiem zamykania.

## Czego ten projekt nie robi

- nie dotyka schematu bazy ani RPC,
- nie zmienia `computeStatus`, `pushAsk`, `calendarRoute` ani logiki `FollowNotifyModal`,
- nie rusza `AttendanceAskModal` ani tabeli `event_attendance`,
- nie przebudowuje mapy ani `MapScreen`,
- nie zmienia trybu `peek`.
