# Extract event-sync scraper into its own repo — Design

**Date:** 2026-07-07
**Source repo:** `meuwe-web` (branch work on `chore/extract-event-sync`)
**New repo:** `meuwe-event-sync` (to be created)
**Status:** zatwierdzony, gotowy do rozpisania planu

## Cel

Wydzielić scraper wydarzeń (`scripts/event-sync/`) z repozytorium aplikacji `meuwe-web` do **osobnego repozytorium** `meuwe-event-sync`. Motywacja (wskazana przez usera): higiena/izolacja repo, niezależny deploy/ops, odchudzenie aplikacji, odchudzenie kontekstu. Nie zmieniamy logiki scrapowania — przenosimy i odsprzęgamy.

## Kontekst (stan obecny)

- Scraper: **91 plików, ~5,6k linii TS**. Struktura: `index.ts` (entrypoint), pipeline `extract → normalize → geocode → dedupe → mapper → sql`, `sources/` (parsery per-źródło + testy), `regions/` (tenerife, rzeszow + venues), `__fixtures__/` (HTML/JSON/XML do testów).
- **Zero sprzężenia kodowego z aplikacją, w obie strony** — scraper nie importuje `src/`, `src/` nie importuje scrapera (zweryfikowane grepem).
- **Runtime:** Node + `tsx`. Zewnętrzne zależności scrapera (z importów): tylko **`cheerio`** (23 importy) + Node builtins (`node:fs/path/url/os`). Testy przez **`vitest`**. **Nie** importuje `jsdom` ani `@supabase/supabase-js` — te dwa są zależnościami aplikacji (jsdom = środowisko vitest dla React, supabase-js = klient app).
- **Uruchamianie dziś:** GitHub Actions `.github/workflows/lagenda-sync.yml` — cron co 3 dni (06:00 UTC) + `workflow_dispatch`. Kroki: `npm ci` → `npm run typecheck:scraper` → `npx tsx scripts/event-sync/index.ts` → commit wygenerowanych `supabase/seeds/*.sql` z powrotem do repo. Jedyny sekret: `MEUWE_TEAM_UUID`.
- **Output:** scraper NIE pisze do bazy. `index.ts` generuje plik SQL (`events_<region>_<date>.sql`) do `supabase/seeds/`; człowiek wkleja go do Supabase Dashboard → SQL Editor. To świadomy gate przeglądu przed zapisem na PROD.
- **Współdzielone dziś z aplikacją:** `package.json` (deps + skrypty `event-sync`, `typecheck:scraper`), `tsconfig.scraper.json` (samodzielny, `include: scripts/event-sync/**`), vitest (testy scrapera łapane domyślnym globem), oraz samo repo. To „to samo repo" jest jedynym realnym sprzężeniem — i to ono spowodowało niedawne problemy: token Mapbox w fixture scrapera zablokował push aplikacji (GitHub Push Protection), a merge scrapera do `staging` wciągnął 23 commity + WIP.

## Decyzje (zatwierdzone)

1. **Osobne repo** `meuwe-event-sync` (nie monorepo/pakiet) — bo tylko to spełnia izolację sekretów/fixtures i odchudzenie kontekstu.
2. **Dostarczanie danych:** scraper commituje wygenerowany **SQL do WŁASNEGO repo**; user wkleja ręcznie do Supabase. Zachowuje gate przeglądu; **żadnych kluczy PROD w CI scrapera** (tylko `MEUWE_TEAM_UUID`).
3. **Historia Gita: świeży start.** Nowe repo = jeden początkowy commit z aktualnym stanem scrapera, z **zredagowanym tokenem Mapbox** w dwóch fixtures (`__fixtures__/erzeszow_calendar.html`, `__fixtures__/erzeszow_event_detail.html`) — trwale usuwa problem push protection. (Bez `git filter-repo`; blame/historia parserów nie jest przenoszona.)

## Stan docelowy (architektura)

**`meuwe-event-sync` (nowe repo):**
- Layout w roocie: `index.ts`, `extract.ts`, `normalize.ts`, `geocoder.ts`, `dedupe.ts`, `mapper.ts`, `sql.ts` (+ testy), `sources/`, `regions/`, `__fixtures__/`.
- `package.json`: runtime dep **`cheerio`**; devDeps **`tsx`, `vitest`, `typescript`, `@types/node`**. Skrypty: `test` (vitest), `typecheck` (tsc), `sync` (`tsx index.ts`).
- `tsconfig.json`: przeniesiony `tsconfig.scraper.json` (już samodzielny), `include` dostosowany do nowego layoutu.
- `vitest.config.ts`: środowisko **`node`** (scraper nie potrzebuje jsdom).
- `.github/workflows/sync.yml`: cron co 3 dni + dispatch; kroki jak dziś, ale **commit SQL do lokalnego `seeds/`** tego repo. Sekret `MEUWE_TEAM_UUID`.
- Output SQL: lokalny katalog `seeds/` (dostosować `SEEDS_DIR` w `index.ts`, dziś `path.resolve(__dirname,'..','..','supabase','seeds')`).
- `README.md`: jak uruchomić (`--region=`), **kontrakt danych** (kolumny tabeli `events`, na które celuje `sql.ts`) i instrukcja: skopiuj wygenerowany SQL do Supabase Dashboard.
- `.env.example`: `MEUWE_TEAM_UUID`.

**`meuwe-web` (po sprzątaniu):**
- Usunięte: `scripts/event-sync/**`, `tsconfig.scraper.json`, skrypty `event-sync` i `typecheck:scraper`, deps **`cheerio`** i **`tsx`** (po weryfikacji, że `src/` ich nie używa), workflow `.github/workflows/lagenda-sync.yml`.
- **Bez zmian:** `vitest.config.ts` (testy scrapera znikają wraz z katalogiem; exclude `fcm.test.ts` zostaje), deps `jsdom` i `@supabase/supabase-js` (używane przez aplikację).
- Historyczne `supabase/seeds/*.sql` (już wygenerowane) — **zostają jako ślad** (poza zakresem; usuwamy tylko na wyraźne życzenie).

## Przepływ danych (bez zmian merytorycznych)

cron/manual (Actions w repo scrapera) → scrape źródeł → normalize/geocode/dedupe/map → `generateSql` → commit SQL do `seeds/` repo scrapera → **user wkleja do Supabase Dashboard** → wydarzenia w tabeli `events`.

## Jak przeprowadzić (kolejność)

**Krok A — nowe repo `meuwe-event-sync`:**
1. Utworzyć repo; skopiować pliki scrapera do roota (bez `scripts/event-sync/` prefixu).
2. Zredagować token Mapbox w dwóch fixtures na `pk.REDACTED` (parser nie używa tokenu — testy muszą dalej przechodzić).
3. Dodać `package.json` (deps jw.), `tsconfig.json`, `vitest.config.ts` (env node), `README.md`, `.env.example`, `.gitignore`.
4. Dostosować `SEEDS_DIR` w `index.ts` na lokalny `seeds/`.
5. Przenieść workflow → commit SQL do lokalnego `seeds/`.
6. **Weryfikacja standalone:** `npm ci && npm test` (~40 testów zielone), `npm run typecheck`, `npm run sync -- --region=rzeszow` generuje SQL.
7. Pierwszy commit; ustawić sekret `MEUWE_TEAM_UUID` w nowym repo.

**Krok B — sprzątanie w `meuwe-web` (osobny PR na `chore/extract-event-sync`):**
1. Usunąć pliki/skrypty/tsconfig/workflow scrapera; usunąć deps `cheerio`, `tsx` (po grep-weryfikacji braku użycia w `src/`).
2. **Weryfikacja:** `npm run build`, `npm test`, `npm run lint` dalej zielone (są — brak sprzężenia kodowego).

## Testowanie

- Repo scrapera: własny `vitest` (env node) uruchamia ~40 testów źródeł/pipeline'u na fixtures, standalone. Plus smoke: `sync --region=` generuje niepusty SQL zgodny z kontraktem `events`.
- Repo aplikacji: testy nietknięte (testy scrapera usunięte wraz z kodem).

## Ryzyka

- **Drift schematu `events`:** po rozdzieleniu zmiana schematu w `meuwe-web` może cicho rozjechać się z `sql.ts`. Mityg.: kontrakt kolumn udokumentowany w README scrapera; smoke test generowanego SQL; przy zmianie schematu `events` aktualizować `sql.ts`.
- **Koordynacja dwóch repo** przy zmianach kontraktu — akceptowalny koszt izolacji.
- **Ukryte sprzężenie kodu:** zweryfikowane, że brak (żaden kierunek). Krok B potwierdza to zielonym buildem/testami.

## Poza zakresem

- Zmiana logiki scrapowania, dodawanie źródeł.
- Bezpośredni zapis do bazy (service-role) — świadomie odrzucone (gate przeglądu).
- Przenoszenie historii Gita (`filter-repo`) — wybrano świeży start.
- Usuwanie historycznych seedów z `meuwe-web` — zostają, chyba że user zdecyduje inaczej.
