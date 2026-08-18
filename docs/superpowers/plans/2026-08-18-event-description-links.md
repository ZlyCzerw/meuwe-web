# Klikalne linki w opisie wydarzenia — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adresy stron w opisie wydarzenia stają się klikalnymi linkami w brandowym pomarańczu, otwieranymi w domyślnej przeglądarce urządzenia.

**Architecture:** Trzy jednostki o jednej odpowiedzialności: `links.ts` dopasowuje adresy w tekście (czysta funkcja, bez Reacta), `linkify.tsx` zamienia trafienia na `<a>`, a `truncateDescription` w `text.ts` korzysta z tego samego dopasowania, żeby podgląd nie urwał się w połowie adresu. Karta wydarzenia zmienia się w jednym miejscu: zamiast wstawiać string, wstawia wynik `linkify`.

**Tech Stack:** TypeScript, React 18, Vite, vitest + jsdom, @testing-library/react. Bez nowych zależności.

**Spec:** [2026-08-17-event-description-links-design.md](../specs/2026-08-17-event-description-links-design.md)

**Repo:** `~/meuwe-web` (nie `meuwe-event-sync`). Wszystkie komendy uruchamiaj z katalogu głównego tego repo.

---

## Struktura plików

| Plik | Odpowiedzialność |
| --- | --- |
| `src/lib/links.ts` (nowy) | Znajduje adresy w tekście. Wzorzec, obcinanie interpunkcji, dopisanie schematu. Zero Reacta. |
| `src/lib/links.test.ts` (nowy) | Testy dopasowania. |
| `src/lib/linkify.tsx` (nowy) | Zamienia tekst na listę fragmentów: stringi i `<a>`. |
| `src/lib/linkify.test.tsx` (nowy) | Testy renderu. |
| `src/lib/text.ts` (modyfikacja) | `truncateDescription` przestaje ciąć w środku adresu. |
| `src/lib/text.test.ts` (modyfikacja) | Nowe przypadki dla wydłużenia podglądu. |
| `src/screens/EventSheet.tsx` (modyfikacja) | Jedno wpięcie: opis renderowany przez `linkify`. |

`EventSheet.tsx` nie ma dziś testu jednostkowego (komponent wymaga sesji Supabase i pełnego kontekstu karty) i ten plan tego nie zmienia — wpięcie weryfikuje kompilacja typów, lint i przejście przez aplikację w trybie dev. Cała logika, którą da się przetestować, siedzi w `links.ts`, `linkify.tsx` i `text.ts`.

---

### Task 1: Dopasowywanie adresów (`links.ts`)

**Files:**
- Create: `src/lib/links.ts`
- Test: `src/lib/links.test.ts`

- [ ] **Step 1: Write the failing test**

Utwórz `src/lib/links.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findLinks } from './links'

describe('findLinks', () => {
  it('finds an address in the middle of a sentence', () => {
    const links = findLinks('Bilety na https://teatr.pl/bilety od poniedzialku.')
    expect(links).toHaveLength(1)
    expect(links[0].text).toBe('https://teatr.pl/bilety')
    expect(links[0].href).toBe('https://teatr.pl/bilety')
  })

  it('finds several addresses in one paragraph', () => {
    const links = findLinks('Strona https://teatr.pl, bilety https://bilety.pl/koncert')
    expect(links.map(l => l.text)).toEqual(['https://teatr.pl', 'https://bilety.pl/koncert'])
  })

  // Adres bez schematu jest w opisach regula, nie wyjatkiem. Tekst zostaje
  // taki, jak go napisano; schemat dokladamy wylacznie do href.
  it('gives a schemeless address an https href and leaves its text alone', () => {
    const [link] = findLinks('Szczegoly: www.teatr.pl')
    expect(link.text).toBe('www.teatr.pl')
    expect(link.href).toBe('https://www.teatr.pl')
  })

  // Kropka konczy zdanie, nie adres.
  it('leaves sentence punctuation out of the address', () => {
    expect(findLinks('Zajrzyj na www.teatr.pl.')[0].text).toBe('www.teatr.pl')
    expect(findLinks('Zajrzyj na https://teatr.pl, potem wroc')[0].text).toBe('https://teatr.pl')
    expect(findLinks('Wiecej: https://teatr.pl...')[0].text).toBe('https://teatr.pl')
  })

  // Nawias bez pary nalezy do zdania, nawias z para do adresu — URL-e z
  // nawiasami istnieja i tych ruszac nie wolno.
  it('drops an unmatched closing paren but keeps a matched one', () => {
    expect(findLinks('(szczegoly na https://teatr.pl)')[0].text).toBe('https://teatr.pl')
    expect(findLinks('https://pl.wikipedia.org/wiki/Rzeszow_(miasto)')[0].text)
      .toBe('https://pl.wikipedia.org/wiki/Rzeszow_(miasto)')
  })

  it('ignores a javascript: scheme', () => {
    expect(findLinks('javascript:alert(1)')).toEqual([])
  })

  // Po obcieciu kropek zostalby sam schemat — to nie jest adres.
  it('ignores a bare scheme with nothing behind it', () => {
    expect(findLinks('adres to https://...')).toEqual([])
  })

  it('returns nothing for text without addresses', () => {
    expect(findLinks('Koncert w parku, wstep wolny')).toEqual([])
  })

  // Na tych indeksach stoi skracanie opisu — musza wskazywac z powrotem na
  // tekst zrodlowy.
  it('reports offsets that point back at the source text', () => {
    const text = 'Bilety na https://teatr.pl juz sa'
    const [link] = findLinks(text)
    expect(text.slice(link.start, link.end)).toBe('https://teatr.pl')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/links.test.ts`
Expected: FAIL — `Failed to resolve import "./links"`.

- [ ] **Step 3: Write minimal implementation**

Utwórz `src/lib/links.ts`:

```ts
/**
 * Adresy w opisie wydarzenia — samo dopasowanie, bez Reacta.
 *
 * Osobno od renderu, bo linkow potrzebuje takze skracanie opisu (`text.ts`):
 * podglad nie moze urwac sie w polowie adresu. Gdyby wzorzec mieszkal w
 * module renderujacym, `text.ts` importowalby `.tsx` wylacznie po regex.
 */

export type LinkMatch = {
  /** Indeks pierwszego znaku adresu w tekscie zrodlowym. */
  start: number
  /** Indeks za ostatnim znakiem adresu — juz po obcieciu interpunkcji. */
  end: number
  /** Adres tak, jak stoi w opisie. */
  text: string
  /** To, co trafia do `href` — ze schematem dopisanym, jesli go brakowalo. */
  href: string
}

/** Znaki, ktore koncza zdanie, a nie adres. */
const SENTENCE_TAIL = '.,;:!?'

function count(text: string, char: string): number {
  let n = 0
  for (const c of text) if (c === char) n++
  return n
}

/**
 * Adres konczy sie tam, gdzie konczy sie adres — nie tam, gdzie konczy sie
 * zdanie. Kropka po "www.teatr.pl." nalezy do zdania, tak samo nawias
 * zamykajacy w "(szczegoly na https://teatr.pl)". Nawias, ktory ma pare w
 * samym adresie, zostaje: takie URL-e istnieja (Wikipedia).
 */
function trimSentenceTail(raw: string): string {
  let text = raw
  while (text.length > 0) {
    const last = text[text.length - 1]
    if (SENTENCE_TAIL.includes(last)) { text = text.slice(0, -1); continue }
    if (last === ')' && count(text, ')') > count(text, '(')) { text = text.slice(0, -1); continue }
    break
  }
  return text
}

/**
 * Czy po obcieciu ogona zostal jeszcze adres.
 *
 * "https://..." dopasowuje sie wzorcem, a po zdjeciu kropek zostaje sam
 * schemat prowadzacy donikad. Domena z kropka jest tu warunkiem wejscia.
 */
const COMPLETE = /^(?:https?:\/\/|www\.)[a-z0-9-]+(?:\.[a-z0-9-]+)+/i

export function findLinks(text: string): LinkMatch[] {
  /**
   * Tylko http(s) i `www.`. Nic innego nie jest w ogole dopasowywane, wiec
   * `javascript:` czy `data:` nie maja ktoredy wejsc do `href`.
   */
  const pattern = /\bhttps?:\/\/[^\s<]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<]*/gi
  const links: LinkMatch[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const found = trimSentenceTail(match[0])
    if (!COMPLETE.test(found)) continue

    links.push({
      start: match.index,
      end: match.index + found.length,
      text: found,
      href: /^https?:\/\//i.test(found) ? found : `https://${found}`,
    })
  }

  return links
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/links.test.ts`
Expected: PASS, 9 testów.

- [ ] **Step 5: Commit**

```bash
git add src/lib/links.ts src/lib/links.test.ts
git commit -m "Find the addresses hiding in a description"
```

---

### Task 2: Render linków (`linkify.tsx`)

**Files:**
- Create: `src/lib/linkify.tsx`
- Test: `src/lib/linkify.test.tsx`

- [ ] **Step 1: Write the failing test**

Utwórz `src/lib/linkify.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { linkify } from './linkify'

describe('linkify', () => {
  it('renders an address as a link that leaves the app', () => {
    render(<>{linkify('Bilety na https://teatr.pl/bilety juz sa')}</>)
    const link = screen.getByRole('link', { name: 'https://teatr.pl/bilety' })
    expect(link).toHaveAttribute('href', 'https://teatr.pl/bilety')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('sends a schemeless address to https', () => {
    render(<>{linkify('Szczegoly: www.teatr.pl')}</>)
    expect(screen.getByRole('link', { name: 'www.teatr.pl' }))
      .toHaveAttribute('href', 'https://www.teatr.pl')
  })

  it('leaves the text around the address untouched', () => {
    const { container } = render(<>{linkify('Bilety na https://teatr.pl juz sa')}</>)
    expect(container.textContent).toBe('Bilety na https://teatr.pl juz sa')
  })

  it('renders text without addresses as plain text', () => {
    const { container } = render(<>{linkify('Koncert w parku, wstep wolny')}</>)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe('Koncert w parku, wstep wolny')
  })

  it('renders every address in the paragraph', () => {
    render(<>{linkify('Strona https://teatr.pl, bilety https://bilety.pl')}</>)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/linkify.test.tsx`
Expected: FAIL — `Failed to resolve import "./linkify"`.

- [ ] **Step 3: Write minimal implementation**

Utwórz `src/lib/linkify.tsx`:

```tsx
import type { CSSProperties } from 'react'
import { C } from './tokens'
import { findLinks } from './links'

/** Ten sam styl, co linki w `renderArticle.tsx` — brandowy pomarancz i podkreslenie. */
const linkStyle: CSSProperties = { color: C.primary, textDecoration: 'underline' }

/**
 * Tekst z klikalnymi adresami.
 *
 * `target="_blank"` to tutaj droga do domyslnej przegladarki, nie ozdoba: na
 * webie otwiera nowa karte, a w powloce Capacitora nawigacja poza origin
 * aplikacji trafia do przegladarki systemowej. Tak samo dziala przycisk
 * "dojazd" w karcie wydarzenia.
 */
export function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0

  findLinks(text).forEach((link, i) => {
    if (link.start > last) parts.push(text.slice(last, link.start))
    parts.push(
      <a href={link.href} key={i} rel="noopener noreferrer" style={linkStyle} target="_blank">
        {link.text}
      </a>,
    )
    last = link.end
  })

  if (last < text.length) parts.push(text.slice(last))
  return parts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/linkify.test.tsx`
Expected: PASS, 5 testów.

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkify.tsx src/lib/linkify.test.tsx
git commit -m "Let a found address be something to tap"
```

---

### Task 3: Skracanie opisu ustępuje linkom (`text.ts`)

**Files:**
- Modify: `src/lib/text.ts`
- Test: `src/lib/text.test.ts` (dopisanie przypadków)

- [ ] **Step 1: Write the failing test**

Dopisz na końcu bloku `describe('truncateDescription', ...)` w `src/lib/text.test.ts`, tuż przed zamykającym `})`:

```ts
  // Limit jest miekki wylacznie dla adresow: link do polowy adresu prowadzi
  // donikad, wiec podglad woli urosnac, niz go przepolowic.
  it('runs past the limit to finish an address', () => {
    const lead = 'a'.repeat(20)
    const url = 'https://teatr.pl/bilety/koncert-w-parku'
    const { preview, truncated } = truncateDescription(`${lead} ${url} i tak dalej`, 30)
    expect(preview).toBe(`${lead} ${url}`)
    expect(truncated).toBe(true)
  })

  it('stops being truncated when the address ends the description', () => {
    const text = `${'a'.repeat(20)} https://teatr.pl/bilety/koncert-w-parku`
    expect(truncateDescription(text, 30)).toEqual({ preview: text, truncated: false })
  })

  // Link zaczynajacy sie za granica nie ma czego ratowac — obowiazuje
  // dotychczasowa granica slowa.
  it('leaves an address that starts past the limit alone', () => {
    const { preview, truncated } = truncateDescription(`${'slowo '.repeat(10)}https://teatr.pl`, 30)
    expect(preview).toBe('slowo slowo slowo slowo slowo')
    expect(truncated).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/text.test.ts`
Expected: FAIL — `runs past the limit to finish an address` oraz `stops being truncated when the address ends the description` zwracają podgląd ucięty na 30 znakach. `leaves an address that starts past the limit alone` przechodzi już teraz.

- [ ] **Step 3: Write minimal implementation**

Zastąp całą zawartość `src/lib/text.ts`:

```ts
import { findLinks } from './links'

/**
 * Ile opisu miesci sie w karcie, zanim poprosi o rozwiniecie.
 *
 * Granica jest miekka w jednym przypadku: adres, ktory ja przecina,
 * przedluza podglad do swojego konca. Patrz `truncateDescription`.
 */
export const DESCRIPTION_PREVIEW_CHARS = 350

/**
 * Ile podgladu wolno oddac, zeby dociac do granicy slowa.
 *
 * Cofamy sie do ostatniej spacji, dopoki nie kosztuje to wiecej niz 40%
 * podgladu. Powyzej tego progu pojedynczy dlugi ciag bez spacji zostawilby
 * kilka znakow zamiast akapitu — wtedy tniemy twardo.
 */
const WORD_BOUNDARY_MIN_RATIO = 0.6

/** Podglad opisu do granicy slowa — albo do konca adresu, ktory ta granice przecina. */
export function truncateDescription(
  text: string | null | undefined,
  limit = DESCRIPTION_PREVIEW_CHARS,
): { preview: string; truncated: boolean } {
  const full = (text ?? '').trim()
  if (full.length <= limit) return { preview: full, truncated: false }

  /**
   * Adres przeciety granica wygrywa z limitem. Ucieta polowa URL-a to link
   * prowadzacy donikad, a tego nie naprawi zadne "czytaj wiecej" — wiec
   * podglad siega konca adresu, choćby przekroczyl limit.
   */
  const straddling = findLinks(full).find(link => link.start < limit && link.end > limit)
  if (straddling) {
    return { preview: full.slice(0, straddling.end), truncated: straddling.end < full.length }
  }

  const cut = full.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const preview = lastSpace >= limit * WORD_BOUNDARY_MIN_RATIO ? cut.slice(0, lastSpace) : cut
  return { preview: preview.trimEnd(), truncated: true }
}
```

- [ ] **Step 4: Doprecyzuj istniejący test granicy**

Test `never returns more than the limit` opisuje teraz regułę tylko dla tekstu bez adresów. Zamień jego komentarz i nazwę w `src/lib/text.test.ts`:

```ts
  // Granica jest po to, zeby karta sie nie rozjechala — podglad tekstu bez
  // adresow nie moze jej przekroczyc nawet o znak. Jedyny wyjatek (adres
  // przeciety granica) ma wlasny test nizej.
  it('never returns more than the limit for text without addresses', () => {
    const long = 'slowo '.repeat(200)
    const { preview, truncated } = truncateDescription(long)
    expect(truncated).toBe(true)
    expect(preview.length).toBeLessThanOrEqual(DESCRIPTION_PREVIEW_CHARS)
  })
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/text.test.ts`
Expected: PASS, 12 testów — dziewięć dotychczasowych (jedno pod nową nazwą) i trzy nowe.

- [ ] **Step 6: Commit**

```bash
git add src/lib/text.ts src/lib/text.test.ts
git commit -m "Stop the preview from cutting an address in half"
```

---

### Task 4: Wpięcie w kartę wydarzenia

**Files:**
- Modify: `src/screens/EventSheet.tsx` (import przy linii 21, render opisu przy linii 623)

- [ ] **Step 1: Dodaj import**

W bloku importów `EventSheet.tsx`, bezpośrednio pod linią:

```tsx
import { truncateDescription } from '../lib/text'
```

dopisz:

```tsx
import { linkify } from '../lib/linkify'
```

- [ ] **Step 2: Renderuj opis przez `linkify`**

Zamień linię renderującą opis:

```tsx
                    {desc.truncated && !descOpen ? `${desc.preview}…` : (event.description ?? '').trim()}
```

na:

```tsx
                    {desc.truncated && !descOpen
                      ? <>{linkify(desc.preview)}…</>
                      : linkify((event.description ?? '').trim())}
```

Styl akapitu, `whiteSpace: 'pre-wrap'` i przycisk „czytaj więcej" zostają bez zmian.

- [ ] **Step 3: Sprawdź typy i lint**

Run: `npx tsc -b && npm run lint`
Expected: brak błędów.

- [ ] **Step 4: Uruchom cały pakiet testów**

Run: `npm test`
Expected: PASS — żaden istniejący test nie regresuje.

- [ ] **Step 5: Zobacz to w aplikacji**

Run: `npm run dev`, otwórz kartę wydarzenia, którego opis zawiera adres (jeśli nie ma takiego pod ręką, wklej adres w opisie przez „Edytuj").
Sprawdź: adres jest pomarańczowy i podkreślony, kliknięcie otwiera nową kartę przeglądarki, tekst wokół adresu wygląda jak przed zmianą, a opis dłuższy niż 350 znaków nadal ma „czytaj więcej".

- [ ] **Step 6: Commit**

```bash
git add src/screens/EventSheet.tsx
git commit -m "Let a link in the description be a link"
```

---

## Czego ten plan nie robi

- Nie linkuje e-maili ani numerów telefonu (decyzja ze spec).
- Nie dotyka `renderArticle.tsx` — tamten moduł interpretuje markdown i wspólny render zjadałby gwiazdki z opisów ze scrapera.
- Nie dodaje `@capacitor/browser`: ten plugin otwiera przeglądarkę wewnątrz aplikacji, a prośba dotyczyła domyślnej przeglądarki systemowej.
- Nie nakłada sufitu na wydłużenie podglądu — adres z długim ogonem parametrów rozepchnie podgląd o swoją długość i to jest świadomy wybór.
