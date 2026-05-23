# meuwe-web — Design Spec

**Date:** 2026-05-23
**Status:** Approved (pending written-spec review)

## 1. Overview & Goals

Rebuild **meuwe** — a hyperlocal social map app ("me" = your location, "u" = others, "we" = events) — as a production-grade **web app (SPA)**, faithfully reproducing the existing prototype `/Users/wiktormarc/TEST/index.html`.

The prototype is a single-file React (UMD) + in-browser Babel + Leaflet + Supabase app. It works but is not production-grade (in-browser transpilation, single file, no types, hardcoded Polish strings). This project re-implements it properly.

**Primary goals:**
- Faithful 1:1 visual reproduction of the prototype (same blobs, colors, CSS keyframe animations).
- Proper toolchain (Vite + React + TypeScript) that later wraps cleanly into Capacitor/Expo for mobile.
- Web OAuth via Supabase (no deep-link pain — `detectSessionInUrl` handles the callback).
- All previously "dummy" features made functional in v1.
- Trilingual (pl / en / es) with all strings in dedicated locale files; language auto-detected by geolocation.

**Non-goals (v1):** push notifications (separate v2 spec), mobile packaging (later).

## 2. Scope

**In scope (v1):**
- Auth: Google OAuth (web flow) + guest browsing mode + session persistence.
- Map: Leaflet + CartoDB Voyager tiles, warm sepia filter, geolocation centering, "me" marker, event blob pins, realtime event updates, empty state.
- Events: create (title/tags/description), list within radius, realtime.
- Event chat: realtime messages in a bottom sheet with 3 snap points.
- Profile panel: slide-in, avatar, sign out.
- **Functional (previously dummy):**
  - Search: Nominatim geocoding → map flyTo.
  - Timeline: real filtering of events by selected day.
  - Interests: saved to `profiles.interests`.
  - Notification radius slider: saved to `profiles.radius_km`.
  - Language switcher in profile.
- i18n: pl / en / es, dedicated files, geolocation-based auto-detection + manual override.

**Out of scope (v1) → future:**
- **v2 (separate spec):** push notifications (service worker / Web Push / FCM + Supabase Edge Function matching new events to users by radius + interests).
- **Later:** Capacitor/Expo mobile packaging.

## 3. Tech Stack & Architecture

- **Build:** Vite + React 18 + TypeScript, SPA.
- **Styling:** typed inline style objects (1:1 port of prototype) + a global `index.css` for resets, fonts, `@keyframes`, `prefers-reduced-motion`, and Leaflet overrides. Design tokens centralized in `tokens.ts`.
- **Maps:** raw Leaflet (not react-leaflet) wrapped in a React component via `useEffect` + refs. Markers use HTML-string `divIcon`s (faithful to prototype's `pinHTML`/`meHTML`).
- **State:** local React state + hooks (`useSession`, `useEvents`). No Redux.
- **Backend:** existing Supabase project `bcfhsbnbvsuxsiwmeway` (reused — keeps the already-configured Google OAuth + fixed `handle_new_user` trigger).
- **i18n:** react-i18next + i18next.
- **Testing:** Vitest for pure logic; manual/visual for UI + integration.

**Location:** new directory `/Users/wiktormarc/meuwe-web` (its own git repo). The Expo app at `/Users/wiktormarc/meuwe` stays untouched as reference; `TEST/index.html` is the visual reference.

## 4. Project Structure

```
meuwe-web/
  index.html  vite.config.ts  tsconfig.json  package.json
  src/
    main.tsx              # React root + i18n init
    App.tsx               # screen state machine: loading | welcome | map
    index.css             # reset, fonts, @keyframes, reduced-motion, leaflet overrides
    lib/
      tokens.ts           # C (colors), F (fonts), BLOBS, TAG_META
      types.ts            # Event, Profile, Message, Category, Lang…
      supabase.ts         # typed db layer
      geo.ts              # geolocation, haversine, reverse-geocode country
      i18n.ts             # react-i18next init + language detection
    locales/
      pl.ts  en.ts  es.ts # all UI strings, one dedicated file each
    hooks/
      useSession.ts       # auth + profile
      useEvents.ts        # load + realtime + day filter
    components/
      DragHandle.tsx  BlobFace.tsx  OrganicBlob.tsx  Avatar.tsx
      StatusPill.tsx  TagChip.tsx  AddButton.tsx  Toast.tsx  mapIcons.ts
    screens/
      Welcome.tsx  MapScreen.tsx  EventSheet.tsx  CreateSheet.tsx
      ProfilePanel.tsx  SearchBar.tsx
```

One component per file. Tokens and data layer isolated so Capacitor integration is clean later.

## 5. Design System (faithful to prototype)

- **Colors (`C`):** primary `#FF7A45`, primaryPress `#E85A2A`, primarySoft `#FFD4C0`, sky `#4FC3F7`, grass `#7DD87A`, sunshine `#FFD54F`, berry `#FF8FA3`, cream `#FFF6EC`, cloud `#FFFFFF`, ink `#2D2B2A`, inkSoft `#8A8580`.
- **Fonts (`F`):** display = Hanken Grotesk; body = Nunito (Google Fonts).
- **Blobs:** 3 organic SVG paths (`BLOBS`), thick ink stroke, flat fill, offset drop shadow.
- **Categories (`TAG_META`):** party/outdoor/family/culture/sport/food — each with color + glyph + label (label now via i18n).
- **Animations (CSS keyframes):** `breathe`, `breathe-sm`, `bob`, `halo`, `spin`, `drift`, `bubble-up`, `pop`. All gated by `@media (prefers-reduced-motion: reduce)`.

## 6. Data Layer & Supabase Schema

**Reuse** the existing Supabase project (keeps OAuth config + fixed trigger).

**Canonical v1 schema:**

`profiles` — **already matches current DB; no migration needed:**
```
id uuid PK references auth.users(id)
display_name text
avatar_color text default '#FF8FA3'
radius_km integer default 10
interests text[] default '{}'
created_at timestamptz default now()
```

`events` — **recreate to canonical (current has only lat/lng/title/category/starts_at/status):**
```
id uuid PK default uuid_generate_v4()
title text not null
description text
lat double precision not null
lng double precision not null
place_name text
category text default 'party'
start_time timestamptz default now()
end_time timestamptz default (now() + interval '24 hours')
creator_id uuid references profiles(id) on delete cascade
status text default 'live'   -- live | upcoming | extended | ended
created_at timestamptz default now()
```

`event_tags` — **create (new):**
```
event_id uuid references events(id) on delete cascade
tag text not null
primary key (event_id, tag)
```

`event_messages` — **recreate to canonical (current has sender_* columns):**
```
id uuid PK default uuid_generate_v4()
event_id uuid references events(id) on delete cascade
author_id uuid references profiles(id)
author_name text
author_color text default '#4FC3F7'
text text not null
created_at timestamptz default now()
```

**Migration:** no production data exists (only one test user). Migration drops & recreates `events`, `event_tags`, `event_messages`; leaves `profiles` and the existing `handle_new_user` trigger intact (the fixed trigger already inserts `display_name` — compatible). Re-apply RLS (public read; insert/update by owner) and enable realtime for `events` + `event_messages`.

**Naming decisions:** keep `display_name` and `radius_km` (matches current DB; prototype's `username`/`notification_radius` are adapted in code). Trivial — not worth a migration.

**`db` layer (`supabase.ts`, typed):** `signInGoogle`, `signOut`, `onAuthChange`, `getSession`, `getProfile`, `upsertProfile`, `getEvents(lat,lng,km,day)` (haversine + bounding box + **day filter**), `createEvent(+tags)`, `getMessages`, `sendMessage`, `subscribeMessages`, `subscribeEvents`.

**OAuth web config:** add redirect URLs `http://localhost:5173` (Vite dev) + production domain to Supabase; set Site URL. Google OAuth client is "Web application" type. On web, `detectSessionInUrl` handles the callback automatically — no deep links.

## 7. i18n System & Language Detection

- **Library:** react-i18next + i18next. Locale dicts in `locales/pl.ts | en.ts | es.ts`. Key type derived from one canonical file so TS flags missing keys.
- **Key groups (single namespace):** `common`, `welcome`, `map` (incl. `days`), `event`, `create`, `profile`, `tags`, `status`.
- **Plurals:** i18next suffixes (`_one/_few/_many/_other`), variant chosen via `Intl.PluralRules` per language (correctly handles Polish). Interpolation via `t(key, { count, dist, … })`.
- **Detection (two-phase, non-blocking):**
  1. **Sync at startup:** saved choice (localStorage `meuwe_lang`) → else `navigator.language` (pl/es/en) → else `en`. App renders immediately.
  2. **Async after geolocation** (already requested for the map): reverse-geocode country via Nominatim → `PL`→pl, Spanish-speaking countries (ES, MX, AR, CO, CL, PE, VE, EC, GT, CU, BO, DO, HN, PY, SV, NI, CR, PA, UY, GQ, PR)→es, else→en. Applies **only if** no manual override.
  3. **Manual switcher in profile:** sets localStorage override + `i18n.changeLanguage`; geolocation no longer overrides after that.

## 8. Components & Screens (faithful + functional additions)

**Components:** `DragHandle`, `BlobFace` (moods as in web prototype: happy + sleepy), `OrganicBlob` (blob + optional face), `Avatar` (initials + unread dot), `StatusPill` (live/upcoming/extended/ended, labels via i18n), `TagChip` (category color/glyph, selectable/removable), `AddButton` (breathing + halo + morphing blob), `Toast`, `mapIcons` (`pinHTML`, `meHTML` divIcon HTML).

**Screens:**
- **Welcome:** gradient bg, drifting background blobs, 2 floating blob characters, breathing logo (me/u/we staggered), Google sign-in button (real multicolor G), "browse without login".
- **MapScreen:** Leaflet map; avatar (top-left); search bar; recenter button (appears on pan); timeline pill (collapsed → draggable day strip); AddButton (center bottom); event pins; "me" marker; empty state bubble.
- **EventSheet:** 3 snap points (peek/half/full) with touch-drag; peek = compact header; half = details (status, time, distance, tags, organizer, description, "conversation" CTA); full = realtime chat (bubbles, send box, login-gated input).
- **CreateSheet:** "Co się dzieje?" form — location card, title input, tag chips (suggested + selected/removable), optional description, submit (loading state, error display).
- **ProfilePanel:** slide-in from left; avatar + name/email; if guest → Google sign-in; if authed → interests chips (saved), radius slider (saved), language switcher, sign out.

## 9. Functional Features Detail

- **Search (`SearchBar`):** debounced Nominatim query (`User-Agent: meuwe-app/1.0`), dropdown results, select → `map.flyTo` + close.
- **Timeline:** selecting a day filters `getEvents` by `start_time` falling on that calendar day (relative to today; labels via i18n).
- **Interests:** toggling chips in profile upserts `profiles.interests` (used by v2 notifications later).
- **Radius:** slider upserts `profiles.radius_km`; also drives the `getEvents` query radius.
- **Language switcher:** segmented control (PL/EN/ES) in profile; persists override.

## 10. Implementation Stages

- **Stage 0 — Foundation:** Vite+React+TS scaffold, ESLint/Prettier, `index.css` (reset, fonts, keyframes, reduced-motion, leaflet), `tokens.ts`, `types.ts`, i18n setup (3 locale files + detection), Supabase client + `db` skeleton, **SQL migration** + web redirect URLs. → empty cream app boots.
- **Stage 1 — Auth & shell:** `App.tsx` state machine, `useSession`, Welcome screen with working Google login, loading screen. → sign in, see empty map.
- **Stage 2 — Map core:** Leaflet + CartoDB + warm filter, geolocation + "me" marker, avatar/search-shell/recenter/AddButton/timeline-shell, event load + blob pins, realtime events, empty state. → see self + events on map.
- **Stage 3 — Event interactions:** EventSheet (snaps + drag) + realtime chat, CreateSheet (+ event_tags), Toast. → create/open/chat.
- **Stage 4 — Profile & functional features:** ProfilePanel (+ sign out), interests save, radius save, functional search, functional timeline filtering, language switcher. → all v1 works.
- **Stage 5 — Polish & verification:** verify 3 languages + plurals, reduced-motion, side-by-side fidelity check vs prototype, manual end-to-end pass.

## 11. Testing Approach

- **Vitest unit tests (pure logic):** haversine distance, country→language mapping, day-filter logic, plural-variant selection.
- **Manual/visual verification:** UI fidelity vs prototype, auth flow, realtime chat/events. Heavy component tests omitted (low ROI for a faithful visual port).

## 12. Risks & Assumptions

- **Assumption:** no production data in Supabase beyond one test user — migration may drop/recreate event tables.
- **Assumption:** CartoDB Voyager tiles remain available for web (they are; web is their supported use).
- **Risk:** visual drift when porting inline styles — mitigated by copying values 1:1 and a Stage 5 side-by-side check.
- **Risk:** Nominatim rate limits for search + reverse-geocode — mitigated by debounce and caching the geolocation→language result.
- **Deferred:** push notifications (v2) depend on web-vs-Capacitor decision; radius + interests are persisted in v1 to be ready for it.
