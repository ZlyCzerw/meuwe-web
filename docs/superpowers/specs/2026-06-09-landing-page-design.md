# Landing Page Design

**Date:** 2026-06-09  
**Status:** Approved

## Goal

Replace the bare Welcome screen at `meuwe.eu` with a full marketing landing page. The existing Welcome component becomes the hero section. A separate `/blog` page shares the same nav and footer. The native Capacitor app (future) bypasses the landing entirely via `isNativePlatform()`.

---

## Design System Constraints

All landing components use **inline styles** with meuwe design tokens (`C`, `F`, `INK` from `src/lib/tokens.ts`). No Tailwind. No new CSS files.

- **Background**: `C.cream` (`#FFF6EC`) — warm off-white, never pure white
- **Cards**: `background: #fff`, `border: 2.5px solid #2D2B2A`, `borderRadius: 24`, `boxShadow: 4px 4px 0 #2D2B2A` (hard offset, no soft blur)
- **Buttons**: pill shape (`borderRadius: 999`), action color `C.primary` (`#FF7A45`), `border: 2.5px solid #2D2B2A`, `boxShadow: 0 4px 0 #2D2B2A33`
- **Typography**: `F.display` (Hanken Grotesk) for headings, `F.body` (Nunito) for body, scale 14/16/18/22/28/36/48px
- **Separators**: `borderTop: '2px solid #2D2B2A22'`
- **No gradients, no soft shadows, no pure white backgrounds**

---

## Architecture

### Routing

Add `react-router-dom`. Two routes:

```
/       → RootView  (Landing when !session, App when session exists)
/blog   → BlogPage
```

`src/main.tsx` wraps the app in `<BrowserRouter>`. `App.tsx` gains a `LandingPage` import — when `screen === 'welcome'`, renders `<LandingPage onSignIn={...} />` instead of `<Welcome onSignIn={...} />`.

### Capacitor hook (future)

`App.tsx` uses a local stub until Capacitor is installed:
```ts
// src/lib/platform.ts
export const isNativePlatform = (): boolean => {
  try { return (window as any)?.Capacitor?.isNativePlatform?.() ?? false }
  catch { return false }
}
```
When Capacitor is added, this stub is replaced with `import { Capacitor } from '@capacitor/core'`. The check in `App.tsx`:
```ts
const showLanding = screen === 'welcome' && !isNativePlatform()
```

---

## File Map

| File | Change |
|------|--------|
| `package.json` | Add `react-router-dom` |
| `src/main.tsx` | Wrap in `<BrowserRouter>`, add `<Routes>` for `/` and `/blog` |
| `src/App.tsx` | Render `<LandingPage>` instead of `<Welcome>` when `screen === 'welcome'` |
| `src/pages/Landing.tsx` | New — landing orchestrator (Nav + sections + Footer) |
| `src/pages/Blog.tsx` | New — blog page (Nav + article list + Footer) |
| `src/components/landing/LandingNav.tsx` | New — sticky nav |
| `src/components/landing/sections/HeroSection.tsx` | New — renders `<Welcome>` |
| `src/components/landing/sections/ProblemSection.tsx` | New |
| `src/components/landing/sections/HowItWorksSection.tsx` | New |
| `src/components/landing/sections/FeaturesSection.tsx` | New |
| `src/components/landing/sections/DownloadCTASection.tsx` | New |
| `src/components/landing/sections/LandingFooter.tsx` | New |
| `src/lib/renderArticle.tsx` | New — blog text renderer |
| `src/lib/platform.ts` | New — `isNativePlatform()` stub |
| `src/locales/pl.ts` | Add `landing.*` and `blog.*` keys |
| `src/locales/en.ts` | Same |
| `src/locales/de.ts` | Same |
| `src/locales/es.ts` | Same |
| `supabase/migrations/20260609_meuwe_blog.sql` | New — blog table |
| `public/sitemap.xml` | New |
| `public/robots.txt` | New |
| `index.html` | Add OG/SEO meta tags |

---

## Section 1: LandingNav

**File:** `src/components/landing/LandingNav.tsx`

Sticky header. Transparent on top → white (`#fff`) background + `borderBottom: '1.5px solid #2D2B2A22'` after scrolling 20px.

**Left:** meuwe logo (same animated letters as Welcome — `me` in `C.primary`, `u` in `C.sky`, `we` in `C.grass`, font 24px Hanken Grotesk 900). Click scrolls to top.

**Center (desktop only):** anchor links to `#how`, `#features`. When on `/` — smooth scroll via `element.scrollIntoView({ behavior: 'smooth' })`. When on `/blog` — `navigate('/', { state: { scrollTo: '#how' } })` and Landing reads `location.state.scrollTo` on mount to scroll after render (same pattern as green-twin-spark Nav).

**Right:**
- Language switcher: 4 flags/codes `PL / EN / DE / ES`, clicking calls `setLanguage(lang)` from `src/lib/i18n.ts`
- "Blog" link → `navigate('/blog')` via react-router-dom
- CTA button "Otwórz aplikację →" → scroll to `#hero`, pill shape, `C.primary` background

**Mobile:** center links hidden, hamburger (☰) opens drawer with all nav links.

---

## Section 2: HeroSection

**File:** `src/components/landing/sections/HeroSection.tsx`

Full viewport height (`height: '100dvh'`). Renders `<Welcome onSignIn={onSignIn} />` directly — no wrapper styling, Welcome fills its container naturally.

The existing Welcome component is not modified.

---

## Section 3: ProblemSection

**File:** `src/components/landing/sections/ProblemSection.tsx`

Background: `C.cream`. Padding: 80px vertical.

**Heading** (36px Hanken Grotesk 900): i18n key `landing.problem.title`  
Polish: *"Coś się dzieje. Tylko gdzie?"*

**3 problem cards** in a row (stack on mobile). Each card: white background, `border: 2.5px solid #2D2B2A`, `borderRadius: 24`, `boxShadow: 4px 4px 0 #2D2B2A`, padding 24px.

| Emoji | i18n key | PL text |
|-------|----------|---------|
| 📱 | `landing.problem.p1` | *Eventy na Facebooku wymagają konta i algorytm je chowa* |
| 📌 | `landing.problem.p2` | *Ogłoszenia na słupach nikt nie czyta* |
| 🗺️ | `landing.problem.p3` | *Nie wiesz co dzieje się 500 metrów od Ciebie* |

---

## Section 4: HowItWorksSection

**File:** `src/components/landing/sections/HowItWorksSection.tsx`

ID: `how`. Background: `#fff`. Padding: 80px vertical.

**Heading** (36px): i18n key `landing.how.title` — PL: *"Jak to działa?"*

**3 steps**, horizontal on desktop / vertical on mobile. Each step has:
- Number badge: pill `C.primary` background, white text, 32×32px, `border: 2.5px solid #2D2B2A`
- Title (22px Hanken Grotesk 800)
- Description (16px Nunito 600, `C.inkSoft`)

| # | Title key | PL title | Description key | PL description |
|---|-----------|----------|-----------------|----------------|
| 1 | `landing.how.s1.title` | *Otwórz mapę* | `landing.how.s1.desc` | *Pinezki w pobliżu pokazują co się dzieje — bez konta, bez algorytmu* |
| 2 | `landing.how.s2.title` | *Znajdź coś dla siebie* | `landing.how.s2.desc` | *Muzyka, sport, pikniki, targi — filtruj po kategorii lub przeglądaj wszystko* |
| 3 | `landing.how.s3.title` | *Dołącz lub obserwuj* | `landing.how.s3.desc` | *Zaloguj się przez Google żeby dodać własne wydarzenie lub śledzić inne* |

---

## Section 5: FeaturesSection

**File:** `src/components/landing/sections/FeaturesSection.tsx`

ID: `features`. Background: `C.cream`. Padding: 80px vertical.

**Heading** (36px): `landing.features.title` — PL: *"Wszystko czego potrzebujesz"*

**4 feature cards** in 2×2 grid (1 column on mobile). Same card style as ProblemSection.

| Icon | Title key | PL title | Desc key | PL desc |
|------|-----------|----------|----------|---------|
| 📍 | `landing.f1.title` | *Mapa na żywo* | `landing.f1.desc` | *Eventy w czasie rzeczywistym — bez odświeżania* |
| 🔒 | `landing.f2.title` | *Prywatne wydarzenia* | `landing.f2.desc` | *Stwórz event widoczny tylko dla zaproszonych* |
| 🔔 | `landing.f3.title` | *Powiadomienia push* | `landing.f3.desc` | *Obserwuj event i dostaj wiadomości gdy coś się zmieni* |
| 👤 | `landing.f4.title` | *Bez konta* | `landing.f4.desc` | *Przeglądaj mapę anonimowo. Konto potrzebne tylko żeby dodać event* |

---

## Section 6: DownloadCTASection

**File:** `src/components/landing/sections/DownloadCTASection.tsx`

Background: `#fff`. Padding: 80px vertical. Centered.

**Heading** (48px Hanken Grotesk 900): `landing.cta.title` — PL: *"Zacznij odkrywać"*

**Subtext** (18px): `landing.cta.sub` — PL: *"Dostępne w przeglądarce. Wkrótce w App Store i Google Play."*

**Buttons:**
1. "Użyj w przeglądarce →" — `C.primary` pill button, scrolls to `#hero`
2. "App Store" — disabled/grayed pill, `opacity: 0.4`, `cursor: 'not-allowed'` (placeholder)
3. "Google Play" — same disabled style

App Store / Google Play buttons become active when Capacitor is shipped. Disabled state is intentional and visible — shows roadmap.

---

## Section 7: LandingFooter

**File:** `src/components/landing/sections/LandingFooter.tsx`

Background: `#2D2B2A` (ink). Text: `#FFF6EC` (cream).

**Left:** meuwe logo in cream + copyright `© 2026 meuwe`

**Right:** links — Terms (`/terms.html`), language switcher (same as Nav)

Padding: 40px vertical.

---

## Blog Page

**File:** `src/pages/Blog.tsx`

Supabase table: `meuwe_blog` (identical structure to `GT_blog` — see migration below).

**Storage bucket:** `blog-images` (public) — image URLs stored as full public URLs in `image` column.

### Blog text renderer

**File:** `src/lib/renderArticle.tsx`

Copied logic from green-twin-spark, adapted to meuwe inline styles (no Tailwind classes):
- Paragraphs: `fontFamily: F.body, fontSize: 16, color: C.inkSoft, lineHeight: 1.7, marginBottom: 24`
- `#` → `<h3>` 28px Hanken Grotesk 800, `##` → `<h4>` 22px, `###` → `<h5>` 18px
- `**bold**` → `<strong>` with `fontWeight: 800, color: C.ink`
- `*italic*` → `<em>`
- `[label](url)` / bare URLs → `<a>` with `color: C.primary, textDecoration: 'underline'`

### Blog page layout

- `LandingNav` at top (same component)
- Header section: "Blog" label + heading + subtext
- Body: sidebar TOC (sticky on desktop, collapsible `<details>` on mobile) + article list
- Scroll-spy via `IntersectionObserver` (same logic as green-twin-spark)
- Each post: date + author + title + hero image (if present) + rendered article
- JSON-LD `BlogPosting` schema injected per post (same as green-twin-spark, URL base `https://meuwe.eu`)
- `LandingFooter` at bottom

### `meuwe_blog` table

```sql
CREATE TABLE public.meuwe_blog (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT        NOT NULL,
  image      TEXT,
  article    TEXT        NOT NULL,
  name       TEXT,
  date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category   TEXT        DEFAULT 'Article',
  lang       TEXT        DEFAULT 'pl'
);

ALTER TABLE public.meuwe_blog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog posts are publicly readable"
ON public.meuwe_blog FOR SELECT USING (true);
```

`lang` column allows filtering posts by language (pl/en/de/es). Initial blog shows all posts regardless of lang — filtering can be added later.

---

## i18n Keys

New keys added to all 4 locale files (`pl.ts`, `en.ts`, `de.ts`, `es.ts`) under `landing` and `blog` namespaces.

**Polish values** (reference):

```ts
landing: {
  problem: { title: 'Coś się dzieje. Tylko gdzie?' },
  problem_p1: 'Eventy na Facebooku wymagają konta i algorytm je chowa',
  problem_p2: 'Ogłoszenia na słupach nikt nie czyta',
  problem_p3: 'Nie wiesz co dzieje się 500 metrów od Ciebie',
  how: {
    title: 'Jak to działa?',
    s1: { title: 'Otwórz mapę', desc: 'Pinezki w pobliżu pokazują co się dzieje — bez konta, bez algorytmu' },
    s2: { title: 'Znajdź coś dla siebie', desc: 'Muzyka, sport, pikniki, targi — filtruj po kategorii lub przeglądaj wszystko' },
    s3: { title: 'Dołącz lub obserwuj', desc: 'Zaloguj się przez Google żeby dodać własne wydarzenie lub śledzić inne' },
  },
  features: {
    title: 'Wszystko czego potrzebujesz',
    f1: { title: 'Mapa na żywo', desc: 'Eventy w czasie rzeczywistym — bez odświeżania' },
    f2: { title: 'Prywatne wydarzenia', desc: 'Stwórz event widoczny tylko dla zaproszonych' },
    f3: { title: 'Powiadomienia push', desc: 'Obserwuj event i dostaj wiadomości gdy coś się zmieni' },
    f4: { title: 'Bez konta', desc: 'Przeglądaj mapę anonimowo. Konto potrzebne tylko żeby dodać event' },
  },
  cta: {
    title: 'Zacznij odkrywać',
    sub: 'Dostępne w przeglądarce. Wkrótce w App Store i Google Play.',
    openApp: 'Użyj w przeglądarce →',
    appStore: 'App Store',
    googlePlay: 'Google Play',
  },
},
blog: {
  title: 'Blog',
  subtitle: 'Aktualności, porady i historie z mapy.',
  articles: 'Artykuły',
  noPostsYet: 'Brak artykułów',
  noPostsSoon: 'Wkrótce pojawią się pierwsze wpisy.',
  loading: 'Ładowanie…',
  by: 'autor',
},
```

---

## SEO — `index.html`

Add to `<head>`:

```html
<meta name="description" content="meuwe — odkrywaj lokalne wydarzenia na mapie. Muzyka, sport, targi i pikniki w Twojej okolicy."/>
<meta property="og:title" content="meuwe — lokalne wydarzenia na mapie"/>
<meta property="og:description" content="Odkrywaj co się dzieje w pobliżu. Bez algorytmu, bez reklam."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://meuwe.eu"/>
<meta property="og:image" content="https://meuwe.eu/og-image.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="canonical" href="https://meuwe.eu"/>
```

`og-image.png` (1200×630): screenshot landingu — do przygotowania ręcznie po implementacji.

---

## `public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://meuwe.eu/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://meuwe.eu/blog</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>
```

## `public/robots.txt`

```
User-agent: *
Allow: /
Sitemap: https://meuwe.eu/sitemap.xml
```

---

## Out of Scope

- App Store / Google Play deep links — placeholders only, active after Capacitor
- Blog CMS UI — posts wstawiane przez SQL insert (Supabase dashboard)
- Framer Motion / page transition animations
- Dark mode
- Per-language blog filtering (lang column present, filtering dodawane później)
