# Landing Cleanup Design

**Date:** 2026-08-18
**Status:** Approved

## Goal

Close eight loose ends found while internationalising the landing page's SEO
(`036355a` and the two commits before it). Four of them are defects a visitor
can see or a crawler can trip over; four are dead weight left behind by earlier
work. None of them changes what the landing is or how it looks, apart from one
deliberate copy change and the removal of a section that was already unmounted.

The work splits into four commits so the one change with an external dependency
can be reverted without touching the rest.

---

## Background

Three findings shaped these decisions and are worth recording, because none of
them is obvious from reading the current code.

**The chips were never meant to be literals.** `ProblemSection` renders five
category chips as hardcoded Polish strings. The same five words already exist,
translated into all five languages, under the `tags` block that the app itself
uses (`tags.party`, `tags.outdoor`, `tags.music`, `tags.sport`, `tags.family`).
The landing was built Polish-first and someone typed the values instead of
reaching for the keys beside them. A German visitor currently reads
*impreza / piknik / koncert / sport / rodzinne* under a German heading.

**`ForWhomSection` was removed on purpose.** Commit `9dfe28e` (2026-06-12) says
"Landing.tsx: remove ForWhomSection" and, in the same breath, "ForWhomSection.tsx:
fix programmatic scroll fighting IO with scrollingRef". The carousel was patched
and pulled from the page in one go. It is 184 lines coordinating an
`IntersectionObserver` against programmatic scrolling. Re-mounting it would mean
re-litigating a decision someone already made with more context than we have, so
it goes.

**The sign-in redirect never carried a path.** `authRedirectTo()` returns
`${location.origin}/` — origin plus a slash, nothing else. This predates the
language routes, so it is not a regression, but it means all four of `/pl/`,
`/de/`, `/es/` and `/sl/` drop their prefix on the way back from Google. A
visitor who has not picked a language by hand then gets their browser's language
instead of the one they were reading.

---

## Scope

### Commit 1 — Language leaks

**Chips read from translations.** The five chips in
`src/components/landing/sections/ProblemSection.tsx` take their labels from
`t('tags.party')`, `t('tags.outdoor')`, `t('tags.music')`, `t('tags.sport')` and
`t('tags.family')`. Colours bind to the key, not to the Polish word, so the
mapping survives translation.

One accepted copy change: the Polish chip currently reading *koncert* becomes
*muzyka*, because `tags` has no separate key for a concert and inventing one to
preserve a decorative label is not worth a sixth entry in five files.

**Slovenian screenshots.** `sl` joins the screenshot maps in `ProblemSection`,
`HowItWorksSection` and `FeaturesSection`. All three files (`map-sl.png`,
`event-sl.png`, `new-sl.png`) are already in `public/screenshots/`; only the
lookup tables were missing the key, so Slovenian visitors fall through to
English.

### Commit 2 — Sign-in returns to the language it left

`authRedirectTo()` in `src/lib/supabase.ts` appends the language prefix when the
current path carries one, producing `https://meuwe.eu/de/` instead of
`https://meuwe.eu/`. The prefix is read with the existing `langFromPath()` from
`src/lib/i18n.ts` rather than a second copy of the path table.

The native branch is left exactly as it is. It returns `${WEB_ORIGIN}/` for
reasons documented above the function — the WebView's own origin is unreachable
from the system browser — and native builds have no language paths to preserve.

### Commit 3 — Heading structure

**H1 stops duplicating the tagline.** The `sr-only` H1 in `HeroSection` renders
`welcome.tagline`, the same string shown beside it as a plain `div`. It gains its
own key, `landing.h1`, carrying wording consistent with that language's
`<title>` — so the heading names the page the way someone searching for it would:

| Locale | `landing.h1` |
|---|---|
| pl | meuwe — mapa lokalnych wydarzeń w Twojej okolicy |
| en | meuwe — a map of local events happening near you |
| de | meuwe — Karte lokaler Events in deiner Nähe |
| es | meuwe — mapa de eventos locales cerca de ti |
| sl | meuwe — zemljevid lokalnih dogodkov v tvoji okolici |

These echo the titles generated in `scripts/seo-content.mjs` without repeating
them verbatim, so the heading and the search snippet agree without reading as
one string pasted twice.

The H1 stays visually hidden. The visible tagline lives in `Welcome`, which the
native app shares; rewriting it would change the mobile welcome screen in five
languages for a web SEO gain.

**Footer headings become H3.** The three `<h4>` elements in `LandingFooter`
become `<h3>`, closing the H2 → H4 jump so the outline reads H1 → H2 → H3.

### Commit 4 — Dead code

- `src/components/landing/sections/ForWhomSection.tsx` is deleted.
- With it go `landing.forWhomTitle`, `landing.forWhomSubtitle` and the
  thirteen-entry `landing.uc[]` array, in all five locales.
- Also deleted, in all five locales: `landing.problem`, `problem_p1`,
  `problem_p2`, `problem_p3`, `landing.how.*`, `landing.features.*` and
  `landing.cta.*`. No component reads any of them; several are superseded
  duplicates of copy the page renders under different keys.
- The `reactSnap` block leaves `package.json`, and `react-snap` leaves
  `devDependencies`.

`snap-ready` in `Landing.tsx` and the `hydrateRoot` branch in `main.tsx` stay.
They cost nothing and they are the two hooks a real prerender would attach to.

---

## Explicitly out of scope

- **Real prerendering.** `react-snap`'s bundled Chromium is version 78 and cannot
  parse what Vite emits for React 19; `react-dom/server` is blocked by
  module-scope browser access in `i18n.ts` and by the Supabase and Capacitor
  imports the landing tree pulls in. Crawlers without JS keep reading the
  `<noscript>` block introduced in `916c4fd`.
- **Dead footer links.** "O nas" and "Cookies" point at `href="#"`. Raised and
  deliberately left alone.
- **Store screenshots.** `store-assets/gen.mjs` still carries "Bez reklam. Bez
  algorytmów." Changing it means regenerating the images and resubmitting to the
  App Store and Google Play.

---

## Risks

**The sign-in change depends on configuration outside this repository.** The new
redirect target only works if Supabase's allowed redirect list carries a wildcard
entry, `https://meuwe.eu/**`. With only the exact `https://meuwe.eu/` on the
list, Supabase rejects the target and throws the user at the Site URL — a broken
login, in production, for everyone arriving from a language path.

Staging and production are **different Supabase projects** —
`ujzmivdgibnnncmoqoyb` and `bcfhsbnbvsuxsiwmeway`. A successful sign-in test on
staging says nothing about production's list. Both dashboards must be checked
before this reaches `main`.

**The chip copy change is visible.** Polish visitors who knew the row as
*koncert* will read *muzyka*.

---

## Testing

Two new tests guard the regressions this work fixes:

- `ProblemSection` renders chip labels from the translation layer. The assertion
  runs in a non-Polish language and fails if a Polish literal reappears.
- `authRedirectTo()` keeps the language prefix on web and omits it on native.

Everything else is regression cover: `npx tsc -b` clean, the existing suite green
(559 tests at the time of writing), and a staging pass confirming German chips on
`/de/` and the Slovenian screenshot on `/sl/`.
