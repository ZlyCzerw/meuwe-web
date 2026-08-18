# Landing Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the eight loose ends listed in `docs/superpowers/specs/2026-08-18-landing-cleanup-design.md` — four visible defects and four pieces of dead weight — without changing what the landing page is.

**Architecture:** Nothing structural. Four themed commits touch existing files: the chips and screenshot maps start reading the translation layer, the sign-in redirect learns to keep its language prefix, the heading outline gains an H1 of its own and loses an H2→H4 jump, and a removed section plus its orphaned translations and a dead build config are deleted.

**Tech Stack:** React 19, TypeScript, react-i18next, vitest + @testing-library/react, Vite 8.

---

## File Structure

**Modified:**
- `src/components/landing/sections/ProblemSection.tsx` — chips read `t('tags.*')`; `sl` joins the screenshot map
- `src/components/landing/sections/HowItWorksSection.tsx` — `sl` joins the screenshot map
- `src/components/landing/sections/FeaturesSection.tsx` — `sl` joins the screenshot map
- `src/lib/supabase.ts` — `authRedirectTo()` keeps the language prefix on web
- `src/lib/supabase.test.ts` — cover the prefix and the native branch
- `src/components/landing/sections/HeroSection.tsx` — H1 reads `landing.h1`
- `src/components/landing/sections/LandingFooter.tsx` — `<h4>` → `<h3>`
- `src/components/landing/landing.css:159` — `.lp-footer-col h4` selector follows the tag
- `src/locales/{pl,en,de,es,sl}.ts` — add `landing.h1`, delete the dead blocks
- `src/locales/parity.test.ts` — assert `landing.h1` exists in every locale
- `package.json` — drop the `reactSnap` block and the `react-snap` dependency

**Created:**
- `src/components/landing/sections/ProblemSection.test.tsx` — chips and screenshot come from the active language
- `src/components/landing/sections/LandingFooter.test.tsx` — footer column headings are H3

**Deleted:**
- `src/components/landing/sections/ForWhomSection.tsx`

---

## Task 1: Chips read from the translation layer

**Files:**
- Modify: `src/components/landing/sections/ProblemSection.tsx:29-39`
- Test: `src/components/landing/sections/ProblemSection.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/landing/sections/ProblemSection.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProblemSection } from './ProblemSection'
import i18n from '../../../lib/i18n'

// Chipy powtarzają kategorie, którymi aplikacja już się posługuje. Gdy ktoś
// wpisze je z palca, niemiecki odwiedzający czyta polskie słowa pod niemieckim
// nagłówkiem — dokładnie to naprawiamy, więc test pilnuje języka, nie treści.
afterEach(() => { i18n.changeLanguage('en') })

describe('ProblemSection chips', () => {
  it('label themselves in the active language', async () => {
    await i18n.changeLanguage('de')
    render(<ProblemSection />)
    expect(screen.getByText('Party')).toBeInTheDocument()
    expect(screen.getByText('Musik')).toBeInTheDocument()
    expect(screen.getByText('Familie')).toBeInTheDocument()
  })

  it('leave no Polish literal behind in German', async () => {
    await i18n.changeLanguage('de')
    render(<ProblemSection />)
    expect(screen.queryByText('impreza')).toBeNull()
    expect(screen.queryByText('piknik')).toBeNull()
    expect(screen.queryByText('rodzinne')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/landing/sections/ProblemSection.test.tsx`

Expected: FAIL — `Unable to find an element with the text: Party`, because the component renders the literal `impreza`.

- [ ] **Step 3: Make the chips read translations**

In `src/components/landing/sections/ProblemSection.tsx`, replace lines 29-39 with:

```tsx
          <div className="lp-chips lp-anim lp-slide-right lp-delay-4">
            {[
              { key: 'party',   bg: '#E91E6328' },
              { key: 'outdoor', bg: `${C.grass}28` },
              { key: 'music',   bg: `${C.sky}28` },
              { key: 'sport',   bg: `${C.primary}28` },
              { key: 'family',  bg: '#FFD54F28' },
            ].map(ch => (
              <span key={ch.key} className="lp-chip" style={{ background: ch.bg }}>{t(`tags.${ch.key}`)}</span>
            ))}
          </div>
```

The colour now binds to the key rather than to a Polish word, so the mapping survives translation. `tags.music` replaces the old `koncert` chip — `tags` has no separate key for a concert, and this is the accepted copy change recorded in the spec.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/landing/sections/ProblemSection.test.tsx`

Expected: PASS — 2 tests.

---

## Task 2: Slovenian screenshots

**Files:**
- Modify: `src/components/landing/sections/ProblemSection.tsx:6-11`
- Modify: `src/components/landing/sections/HowItWorksSection.tsx:6-11`
- Modify: `src/components/landing/sections/FeaturesSection.tsx:6-11`
- Test: `src/components/landing/sections/ProblemSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/components/landing/sections/ProblemSection.test.tsx`:

```tsx
describe('ProblemSection screenshot', () => {
  // Pliki map-sl.png, event-sl.png i new-sl.png leżą w repo od dawna — brakowało
  // wyłącznie klucza w tablicy, więc Słoweniec cicho dostawał angielski zrzut.
  it('uses the Slovenian screenshot in Slovenian', async () => {
    await i18n.changeLanguage('sl')
    const { container } = render(<ProblemSection />)
    const img = container.querySelector('img[src*="/screenshots/"]')
    expect(img?.getAttribute('src')).toBe('/screenshots/map-sl.png')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/landing/sections/ProblemSection.test.tsx`

Expected: FAIL — received `/screenshots/map-en.png`, because `sl` is missing from the lookup and falls through to English.

- [ ] **Step 3: Add `sl` to all three maps**

In `src/components/landing/sections/ProblemSection.tsx`, replace lines 6-11:

```tsx
const MAP_SCREENSHOTS: Record<string, string> = {
  pl: '/screenshots/map-pl.png',
  en: '/screenshots/map-en.png',
  de: '/screenshots/map-de.png',
  es: '/screenshots/map-es.png',
  sl: '/screenshots/map-sl.png',
}
```

In `src/components/landing/sections/HowItWorksSection.tsx`, replace lines 6-11:

```tsx
const EVENT_SCREENSHOTS: Record<string, string> = {
  pl: '/screenshots/event-pl.png',
  en: '/screenshots/event-en.png',
  de: '/screenshots/event-de.png',
  es: '/screenshots/event-es.png',
  sl: '/screenshots/event-sl.png',
}
```

In `src/components/landing/sections/FeaturesSection.tsx`, replace lines 6-11:

```tsx
const NEW_SCREENSHOTS: Record<string, string> = {
  pl: '/screenshots/new-pl.png',
  en: '/screenshots/new-en.png',
  de: '/screenshots/new-de.png',
  es: '/screenshots/new-es.png',
  sl: '/screenshots/new-sl.png',
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/landing/sections/ProblemSection.test.tsx`

Expected: PASS — 3 tests.

- [ ] **Step 5: Confirm the referenced files exist**

Run: `ls public/screenshots/map-sl.png public/screenshots/event-sl.png public/screenshots/new-sl.png`

Expected: all three paths listed, no "No such file".

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx tsc -b && npx vitest run`

Expected: `tsc` silent, suite green.

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/sections/ProblemSection.tsx src/components/landing/sections/ProblemSection.test.tsx src/components/landing/sections/HowItWorksSection.tsx src/components/landing/sections/FeaturesSection.tsx
git commit -m "Let the chips and the screenshots speak the reader's language

The five category chips were Polish literals, so a German visitor read
impreza and piknik under a German heading. They now read the tags block
the app already uses, translated into all five languages. The old koncert
chip becomes muzyka: tags has no key for a concert and inventing one to
keep a decorative label is not worth a sixth entry in five files.

sl was missing from the three screenshot maps even though map-sl.png,
event-sl.png and new-sl.png have been in the repo all along, so Slovenian
quietly fell through to the English captures."
```

---

## Task 3: Sign-in returns to the language it left

**Files:**
- Modify: `src/lib/supabase.ts:36-38`
- Test: `src/lib/supabase.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/supabase.test.ts`:

```ts
describe('authRedirectTo language prefix', () => {
  afterEach(() => {
    (globalThis as any).__native = false
    window.history.pushState({}, '', '/')
  })

  // Bez prefiksu ktoś, kto czytał /de/, wraca na / i — jeśli nie wybrał języka
  // ręcznie — dostaje język przeglądarki zamiast tego, na którym był.
  it('keeps the language prefix on web', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    window.history.pushState({}, '', '/de/')
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: `${location.origin}/de/` },
    })
    spy.mockRestore()
  })

  it('returns to the root when the path carries no language', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    window.history.pushState({}, '', '/')
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: `${location.origin}/` },
    })
    spy.mockRestore()
  })

  // Natywnie wracamy na App Link meuwe.eu, bo origin WebView jest nieosiągalny
  // dla przeglądarki systemowej. Ścieżek językowych tam nie ma.
  it('ignores the prefix on native', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    ;(globalThis as any).__native = true
    ;(globalThis as any).__ios = false
    window.history.pushState({}, '', '/de/')
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: 'https://meuwe.eu/' },
    })
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/supabase.test.ts -t "keeps the language prefix"`

Expected: FAIL — received `redirectTo` of `${location.origin}/`, expected `${location.origin}/de/`.

- [ ] **Step 3: Teach `authRedirectTo` about the prefix**

In `src/lib/supabase.ts`, add `langFromPath` to the imports at the top of the file:

```ts
import { langFromPath } from './i18n'
```

Then replace the body of `authRedirectTo` at lines 36-38 with:

```ts
function authRedirectTo(): string {
  if (isNativePlatform()) return `${WEB_ORIGIN}/`
  // Wejście z /de/ ma wrócić na /de/, inaczej adres przestaje być sobą: nie da
  // się go udostępnić, a ktoś bez ręcznie wybranego języka dostaje po powrocie
  // język przeglądarki. Prefiks czytamy tym samym langFromPath, którego używa
  // detectInitialLang — dwa źródła prawdy rozjechałyby się przy pierwszej zmianie.
  const lang = langFromPath(location.pathname)
  return lang ? `${location.origin}/${lang}/` : `${location.origin}/`
}
```

Leave the comment block above the function in place — it explains why the trailing slash matters and why native differs, and both still hold.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/supabase.test.ts`

Expected: PASS — including the pre-existing `db.signInApple` test, which stays green because it runs at path `/`.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx tsc -b && npx vitest run`

Expected: `tsc` silent, suite green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "Send people back to the page they signed in from

authRedirectTo returned the bare origin, so all four of /pl/, /de/, /es/
and /sl/ dropped their prefix on the way back from Google. Someone who
had not picked a language by hand then got their browser's language
instead of the one they were reading.

The prefix comes from langFromPath, the same reader detectInitialLang
uses, so there is one path table rather than two that can drift. Native
is untouched: its origin is unreachable from the system browser, which
is why it returns the meuwe.eu App Link, and it has no language paths.

Needs a wildcard redirect entry in Supabase — https://meuwe.eu/** — or
the project falls back to Site URL. Staging and production are separate
projects; both lists need checking."
```

---

## Task 4: H1 stops duplicating the tagline

**Files:**
- Modify: `src/components/landing/sections/HeroSection.tsx:34`
- Modify: `src/locales/{pl,en,de,es,sl}.ts` — add `landing.h1`
- Test: `src/locales/parity.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/locales/parity.test.ts`:

```ts
describe('landing headline', () => {
  // H1 był kopią welcome.tagline, więc ta sama treść stała na stronie dwa razy
  // i ani razu nie mówiła "mapa" ani "lokalne wydarzenia".
  it.each(Object.entries(LOCALES))('%s defines landing.h1', (_name, dict) => {
    const landing = (dict as { landing: Record<string, unknown> }).landing
    expect(typeof landing.h1).toBe('string')
    expect(landing.h1).not.toBe('')
  })

  it.each(Object.entries(LOCALES))('%s does not reuse the tagline as h1', (_name, dict) => {
    const d = dict as { landing: Record<string, unknown>; welcome: Record<string, unknown> }
    expect(d.landing.h1).not.toBe(d.welcome.tagline)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/locales/parity.test.ts`

Expected: FAIL — `expected undefined to be 'string'`, five times, because no locale defines `landing.h1`.

- [ ] **Step 3: Add the key to all five locales**

Add `h1` as the first entry inside the `landing: {` block of each file, immediately after the opening brace. These echo the titles in `scripts/seo-content.mjs` without repeating them verbatim, so heading and search snippet agree without reading as one string pasted twice.

`src/locales/pl.ts`:

```ts
    h1: 'meuwe — mapa lokalnych wydarzeń w Twojej okolicy',
```

`src/locales/en.ts`:

```ts
    h1: 'meuwe — a map of local events happening near you',
```

`src/locales/de.ts`:

```ts
    h1: 'meuwe — Karte lokaler Events in deiner Nähe',
```

`src/locales/es.ts`:

```ts
    h1: 'meuwe — mapa de eventos locales cerca de ti',
```

`src/locales/sl.ts`:

```ts
    h1: 'meuwe — zemljevid lokalnih dogodkov v tvoji okolici',
```

- [ ] **Step 4: Point the H1 at the new key**

In `src/components/landing/sections/HeroSection.tsx`, replace line 34:

```tsx
      <h1 style={srOnly}>{t('landing.h1')}</h1>
```

The H1 stays `sr-only`. The visible tagline lives in `Welcome`, which the native app shares, so rewriting it would change the mobile welcome screen in five languages for a web-only gain. The `.replace('\n', ' ')` goes with the old key — `landing.h1` carries no newline.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/locales/parity.test.ts`

Expected: PASS — 10 new assertions.

---

## Task 5: Footer headings close the outline

**Files:**
- Modify: `src/components/landing/sections/LandingFooter.tsx:23,32,40`
- Test: `src/components/landing/sections/LandingFooter.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/landing/sections/LandingFooter.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingFooter } from './LandingFooter'
import '../../../lib/i18n'

// Strona idzie H1 → H2 → H4, więc czytnik ekranu melduje poziom, którego nie ma.
describe('LandingFooter', () => {
  it('titles its columns at heading level 3', () => {
    render(<MemoryRouter><LandingFooter /></MemoryRouter>)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/landing/sections/LandingFooter.test.tsx`

Expected: FAIL — `Unable to find an accessible element with the role "heading" and level 3`.

- [ ] **Step 3: Change the three headings**

In `src/components/landing/sections/LandingFooter.tsx`, change the tags on lines 23, 32 and 40 from `h4` to `h3`, opening and closing:

```tsx
            <h3>{t('landing.footer.product')}</h3>
```

```tsx
            <h3>{t('landing.footer.company')}</h3>
```

```tsx
            <h3>{t('landing.footer.legal')}</h3>
```

- [ ] **Step 4: Retarget the stylesheet**

`src/components/landing/landing.css:159` selects the old tag. Without this the
column titles lose their styling. Change:

```css
.lp-footer-col h4 {
```

to:

```css
.lp-footer-col h3 {
```

Confirm nothing else targets it: `grep -n "h4" src/components/landing/landing.css` — expected: no output.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/landing/sections/LandingFooter.test.tsx`

Expected: PASS — 1 test.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx tsc -b && npx vitest run`

Expected: `tsc` silent, suite green.

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/sections/HeroSection.tsx src/components/landing/sections/LandingFooter.tsx src/components/landing/landing.css src/locales/pl.ts src/locales/en.ts src/locales/de.ts src/locales/es.ts src/locales/sl.ts src/locales/parity.test.ts src/components/landing/sections/LandingFooter.test.tsx
git commit -m "Give the landing a heading outline that holds together

The H1 was a hidden copy of the visible tagline, so the same words stood
on the page twice and neither instance said map or local events. It gets
its own key now, worded to match that language's title tag. It stays
hidden: the visible tagline lives in Welcome, which the native app
shares, so rewriting it would change the mobile welcome screen too.

The footer's three column titles were h4 under an h2, skipping a level
for anyone navigating by heading."
```

---

## Task 6: Delete ForWhomSection

**Files:**
- Delete: `src/components/landing/sections/ForWhomSection.tsx`

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "ForWhomSection" src/ --include="*.tsx" --include="*.ts"`

Expected: only `src/components/landing/sections/ForWhomSection.tsx` itself. It was unmounted from `Landing.tsx` in commit `9dfe28e` on 2026-06-12 and never re-added.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/landing/sections/ForWhomSection.tsx
```

- [ ] **Step 3: Verify the build still typechecks**

Run: `npx tsc -b`

Expected: silent.

---

## Task 7: Delete the orphaned translation blocks

**Files:**
- Modify: `src/locales/{pl,en,de,es,sl}.ts`

Delete two contiguous stretches from the `landing` block of each file. Line
numbers are deliberately not given: Task 4 inserts `h1` at the top of that block,
which shifts every number below it. Use the content anchors instead — the shape
is identical in all five locales, only the translated strings differ.

**Stretch A** starts at the line beginning `problem: { title:` and ends at the
`},` that closes `cta`. The line directly below that `},` is `nav: {` — if it is
anything else, the range is wrong. Between those two anchors sit `problem`,
`problem_p1`, `problem_p2`, `problem_p3`, `how: { … }`, `features: { … }` and
`cta: { … }`, and nothing else.

**Stretch B** starts at the line beginning `forWhomTitle:` and ends at the `],`
that closes the thirteen-entry `uc` array. The line directly below that `],` is
`downloadTitle:` — again, if it is anything else, the range is wrong.

Keep everything else in the `landing` block: `nav`, `footer`, `f1*`, `f2*`, `f3*`, `step1`-`step3`, `private*`, `downloadTitle`, `downloadBody`, `screenshotEventAlt`, `screenshotCreateAlt`, and the `h1` added in Task 4.

- [ ] **Step 1: Delete both stretches in all five files**

Apply the deletions above. Delete **Stretch B first** in each file — removing
Stretch A shifts everything below it.

- [ ] **Step 2: Verify the dead keys are gone**

Run: `grep -rn "problem_p1\|problem_p2\|problem_p3\|forWhomTitle\|forWhomSubtitle\|uc: \[" src/locales/`

Expected: no output.

- [ ] **Step 3: Verify the surviving keys are intact**

List what actually survived in each `landing` block rather than counting grep hits —
a count cannot tell a survivor from a lookalike elsewhere in the file. `store`
carries its own `downloadTitle` ("Miej meuwe pod ręką" in Polish), unrelated to
`landing.downloadTitle`, which is exactly the kind of collision a count hides.

```bash
for l in pl en de es sl; do
  printf "%s: " $l
  node -e "
const s=require('fs').readFileSync('src/locales/$l.ts','utf8');
const m=s.match(/\n  landing: \{([\s\S]*?)\n  \},\n/);
if(!m){console.log('NIE SPARSOWANO bloku landing');process.exit(1)}
const keys=[...m[1].matchAll(/^    ([A-Za-z0-9_]+)\s*:/gm)].map(x=>x[1]);
console.log(keys.join(' '));
"
done
```

Expected: all five print the same 22 keys, in this order:

```
h1 nav footer f1Eyebrow f1Title f1Body f2Eyebrow f2Title f2Body f3Eyebrow f3Title
f3Body step1 step2 step3 privateEyebrow privateTitle privateBody downloadTitle
downloadBody screenshotEventAlt screenshotCreateAlt
```

Any file printing a different list, or `NIE SPARSOWANO`, means a boundary was
clipped — stop and restore rather than patching forward.

- [ ] **Step 4: Verify nothing referenced them**

Run: `grep -rn "landing.problem\|landing.how\|landing.features\|landing.cta\|landing.forWhom\|landing.uc" src/ --include="*.tsx" --include="*.ts"`

Expected: no output.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc -b && npx vitest run`

Expected: `tsc` silent, suite green. `parity.test.ts` only asserts `event` keys plus the `landing.h1` checks from Task 4, so removing `landing` keys does not touch it.

---

## Task 8: Remove the react-snap config

**Files:**
- Modify: `package.json:17-25`, `package.json:69`

- [ ] **Step 1: Delete the `reactSnap` block**

Remove these lines from `package.json`, leaving the `"scripts"` block above and `"dependencies"` below intact:

```json
  "reactSnap": {
    "source": "dist",
    "renderAfterDocumentEvent": "snap-ready",
    "puppeteerArgs": [
      "--no-sandbox"
    ],
    "minifyHtml": false
  },
```

- [ ] **Step 2: Remove the dependency**

Run: `npm uninstall react-snap`

Expected: `package.json` loses the `"react-snap"` line from `devDependencies` and `package-lock.json` updates.

- [ ] **Step 3: Confirm nothing else invokes it**

Run: `grep -rn "react-snap\|reactSnap" package.json scripts/ src/ 2>/dev/null`

Expected: no output. `snap-ready` in `Landing.tsx:39` and the `hydrateRoot` branch in `main.tsx:29` stay — they cost nothing and are the two hooks a real prerender would attach to.

- [ ] **Step 4: Verify the build still produces all five language pages**

Run: `npm run build`

Expected: the vite summary, then five lines from `build-seo-pages`:

```
  en → dist/index.html
  pl → dist/pl/index.html
  de → dist/de/index.html
  es → dist/es/index.html
  sl → dist/sl/index.html
build-seo-pages: zapisano 5 wariantów językowych
```

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc -b && npx vitest run`

Expected: `tsc` silent, suite green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Clear out what the landing stopped rendering

ForWhomSection was unmounted on purpose in 9dfe28e, in the same commit
that fixed its carousel scroll — patched and pulled in one go. It has sat
unreferenced since, together with forWhomTitle, forWhomSubtitle and a
thirteen-entry uc array in five languages.

The problem, how, features and cta blocks went the same way earlier:
nothing reads them, and several are superseded duplicates of copy the
page renders under other keys.

The reactSnap config promised a prerender that never ran — no postbuild
script ever invoked it, and its bundled Chromium is version 78, which
cannot parse what Vite emits for React 19. Running it would have
overwritten dist/index.html with an empty snapshot. snap-ready and the
hydrateRoot branch stay: they are free, and they are where a real
prerender would attach."
```

---

## Task 9: Verify on staging

**Files:** none — deployment check.

- [ ] **Step 1: Push the branch**

```bash
git push origin staging
```

- [ ] **Step 2: Wait for the deploy and check the German chips**

Run:

```bash
curl -sS https://staging.meuwe-web.pages.dev/de/ >/dev/null && echo deployed
```

Then open `https://staging.meuwe-web.pages.dev/de/` and confirm the chip row under the first H2 reads **Party / Outdoor / Musik / Sport / Familie**, not `impreza / piknik / koncert / sport / rodzinne`.

- [ ] **Step 3: Check the Slovenian screenshot**

Open `https://staging.meuwe-web.pages.dev/sl/` and confirm the phone mockups show Slovenian captures.

- [ ] **Step 4: Check the Supabase redirect list before promoting to main**

**Production is already confirmed** (checked 2026-08-18): the Redirect URLs list on
project `bcfhsbnbvsuxsiwmeway` carries `https://meuwe.eu/**`, alongside `meuwe://`,
`exp://192.168.1.35:8081/--/auth`, `http://localhost:5173` and `http://localhost:5175`.
`**` spans separators, so it covers `https://meuwe.eu/de/`. Nothing to do there.

Still open: the **staging** project, `ujzmivdgibnnncmoqoyb`, is a separate project
with its own list. Open its **Auth → URL Configuration** and confirm it carries a
wildcard covering the staging origin. Without it Supabase rejects the target and
falls back to Site URL, and the sign-in check in Step 5 fails for a reason that
has nothing to do with this code.

Note for local work: the two `localhost` entries have no `/**` suffix, so they
match literally. Signing in from `http://localhost:5173/de/` will not match the
list and will land on the Site URL — production. Add `http://localhost:5173/**`
if you want to exercise this path in dev.

- [ ] **Step 5: Test sign-in from a language path on staging**

Open `https://staging.meuwe-web.pages.dev/de/`, start Google sign-in, and confirm the return lands on `/de/` with the interface still in German.
