# Płynność mapy przy wielu pinezkach - projekt

**Status:** kierunek zatwierdzony w rozmowie 2026-09-24 (wariant A), czeka na przegląd specu i plan wdrożenia.

## Po co

Przy mocnym oddaleniu mapy (na telefonie do zoomu 8, czyli ~140×300 km) na ekranie jest naraz większość pobranych wydarzeń. Przesuwanie i przybliżanie palcami tnie się, telefon wyraźnie zwalnia. Cel: płynna mapa przy tej samej liczbie wydarzeń, **bez żadnej widocznej zmiany wyglądu pinezek**.

## Stan obecny

- Wydarzenia przychodzą z `db.getEvents` z limitem `MAP_EVENT_LIMIT = 1500` ([supabase.ts:57](../../../src/lib/supabase.ts#L57)), z okna do `MAX_MAP_KM`. Na zoomie 8 praktycznie wszystkie pobrane leżą w kadrze.
- Każde wydarzenie publiczne (po zgrupowaniu 3×3 m w `clusterPublicEvents`) i każde prywatne to osobny `L.marker` z `L.divIcon` ([MapScreen.tsx:511](../../../src/screens/MapScreen.tsx#L511)). Wszystkie markery są na mapie niezależnie od tego, czy są w kadrze.
- HTML pinezki z `pinHTML` ([mapIcons.ts](../../../src/components/mapIcons.ts)) to ~8 elementów plus kilka `<path>` glifu: kontener, pudełko 44×44 (z `transform: scale()` zależnym od liczby interakcji), SVG bloba z **`filter: drop-shadow(0 3px 0 #2D2B2A22)`**, warstwa glifu z drugim SVG (z `solid()` w [tokens.ts:88](../../../src/lib/tokens.ts#L88), `fill="currentColor"`, `1em` przy `font-size:18px`), kropka pod spodem. Klaster dokłada odznakę (SVG koła z tym samym typem cienia + tekst). Jeden glif ma `<mask id>` - identyfikator powtarza się w DOM w każdej pinezce tej kategorii.
- Wydarzenia trwające dostają dwa pierścienie `halo` z nieskończoną animacją CSS - także poza kadrem.
- **Pinch-zoom:** Leaflet 1.9 w `TouchZoom` wywołuje `map._move(..., {pinch: true})` co klatkę, co zawsze odpala `zoom` ([Map.js:1230](../../../node_modules/leaflet/src/map/Map.js#L1230)), a `Marker` na `zoom` robi `update()` - czyli **każdy marker dostaje nowy `translate3d` w każdej klatce gestu**. Z filtrem `drop-shadow` każdy z nich jest osobno rasteryzowany.
- **Kompas:** `useDeviceHeading` robi `setHeading` na każdym `deviceorientation` (dziesiątki razy na sekundę), co re-renderuje cały `MapScreen` z `SearchBar`, `DayTimeline`, `AdaptiveFilterBar`. Sam kurs trafia potem do DOM przez `querySelector('.me-heading')` ([MapScreen.tsx:362](../../../src/screens/MapScreen.tsx#L362)).
- Diff pinezek jest już zrobiony (sygnatura `sig` na marker), ale przy każdej zmianie `visibleEvents` każdy marker dostaje `off('click').on(...)` i `setZIndexOffset`, a `clusterPublicEvents` porównuje każde wydarzenie z każdym (O(n²)).
- `pinHTML` używa też `EventPickerModal` i dev-strona `src/dev/pinPreview.tsx` (wszystkie 22 kategorie obok siebie).
- CSP w `public/_headers` dopuszcza `img-src blob: data:`.

## Decyzje podjęte w rozmowie

| Pytanie | Decyzja |
|---|---|
| Kierunek | A: ten sam wygląd, lżejsze rysowanie (gotowe obrazki, kadrowanie, kompas poza Reactem). |
| Łączenie pinezek w bańki przy oddaleniu | Nie. Zmienia to, co widzi użytkownik. |
| Canvas (jedna warstwa rysowana ręcznie) | Nie teraz. Wraca do rozmowy tylko, jeśli po wdrożeniu A pomiary nie osiągną celu. |
| Wygląd | Piksel w piksel jak dziś - pinezki, klastry, prywatne, halo, skala od interakcji. |

## Cel i miary

Mierzone przed zmianami (krok 0) i po każdym kroku, na tym samym zestawie danych:

| Miara | Jak | Cel |
|---|---|---|
| Klatki podczas pinch-zoomu i przesuwania na zoomie 8 | Performance panel (Chrome remote debugging na Androidzie, Safari Web Inspector na iOS) | ≥ 50 fps na średnim Androidzie, bez klatek > 50 ms |
| Re-rendery `MapScreen` w spoczynku, z działającym kompasem | React Profiler / licznik renderów w dev | ~0/s (dziś kilkadziesiąt) |
| Elementy DOM na jedną pinezkę | `document.querySelectorAll('.leaflet-marker-icon *').length / liczba markerów` (bez samego korzenia divIcona) | 4 zwykła, 6 trwająca, 7 klaster, 9 trwający klaster (dziś ~15-25) |
| Czas efektu pinezek przy 1500 wydarzeniach | `performance.mark` wokół efektu | < 16 ms |
| Wygląd | Nakładka różnicowa (sekcja 2) | Brak widocznych różnic poza antyaliasingiem krawędzi |

**Uczciwe zastrzeżenie:** na samym najdalszym zoomie wszystkie wydarzenia są w kadrze, więc kadrowanie (sekcja 3) tam nie pomaga - zysk w tym punkcie dają tańsze markery (sekcja 2) i odciążenie Reacta (sekcja 1). Kadrowanie pomaga na średnich zoomach i przy przesuwaniu.

## 0. Pomiar wyjściowy

- **Dane testowe:** parametr dev `?perfPins=N` w `MapScreen`, tylko pod `import.meta.env.DEV` (wycinany z buildu produkcyjnego), dokłada N syntetycznych wydarzeń wokół środka mapy: losowe kategorie, ~10% trwających, ~5% prywatnych, kilka par w tym samym punkcie (żeby powstały klastry), rozrzut do `MAX_MAP_KM`. Deterministyczne ziarno, żeby każdy pomiar widział ten sam układ.
- **Urządzenia:** jeden średni Android (WebView z Capacitora, debug build z włączonym debugowaniem WebView) i iPhone (Safari Web Inspector). Konkretne modele do ustalenia przy wdrożeniu.
- **Scenariusz:** start na zoomie 15, pinch-out do 8, przesunięcie w cztery strony, pinch-in do 12. Nagranie Performance panelu dla każdego kroku.
- Wyniki trafiają do tabeli na końcu tego dokumentu (sekcja „Pomiary”).

## 1. Kompas poza Reactem

**Zmiana:** `useDeviceHeading` przestaje trzymać kurs w stanie Reacta. Zamiast tego:

- nowa funkcja `subscribeDeviceHeading(onHeading: (deg: number | null) => void): () => void` w `src/hooks/useDeviceHeading.ts` - cała dzisiejsza logika (iOS `webkitCompassHeading` + dokładność, Android `deviceorientationabsolute`, prośba o zgodę z `click`/`touchend`, `STALE_MS`, logi diagnostyczne) przeniesiona bez zmian, tylko `setHeading` zastąpione wywołaniem callbacku;
- callback jest spinany przez `requestAnimationFrame`: z wielu odczytów w jednej klatce do DOM trafia tylko ostatni;
- `MapScreen` w jednym efekcie subskrybuje i pisze prosto do `.me-heading` (to, co dziś robi efekt z `[heading, userPos]`). Po odtworzeniu markera „ja” ostatni kurs jest nakładany ponownie (trzymany w refie).
- Hook `useDeviceHeading` zostaje jako cienka nakładka na `subscribeDeviceHeading`, gdyby coś w przyszłości potrzebowało kursu w stanie; `MapScreen` go już nie używa.

**Efekt:** `MapScreen` przestaje się re-renderować od kompasu. Wygląd i zachowanie strzałki bez zmian (ten sam `transition: transform .15s linear`).

## 2. Pinezki jako gotowe obrazki

### Moduł `src/components/pinImages.ts`

- `pinImageUrl(variant)` zwraca `blob:` URL samodzielnego SVG, budowanego raz na wariant i trzymanego w `Map` na czas życia aplikacji.
- Warianty:
  - `{ kind: 'public', category, blob }` - 22 kategorie × 3 kształty `BLOBS`,
  - `{ kind: 'private' }`,
  - `{ kind: 'badge' }` - koło odznaki klastra.

  Razem ≤ 70 małych obrazków.
- Skala od interakcji **nie jest** częścią wariantu: zostaje jak dziś `transform: scale()` na pudełku 44×44, a SVG jako obraz wektorowy jest rasteryzowany w docelowym rozmiarze, więc pozostaje ostry.

### Zawartość obrazka bloba (44×44, `viewBox="-3 -3 106 106"` jak dziś)

1. **Cień bez filtra:** kopia ścieżki bloba z `fill` i `stroke` w kolorze `#2D2B2A` z `opacity` 0x22/255, przesunięta o `3px` w dół, czyli `translate(0, 3 * 106 / 44)` w jednostkach viewBoxa. `drop-shadow(0 3px 0 c)` bez rozmycia to dokładnie przesunięta sylwetka w kolorze c, więc wynik jest ten sam. Prywatna pinezka: 0x44 zamiast 0x22, jak dziś.
2. Blob: ta sama ścieżka, `fill` z `TAG_META`, `stroke="#2D2B2A" stroke-width="5" stroke-linejoin="round"`.
3. Glif: zagnieżdżony `<svg>` z `solid()` z jawnym `color: #2D2B2A` (w obrazie nie ma dziedziczenia `currentColor` ze strony), 18×18, wyśrodkowany. Obecne położenie wynika z flexa i linii tekstu (`vertical-align: -0.125em`), więc dokładne przesunięcie ustala nakładka różnicowa poniżej, a nie rachunek. `<mask id>` z `erode` jest w obrazku lokalny, więc duplikaty id w DOM znikają.
4. Prywatna: glif „okularów” z `privateHTML` w tym samym miejscu, biały blob.

Obrazek odznaki: koło 28×28 (`r=46.5`, `stroke-width=7` w viewBoxie 100) z cieniem `0 2px 0 #2D2B2A22` zrobionym tym samym sposobem.

### Nowy HTML markerów (`pinHTML`, `privateHTML`, `clusterHTML` - te same sygnatury)

```
div 44×56 (kontener)
├─ div 44×44 [transform: scale(s) jak dziś]
│  ├─ [halo ×2 - tylko trwające, bez zmian]
│  └─ img 44×44 (blob + cień + glif)
└─ div kropka 12×12 (bez zmian - zwykły div, bez filtra)
[klaster:] div odznaki 28×28 = img koła + tekst liczby jako HTML
```

Odznaka siedzi bezpośrednio w kontenerze pinezki, bez dzisiejszego dodatkowego opakowania z `clusterHTML`. Klaster ma 7 elementów, a trwający klaster 9.

Liczba zostaje tekstem HTML, bo SVG ładowany jako `<img>` nie ma dostępu do fontów strony (`Hanken Grotesk`) - wpisany w obrazek wyglądałby inaczej.

Zwykła pinezka: 4 elementy zamiast ~15, bez filtra. `EventPickerModal` i `pinPreview` korzystają z tych samych funkcji i zyskują to samo bez zmian po swojej stronie.

`<img>` dostaje `draggable="false"`, `alt=""` i `pointer-events:none` (klik łapie kontener markera, jak dziś).

### Rozgrzewka

Przy montowaniu mapy, w `requestIdleCallback` (z `setTimeout` jako zapasem na iOS), wszystkie warianty są tworzone i dekodowane przez `img.decode()`. Bez tego pierwsze pojawienie się danej kategorii mogłoby mignąć pustym pudełkiem przez klatkę dekodowania.

### Weryfikacja wyglądu

Na dev-stronie `src/dev/pinPreview.tsx` dochodzi sekcja „stary vs nowy”. Dla każdej kategorii, prywatnej, klastra i trwającej jest wyrenderowany stary HTML (zachowany w pliku dev jako kopia referencyjna) i nowy, jeden na drugim z `mix-blend-mode: difference`, w powiększeniu 4× i przy `devicePixelRatio` 2 i 3. Identyczne piksele dają czerń, więc każda różnica świeci. Sprawdzam to na zrzutach w podglądzie przeglądarki i na urządzeniu. Kopia referencyjna jest usuwana po zatwierdzeniu wyglądu.

## 3. Na mapie tylko pinezki w pobliżu kadru

- Czysta funkcja `src/lib/pinCulling.ts`: `pinsToMount(points: Record<id, {lat, lng}>, bounds: {s, w, n, e}): Set<id>`, bez Leafleta, testowana na liczbach.
- W `MapScreen` efekt pinezek dalej liczy pełny `desired` (potrzebny m.in. `spreadOrOpen`, który liczy nakładanie z pełnej listy). Na mapę trafiają tylko markery z `pinsToMount(desired, map.getBounds().pad(0.5))`: kadr plus pół ekranu zapasu z każdej strony.
- Przeliczanie:
  - po zmianie `visibleEvents` (jak dziś),
  - na `moveend` i `zoomend`,
  - w trakcie przesuwania co ~200 ms (throttle na `move`), tylko **dokładanie** brakujących. Dzięki temu przy szybkim rzucie mapą pinezki nie „doskakują” dopiero po zatrzymaniu. Zdejmowanie odbywa się tylko na `moveend`.
- Marker zdjęty z mapy zostaje w `pinsRef` (z `sig`), tylko bez `addTo(map)`. Powrót w kadr to `addTo` bez przebudowy ikony.
- Pierścienie `halo` pinezek poza kadrem znikają razem z markerem, więc ich animacje przestają pracować bez dodatkowego kodu.

## 4. Porządki w aktualizacji pinezek

- **Jeden handler kliknięcia na marker, podpinany raz:** marker przy tworzeniu dostaje `marker.on('click', () => clickRef.current[id]?.())`. Efekt tylko podmienia `clickRef.current = { id: onClick }`. Znika `off('click').on(...)` na wszystkich markerach przy każdej zmianie.
- **`setZIndexOffset` tylko przy zmianie:** `pinsRef` pamięta ostatni `zIndexOffset`.
- **`clusterPublicEvents` przez siatkę:** wydarzenia są rozkładane do komórek o boku `ZONE_SIDE_M` (w metrach, jak w `zonesOverlapSpatially`), a kandydaci dla kotwicy to 3×3 sąsiednie komórki. Kolejność przeglądania (indeks w tablicy) i warunek (`zonesOverlapSpatially(anchor, j)`, tylko `j > i`, nieużyte) zostają te same. **Wynik ma być identyczny co do grup i kolejności** - pilnuje tego test porównujący starą i nową implementację na losowych danych (stara zostaje w teście jako wzorzec).

## 5. Eksperyment pomiarowy: warstwy kompozytora

Leaflet ustawia markerom `translate3d`, co w WebView zwykle tworzy osobną warstwę kompozytora dla każdego markera. Przy setkach markerów to dużo pamięci GPU. Po krokach 1-4 sprawdzam w zakładce Layers (Chrome), ile warstw powstaje. Jeśli to nadal wąskie gardło, rozważamy osobny `pane` dla pinezek z `contain: layout paint` (bez globalnego `L_DISABLE_3D`, który dotknąłby też kafelków). **Decyzja dopiero po pomiarze.** Jeśli nie przyniesie mierzalnego zysku, nic nie zmieniamy.

## Testy

- `pinImages.test.ts`: wariant → ten sam URL przy drugim wywołaniu (cache); SVG zawiera kopię cienia z właściwym przesunięciem i przezroczystością; glif ma jawny kolor; prywatna ma cień 0x44.
- `mapIcons.test.ts`: `pinHTML`/`clusterHTML`/`privateHTML` zawierają `<img>`, nie zawierają `filter:`; halo tylko dla trwających; skala jak dziś; liczba klastra jako tekst.
- `pinCulling.test.ts`: punkty w kadrze, w zapasie, poza nim; kadr przez antypołudnik nie jest potrzebny (mapa pokazuje ≤ 300 km) - pomijamy świadomie.
- `eventClusters.test.ts`: istniejące testy bez zmian + test równoważności siatka vs O(n²) na losowych zestawach, w tym punkty na granicach komórek.
- `useDeviceHeading`: test `subscribeDeviceHeading` - wiele zdarzeń w jednej klatce → jeden callback; `STALE_MS` → `null`; odsubskrybowanie zdejmuje nasłuch.
- Wygląd: nakładka różnicowa na `pinPreview` (sekcja 2).
- Wydajność: pomiary z kroku 0 powtórzone po każdym kroku.
- Build: `npx tsc -b`, `npm test`, `npm run lint`.

## Kolejność wdrożenia

Każdy krok to osobny commit z pomiarem przed i po, żeby było widać, co ile dało:

0. Dane testowe `?perfPins` + pomiar wyjściowy.
1. Kompas poza Reactem.
2. Obrazki pinezek + nakładka różnicowa + rozgrzewka.
3. Kadrowanie markerów.
4. Porządki (klik, z-index, siatka klastrów).
5. Eksperyment z warstwami - tylko jeśli pomiary go uzasadniają.
6. Pomiar końcowy, uzupełnienie tabeli poniżej. Jeśli cel nie jest osiągnięty - wracamy do rozmowy o canvasie.

## Poza zakresem

- Zmiana limitu 1500 wydarzeń i zasięgu pobierania.
- Łączenie pinezek przy oddaleniu, zmiana ich wyglądu lub animacji.
- Kafelki mapy (CARTO) i ich ładowanie.
- Marker „ja” (jeden element, nie ma wpływu na skalę problemu).

## Ryzyka

| Ryzyko | Jak ograniczamy |
|---|---|
| Glif w obrazku przesunięty o piksel względem dzisiejszego | Nakładka różnicowa, przesunięcie dobierane pomiarem. |
| Mignięcie pustej pinezki przy pierwszym użyciu wariantu | Rozgrzewka z `img.decode()`. |
| Pinezki doskakujące przy szybkim rzucie mapą | Zapas pół ekranu + dokładanie w trakcie ruchu. |
| Rozjazd klastrów po przejściu na siatkę | Test równoważności ze starą implementacją. |
| Kompas po zmianie przestaje reagować na iOS (gest zgody) | Logika zgody przeniesiona bez zmian; ręczny test na iPhonie. |

## Pomiary

Do uzupełnienia przy wdrożeniu (krok 0 i po każdym kroku).

| Krok | Urządzenie | fps pinch | fps pan | renderów/s w spoczynku | DOM/pinezka | efekt pinezek (ms) |
|---|---|---|---|---|---|---|
| 0 | desktop (Browser pane, dev) | - | - | - | 10,7 (1734 ikon na z8 i z12, wszystkie w DOM) | 99 / 86 / 22 / 39 (kolejne przebiegi) |
| 0 | Android / iPhone | do zmierzenia (Procedura B na commicie Task 1) | | | | |
| 1 (kompas) | desktop | - | - | 0 w 3 s (bez kompasu na desktopie) | bez zmian | bez zmian |
| 1 (kompas) | Android / iPhone | do zmierzenia (rendery/s z kompasem, strzałka na iOS po tapnięciu) | | | | |
| 2 (obrazki) | desktop | - | - | - | 4,4 (1734 ikon) | 71 / 55 / 21 / 37 |
| 2 (obrazki) | Android / iPhone | do zmierzenia | | | | |
