# Tenerife Event Sources — Catalogue & Scrape Viability

**Last verified:** 2026-06-03 (via automated fetch with a generic bot User-Agent).
**Scraper:** `scripts/event-sync/sources/` — implemented: `lagenda`, `tribe`, `eco`. To add a source, follow the `Source` interface (see `sources/index.ts`).

> ⚠️ **Verification caveat:** statuses below come from a single fetch with a generic UA. A `403`/`429` here usually means *bot-blocked / rate-limited*, **not** dead — those sites are often scrapable with a real browser UA, proper headers, or an official API. "JS-rendered" means the listing is hydrated client-side and needs a headless browser or the site's underlying JSON/GraphQL endpoint.
>
> ⚖️ **Always check `robots.txt` / ToS before scraping**, especially ticketing platforms (Eventbrite, RA, Songkick, Tomaticket) and social networks.

## Legend
- ✅ live, usable listing with dated events
- ⚠️ live but caveat (sparse, mixed freshness, JS-rendered, paywall, articles-only, empty for the slice fetched)
- ⛔ blocked to generic UA (`403`) — needs real UA/headers or official API
- 💀 dead / stale (old data)
- ⭐ strong scraper candidate
- **Struct.** = data shape: HTML / RSS / API / iCal / JSON-LD / JS

---

## Implemented sources

- **`lagenda`** — HTML scrape of lagenda.org (`scripts/event-sync/sources/lagenda.ts`).
- **`tribe`** — The Events Calendar REST API across municipal WordPress sites
  (`scripts/event-sync/sources/tribe.ts`). One adapter, config-driven URL list, no
  key. Confirmed open endpoints (`/wp-json/tribe/events/v1/events`): **El Sauzal,
  Candelaria, Santiago del Teide, San Miguel de Abona, Granadilla de Abona,
  La Guancha, El Tanque** (7 towns). Present but blocked/erroring (revisit):
  Tegueste, Buenavista del Norte, El Rosario (401), Arico (403), Fasnia (500);
  cert-expired (Node fetch rejects): Los Silos, Santa Úrsula, Vilaflor,
  granadilladeabona.es (use the .org). Add towns
  to `TRIBE_SITES`. Each `TribeSite.city` is a geocoding fallback for venue-less
  events (must match a key in `mapper.ts` MUNICIPALITY_COORDS).
- **`eco`** — HTML scrape of ecoentradas.com (`scripts/event-sync/sources/ecoentradas.ts`).
  Canary Islands cultural ticketing; listing → `/elegirsesion/{id}` detail, filtered
  to **island = Tenerife** (live: ~31 of ~82 shows). One RawEvent per session
  (date+time+venue from `.table-sesion`; full `.description-eco` synopsis). Paid
  sessions get an `EVENTO DE PAGO` notice prepended to the description (event's own
  language, ES); free ones don't. No key.

> ❌ **Songkick — NOT viable.** It stopped issuing new API keys (and its HTML is
> 403-blocked), so there's no way to feed an adapter. For concerts use the
> obtainable-key alternatives: **Ticketmaster Discovery** (free key) or
> **Bandsintown** (free `app_id`).

## Recommended build order

**Tier 1 — build next (structured or high-volume, fresh):**
`eventbrite` (HTML city listing) · ~~`ecoentradas`~~ ✅ · `webtenerife` · `cierraporfuera` · `arona.org` · `adeje.es` · `museosdetenerife` (RSS in footer) · `hardrock-cafe` (iCal/RSS export) · `tenerife.music` · `casa-balcones` (fiestas/romerías) · `gesportcanarias` + `running.life` (sport) · `elchikiplan` (family) · more `tribe` towns.

**Tier 2 — solid, plain HTML:**
`tickety` · `xceed` · `feverup` · `civitatis` · `tenerife.es` (Cabildo) · `puertodelacruz.es` · `citpuertodelacruz` · `laorotava.es` · `elsauzal` (+ `/feed` RSS) · `sinfonicadetenerife` · `teatenerife` · `clubdeportivotenerife` · `gotrail.run` · `nestshostels` · `villaadejebeach` · `thegourmetjournal` · `esmartribu` · `timeintenerife` (WP `/feed`) · `tenerifeweekly` (WP `/feed`) · `taquilla` · `monkeybeachclub`.

**Tier 3 — bot-blocked/JS (need headers/headless/API) or low-yield:**
`tomaticket` · `ra.co` (GraphQL) · `auditoriodetenerife/tickets` · `wegow` · `myguidetenerife` · `guidetocanaryislands` · `tictra` · `tenerifemusicfestival` · `soldelsurtenerife` · `partyhardtravel` · `cbcanarias` · `buscametas` · `lagranja.janto` · `papagayotenerife` · news sites (articles only) · municipal `/agenda` pages for the remaining ~20 towns.

---

## A. Island-wide aggregators / agendas

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| lagenda.org | https://lagenda.org/programacion | ✅ **INTEGRATED** | HTML | 100+ events, fresh; `?fecha_ini=&fecha_fin=` listing |
| Web Tenerife (oficial) ⭐ | https://www.webtenerife.co.uk/events/ | ✅ | HTML | ~60 events, fresh; ES at `webtenerife.com` |
| Cierra por fuera ⭐ | https://www.cierraporfuera.com/tenerife | ✅ | HTML | Jun–Oct 2026 |
| Cabildo de Tenerife | https://www.tenerife.es/portalcabtfe/es/agenda | ✅ | HTML | Sparse on default filter; also `/eventos`, `/fiestas-de-tenerife` |
| Tenerife LIVE (music) ⭐ | https://tenerife.music/ | ✅ | HTML | "38 upcoming"; `/events` paths |
| Tenerife Co Tours | https://tenerifecotours.com/en/ | ✅ | HTML | Blog "News & Events" w/ dated posts |
| Wonderful Tenerife | https://www.wonderfultenerife.com/es/events | ⚠️ | HTML | Mixed freshness (some 2025) |
| Club Canary | https://clubcanary.com/events-in-tenerife/ | ⚠️ | HTML+JSON-LD | Mostly annual/recurring |
| Travel to Tenerife | https://www.traveltotenerife.com/events-calendar | ⚠️ | HTML | Static annual list |
| El Corazón de Tenerife | https://www.elcorazondetenerife.com/agenda/ | ⚠️ | HTML | Listing indeterminate |
| ICDC (cultura) | https://www.icdcultural.org/ | ⚠️ | HTML (Webflow) | "Agenda cultural" section |
| MasCultura | https://www.masscultura.com/agenda-cultural-de-la-laguna/ | ⚠️ | HTML | `429` rate-limited on fetch (live) |
| Sobre Tenerife | https://sobretenerife.com/eventos/ | ⚠️ | HTML | Sparse |
| Amigos Tenerife | https://www.amigostenerife.com/eventos/<municipio> | ⚠️ | HTML | Per-municipality + "gratis" filter; can be empty |
| Guide to Canary Islands | https://www.guidetocanaryislands.com/events/tenerife/ | ⛔ | — | `403` |
| Tictra | https://tictra.com/Festival/tenerife | ⛔ | — | `403` |

## B. Municipal town-hall agendas

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| Arona ⭐ | https://www.arona.org/Agenda | ✅ | HTML | 65 events, paginated |
| Adeje ⭐ | https://www.adeje.es/agenda | ✅ | HTML | 15+, May–Nov 2026 |
| Puerto de la Cruz | https://www.puertodelacruz.es/eventos/ | ✅ | HTML | 15+ |
| CIT Puerto de la Cruz | https://citpuertodelacruz.com/programa-de-eventos/ | ✅ | HTML | 25+ |
| La Orotava | http://www.laorotava.es/es/agenda | ✅ | HTML | ~15 |
| El Sauzal ⭐ | https://www.elsauzal.es/actividades/ | ✅ | HTML + **RSS** | 18 events; `/feed` is a working WP RSS |
| Santa Cruz de Tenerife | https://www.santacruzdetenerife.es/web/noticias-y-agenda/agenda | ✅ | HTML | ~5, tabbed filters |
| Granadilla (portal) | https://portal.granadilladeabona.es/Eventos | ⚠️ | HTML/JS | 88 items, some resident-only ("solo empadronados") |
| Cultura Puerto de la Cruz | https://culturapuertodelacruz.com/ideas-y-generadores/festivales/ | ⚠️ | HTML | By month, low date precision |
| Visit Puerto de la Cruz | https://visitpuertodelacruz.es/en/monthly-agenda/ | ⚠️ | HTML | Empty for the month fetched |
| Granadilla (programa) | https://www.granadilladeabona.org/actividades/ | ⚠️ | HTML | Promo, no concrete dates |
| Revista Integración (La Laguna) | https://www.revistaintegracion.es/agenda-cultural-de-la-laguna/ | ⚠️ | HTML | Snapshot looked stale (2024) |
| Tegueste | https://www.tegueste.es/20870-2/ | 💀 | HTML | That page shows Nov 2024 — find current agenda URL |

➡️ **Remaining ayuntamientos** (same `…/agenda` + WordPress `/feed` RSS pattern): La Laguna, Candelaria, Los Realejos, San Miguel de Abona, Guía de Isora, Santiago del Teide, Arico, Vilaflor, Buenavista del Norte, Los Silos, Garachico, Icod de los Vinos, Tacoronte, El Rosario, Santa Úrsula, La Victoria/La Matanza, Fasnia, Güímar. The **El Sauzal `/feed`** test confirms many of these expose a usable RSS feed — cheapest bulk integration.

## C. Venues / theatres / clubs

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| Hard Rock Cafe Tenerife ⭐ | https://cafe.hardrock.com/tenerife/event-calendar.aspx | ✅ | HTML + **iCal/RSS** | 20+ events, Jun 2026→Oct 2027; exports! |
| TEA (Espacio de las Artes) ⭐ | https://teatenerife.es/ | ✅ | HTML | 14 exhibitions + activities, dated |
| Orquesta Sinfónica de Tenerife | https://sinfonicadetenerife.es/en/ | ✅ | HTML | 4+ concerts, Jun–Jul |
| Monkey Beach Club | https://www.monkeybeachclub.com/ | ✅ | HTML | 8 events → fourvenues/utopiaparties |
| Espacio La Granja (Janto) | https://lagranja.janto.es/ | ⚠️ | JS | Janto ticketing SPA |
| Papagayo Tenerife | https://papagayotenerife.com/events/ | ⚠️ | JS | Events page JS-rendered |
| Auditorio de Tenerife (tickets) | https://tickets.auditoriodetenerife.com/ | ⛔ | — | `403`; main site `auditoriodetenerife.com` |
| Teatro Guimerá | https://teatroguimera.es/ | 💀 | — | Closed for renovation (~until 2027) |
| Espacio Cultural CajaCanarias | https://www.cajacanarias.com/ | — | — | Not directly verified; events surface via Cabildo/lagenda |

## D. Ticketing platforms

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| Songkick (Tenerife) | https://www.songkick.com/metro-areas/54425-spain-tenerife | ❌ | API | NOT viable: no new API keys issued + HTML 403. Use Ticketmaster/Bandsintown for concerts |
| Eventbrite (Tenerife) ⭐ | https://www.eventbrite.com/d/spain--tenerife/events/ | ✅ | HTML | 20+ events; discovery API dead but HTML listing live |
| Ecoentradas ⭐ | https://www.ecoentradas.com/ | ✅ **INTEGRATED** | HTML | `eco`; Tenerife-filtered, session-level dates+times, paid-event notice |
| Tickety | https://tickety.es/ | ✅ | HTML | 50+ events Jun–Dec 2026 |
| Xceed (clubs) ⭐ | https://xceed.me/en/tenerife/events | ✅ | HTML | 25+ club events |
| Fever | https://feverup.com/en/tenerife | ✅ | HTML | 50+ (mostly Candlelight/tours) |
| Civitatis | https://www.civitatis.com/en/tenerife/ | ✅ | HTML | 137 activities (tours) |
| Taquilla | https://www.taquilla.com/entradas/cd-tenerife | ✅ | HTML | Per-event/venue pages |
| Tomaticket | https://www.tomaticket.es/es-es/tenerife | ⛔ | — | `403`; rich venue pages if UA fixed |
| Resident Advisor | https://ra.co/events/es/canaryislands | ⛔ | GraphQL | `403`; has GraphQL API + club pages (O Club, Magma, Cirkus, Tibu, TAO, Liquid) |
| Wegow | https://www.wegow.com/ | ⚠️ | JS/SPA | Listings hydrate client-side; find correct city URL/API |
| Hellotickets | https://www.hellotickets.com/spain/tenerife/ | ⚠️ | HTML | `404` on guessed path; domain live |
| Yumping | https://www.yumping.com/ | ⚠️ | HTML | `404` on guessed path |
| Rebel Tickets | https://www.rebeltickets.es/ | ⚠️ | HTML | Resale, thin event data |
| Atrápalo / Entradas.com / DICE | — | — | — | Major platforms w/ Tenerife filters; not individually verified |

## E. News media (mostly articles — lower yield)

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| Time in Tenerife ⭐ | https://timeintenerife.com/ | ✅ | WP **RSS** | Dated events in posts; `/feed` |
| Tenerife Weekly | https://tenerifeweekly.com/ | ✅ | WP **RSS** | Events in articles; `/feed` |
| RTVC (público) | https://rtvc.es/ | ✅ | HTML | Cultural agenda content |
| Atlántico Hoy | https://www.atlanticohoy.com/tenerife | ⚠️ | HTML | Articles; possible paywall |
| Diario de Avisos | https://diariodeavisos.elespanol.com/seccion/cultura/ | ⚠️ | HTML | Articles, mixed dates |
| eldiario.es / Canarias Ahora | https://www.eldiario.es/canariasahora/cultura/ | ⚠️ | RSS | Paywalled; RSS at `/rss` |
| Canarias7 (cultura) | https://www.canarias7.es/cultura/ | ⚠️ | HTML | Articles + event mentions |
| El Digital Sur | https://eldigitalsur.com/ | ⚠️ | WP (`/feed`) | News; events embedded in articles |
| Canarian Weekly | https://www.canarianweekly.com/ | ⚠️ | HTML | News only, no events section |
| Diario de Tenerife | https://www.diariodetenerife.info/ | ⚠️ | — | Indeterminate |
| My Guide Tenerife | https://www.myguidetenerife.com/events | ⛔ | — | `403` |
| Sol del Sur Tenerife | https://www.soldelsurtenerife.com/ | ⛔ | — | `403` |

## F. Festivals / promoters / guides

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| Casa de los Balcones (romerías) ⭐ | https://casa-balcones.com/calendario-de-romerias-en-tenerife-2026/ | ✅ | HTML | 150+ fiestas/romerías 2026 by month |
| Nests Hostels (festivals) ⭐ | https://nestshostels.com/en/music-festivals-tenerife-2026/ | ✅ | HTML | 14–20 festivals w/ dates |
| Villa Adeje Beach (calendar) | https://villaadejebeachhotel.com/en/post/calendar-of-festivals-and-events-in-tenerife/ | ✅ | HTML | 20+ annual events |
| Modo Festival | https://modofestival.es/ | ✅ | HTML | Festival aggregator, dated |
| DOD Magazine | https://www.dodmagazine.es/ | ✅ | HTML | Festival coverage, "Festivales 2026" |
| Phe Festival | https://phefestival.es/en/ | ✅ | HTML | 4–5 Sep 2026, lineup |
| Tenerife Sevive | https://tenerifesevive.wordpress.com/ | — | WP (`/feed`) | Not individually verified |
| Tenerife Music Festival | https://tenerifemusicfestival.es/ | ⛔ | — | `403` |
| Party Hard Travel | https://www.partyhardtravel.com/tenerife/tenerife-events | ⛔ | — | `403` |

## G. Sports (fixtures / races)

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| Gesport Canarias ⭐ | https://www.gesportcanarias.com/web/eventos/ | ✅ | HTML | 100+ races 2025–26 |
| running.life (Tenerife) ⭐ | https://running.life/running-calendar/spain/canarias/tenerife | ✅ | HTML | 54 races |
| GoTrail (Tenerife) | https://gotrail.run/en/calendar/spain/canarias/santa-cruz-de-tenerife | ✅ | HTML | 39 trail races |
| CD Tenerife (fútbol) | https://www.clubdeportivotenerife.es/partidos | ✅ | HTML | 38 fixtures |
| Media Maratón SC Tenerife | https://media.maratondetenerife.com/ | ✅ | HTML | Single annual event (2026) |
| RTVC — CD Tenerife calendar | https://rtvc.es/deportes/futbol/cd-tenerife/calendario/ | ✅ | HTML | TV calendar |
| Buscametas (Tenerife) | https://www.buscametas.com/calendario/zona/tenerife/ | ⚠️ | JS | "Cargando eventos…" — needs headless |
| CB Canarias (baloncesto) | https://cbcanarias.net/temporada/calendario/ | ⚠️ | JS | Calendar hydrates client-side |
| Rock the Sport | https://web.rockthesport.com/es | — | — | Race registration platform; not verified |
| LaLiga / BaloncestoHoy | https://www.laliga.com/clubes/cd-tenerife | — | — | Official fixture data (alt source) |

## H. Gastronomy / fairs / congresses

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| The Gourmet Journal (agenda) ⭐ | https://www.thegourmetjournal.com/noticias/agenda-gastronomica-para-2026/ | ✅ | HTML | 150+ gastro events (incl. Canarias) |
| GastroCanarias (ntradeshows) | https://www.ntradeshows.com/gastrocanarias/ | ✅ | HTML | Dates 19–21 Mar 2026 |
| Salón Gastronómico de Canarias | https://salongastronomicodecanarias.com/ | ✅ | HTML | Same event; program via qaproveche.com |
| HORECA Entertainment | https://horecaentertainment.com/ | ⚠️ | Next.js | "Eventos" section, dates not surfaced |
| Neventum | https://www.neventum.com/tradeshows/gastrocanarias | — | — | Trade-show aggregator; not verified |

## I. Family / kids

| Source | URL | Status | Struct. | Notes |
|---|---|---|---|---|
| El Chikiplan ⭐ | https://elchikiplan.com/agenda/ | ✅ | HTML (WP) | 100+ kids/family activities; `/feed` likely |
| Esmartribu | https://esmartribu.com/agenda-en-tenerife/ | ✅ | HTML | 50–100+ kids activities |
| Familias en Ruta | https://familiasenruta.com/destinos/tenerife-con-ninos/ | — | — | Guide; not verified |

---

## Technical notes for implementation

1. **Official API first.** `songkick` has a real developer API; `ra.co` has GraphQL; `eventbrite` org API works for owned events. Prefer these over HTML where available.
2. **`403`/`429` ≠ dead.** `tomaticket`, `ra.co`, `auditoriodetenerife/tickets`, `myguidetenerife`, `guidetocanaryislands`, `tictra`, `tenerifemusicfestival`, `soldelsurtenerife`, `partyhardtravel` blocked our generic UA. Retry with a browser UA + `Accept-Language: es` and respectful rate limiting.
3. **JS-rendered:** `wegow`, `cbcanarias`, `buscametas`, `lagranja.janto`, `papagayotenerife` hydrate client-side — use the site's XHR/JSON endpoint (check Network tab) or a headless fetch.
4. **WordPress `/feed` RSS** is the cheapest bulk win: confirmed working on `elsauzal.es/feed`; very likely on most ayuntamientos and on `timeintenerife`, `tenerifeweekly`, `eldigitalsur`, `elchikiplan`, `tenerifesevive`.
5. **`iCal`/`RSS` exports:** `hardrock-cafe` exposes iCal+RSS; `museosdetenerife` has an RSS link in the footer.
6. **Dedupe across sources:** the same event appears on lagenda + a venue + a ticketing platform. Keep `external_id = ${source}:${nativeId}` and add cross-source dedup (title + date + venue/geo) before insert.
7. **Geo:** most municipal/venue sources imply location from venue; geocode `place_name` (Nominatim, as in CreateSheet) to fill `lat/lng`.
8. **Dead (do not build):** `datos.canarias.es` Agenda Cultural, `santacruzdetenerife.es/opendata` (see `reference_event_source_apis` memory); `teatroguimera.es` until it reopens.
