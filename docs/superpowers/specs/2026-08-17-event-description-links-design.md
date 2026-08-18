# Klikalne linki w opisie wydarzenia — projekt

**Status:** zatwierdzony w rozmowie 2026-08-17, czeka na plan wdrożenia.

## Po co

Opis wydarzenia renderuje się dziś jako czysty tekst ([EventSheet.tsx:623](../../../src/screens/EventSheet.tsx)) — `whiteSpace: 'pre-wrap'` i nic więcej. Adres strony organizatora, regulaminu czy sprzedaży biletów wygląda w karcie jak każde inne słowo: nie da się w niego kliknąć, można go tylko przepisać ręcznie. Opisy przychodzą w dużej części ze scrapera (`meuwe-event-sync`), gdzie link bywa jedyną drogą do szczegółów i puli biletów.

Po zmianie adres w opisie jest podświetlony, klikalny i otwiera się w domyślnej przeglądarce urządzenia — poza aplikacją, żeby karta wydarzenia została tam, gdzie była.

## Decyzje podjęte w rozmowie

1. **Zakres wykrywania:** pełne adresy `http(s)://…` oraz `www.…` bez schematu. Bez e-maili i bez numerów telefonu.
2. **Kolor:** brandowy `C.primary` (#FF7A45) z podkreśleniem — ten sam styl, co linki w `renderArticle.tsx` i przycisk „czytaj więcej". Klasyczny niebieski został odrzucony jako obcy palecie.
3. **Otwieranie:** `target="_blank"` + `rel="noopener noreferrer"`, bez nowych zależności.
4. **Skracanie opisu ustępuje linkom:** gdy granica podglądu wypada w środku adresu, podgląd wydłuża się do końca tego adresu, zamiast go przepoławiać.

## Dlaczego bez `@capacitor/browser`

Prośba brzmiała: domyślna przeglądarka. `@capacitor/browser` otwiera Custom Tab (Android) lub `SFSafariViewController` (iOS), czyli przeglądarkę **wewnątrz** aplikacji — dokładnie to, czego ta zmiana ma nie robić. Zwykła kotwica z `target="_blank"` na webie otwiera nową kartę, a w powłoce Capacitora nawigacja poza origin aplikacji trafia do systemowej przeglądarki. Ten sam mechanizm już nosi przycisk „dojazd" do Google Maps w [EventSheet.tsx:562](../../../src/screens/EventSheet.tsx) i link do regulaminu na ekranie powitalnym, więc nie wprowadzamy nowej drogi — korzystamy z tej, która w tej aplikacji jest sprawdzona.

## Podział na moduły

Wykrywanie linków przestaje być sprawą samego renderu: potrzebuje go też skracanie opisu. Gdyby wzorzec mieszkał w module renderującym, `text.ts` musiałby importować `.tsx` wyłącznie po regex. Stąd trzy jednostki:

### `src/lib/links.ts` — dopasowanie (bez Reacta)

```ts
export type LinkMatch = { start: number; end: number; text: string; href: string }
export function findLinks(text: string): LinkMatch[]
```

- Wzorzec obejmuje `https?://…` oraz `www.…`.
- `href` dla trafienia bez schematu dostaje przedrostek `https://`; `text` zostaje dokładnie taki, jak w opisie.
- Końcowa interpunkcja (`.,;:!?`) nie należy do adresu — „zobacz na www.teatr.pl." kończy adres na `pl`.
- Niesparowany nawias zamykający też odpada: „(szczegóły na https://teatr.pl)" nie wciąga `)` do adresu. Nawias sparowany wewnątrz adresu zostaje — takie URL-e istnieją (Wikipedia).
- Dopuszczone są wyłącznie schematy `http:` i `https:`. `javascript:`, `data:` i podobne nie są w ogóle dopasowywane.
- `start`/`end` to indeksy w wejściowym tekście, po obcięciu interpunkcji. Na nich stoi reguła skracania.

### `src/lib/linkify.tsx` — render

```tsx
export function linkify(text: string): React.ReactNode[]
```

Woła `findLinks` i skleja z tekstu listę fragmentów: zwykłe kawałki jako stringi, trafienia jako `<a>` ze stylem `{ color: C.primary, textDecoration: 'underline' }`, `target="_blank"`, `rel="noopener noreferrer"`. Tekst bez linków oddaje jeden fragment — wynik zawsze da się wstawić w to samo miejsce, w którym stoi dziś goły string.

### `src/lib/text.ts` — skracanie świadome linków

`truncateDescription` dokłada jeden krok przed dotychczasową regułą granicy słowa: jeśli jakieś trafienie z `findLinks` przecina granicę (`start < limit < end`), podgląd kończy się na `end` tego trafienia i reguła granicy słowa nie ma tu nic do powiedzenia. `truncated` zostaje `true`, o ile za adresem jest jeszcze tekst. Gdy link zaczyna się dopiero za granicą, wszystko działa jak dotąd i link po prostu nie mieści się w podglądzie.

Bez górnego sufitu na wydłużenie. Adres z długim ogonem parametrów śledzenia rozepchnie podgląd o swoją długość — to świadomy wybór: link do połowy adresu jest gorszy niż kilka linijek nadmiaru, a takie adresy trafiają się w opisach rzadko.

## Co się zmienia w istniejącym kontrakcie

`DESCRIPTION_PREVIEW_CHARS` przestaje być twardą granicą. Dziś komentarz w `text.ts` i test *„never returns more than the limit"* obiecują, że podgląd nie przekroczy limitu ani o znak. Po zmianie limit jest miękki: wolno go przekroczyć **wyłącznie** po to, żeby dokończyć adres. Komentarz przy stałej i przy `WORD_BOUNDARY_MIN_RATIO` mówi to wprost; istniejący test zostaje jako asercja dla tekstu bez linków, a nową swobodę pokrywa osobny test.

Sama reguła `WORD_BOUNDARY_MIN_RATIO` zostaje bez zmian, ale z jej komentarza znika wklejony link jako przykład długiego ciągu bez spacji: link przecinający granicę nigdy już nie dochodzi do tej gałęzi, więc przykład wprowadzałby w błąd. Reszta komentarza zostaje.

## Wpięcie w kartę

Jedna zmiana w [EventSheet.tsx:623](../../../src/screens/EventSheet.tsx): zamiast wstawiać string, wstawiamy `linkify(...)`. Ta sama funkcja obsługuje podgląd i tekst rozwinięty — w podglądzie dostaje `desc.preview`, po rozwinięciu pełny opis. Reszta karty (styl akapitu, `whiteSpace: 'pre-wrap'`, przycisk „czytaj więcej") zostaje nietknięta.

Kliknięcie w link nie koliduje ze `sznurkiem` karty (`useCardDrag`): to gest stuknięcia, nie ciągnięcia, a kotwica do Google Maps w tej samej karcie działa tak od dawna.

## Testy

`src/lib/links.test.ts`
- adres w środku zdania; kilka adresów w jednym akapicie
- `www.teatr.pl` bez schematu → `href` z `https://`, tekst bez zmian
- kropka i przecinek po adresie nie należą do adresu
- niesparowany `)` odpada, sparowany zostaje
- `javascript:alert(1)` nie jest dopasowany
- tekst bez adresów → pusta lista

`src/lib/linkify.test.tsx`
- adres renderuje się jako `<a>` z `href`, `target="_blank"`, `rel="noopener noreferrer"`
- tekst wokół adresu zostaje nienaruszony
- tekst bez adresów renderuje się jako sam tekst

`src/lib/text.test.ts` (dokładka do istniejących)
- granica w środku adresu → podgląd sięga końca adresu i przekracza limit
- za adresem jest jeszcze tekst → `truncated` zostaje `true`
- adres kończy opis → `truncated` schodzi na `false`
- link zaczynający się za granicą → podgląd jak dotąd, bez wydłużenia
- opis bez linków → zachowanie bit w bit jak przed zmianą

## Czego ta zmiana nie robi

- Nie rusza `renderArticle.tsx`. Tamten moduł interpretuje markdown (`**pogrubienie**`, `[tekst](url)`), a opisy ze scrapera zawierają gwiazdki i nawiasy jako zwykłe znaki — wspólny render zjadałby fragmenty tekstu. Wspólny rdzeń dla obu odłożony jako YAGNI.
- Nie linkuje e-maili ani telefonów.
- Nie dotyka `CreateSheet` ani żadnego innego miejsca — `truncateDescription` ma dziś jednego konsumenta i jest nim karta wydarzenia.
