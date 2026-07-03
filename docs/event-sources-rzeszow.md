# Rzeszów Region Event Sources — Catalogue & Scrape Viability

**Region:** Rzeszów + Tyczyn, Boguchwała, Łańcut, Jasionka (bbox ~lat 49.90–50.20, lng 21.80–22.35)
**Last verified:** 2026-07-03 (live fetch with a Chrome browser User-Agent, `Accept-Language: pl`).
**Scraper:** `scripts/event-sync/` (region `rzeszow`). Sources implement the same `Source` interface as Tenerife.

> ⚖️ Check `robots.txt`/ToS before scraping, especially ticketing platforms.
> Statuses come from single fetches — a `404`/tiny response may mean bot-blocking, not a dead site.

## Legend
- ✅ live, usable, verified data shape
- ⚠️ live but caveat (JS-rendered, unclear markup, needs more digging)
- ⛔ blocked / broken for generic fetch
- ⭐ launch source (implemented first)

---

## Launch sources (tier 1 — verified end-to-end)

### `ebilet` ⭐ — eBilet city landing pages + internal JSON API
- **Listing:** `https://www.ebilet.pl/miasto/{city}` — confirmed live for `rzeszow`, `lancut`, `jasionka` (`boguchwala`, `tyczyn` → 404, no page).
- **Data:** the landing HTML embeds URLs like
  `https://www.ebilet.pl/api/LandingPage/group/{uuid}/event`. Each API call returns clean JSON:
  `{ events: [{ date: "2026-10-25T17:00:00", city: "Rzeszów", placeName: "Filharmonia Podkarpacka im. Artura Malawskiego", street: "Chopina 30", postalCode: "35-959", titleTitle, titleId, uniqueId, isCancelled, soldOut, freeSeats: { minPrice } … }] }`
- **Why it's gold:** per-event **exact venue name + street address + city** → precise geocoding; covers the big venues across the whole region (Filharmonia, Podpromie, Millenium Hall, G2A Arena Jasionka, Łańcut).
- **Caveats:** the page's JSON-LD `ItemList` mixes multi-city tours (first tour date, foreign venue) — use the **group API**, not the JSON-LD. Filter `city` to region cities and date to window. Same `uniqueId` can appear in several groups → dedupe by id. No category/description in API (map category from title keywords).

### `estrada` ⭐ — Estrada Rzeszowska (city culture agency)
- **Listing:** `https://estrada.rzeszow.pl/` (the `/wydarzenia/` URL redirects to the homepage, which is the server-rendered calendar). ~53 events, weeks ahead.
- **Markup:** `.calendarSingleDay` blocks → `.calendar--left .day`/`.month` (no year — infer) + `.calendar--right article` cards: event link `/wydarzenia/{slug},wydarzenie{id}/` (title in `title` attr), venue in `span.organizer` (e.g. "Rzeszowskie Piwnice"), image in `<picture>`.
- **Detail page:** clean `.where` block — `span.date` (`23.07.2026`), `span.time` (`21:00`), `span.place` ("Skwer Kultury w Rzeszowie, Rynek") + full description in `.ArticleFull__text`.
- **Why:** free/city cultural events that never reach ticketing platforms; venue-level place strings.

### `mgoktyczyn` ⭐ — MGOK Tyczyn (WordPress RSS)
- **Feed:** `https://mgoktyczyn.pl/feed/` — working WP RSS, 10 items.
- **Data shape:** `description`/`content:encoded` are **empty**; the date lives in the item **title** ("23.06 | Wernisaż prac…", "Spacer… | 31.05.2026 r."). Parse `dd.mm[.yyyy]` from title (year inferred when missing); items without a parseable date are skipped. Venue defaults to MGOK Tyczyn (venue registry); post page can refine later.
- **Why:** the only verified feed for Tyczyn; cheap to maintain.

## Tier 2 — viable, needs more digging (build later)

| Source | URL | Status | Notes |
|---|---|---|---|
| G2A Arena (Jasionka) | https://g2aarena.pl/ | ⚠️ | WP; homepage `eventsSlick` carousel has 54 `/wydarzenie/{slug}` links, but detail pages 404 to curl (bot-block?) and `wp-json/wp/v2` is 404. Its big events are on **eBilet Jasionka** anyway. Revisit with better headers/headless. |
| Filharmonia Podkarpacka | https://filharmonia.rzeszow.pl/repertuar/ | ⚠️ | WP + WooCommerce — events are shop products (`kategoria-produktu`); no JSON-LD events, no dates in listing HTML. Big concerts covered via eBilet. Try the WooCommerce store API (`/wp-json/wc/store/products`). |
| Teatr im. W. Siemaszkowej | https://teatr-rzeszow.pl/ | ⚠️ | WP + JSON-LD marker on homepage; repertoire structure unverified. No Tribe REST (`rest_no_route`). |
| Teatr Maska | https://www.teatrmaska.pl/ | ⚠️ | Live (110 KB); repertoire markup unverified. Kids' theatre → good `family` source. |
| Kino Zorza | https://kinozorza.pl/ | ⚠️ | Live (33 KB); no wp-json. Mostly daily cinema showtimes — questionable fit for an events map. |
| rzeszow.pl city calendar | https://www.rzeszow.pl/kultura/kalendarz-imprez/ | ⚠️ | Live; day-grid calendar (`events-grid`, `day-link`, `kat-*` classes) — events per day load via JS/XHR. Find the XHR endpoint. |
| WDK Rzeszów | https://wdk.podkarpackie.pl/ | ⚠️ | Live (53 KB); agenda structure unverified. |
| Zamek Łańcut | https://www.zamek-lancut.pl/ | ⚠️ | Homepage live (350 KB); `/wydarzenia-i-programy` returned 315 B (blocked or wrong path). Important for Łańcut — find the right agenda URL. |
| boguchwala.pl / lancut.pl | city portals | ⚠️ | Live, many region mentions; news-style posts, date extraction from content needed. |

## Second research pass (2026-07-03) — local news & event portals

Aggregators and local media verified live in a second sweep. **RDK Rzeszów is
the top new pick** — it has the same open Tribe REST API pattern we already use
for Tenerife, so it drops in as a config entry.

| # | Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|---|
| 1 | **Rzeszowski Dom Kultury** ⭐ | https://rdk.rzeszow.pl/kalendarz/ | ✅ **INTEGRATED** | Tribe REST | `sources/tribe.ts` (`rdk` site, `country: 'PL'`); `/wp-json/tribe/events/v1/events` open, events with title+start_date+venue+city (no geo → geocoder resolves). Filie (Słocina, Załęże) + outdoor venues added to the venue registry. "Wybrane filie RDK" (multi-branch events) have no single location → strict-dropped by design. |
| 2 | biletyna.pl ⭐ | https://biletyna.pl/Rzeszow | ✅ **INTEGRATED** | JSON-LD | `sources/biletyna.ts` via shared `sources/jsonld.ts`; per-city `ItemList` of schema.org `*Event` with **venue name + street + city** (venue-level precise). Rzeszów + Łańcut pages. High overlap with eBilet → cross-source dedup handles it. |
| — | Fakty Rzeszów | https://faktyrzeszow.pl/wydarzenie/ | ⚠️ tier 2 | JSON-LD `ItemList`→`Event` | Listing has only ~3 events, **no venue** (needs detail fetch); those events fully overlap biletyna/eBilet. Low yield — deferred. |
| 3 | RESinet (serwis rozrywkowy) | https://www.resinet.pl/rozrywka/kalendarium | ✅ | HTML | 900 KB kalendarium; no Event JSON-LD (only breadcrumb) — parse HTML rows. Rzeszów entertainment listings. |
| 4 | Visit Rzeszów (oficjalny turystyczny) | https://www.visitrzeszow.pl/pl/wydarzenia | ✅ | HTML | 73 KB events page; official tourism agenda, structure unverified. |
| 5 | erzeszow.pl — Kalendarz imprez | https://erzeszow.pl/41-miasto-rzeszow/6241-kalendarz-imprez.html | ✅ | HTML | Official city hall event calendar (the live one; the old `/wydarzenia` guess 404s). |
| 6 | Rzeszów News | https://rzeszow-news.pl/ | ✅ | WP + JSON-LD | Largest local news portal (~30M visits/yr); events embedded in articles + culture section. Try `/feed`. |
| 7 | Rzeszów112 | https://www.rzeszow112.pl/ | ✅ | HTML + JSON-LD | Local news + "przewodnik po wydarzeniach". |
| 8 | Super Nowości 24 | https://supernowosci24.pl/ | ✅ | WP + JSON-LD | Whole Podkarpacie (Rzeszów, Przemyśl, Mielec, Dębica…); WP `/feed` likely. Filter to region cities. |
| 9 | Rzeszów24.info | https://rzeszow24.info/ | ✅ | SPA state + JSON-LD | Client-hydrated; has embedded state JSON — find the XHR/API. |
| 10 | Rzeszów-Info | https://www.rzeszow-info.pl/ | ✅ | HTML | News portal, events section; structure unverified. |
| 11 | biletyna.pl (Rzeszów) | https://biletyna.pl/Rzeszow | ✅ | JSON-LD | Ticketing; per-city listing, big venues (G2A, Filharmonia). Overlaps eBilet — dedupe handles it. |
| 12 | kicket.com (Rzeszów) | https://kicket.com/rzeszow | ⚠️ tier 2 | HTML (no Event LD) | Re-checked: JSON-LD is only `WebSite`, and detail pages carry **no** Event LD → needs HTML listing+detail scrape (brittle, like Estrada). ~36 `/event/view/id/N` links. High overlap with biletyna/eBilet → deferred. |
| 13 | Adria Art | https://adria-art.pl/miasta/1213/rzeszow | ⚠️ tier 2 | HTML (no Event LD) | Re-checked: JSON-LD is only `Organization`; events are in HTML cards (~74 `/koncert//spektakl/` links). HTML scrape needed; overlaps ticketing → deferred. |
| 14 | Atrakcje.pl (Rzeszów) | https://rzeszow.atrakcje.pl/wydarzenia | ✅ | HTML | Regional events + attractions listing. |
| 15 | Łańcut News | https://lancutnews.pl/kalendarz-wydarzen-w-domu-kultury/ | ✅ | WP | Łańcut local news + culture-house calendar. WP `/feed` likely. **Fills part of the Łańcut/Boguchwała gap.** |
| 16 | MDK Łańcut | https://mdk-lancut.pl/wydarzenia/ | ✅ | HTML | Events page live (Tribe REST is **off** → 404); parse HTML. Łańcut culture house. |
| 17 | Nasze Miasto Rzeszów | https://rzeszow.naszemiasto.pl/kalendarz-imprez | ⛔ | — | `403` bot-block (Polska Press). Needs real browser headers / their API. |
| 18 | Kiwiportal (Rzeszów) | https://www.kiwiportal.pl/wydarzenia/m/rzeszow | ⛔ | — | Connection refused to generic fetch — retry with browser headers/headless. Nationwide event aggregator w/ city filter. |

**Recommended integration order (this pass):**
`rdk` (Tribe REST — do first) → `faktyrzeszow` (JSON-LD ItemList + detail) →
`lancutnews` + `mdk-lancut` (close the Łańcut gap) → `biletyna`/`kicket`/`adria-art`
(ticketing, high overlap → rely on dedup) → `resinet`/`atrakcje`/`visitrzeszow`
(HTML aggregators) → news portals (`rzeszow-news`, `rzeszow112`, `supernowosci24`)
via `/feed` for events-in-articles. Boguchwała still thin — `lancutnews`-style
local portal for Boguchwała not yet found; `boguchwala.pl` portal remains the
fallback.

## Tier 3 — blocked / low value for now

| Source | URL | Status | Notes |
|---|---|---|---|
| Bilety24 | https://www.bilety24.pl/szukaj?miasto=Rzeszów | ⛔ | Search GET params ignored — returns only nationwide "Popularne" (promoted) blocks. City filter is JS/POST; find the real search endpoint. |
| KupBilecik | https://www.kupbilecik.pl/imprezy/Rzeszów/ | ⛔ | 1.25 MB response with **zero** "Rzesz" occurrences — consent/geo wall or JS-rendered listing. |
| Going. | https://goingapp.pl/ | ⛔ | SPA, 3.4 KB shell — needs their internal API. |
| kultura.boguchwala.pl | http://kultura.boguchwala.pl/ | ⛔ | Ancient frame-based CMS (`1-start.html`) — no parseable listing. Boguchwała coverage gap: watch `boguchwala.pl` portal (tier 2). |
| erzeszow.pl | https://erzeszow.pl/wydarzenia | ⛔ | 404 on guessed paths; the portal moved — the live calendar is on `rzeszow.pl` (tier 2). |
| kultura.rzeszow.pl | — | ⛔ | DNS dead. |

## Coverage map (integrated sources)

Six sources live: `ebilet`, `estrada`, `mgoktyczyn`, `tribe (rdk)`, `biletyna`.

| Town | Covered by |
|---|---|
| Rzeszów | ebilet + estrada + rdk (Tribe) + biletyna |
| Łańcut | ebilet (lancut) + biletyna (lancut) |
| Jasionka | ebilet (jasionka — G2A Arena events) |
| Tyczyn | mgoktyczyn RSS |
| Boguchwała | ⚠️ gap — no viable source yet (tier 2: boguchwala.pl portal); ebilet/biletyna have no city page |

## Technical notes

1. **Browser UA required everywhere** — probes used a Chrome UA; the generic bot UA was not tested as OK anywhere.
2. **eBilet JSON-LD ≠ eBilet API.** The visible ItemList mixes tour-wide entries with wrong city/date; the LandingPage group API is per-city and accurate.
3. **Fixtures captured 2026-07-03** during research (raw HTML/JSON) — see `scripts/event-sync/__fixtures__/` after implementation.
4. **Polish dates:** `dd.mm.yyyy`, Polish month genitives ("23 lipca 2026 r."), "godz. 21:00" — shared PL date helpers live with the sources.
5. **Timezone:** Europe/Warsaw (CET/CEST, UTC+1/+2).
