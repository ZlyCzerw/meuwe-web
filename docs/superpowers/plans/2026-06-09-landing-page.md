# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare Welcome screen at `meuwe.eu` with a full marketing landing page (hero + 5 sections + blog), routed via react-router-dom, with native Capacitor detection stubbed.

**Architecture:** `BrowserRouter` in `main.tsx` routes `/` to `App` (which renders `LandingPage` or the existing app depending on session state + `isNativePlatform()`) and `/blog` to `BlogPage`. Landing is composed of `LandingNav` + six section components + `LandingFooter`. Blog fetches from `meuwe_blog` Supabase table and renders via a custom `renderArticle` text renderer.

**Tech Stack:** React + react-router-dom, Supabase (`supabase` client), react-i18next, Vitest + @testing-library/react, inline styles with meuwe design tokens (`C`, `F` from `src/lib/tokens.ts`)

---

## File Map

| File | Action |
|------|--------|
| `package.json` | Add `react-router-dom` |
| `src/main.tsx` | Wrap in `<BrowserRouter>`, add `<Routes>` for `/` and `/blog` |
| `src/lib/platform.ts` | Create — `isNativePlatform()` stub |
| `src/lib/renderArticle.tsx` | Create — blog markdown-like text renderer |
| `src/lib/renderArticle.test.tsx` | Create — unit tests for renderer |
| `src/locales/pl.ts` | Add `landing.*` and `blog.*` keys |
| `src/locales/en.ts` | Same, in English |
| `src/locales/de.ts` | Same, in German |
| `src/locales/es.ts` | Same, in Spanish |
| `supabase/migrations/20260609_meuwe_blog.sql` | Create — blog table + RLS |
| `src/components/landing/LandingNav.tsx` | Create — sticky nav with scroll + routing |
| `src/components/landing/sections/HeroSection.tsx` | Create — wraps `<Welcome>` |
| `src/components/landing/sections/ProblemSection.tsx` | Create |
| `src/components/landing/sections/HowItWorksSection.tsx` | Create |
| `src/components/landing/sections/FeaturesSection.tsx` | Create |
| `src/components/landing/sections/DownloadCTASection.tsx` | Create |
| `src/components/landing/sections/LandingFooter.tsx` | Create |
| `src/pages/Landing.tsx` | Create — orchestrator |
| `src/pages/Blog.tsx` | Create — blog page |
| `src/App.tsx` | Modify — render `LandingPage` instead of `Welcome` for `screen === 'welcome'` |
| `index.html` | Add SEO/OG meta tags |
| `public/sitemap.xml` | Create |
| `public/robots.txt` | Create |

---

### Task 1: Add react-router-dom

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

Expected: `react-router-dom` added to `package.json` dependencies.

- [ ] **Step 2: Read current main.tsx**

```bash
cat src/main.tsx
```

- [ ] **Step 3: Update main.tsx with BrowserRouter + Routes**

Replace the entire `src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './lib/i18n'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/blog" element={<div id="blog-placeholder" />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```

Note: `/blog` route has a placeholder — `Blog` component is wired in Task 9.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors. If react-router-dom types are missing: `npm install --save-dev @types/react-router-dom` (not needed — v6 ships its own types).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "feat(landing): add react-router-dom, wrap app in BrowserRouter"
```

---

### Task 2: `src/lib/platform.ts` — isNativePlatform stub

**Files:**
- Create: `src/lib/platform.ts`

No test needed — this is a one-line stub that reads a runtime global. When Capacitor is installed, this file is replaced with `import { Capacitor } from '@capacitor/core'`.

- [ ] **Step 1: Create the file**

```ts
// src/lib/platform.ts
export const isNativePlatform = (): boolean => {
  try { return (window as any)?.Capacitor?.isNativePlatform?.() ?? false }
  catch { return false }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/platform.ts
git commit -m "feat(landing): add isNativePlatform stub for Capacitor detection"
```

---

### Task 3: `src/lib/renderArticle.tsx` — blog text renderer

**Files:**
- Create: `src/lib/renderArticle.tsx`
- Create: `src/lib/renderArticle.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/lib/renderArticle.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderArticle, renderInline } from './renderArticle'

describe('renderArticle', () => {
  it('renders a paragraph', () => {
    render(<>{renderArticle('Hello world')}</>)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders # as h3', () => {
    render(<>{renderArticle('# Big title')}</>)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Big title')
  })

  it('renders ## as h4', () => {
    render(<>{renderArticle('## Sub title')}</>)
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Sub title')
  })

  it('renders ### as h5', () => {
    render(<>{renderArticle('### Minor title')}</>)
    expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent('Minor title')
  })

  it('renders blank line as paragraph break', () => {
    render(<>{renderArticle('Para one\n\nPara two')}</>)
    expect(screen.getByText('Para one')).toBeInTheDocument()
    expect(screen.getByText('Para two')).toBeInTheDocument()
  })
})

describe('renderInline', () => {
  it('renders **bold** as strong', () => {
    render(<>{renderInline('say **hello** now')}</>)
    expect(screen.getByText('hello').tagName).toBe('STRONG')
  })

  it('renders *italic* as em', () => {
    render(<>{renderInline('say *hello* now')}</>)
    expect(screen.getByText('hello').tagName).toBe('EM')
  })

  it('renders [label](url) as anchor', () => {
    render(<>{renderInline('[meuwe](https://meuwe.eu)')}</>)
    const link = screen.getByRole('link', { name: 'meuwe' })
    expect(link).toHaveAttribute('href', 'https://meuwe.eu')
  })

  it('renders bare https URL as anchor', () => {
    render(<>{renderInline('visit https://meuwe.eu for more')}</>)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://meuwe.eu')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/renderArticle.test.tsx
```

Expected: FAIL — `Cannot find module './renderArticle'`

- [ ] **Step 3: Implement renderArticle.tsx**

Create `src/lib/renderArticle.tsx`:

```tsx
import type { CSSProperties } from 'react'
import { C, F } from './tokens'

const paraStyle: CSSProperties = { fontFamily: F.body, fontSize: 16, color: C.inkSoft, lineHeight: 1.7, marginBottom: 24 }
const h3Style: CSSProperties  = { fontFamily: F.display, fontSize: 28, fontWeight: 800, color: C.ink, marginBottom: 16, marginTop: 32 }
const h4Style: CSSProperties  = { fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 12, marginTop: 24 }
const h5Style: CSSProperties  = { fontFamily: F.display, fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8,  marginTop: 20 }
const linkStyle: CSSProperties = { color: C.primary, textDecoration: 'underline' }

// Inline: **bold**, *italic*, [label](url), bare https://...
export function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/\S+)/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) parts.push(<strong key={i} style={{ fontWeight: 800, color: C.ink }}>{m[1]}</strong>)
    else if (m[2] !== undefined) parts.push(<em key={i}>{m[2]}</em>)
    else if (m[3] !== undefined) parts.push(<a key={i} href={m[4]} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m[3]}</a>)
    else if (m[5] !== undefined) parts.push(<a key={i} href={m[5]} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m[5]}</a>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function renderArticle(markdown: string): React.ReactNode {
  const blocks = markdown.split(/\n\n+/)
  return blocks.map((block, idx) => {
    const line = block.trim()
    if (line.startsWith('### ')) return <h5 key={idx} style={h5Style}>{renderInline(line.slice(4))}</h5>
    if (line.startsWith('## '))  return <h4 key={idx} style={h4Style}>{renderInline(line.slice(3))}</h4>
    if (line.startsWith('# '))   return <h3 key={idx} style={h3Style}>{renderInline(line.slice(2))}</h3>
    return <p key={idx} style={paraStyle}>{renderInline(line)}</p>
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/renderArticle.test.tsx
```

Expected: all 9 tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/renderArticle.tsx src/lib/renderArticle.test.tsx
git commit -m "feat(landing): add renderArticle blog text renderer with tests"
```

---

### Task 4: i18n — add landing and blog keys to all 4 locales

**Files:**
- Modify: `src/locales/pl.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/de.ts`
- Modify: `src/locales/es.ts`

The `Resources` type is derived from `pl.ts` via `export type Resources = typeof pl`. All other locales import that type and TypeScript enforces they match the shape. Adding keys to `pl.ts` makes the type stricter — other locales will have compile errors until you add matching keys.

- [ ] **Step 1: Add keys to pl.ts**

Find the last line of the `pl` object (before `export default pl`) and add after the `follow` key and before the closing `}`:

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
    nav: { openApp: 'Otwórz aplikację' },
    footer: { terms: 'Regulamin' },
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

- [ ] **Step 2: Add keys to en.ts**

Add after the last key (before the closing `}`):

```ts
  landing: {
    problem: { title: 'Something is happening. But where?' },
    problem_p1: 'Facebook events require an account and the algorithm buries them',
    problem_p2: 'Nobody reads flyers on poles',
    problem_p3: "You don't know what's happening 500 metres from you",
    how: {
      title: 'How does it work?',
      s1: { title: 'Open the map', desc: "Nearby pins show what's going on — no account, no algorithm" },
      s2: { title: 'Find something for you', desc: 'Music, sport, picnics, fairs — filter by category or browse everything' },
      s3: { title: 'Join or follow', desc: 'Sign in with Google to add your own event or track others' },
    },
    features: {
      title: 'Everything you need',
      f1: { title: 'Live map', desc: 'Events in real time — no refreshing' },
      f2: { title: 'Private events', desc: 'Create an event visible only to people with the link' },
      f3: { title: 'Push notifications', desc: 'Follow an event and get notified when something changes' },
      f4: { title: 'No account required', desc: 'Browse the map anonymously. Account needed only to add an event' },
    },
    cta: {
      title: 'Start discovering',
      sub: 'Available in browser. Coming soon to App Store and Google Play.',
      openApp: 'Use in browser →',
      appStore: 'App Store',
      googlePlay: 'Google Play',
    },
    nav: { openApp: 'Open app' },
    footer: { terms: 'Terms' },
  },
  blog: {
    title: 'Blog',
    subtitle: 'News, tips and stories from the map.',
    articles: 'Articles',
    noPostsYet: 'No articles yet',
    noPostsSoon: 'First posts coming soon.',
    loading: 'Loading…',
    by: 'by',
  },
```

- [ ] **Step 3: Add keys to de.ts**

```ts
  landing: {
    problem: { title: 'Etwas passiert. Aber wo?' },
    problem_p1: 'Facebook-Events erfordern ein Konto und der Algorithmus versteckt sie',
    problem_p2: 'Niemand liest Aushänge an Litfaßsäulen',
    problem_p3: 'Du weißt nicht, was 500 Meter von dir passiert',
    how: {
      title: 'Wie funktioniert es?',
      s1: { title: 'Karte öffnen', desc: 'Pins in der Nähe zeigen, was los ist — kein Konto, kein Algorithmus' },
      s2: { title: 'Etwas für dich finden', desc: 'Musik, Sport, Picknicks, Märkte — nach Kategorie filtern oder alles durchsuchen' },
      s3: { title: 'Mitmachen oder folgen', desc: 'Mit Google anmelden, um eigene Events hinzuzufügen oder andere zu verfolgen' },
    },
    features: {
      title: 'Alles, was du brauchst',
      f1: { title: 'Live-Karte', desc: 'Events in Echtzeit — ohne Aktualisierung' },
      f2: { title: 'Private Events', desc: 'Erstelle ein Event, das nur für eingeladene Personen sichtbar ist' },
      f3: { title: 'Push-Benachrichtigungen', desc: 'Event verfolgen und benachrichtigt werden, wenn sich etwas ändert' },
      f4: { title: 'Kein Konto nötig', desc: 'Karte anonym durchsuchen. Konto nur zum Hinzufügen von Events nötig' },
    },
    cta: {
      title: 'Entdecke los',
      sub: 'Im Browser verfügbar. Bald im App Store und Google Play.',
      openApp: 'Im Browser öffnen →',
      appStore: 'App Store',
      googlePlay: 'Google Play',
    },
    nav: { openApp: 'App öffnen' },
    footer: { terms: 'Nutzungsbedingungen' },
  },
  blog: {
    title: 'Blog',
    subtitle: 'Neuigkeiten, Tipps und Geschichten von der Karte.',
    articles: 'Artikel',
    noPostsYet: 'Noch keine Artikel',
    noPostsSoon: 'Die ersten Beiträge kommen bald.',
    loading: 'Laden…',
    by: 'von',
  },
```

- [ ] **Step 4: Add keys to es.ts**

```ts
  landing: {
    problem: { title: '¿Algo está pasando. Pero dónde?' },
    problem_p1: 'Los eventos de Facebook requieren cuenta y el algoritmo los oculta',
    problem_p2: 'Nadie lee los carteles en los postes',
    problem_p3: 'No sabes qué pasa a 500 metros de ti',
    how: {
      title: '¿Cómo funciona?',
      s1: { title: 'Abre el mapa', desc: 'Los pins cercanos muestran qué está pasando — sin cuenta, sin algoritmo' },
      s2: { title: 'Encuentra algo para ti', desc: 'Música, deporte, picnics, mercados — filtra por categoría o explora todo' },
      s3: { title: 'Únete o sigue', desc: 'Inicia sesión con Google para añadir tu propio evento o seguir otros' },
    },
    features: {
      title: 'Todo lo que necesitas',
      f1: { title: 'Mapa en vivo', desc: 'Eventos en tiempo real — sin actualizar' },
      f2: { title: 'Eventos privados', desc: 'Crea un evento visible solo para personas con el enlace' },
      f3: { title: 'Notificaciones push', desc: 'Sigue un evento y recibe avisos cuando algo cambie' },
      f4: { title: 'Sin cuenta', desc: 'Explora el mapa de forma anónima. Cuenta necesaria solo para añadir eventos' },
    },
    cta: {
      title: 'Empieza a descubrir',
      sub: 'Disponible en el navegador. Próximamente en App Store y Google Play.',
      openApp: 'Usar en el navegador →',
      appStore: 'App Store',
      googlePlay: 'Google Play',
    },
    nav: { openApp: 'Abrir app' },
    footer: { terms: 'Términos' },
  },
  blog: {
    title: 'Blog',
    subtitle: 'Noticias, consejos e historias del mapa.',
    articles: 'Artículos',
    noPostsYet: 'Sin artículos todavía',
    noPostsSoon: 'Los primeros artículos llegan pronto.',
    loading: 'Cargando…',
    by: 'por',
  },
```

- [ ] **Step 5: TypeScript check — verifies all 4 locales match the Resources type**

```bash
npx tsc -b
```

Expected: no errors. TypeScript will error if any locale is missing a key.

- [ ] **Step 6: Run existing i18n tests**

```bash
npx vitest run src/lib/i18n.test.ts
```

Expected: all tests PASS (adding keys doesn't break existing behaviour).

- [ ] **Step 7: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/de.ts src/locales/es.ts
git commit -m "feat(landing): add landing and blog i18n keys for all 4 locales"
```

---

### Task 5: Supabase migration — meuwe_blog table

**Files:**
- Create: `supabase/migrations/20260609_meuwe_blog.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260609_meuwe_blog.sql
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

- [ ] **Step 2: Apply to staging**

```bash
bash scripts/deploy-staging.sh
```

This links to staging, runs `supabase db push --linked` (which applies the new migration), deploys edge functions, and relinks to production.

Expected output ends with: `==> Done. Staging is up to date.`

Verify in Supabase dashboard that `meuwe_blog` table exists on staging project `ujzmivdgibnnncmoqoyb`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609_meuwe_blog.sql
git commit -m "feat(landing): add meuwe_blog table migration with public RLS policy"
```

---

### Task 6: LandingNav component

**Files:**
- Create: `src/components/landing/LandingNav.tsx`

- [ ] **Step 1: Read tokens.ts to confirm available token names**

```bash
grep -E "^export|primary|cream|ink|sky|grass" src/lib/tokens.ts | head -20
```

- [ ] **Step 2: Create LandingNav.tsx**

```tsx
// src/components/landing/LandingNav.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { C, F } from '../../lib/tokens'
import { setLanguage } from '../../lib/i18n'
import type { Lang } from '../../lib/types'

const LANGS: Lang[] = ['pl', 'en', 'de', 'es']

function MeuweLogo({ cream = false }: { cream?: boolean }) {
  const base: React.CSSProperties = { fontFamily: F.display, fontSize: 24, fontWeight: 900, letterSpacing: -1, cursor: 'pointer', userSelect: 'none' }
  return (
    <span style={base}>
      <span style={{ color: cream ? C.cream : C.primary }}>me</span>
      <span style={{ color: cream ? C.cream : C.sky }}>u</span>
      <span style={{ color: cream ? C.cream : C.grass }}>we</span>
    </span>
  )
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingNav() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const onBlog = location.pathname === '/blog'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleNav(anchor: string) {
    setMenuOpen(false)
    if (onBlog) {
      navigate('/', { state: { scrollTo: anchor } })
    } else {
      scrollTo(anchor)
    }
  }

  const nav: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 60,
    background: scrolled ? '#fff' : 'transparent',
    borderBottom: scrolled ? '1.5px solid #2D2B2A22' : 'none',
    transition: 'background 0.2s, border-color 0.2s',
  }
  const link: React.CSSProperties = { fontFamily: F.body, fontSize: 15, fontWeight: 700, color: C.ink, cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px' }
  const ctaBtn: React.CSSProperties = {
    fontFamily: F.body, fontSize: 14, fontWeight: 800, color: '#fff',
    background: C.primary, border: `2px solid ${C.ink}`, borderRadius: 999,
    padding: '8px 16px', cursor: 'pointer', boxShadow: `0 4px 0 ${C.ink}33`,
  }
  const langBtn = (active: boolean): React.CSSProperties => ({
    fontFamily: F.body, fontSize: 12, fontWeight: active ? 800 : 600,
    color: active ? C.primary : C.inkSoft,
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
    textTransform: 'uppercase',
  })

  return (
    <nav style={nav}>
      <span onClick={() => handleNav('hero')}>
        <MeuweLogo />
      </span>

      {/* Desktop center links */}
      <span style={{ display: 'flex', gap: 8, '@media(max-width:640px)': { display: 'none' } } as React.CSSProperties}>
        <button style={link} onClick={() => handleNav('how')}>{t('landing.how.title')}</button>
        <button style={link} onClick={() => handleNav('features')}>{t('landing.features.title')}</button>
        <button style={link} onClick={() => { setMenuOpen(false); navigate('/blog') }}>Blog</button>
      </span>

      {/* Desktop right: lang + CTA */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', gap: 2 }}>
          {LANGS.map(l => (
            <button key={l} style={langBtn(i18n.language === l)} onClick={() => setLanguage(l)}>{l}</button>
          ))}
        </span>
        <button style={ctaBtn} onClick={() => handleNav('hero')}>{t('landing.nav.openApp')}</button>

        {/* Mobile hamburger */}
        <button
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '4px 0' }}
          onClick={() => setMenuOpen(m => !m)}
          aria-label="Menu"
        >☰</button>
      </span>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0,
          background: '#fff', borderBottom: `2px solid ${C.ink}`,
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: `0 4px 0 ${C.ink}22`,
        }}>
          <button style={link} onClick={() => handleNav('how')}>{t('landing.how.title')}</button>
          <button style={link} onClick={() => handleNav('features')}>{t('landing.features.title')}</button>
          <button style={link} onClick={() => { setMenuOpen(false); navigate('/blog') }}>Blog</button>
          <button style={ctaBtn} onClick={() => handleNav('hero')}>{t('landing.nav.openApp')}</button>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/LandingNav.tsx
git commit -m "feat(landing): add LandingNav with scroll, routing, lang switcher"
```

---

### Task 7: Landing section components

**Files:**
- Create: `src/components/landing/sections/HeroSection.tsx`
- Create: `src/components/landing/sections/ProblemSection.tsx`
- Create: `src/components/landing/sections/HowItWorksSection.tsx`
- Create: `src/components/landing/sections/FeaturesSection.tsx`
- Create: `src/components/landing/sections/DownloadCTASection.tsx`
- Create: `src/components/landing/sections/LandingFooter.tsx`

First check what Welcome's `onSignIn` prop type looks like:

```bash
grep "onSignIn" src/components/Welcome.tsx | head -5
```

It accepts `(mode: 'google' | 'skip') => void`.

- [ ] **Step 1: Create HeroSection.tsx**

```tsx
// src/components/landing/sections/HeroSection.tsx
import Welcome from '../../Welcome'

interface Props {
  onSignIn: (mode: 'google' | 'skip') => void
}

export function HeroSection({ onSignIn }: Props) {
  return (
    <section id="hero" style={{ height: '100dvh' }}>
      <Welcome onSignIn={onSignIn} />
    </section>
  )
}
```

- [ ] **Step 2: Create ProblemSection.tsx**

```tsx
// src/components/landing/sections/ProblemSection.tsx
import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

const PROBLEMS = [
  { emoji: '📱', key: 'landing.problem_p1' as const },
  { emoji: '📌', key: 'landing.problem_p2' as const },
  { emoji: '🗺️', key: 'landing.problem_p3' as const },
]

export function ProblemSection() {
  const { t } = useTranslation()
  return (
    <section style={{ background: C.cream, padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 48 }}>
          {t('landing.problem.title')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {PROBLEMS.map(({ emoji, key }) => (
            <div key={key} style={{
              background: '#fff', border: `2.5px solid ${C.ink}`, borderRadius: 24,
              boxShadow: `4px 4px 0 ${C.ink}`, padding: 24,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{emoji}</div>
              <p style={{ fontFamily: F.body, fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.5, margin: 0 }}>
                {t(key)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create HowItWorksSection.tsx**

```tsx
// src/components/landing/sections/HowItWorksSection.tsx
import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

const STEPS = [
  { n: 1, titleKey: 'landing.how.s1.title' as const, descKey: 'landing.how.s1.desc' as const },
  { n: 2, titleKey: 'landing.how.s2.title' as const, descKey: 'landing.how.s2.desc' as const },
  { n: 3, titleKey: 'landing.how.s3.title' as const, descKey: 'landing.how.s3.desc' as const },
]

export function HowItWorksSection() {
  const { t } = useTranslation()
  return (
    <section id="how" style={{ background: '#fff', padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 48 }}>
          {t('landing.how.title')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
          {STEPS.map(({ n, titleKey, descKey }) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 999,
                background: C.primary, color: '#fff',
                fontFamily: F.display, fontWeight: 900, fontSize: 16,
                border: `2.5px solid ${C.ink}`,
              }}>{n}</span>
              <h3 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.ink, margin: 0 }}>{t(titleKey)}</h3>
              <p style={{ fontFamily: F.body, fontSize: 16, fontWeight: 600, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create FeaturesSection.tsx**

```tsx
// src/components/landing/sections/FeaturesSection.tsx
import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

const FEATURES = [
  { icon: '📍', titleKey: 'landing.features.f1.title' as const, descKey: 'landing.features.f1.desc' as const },
  { icon: '🔒', titleKey: 'landing.features.f2.title' as const, descKey: 'landing.features.f2.desc' as const },
  { icon: '🔔', titleKey: 'landing.features.f3.title' as const, descKey: 'landing.features.f3.desc' as const },
  { icon: '👤', titleKey: 'landing.features.f4.title' as const, descKey: 'landing.features.f4.desc' as const },
]

export function FeaturesSection() {
  const { t } = useTranslation()
  return (
    <section id="features" style={{ background: C.cream, padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 48 }}>
          {t('landing.features.title')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {FEATURES.map(({ icon, titleKey, descKey }) => (
            <div key={titleKey} style={{
              background: '#fff', border: `2.5px solid ${C.ink}`, borderRadius: 24,
              boxShadow: `4px 4px 0 ${C.ink}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 36 }}>{icon}</div>
              <h3 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.ink, margin: 0 }}>{t(titleKey)}</h3>
              <p style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create DownloadCTASection.tsx**

```tsx
// src/components/landing/sections/DownloadCTASection.tsx
import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

interface Props { onOpenApp: () => void }

export function DownloadCTASection({ onOpenApp }: Props) {
  const { t } = useTranslation()
  const btn = (disabled?: boolean): React.CSSProperties => ({
    fontFamily: F.body, fontSize: 16, fontWeight: 800,
    color: disabled ? C.inkSoft : '#fff',
    background: disabled ? '#e0dbd5' : C.primary,
    border: `2.5px solid ${disabled ? '#c0bbb5' : C.ink}`,
    borderRadius: 999, padding: '14px 28px', cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : `0 4px 0 ${C.ink}33`,
    opacity: disabled ? 0.4 : 1,
  })
  return (
    <section style={{ background: '#fff', padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 48, fontWeight: 900, color: C.ink, marginBottom: 16 }}>
          {t('landing.cta.title')}
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 18, color: C.inkSoft, marginBottom: 40 }}>
          {t('landing.cta.sub')}
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={btn()} onClick={onOpenApp}>{t('landing.cta.openApp')}</button>
          <button style={btn(true)} disabled>{t('landing.cta.appStore')}</button>
          <button style={btn(true)} disabled>{t('landing.cta.googlePlay')}</button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Create LandingFooter.tsx**

```tsx
// src/components/landing/sections/LandingFooter.tsx
import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'
import { setLanguage } from '../../../lib/i18n'
import type { Lang } from '../../../lib/types'

const LANGS: Lang[] = ['pl', 'en', 'de', 'es']

function MeuweLogo() {
  return (
    <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, letterSpacing: -1, color: C.cream }}>
      meuwe
    </span>
  )
}

export function LandingFooter() {
  const { t, i18n } = useTranslation()
  return (
    <footer style={{ background: C.ink, padding: '40px 24px', borderTop: `2px solid #ffffff22` }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <MeuweLogo />
          <span style={{ fontFamily: F.body, fontSize: 13, color: `${C.cream}99` }}>© 2026 meuwe</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/terms.html" style={{ fontFamily: F.body, fontSize: 13, color: `${C.cream}cc`, textDecoration: 'none' }}>
            {t('landing.footer.terms')}
          </a>
          <span style={{ display: 'flex', gap: 4 }}>
            {LANGS.map(l => (
              <button key={l} onClick={() => setLanguage(l)} style={{
                fontFamily: F.body, fontSize: 11, fontWeight: i18n.language === l ? 800 : 500,
                color: i18n.language === l ? C.cream : `${C.cream}66`,
                background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', padding: '2px 4px',
              }}>{l}</button>
            ))}
          </span>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/landing/
git commit -m "feat(landing): add LandingNav and all 6 section components"
```

---

### Task 8: Landing.tsx orchestrator + wire into App.tsx

**Files:**
- Create: `src/pages/Landing.tsx`
- Modify: `src/App.tsx` (line where `screen === 'welcome'` is handled)

- [ ] **Step 1: Create Landing.tsx**

```tsx
// src/pages/Landing.tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LandingNav } from '../components/landing/LandingNav'
import { HeroSection } from '../components/landing/sections/HeroSection'
import { ProblemSection } from '../components/landing/sections/ProblemSection'
import { HowItWorksSection } from '../components/landing/sections/HowItWorksSection'
import { FeaturesSection } from '../components/landing/sections/FeaturesSection'
import { DownloadCTASection } from '../components/landing/sections/DownloadCTASection'
import { LandingFooter } from '../components/landing/sections/LandingFooter'

interface Props {
  onSignIn: (mode: 'google' | 'skip') => void
}

export function Landing({ onSignIn }: Props) {
  const location = useLocation()

  // Handle navigate('/', { state: { scrollTo: '#how' } }) from Blog nav
  useEffect(() => {
    const anchor = (location.state as any)?.scrollTo as string | undefined
    if (!anchor) return
    const id = anchor.replace('#', '')
    const el = document.getElementById(id)
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [location.state])

  function openApp() {
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ overflowX: 'hidden' }}>
      <LandingNav />
      <HeroSection onSignIn={onSignIn} />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <DownloadCTASection onOpenApp={openApp} />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 2: Find the welcome screen render in App.tsx**

```bash
grep -n "screen === 'welcome'" src/App.tsx
```

This will show the line number. It looks like:

```tsx
if (screen === 'welcome') return (
  <Welcome onSignIn={mode => {
    if (mode === 'skip') { goToMap(); return }
    if (deepLinkIdRef.current) sessionStorage.setItem('pending_event', deepLinkIdRef.current)
    db.signInGoogle()
  }} />
)
```

- [ ] **Step 3: Add imports at the top of App.tsx**

Find the import section and add after the last import:

```ts
import { isNativePlatform } from './lib/platform'
import { Landing } from './pages/Landing'
```

- [ ] **Step 4: Replace the welcome block in App.tsx**

Replace the block found in Step 2 with:

```tsx
if (screen === 'welcome') {
  const signIn = (mode: 'google' | 'skip') => {
    if (mode === 'skip') { goToMap(); return }
    if (deepLinkIdRef.current) sessionStorage.setItem('pending_event', deepLinkIdRef.current)
    db.signInGoogle()
  }
  if (isNativePlatform()) return <Welcome onSignIn={signIn} />
  return <Landing onSignIn={signIn} />
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173` in browser. Expected:
- Landing page displays with sticky nav, hero (Welcome component), all 5 sections, and footer
- Clicking "Otwórz aplikację" scrolls to hero
- Clicking section nav links scrolls smoothly
- Language switcher updates the language
- `http://localhost:5173/blog` shows the placeholder div (no crash)

Stop server when verified.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Landing.tsx src/App.tsx
git commit -m "feat(landing): add Landing orchestrator, wire into App.tsx with native detection"
```

---

### Task 9: Blog.tsx page + wire into main.tsx

**Files:**
- Create: `src/pages/Blog.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Check supabase export to confirm client name**

```bash
grep "^export const supabase" src/lib/supabase.ts
```

Expected: `export const supabase = createClient(...)`

- [ ] **Step 2: Create Blog.tsx**

```tsx
// src/pages/Blog.tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LandingNav } from '../components/landing/LandingNav'
import { LandingFooter } from '../components/landing/sections/LandingFooter'
import { renderArticle } from '../lib/renderArticle'
import { supabase } from '../lib/supabase'
import { C, F } from '../lib/tokens'

interface BlogPost {
  id: string
  title: string
  image: string | null
  article: string
  name: string | null
  date: string
  category: string
  lang: string
}

function slugify(title: string) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 60)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Blog() {
  const { t } = useTranslation()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const articleRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    supabase
      .from('meuwe_blog')
      .select('id,title,image,article,name,date,category,lang')
      .order('date', { ascending: false })
      .then(({ data }) => {
        setPosts((data ?? []) as BlogPost[])
        setLoading(false)
      })
  }, [])

  // Scroll-spy
  useEffect(() => {
    if (posts.length === 0) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id) })
    }, { rootMargin: '-20% 0px -60% 0px' })
    Object.values(articleRefs.current).forEach(el => { if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [posts])

  // JSON-LD for each post
  useEffect(() => {
    posts.forEach(post => {
      const id = `jsonld-${post.id}`
      if (document.getElementById(id)) return
      const script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        datePublished: post.date,
        author: { '@type': 'Person', name: post.name ?? 'meuwe' },
        url: `https://meuwe.eu/blog#${slugify(post.title)}`,
        ...(post.image ? { image: post.image } : {}),
      })
      document.head.appendChild(script)
    })
  }, [posts])

  const sidebarLink = (post: BlogPost): React.CSSProperties => ({
    fontFamily: F.body, fontSize: 14, fontWeight: activeId === post.id ? 800 : 500,
    color: activeId === post.id ? C.primary : C.inkSoft,
    textDecoration: 'none', display: 'block', padding: '4px 0',
    borderLeft: `3px solid ${activeId === post.id ? C.primary : 'transparent'}`,
    paddingLeft: 10, lineHeight: 1.4, cursor: 'pointer', background: 'none', border: 'none',
  })

  return (
    <div style={{ background: C.cream, minHeight: '100dvh' }}>
      <LandingNav />

      {/* Header */}
      <div style={{ paddingTop: 80, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, background: '#fff', borderBottom: `2px solid ${C.ink}22` }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('blog.articles')}
          </span>
          <h1 style={{ fontFamily: F.display, fontSize: 48, fontWeight: 900, color: C.ink, margin: '8px 0 12px' }}>
            {t('blog.title')}
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 18, color: C.inkSoft, margin: 0 }}>
            {t('blog.subtitle')}
          </p>
        </div>
      </div>

      {/* Body: sidebar + articles */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>

        {/* Sidebar TOC — sticky on desktop */}
        {posts.length > 0 && (
          <aside style={{
            flexShrink: 0, width: 220,
            position: 'sticky', top: 80,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <p style={{ fontFamily: F.body, fontSize: 12, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {t('blog.articles')}
            </p>
            {posts.map(post => (
              <button
                key={post.id}
                style={sidebarLink(post)}
                onClick={() => document.getElementById(post.id)?.scrollIntoView({ behavior: 'smooth' })}
              >
                {post.title}
              </button>
            ))}
          </aside>
        )}

        {/* Articles */}
        <div style={{ flex: 1 }}>
          {loading && (
            <p style={{ fontFamily: F.body, color: C.inkSoft }}>{t('blog.loading')}</p>
          )}
          {!loading && posts.length === 0 && (
            <div style={{
              background: '#fff', border: `2.5px solid ${C.ink}`, borderRadius: 24,
              boxShadow: `4px 4px 0 ${C.ink}`, padding: 40, textAlign: 'center',
            }}>
              <p style={{ fontFamily: F.display, fontSize: 24, fontWeight: 800, color: C.ink, marginBottom: 8 }}>
                {t('blog.noPostsYet')}
              </p>
              <p style={{ fontFamily: F.body, color: C.inkSoft }}>
                {t('blog.noPostsSoon')}
              </p>
            </div>
          )}
          {posts.map((post, i) => (
            <article
              key={post.id}
              id={post.id}
              ref={el => { articleRefs.current[post.id] = el }}
              style={{
                background: '#fff', border: `2.5px solid ${C.ink}`, borderRadius: 24,
                boxShadow: `4px 4px 0 ${C.ink}`, padding: '32px 32px',
                marginBottom: i < posts.length - 1 ? 40 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: F.body, fontSize: 13, color: C.inkSoft }}>{formatDate(post.date)}</span>
                {post.name && (
                  <span style={{ fontFamily: F.body, fontSize: 13, color: C.inkSoft }}>
                    · {t('blog.by')} {post.name}
                  </span>
                )}
                <span style={{
                  fontFamily: F.body, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                  color: C.primary, background: `${C.primary}18`, borderRadius: 999, padding: '2px 10px',
                }}>{post.category}</span>
              </div>
              <h2 style={{ fontFamily: F.display, fontSize: 28, fontWeight: 900, color: C.ink, marginBottom: 20, marginTop: 0 }}>
                {post.title}
              </h2>
              {post.image && (
                <img
                  src={post.image}
                  alt={post.title}
                  style={{ width: '100%', borderRadius: 16, border: `2px solid ${C.ink}22`, marginBottom: 24, objectFit: 'cover', maxHeight: 400 }}
                />
              )}
              <div>{renderArticle(post.article)}</div>
            </article>
          ))}
        </div>
      </div>

      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 3: Update main.tsx to wire in Blog**

Replace the `/blog` placeholder route:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './lib/i18n'
import App from './App'
import Blog from './pages/Blog'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/blog" element={<Blog />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify blog page**

```bash
npm run dev
```

Open `http://localhost:5173/blog`. Expected:
- Nav, header with "Blog" title, empty state card ("Brak artykułów" / "Wkrótce pojawią się pierwsze wpisy."), footer
- No console errors

Stop server when verified.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Blog.tsx src/main.tsx
git commit -m "feat(landing): add Blog page with TOC sidebar, scroll-spy, and JSON-LD schema"
```

---

### Task 10: SEO — meta tags, sitemap, robots.txt

**Files:**
- Modify: `index.html`
- Create: `public/sitemap.xml`
- Create: `public/robots.txt`

- [ ] **Step 1: Add OG/SEO meta tags to index.html**

Inside `<head>`, after the `<title>meuwe</title>` line, add:

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

- [ ] **Step 2: Create public/sitemap.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://meuwe.eu/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://meuwe.eu/blog</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>
```

- [ ] **Step 3: Create public/robots.txt**

```
User-agent: *
Allow: /
Sitemap: https://meuwe.eu/sitemap.xml
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add index.html public/sitemap.xml public/robots.txt
git commit -m "feat(landing): add SEO meta tags, OG tags, sitemap.xml and robots.txt"
```

---

## Final Smoke Test

After all tasks are complete:

1. `npm run dev` → open `http://localhost:5173`
2. Check landing page:
   - Nav is sticky, logo visible
   - Hero section (Welcome component) fills viewport
   - Scroll down → Problem, HowItWorks, Features, CTA, Footer sections visible
   - "Użyj w przeglądarce →" button scrolls to hero
   - App Store / Google Play buttons are visibly disabled
   - Language switcher works (text changes language)
3. Check nav link scroll: click "Jak to działa?" → smooth scroll to HowItWorks section
4. Click "Blog" in nav → navigates to `/blog`
5. On `/blog`: click "Jak to działa?" in nav → navigates to `/` and scrolls to `#how`
6. Signing in from Welcome: behaves as before (deep link preservation intact)
7. Check `http://localhost:5173/blog` directly — no crash, empty state shown
