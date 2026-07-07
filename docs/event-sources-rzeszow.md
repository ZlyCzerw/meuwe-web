# Rzeszów Region Event Sources — Catalogue & Scrape Viability

**Region:** Rzeszów + Tyczyn, Boguchwała, Łańcut, Jasionka (bbox ~lat 49.90–50.20, lng 21.80–22.35)
**Last verified:** 2026-07-06 (live fetch with a Chrome browser User-Agent, `Accept-Language: pl`).
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
| 13 | Adria Art | https://adria-art.pl/miasta/1213/rzeszow | ⚠️ tier 2 | HTML/SPA + JSON-LD shell | Live third-pass fetch is large and event-rich, but the JSON-LD is not yet verified as per-event payload. Needs parser/API discovery; high overlap with eBilet/Biletyna/KupBilecik. |
| 14 | Atrakcje.pl (Rzeszów) | https://rzeszow.atrakcje.pl/wydarzenia | ✅ | HTML | Regional events + attractions listing. |
| 15 | Łańcut News | https://lancutnews.pl/kalendarz-wydarzen-w-domu-kultury/ | ✅ | WP | Łańcut local news + culture-house calendar. WP `/feed` likely. **Fills part of the Łańcut/Boguchwała gap.** |
| 16 | MDK Łańcut | https://mdk-lancut.pl/wydarzenia/ | ✅ | HTML | Events page live (Tribe REST is **off** → 404); parse HTML. Łańcut culture house. |
| 17 | Nasze Miasto Rzeszów | https://rzeszow.naszemiasto.pl/kalendarz-imprez | ⛔ | — | `403` bot-block (Polska Press). Needs real browser headers / their API. |
| 18 | Kiwiportal (Rzeszów) | https://www.kiwiportal.pl/wydarzenia/m/rzeszow | ⛔ | — | Connection refused to generic fetch — retry with browser headers/headless. Nationwide event aggregator w/ city filter. |

## Third research pass (2026-07-03) - clubs, venues, aggregators, sport and family portals

Live probes used a Chrome browser User-Agent and `Accept-Language: pl`. The
statuses below are an implementation triage, not a guarantee that every site has
events in the current 21-day scrape window.

**Club/venue rule for future adapters:** if an official club/bar/disco page is
the source and an event has no separate venue field, assign the event to that
club's verified address from `regions/rzeszow-venues.ts` instead of dropping it
for missing venue. These sources usually publish events happening on-site.

Status glossary for this pass:

- **INTEGRATED** - already active in `regions/rzeszow.ts`.
- **READY** - fixture-backed and likely a direct adapter candidate.
- **HTML** - viable but still needs a custom parser.
- **API-DISCOVERY** - live but needs endpoint/SPA/browser research.
- **EMPTY-CURRENTLY** - canonical URL resolves, but does not currently return usable event listings.
- **VENUE-ONLY** - useful for venue registry/resolution, not yet an event feed.
- **SOCIAL-ONLY** - Facebook/Instagram only; keep for venue discovery, not first-wave scraping.
- **BLOCKED/LOW-VALUE** - blocked, failing, too sparse, duplicate, or otherwise not a good event input.

### Clubs and nightlife

| Source | Canonical URL | Status | Struct. | Notes | Priority |
|---|---|---|---|---|---|
| Grand Club | https://grandclub.pl/rezerwacje/ | ⚠️ VENUE-ONLY | HTML/reservations | Canonical page is a reservations surface, but it exposes a dedicated `/wydarzenia/` link in navigation. Keep for venue registry; only promote once the events page is fixture-backed. | Low |
| Klub Pod Palmą | https://www.podpalma.pl/wydarzenia/ | ✅ INTEGRATED | Tribe REST + WP | Active through `TribeEventsSource` as `podpalma`; live run returned `0` events for the 2026-07-03 → 2026-07-24 window. | Done |
| Underground Pub | https://undergroundpub.pl/ | ❌ OUT-OF-REGION | WP/HTML | Domain from the candidate list resolves to Underground Pub in Tychy (`PL. Korfantego 1`, map coords `50.1092483,18.9753013`), not Rzeszów. Do not activate for Rzeszów; local Rzeszów venue should be handled only if a separate local source/feed is found. | Low |
| ALOHA Food, Bowling & Club | https://aloha-club.pl/ | ⚠️ VENUE-ONLY | WP + JSON-LD | Homepage fixture is a venue/reservations surface with promotions and booking links, not dated event cards. Keep as a venue source unless a dedicated events page/feed is found. | Medium |
| Sofa Club & Restaurant | https://www.clubsofa.pl/ | ⛔ BLOCKED/LOW-VALUE | TLS/cert failure | `curl` failed with `SSL certificate problem: unable to get local issuer certificate` on 2026-07-06, so there is no trustworthy fixture from the canonical URL yet. | Low |
| LUKR Club | https://www.lukr.club/ | ⚠️ VENUE-ONLY | HTML/navigation | Homepage fixture exposes `rezerwacja/wydarzenia.html` in navigation, but the canonical home page itself is a club/restaurant shell without dated event blocks. Keep for venue resolution until the events page is fixture-backed. | Medium |
| Lord Jack | https://lordjack.pl/ | ⚠️ VENUE-ONLY | HTML/local business | Official restaurant/pub site at Rynek 4; useful for venue registry and RESinet/eRzeszow venue resolution. Activate only if dated event entries appear. | Low |
| Aqua Club & Lounge | https://www.facebook.com/AquaClubLounge/ | ⚠️ SOCIAL-ONLY | Facebook | No official scrapeable site in the submitted list. Track for venue registry/social monitoring only. | Backlog |
| Rubin Club | https://www.facebook.com/rubinclubrzeszow/ | ⚠️ SOCIAL-ONLY | Facebook | Social-only. Do not scrape behind login. | Backlog |
| Candela Club | https://www.instagram.com/candela.rzeszow/ | ⚠️ SOCIAL-ONLY | Instagram | Social-only. Do not scrape behind login. | Backlog |
| Pewex Pub | https://www.instagram.com/pewex_pub/ | ⚠️ SOCIAL-ONLY | Instagram | Social-only. Do not scrape behind login. | Backlog |
| Czarny Kot | https://czarnykot.eatbu.com/?lang=pl | ⚠️ VENUE-ONLY | Eatbu + JSON-LD | Eatbu page is useful for venue identity, but current evidence still looks like static local-business content rather than an event feed. | Low |
| Jameson Pub | https://jamesonpub.eatbu.com/?lang=pl | ⚠️ VENUE-ONLY | Eatbu + JSON-LD | Local-business page with no confirmed event listing. Keep only for venue registry enrichment. | Low |
| Bue Bue Klubokawiarnia | https://buebuerzeszow.eatbu.com/?lang=pl | ⚠️ VENUE-ONLY | Eatbu + JSON-LD | Website is preferable to Facebook, but it still reads as a venue/profile page rather than a dated event source. | Low |
| Cybermachina Rzeszów | https://www.facebook.com/p/Cybermachina-Rzesz%C3%B3w-100063660819248/ | ⚠️ SOCIAL-ONLY | Facebook/Instagram | Submitted Facebook and Instagram profiles collapse to one source family. Keep for venue discovery only. | Backlog |
| Chilli Klub Rzeszów | https://www.facebook.com/chilliklubrzeszow/ | ⚠️ SOCIAL-ONLY | Facebook | Social-only. Do not scrape behind login. | Backlog |
| Jazz Club Gramofon | https://jazz.rzeszow.pl/ | ⛔ BLOCKED/LOW-VALUE | WP/RSS | Current fixture is generic SEO/blog content, not a club event feed. Do not activate without a separate event page/feed. | Low |
| Runway Music Club | https://goout.net/pl/runway-music-club/vzuofe/ | ⚠️ API-DISCOVERY | GoOut JSON-LD/SPA | GoOut place page is live and event-word rich; Going page is tiny shell. First verify current venue activity, then prefer GoOut/API discovery. | Low |
| Strefa 57 | https://strefa57.com/ | ❌ OUT-OF-REGION | WP + JSON-LD | Live, large event-rich venue site, but public profiles/search identify it as Strefa 57 in Przytkowice/Kalwaria Zebrzydowska area, not Rzeszów. Do not activate in the Rzeszów region unless a local Rzeszów-specific venue/source is confirmed. | Low |

### Culture, sport, shopping and aggregators

| Source | Canonical URL | Status | Struct. | Notes | Priority |
|---|---|---|---|---|---|
| Miasto Rzeszów / erzeszow.pl | https://erzeszow.pl/41-miasto-rzeszow/6241-kalendarz-imprez.html | ✅ INTEGRATED | HTML listing + detail | Active custom source. Listing gives date/title; details provide hour and venue when parseable. Live run collected `10` events. | Done |
| Visit Rzeszów | https://www.visitrzeszow.pl/pl/wydarzenia | ⚠️ API-DISCOVERY | HTML form/POST | Redirects from `/wydarzenia`; official tourism events page remains live, but the 2026-07-07 fixture returns `Nie znaleziono wyników` without submitted filters. Needs POST/API discovery before activation. | Medium |
| Estrada Rzeszowska | https://estrada.rzeszow.pl/ | ✅ INTEGRATED | HTML listing + detail | `/wydarzenia/` is duplicate of the implemented Estrada source family. | Done |
| Rzeszowskie Piwnice | https://rzeszowskiepiwnice.pl/wydarzenia/ | ⛔ BLOCKED/LOW-VALUE | Estrada-branded HTML | Current page family appears to overlap the integrated Estrada source. Keep out of the first wave unless it exposes Piwnice-only events not already emitted by Estrada. | Low |
| Rzeszowski Dom Kultury | https://rdk.rzeszow.pl/kalendarz/ | ✅ INTEGRATED | Tribe REST | Already active through `TribeEventsSource` configured for `rdk`. | Done |
| WDK Rzeszów | https://wdk.kulturapodkarpacka.pl/ | ⚠️ READY | HTML | 2026-07-06 fixture contains dated `Kalendarz` links and `Zapowiedzi`/`topic__date` blocks on the canonical domain. Filter out news/photo relacje and keep dated event announcements. | Medium |
| Podkarpacki Informator Kulturalny | https://kulturapodkarpacka.pl/ | ⚠️ READY | HTML | 2026-07-06 fixture contains dated `event-box` cards and Rzeszów venue labels, including WDK/BWA/Filharmonia entries. Good regional source once bbox/city filtering is enforced. | Medium |
| Filharmonia Podkarpacka | https://filharmonia.rzeszow.pl/ | ⚠️ API-DISCOVERY | WP + JSON-LD | Live; previous note about WooCommerce/repertuar still applies. Big concerts overlap eBilet, but official source could improve descriptions. | Low |
| Teatr Maska | https://www.teatrmaska.pl/repertuar/ | ⚠️ EMPTY-CURRENTLY | HTML calendar shell | 2026-07-07 fixture renders the July 2026 calendar shell and `Brak wydarzeń w wybranym terminie.` No parser until a populated month or calendar AJAX endpoint is identified. | Medium |
| Teatr im. Wandy Siemaszkowej | https://teatr-rzeszow.pl/kalendarium/ | ⚠️ API-DISCOVERY | WP/Elementor + stale cache | 2026-07-07 fixture is LiteSpeed-cached and exposes stale 2024 repertuar snippets in metadata/content. Needs a current endpoint or browser/API path before activation. | Medium |
| Kino Zorza | https://www.kinozorza.pl/wydarzenia | ⛔ BLOCKED/LOW-VALUE | HTML | Live events page, but most inventory looks like cinema/showtime content rather than map-worthy events. Include only if a dedicated special-events subset appears. | Low |
| ROSiR Rzeszów | https://rosir.pl/wydarzenia/ | ✅ INTEGRATED | HTML Kadence cards | Active custom source. Parses dated sports/recreation cards, de-dupes repeated sections, and assigns known ROSiR venues from category classes. | Done |
| Asseco Resovia | https://www.assecoresovia.pl/ | ⚠️ API-DISCOVERY | WP + JSON-LD | Live team site. Needs match schedule endpoint; sports events map to Hala Podpromie. | Low |
| Stal Rzeszów - football | https://stalrzeszow.pl/terminarz-spotkan/ | ⚠️ API-DISCOVERY | WP/SportsPress | Static fixture contains the page shell and an empty SportPress `sp-event-list`; no deterministic home/away event rows are present in HTML. Needs a SportsPress endpoint or browser-rendered data before activation. | Medium |
| H69 / Stal Rzeszów speedway | https://www.h69.pl/terminarz | ✅ INTEGRATED | HTML table | Active custom source. Emits home matches only and assigns `Stadion Stal Rzeszów`. Live run collected `1` event in window. | Done |
| Millenium Hall | https://www.milleniumhall.pl/aktualnosci.html | ⛔ BLOCKED/LOW-VALUE | HTML + JSON-LD | News/promotions mix is likely to swamp true events. Revisit only if a dedicated dated events surface appears. | Low |
| Galeria Rzeszów | https://galeria-rzeszow.pl/aktualnosci/ | ⛔ BLOCKED/LOW-VALUE | WP/RSS markers | Current signal is still shopping/news heavy. Revisit only if repeated dated family/event posts justify a parser. | Low |
| RESinet kalendarium | https://www.resinet.pl/rozrywka/kalendarium | ✅ INTEGRATED | HTML cards | Active custom source. Live run collected `73` raw events; venue registry needs follow-up for several local places. | Done |
| RESinet places | https://www.resinet.pl/rozrywka/miejsca-instytucje | ⚠️ VENUE-ONLY | HTML/JSON-LD markers | Venue directory, not an event source. Useful for venue registry enrichment and resolver support only. | Backlog |
| toRzeszow.pl | https://torzeszow.pl/wydarzenia/ | ⚠️ READY | WP event listing HTML | 2026-07-06 fixture contains dated `cep-event__date` cards, categories, and detail links on the canonical page. Tribe REST still 404s, but the HTML listing is strong enough for a direct parser. | Medium |
| Koncerty w Rzeszowie | https://koncertywrzeszowie.pl/ | ✅ INTEGRATED | Tribe REST | Active through `TribeEventsSource` as `koncertywrzeszowie`. Live run collected `2` events. | Done |
| eBilet Rzeszów | https://www.ebilet.pl/miasto/rzeszow | ✅ INTEGRATED | internal JSON API | Already active through `EbiletSource`. | Done |
| Biletyna Rzeszów | https://biletyna.pl/Rzeszow | ✅ INTEGRATED | JSON-LD | Already active through `BiletynaSource`. | Done |
| KupBilecik Rzeszów | https://www.kupbilecik.pl/miasta/14/Rzesz%C3%B3w/ | ⚠️ API-DISCOVERY | HTML/SPA + JSON-LD markers | New city URL is live and event-rich; older guessed `/imprezy/Rzeszów/` path was low-value. Needs JSON-LD/API inspection and dedupe against eBilet/Biletyna. | Medium |
| Biletomat Rzeszów | https://biletomat.pl/rzeszow | ⚠️ API-DISCOVERY | HTML/SPA + JSON-LD markers | Live ticketing page. Likely high overlap; parse only if structured event data is clean. | Medium |
| PanBilet Rzeszów | https://www.panbilet.pl/wydarzenia/miasto/Rzesz%C3%B3w/ | ⚠️ API-DISCOVERY | HTML/SPA + JSON-LD markers | Live ticketing page. Verify JSON-LD/event API before adapter. | Medium |
| Biletor Rzeszów | https://biletor.pl/bilety/rzeszow | ⚠️ API-DISCOVERY | HTML/SPA + JSON-LD markers | Live ticketing page with 2026 title. Verify per-event structured payload. | Medium |
| Adria Art Rzeszów | https://adria-art.pl/miasta/1213/rzeszow | ⚠️ API-DISCOVERY | HTML/SPA + JSON-LD markers | Already catalogued; live event-rich city page. High overlap with ticketing platforms. | Low |
| GoOut Rzeszów | https://goout.net/pl/rzeszow/wydarzenia/lezukdmkk/ | ⚠️ API-DISCOVERY | HTML/SPA + JSON-LD markers | Live event-rich page. Good for club/indie coverage if API can be found; dedupe required. | Medium |
| Going Rzeszów | https://goingapp.pl/wydarzenia/rzeszow | ⛔ BLOCKED/LOW-VALUE | SPA shell | Generic fetch returns tiny shell. Needs browser/internal API; defer. | Low |
| Co Jest Grane Rzeszów | https://cojestgrane.pl/polska/podkarpackie/rzeszow | ⚠️ READY | HTML + schema.org Event | 2026-07-06 fixture contains itemized events with `startDate`, venue name, street address, city, and ticket links. Multi-page pagination still needs handling, but the markup is directly parseable. | Medium |
| Czas Dzieci Rzeszów | https://czasdzieci.pl/rzeszow/wydarzenia/ | ⚠️ EMPTY-CURRENTLY | HTML day listing | 2026-07-07 fixture for `2026-07-03` has an empty `<ul class="artList">` and only a next-day URL. Needs date iteration with populated days before parser work. | Medium |
| MapaPrzygód Rzeszów | https://mapaprzygod.pl/wydarzenia/miasto/rzeszow | ⚠️ EMPTY-CURRENTLY | HTML 404 | 2026-07-06 fixture for the canonical city URL is a branded `404` page, not an event listing. Keep dormant until the city events path returns real content again. | Medium |
| Atrakcje.pl Rzeszów | https://rzeszow.atrakcje.pl/ | ⚠️ HTML | HTML | Already catalogued. Live regional events/attractions page; still needs parser work and event filtering. | Medium |
| Radio Rzeszów - kalendarz | https://radio.rzeszow.pl/kalendarz-wydarzen/ | ⚠️ HTML | WP article/patronage page | Canonical page resolves to a patronage article shell rather than a clean structured feed. Keep only if the visible page content yields repeatable dated entries worth parsing. | Medium |
| FNT Rzeszów | https://fnt-rzeszow.pl/wydarzenia | ⚠️ READY | HTML | 2026-07-06 fixture contains dated cards/modals with event dates, descriptions, and ticket links. Good parser candidate despite overlap with ticketing platforms. | Medium |
| Nasze Miasto Rzeszów | https://rzeszow.naszemiasto.pl/kalendarz-imprez | ⛔ BLOCKED/LOW-VALUE | 403 | Still bot-blocked (`Just a moment...`). Needs browser/API research. | Low |
| Krajownik | https://krajownik.pl/ | ⚠️ API-DISCOVERY | HTML + JSON-LD markers | Nationwide search/events site; needs city query/API discovery before it is useful. | Low |
| Facebook - Imprezy Rzeszów | https://www.facebook.com/groups/102072139974671/ | ⚠️ SOCIAL-ONLY | Facebook group | Social-only group. Do not scrape behind login. | Backlog |
| Europejski Stadion Kultury | https://stadionkultury.pl/ | ⚠️ HTML | HTML | Live festival site. Seasonal high-value source; parser only makes sense close to the festival window. | Low/seasonal |

**Implemented in this pass (2026-07-03):**

- Added Tribe sites: `koncertywrzeszowie`, `podpalma`.
- Added custom sources: `resinet`, `erzeszow`, `h69`.
- Live run: `126` raw events collected, `94` kept after geocoding, `86` written after dedupe.

**Implemented in group-2 follow-up (2026-07-07):**

- Added custom source: `rosir`.
- Added venue registry entry for `Baseny otwarte ROSIR`.
- Deferred `visitrzeszow`, `teatrmaska`, `teatr-rzeszow`, `czasdzieci`, and `stalrzeszow` until their fixtures expose current event rows or API endpoints.

**Recommended integration order (next pass):**

1. Venue registry recovery from the latest `no-venue-match` list: `Wybrane filie RDK`, `Place zabaw na Osiedlu Baranówka`, `Skwer obok kamienicy przy ul. Króla Kazimierza 25`, `Aqua Club & Lounge`, `Aloha`, `Kino za Rogiem Café`, `Galeria Nierzeczywista RSF`.
2. `visitrzeszow` only after finding the POST/API endpoint; the fetched HTML returned "Nie znaleziono wyników" without submitted filters.
3. `teatrmaska`, `teatr-rzeszow`, `czasdzieci` or `mapaprzygod` - fill family/theatre gap, but only when fixture pages contain dated events or a stable calendar/listing endpoint.
4. Sports schedules: `stalrzeszow` football needs SportsPress endpoint/browser-rendered data before activation; keep the H69 home/away filtering pattern for any future parser.
5. Nightlife official sites (`underground`, `strefa57`, `lukr`, `aloha`) only when dated event cards are visible in fixture HTML; social-only club sources remain discovery/backlog.
6. Ticketing/API discovery (`KupBilecik`, `Biletomat`, `PanBilet`, `Biletor`, `GoOut`) - add after dedupe pressure is acceptable.

## Tier 3 — blocked / low value for now

| Source | URL | Status | Notes |
|---|---|---|---|
| Bilety24 | https://www.bilety24.pl/szukaj?miasto=Rzeszów | ⛔ | Search GET params ignored — returns only nationwide "Popularne" (promoted) blocks. City filter is JS/POST; find the real search endpoint. |
| KupBilecik old guessed path | https://www.kupbilecik.pl/imprezy/Rzeszów/ | ⛔ | Old guessed path was low-value. The canonical city URL `https://www.kupbilecik.pl/miasta/14/Rzesz%C3%B3w/` is live and tracked in the third-pass table. |
| Going. | https://goingapp.pl/ | ⛔ | SPA, 3.4 KB shell — needs their internal API. |
| kultura.boguchwala.pl | http://kultura.boguchwala.pl/ | ⛔ | Ancient frame-based CMS (`1-start.html`) — no parseable listing. Boguchwała coverage gap: watch `boguchwala.pl` portal (tier 2). |
| erzeszow.pl | https://erzeszow.pl/wydarzenia | ⛔ | 404 on guessed paths; the portal moved — the live calendar is on `rzeszow.pl` (tier 2). |
| kultura.rzeszow.pl | — | ⛔ | DNS dead. |

## Coverage map (integrated sources)

Eight source objects / ten configured source instances live: `ebilet`, `estrada`, `mgoktyczyn`, `tribe (rdk, koncertywrzeszowie, podpalma)`, `biletyna`, `resinet`, `erzeszow`, `h69`.

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
3. **Fixtures captured 2026-07-06** during the group 2 discovery refresh (raw HTML/JSON) — see `scripts/event-sync/__fixtures__/`.
4. **Polish dates:** `dd.mm.yyyy`, Polish month genitives ("23 lipca 2026 r."), "godz. 21:00" — shared PL date helpers live with the sources.
5. **Timezone:** Europe/Warsaw (CET/CEST, UTC+1/+2).
