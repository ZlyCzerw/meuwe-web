# Karta wydarzenia — nowy front — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przebudować front karty wydarzenia według makiety `meuwe-karta-wydarzenia-standalone.html` — bez utraty jakiejkolwiek funkcji — oraz naprawić nieklikalny przycisk zamykania podglądu pełnoekranowego.

**Architecture:** `EventSheet.tsx` (798 linii) rozpada się na orkiestratora plus cztery jednostki prezentacyjne o jednej odpowiedzialności każda. Wysokość trybu `half` przestaje być procentem ekranu, a zaczyna wynikać z `ResizeObserver` mierzącego zawartość. Czat staje się warstwą w istniejącym stosie historii `App.tsx`, dzięki czemu sprzętowy „wstecz" na Androidzie zamyka go zamiast całej karty.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + Testing Library, react-i18next, Capacitor (Android/iOS), style inline na tokenach z `src/lib/tokens.ts`.

**Spec:** [2026-08-11-event-card-redesign-design.md](../specs/2026-08-11-event-card-redesign-design.md)

---

## Struktura plików

| plik | odpowiedzialność | status |
|---|---|---|
| `src/lib/text.ts` | skracanie opisu na granicy słowa | nowy |
| `src/components/TagChip.tsx` | chip taga; nowy prop `outlined` | zmiana |
| `src/components/ActionRow.tsx` | trzykolumnowy rząd akcji + `ActionBtn` | nowy |
| `src/screens/event/EventPhotoStrip.tsx` | carousel, tagi, obserwujący, ×, kadr zastępczy | nowy |
| `src/screens/event/PhotoLightbox.tsx` | podgląd pełnoekranowy z przewijaniem | nowy |
| `src/screens/event/EventChatPanel.tsx` | lista wiadomości + pole wpisywania + pasek powrotu | nowy |
| `src/screens/EventSheet.tsx` | dane, snapy, modale, orkiestracja | duża zmiana |
| `src/App.tsx` | czat jako warstwa historii | zmiana |
| `src/locales/{pl,en,es,de,sl}.ts` | nowe klucze | zmiana |

**Kolejność ma znaczenie:** zadania 1–6 tworzą samodzielne, przetestowane jednostki, których nic jeszcze nie używa. Dopiero zadanie 8 składa je w kartę. Dzięki temu każdy commit po drodze zostawia działającą aplikację.

**Komendy weryfikacyjne** (używane w całym planie):

```bash
npx vitest run src/lib/text.test.ts
```

```bash
npm test
```

```bash
npx tsc -b
```

> `tsc -b`, nie `--noEmit` — Cloudflare jest bardziej restrykcyjny i wyłapuje rzeczy, których `--noEmit` nie widzi.

Lint uruchamiamy **na własnych plikach**, nie na całym repo:

```bash
npx eslint <ścieżki zmienione w tym zadaniu>
```

> Stan zastany na `4ce64b4`: `npm run lint` zgłasza 56 błędów i 7 ostrzeżeń w kodzie, którego to zadanie nie dotyka (`no-explicit-any` w `supabase.ts` i testach, puste bloki `catch` w `App.tsx`, ostrzeżenia reguł React Hooks). Do `4ce64b4` maskował je błąd parsowania: zostawiony worktree w `.claude/` miał własny `tsconfig`, przez co typescript-eslint nie umiał wybrać katalogu głównego i przestawał parsować każdy plik. Zielony wynik na całym repo nie jest więc miarą — miarą jest brak nowych uwag w plikach dotkniętych zadaniem.

---

## Task 1: Skracanie opisu

**Files:**
- Create: `src/lib/text.ts`
- Test: `src/lib/text.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/text.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { truncateDescription, DESCRIPTION_PREVIEW_CHARS } from './text'

describe('truncateDescription', () => {
  it('leaves a short description alone', () => {
    const { preview, truncated } = truncateDescription('Kameralny koncert w parku.')
    expect(preview).toBe('Kameralny koncert w parku.')
    expect(truncated).toBe(false)
  })

  it('treats a missing description as empty, not as an error', () => {
    expect(truncateDescription(null)).toEqual({ preview: '', truncated: false })
    expect(truncateDescription(undefined)).toEqual({ preview: '', truncated: false })
  })

  // Granica jest po to, żeby karta się nie rozjechała — podgląd nie może jej
  // przekroczyć nawet o znak.
  it('never returns more than the limit', () => {
    const long = 'słowo '.repeat(200)
    const { preview, truncated } = truncateDescription(long)
    expect(truncated).toBe(true)
    expect(preview.length).toBeLessThanOrEqual(DESCRIPTION_PREVIEW_CHARS)
  })

  // Ucięcie w połowie wyrazu wygląda jak błąd aplikacji, nie jak skrót.
  it('cuts on a word boundary', () => {
    const long = 'alfa '.repeat(100)
    const { preview } = truncateDescription(long)
    expect(preview.endsWith('alfa')).toBe(true)
  })

  // Jeden bardzo długi ciąg bez spacji (link, sklejka) nie ma granicy słowa —
  // wtedy twarde cięcie jest jedynym wyjściem i nie wolno mu oddać pustki.
  it('hard-cuts a run with no spaces', () => {
    const { preview, truncated } = truncateDescription('x'.repeat(500))
    expect(truncated).toBe(true)
    expect(preview.length).toBe(DESCRIPTION_PREVIEW_CHARS)
  })

  it('trims surrounding whitespace', () => {
    expect(truncateDescription('   Piknik   ').preview).toBe('Piknik')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/text.test.ts`
Expected: FAIL — `Failed to resolve import "./text"`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/text.ts`:

```ts
/** Ile opisu mieści się w karcie, zanim poprosi o rozwinięcie. */
export const DESCRIPTION_PREVIEW_CHARS = 350

/**
 * Podgląd opisu do granicy słowa.
 *
 * Cofamy się do ostatniej spacji tylko wtedy, gdy nie zjada to więcej niż 40%
 * podglądu. Inaczej pojedynczy długi ciąg bez spacji (wklejony link) zostawiłby
 * kilka znaków zamiast akapitu.
 */
export function truncateDescription(
  text: string | null | undefined,
  limit = DESCRIPTION_PREVIEW_CHARS,
): { preview: string; truncated: boolean } {
  const full = (text ?? '').trim()
  if (full.length <= limit) return { preview: full, truncated: false }

  const cut = full.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const preview = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut
  return { preview: preview.trimEnd(), truncated: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/text.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/text.ts src/lib/text.test.ts && git commit -m "Cut the description where a word ends, not where the counter stops"
```

---

## Task 2: Nowe teksty w pięciu językach

**Files:**
- Modify: `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`, `src/locales/sl.ts`
- Test: `src/locales/parity.test.ts` (nowy)

Nowe klucze trafiają do sekcji `event:` w każdym pliku.

- [ ] **Step 1: Write the failing test**

Create `src/locales/parity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import pl from './pl'
import en from './en'
import es from './es'
import de from './de'
import sl from './sl'

const NEW_EVENT_KEYS = [
  'attend', 'attending', 'readMore', 'readLess',
  'backToEvent', 'photoPrev', 'photoNext',
] as const

const LOCALES = { pl, en, es, de, sl }

describe('locale parity', () => {
  // Brakujący klucz nie wywraca aplikacji — pokazuje użytkownikowi surowy
  // identyfikator, więc bez testu wyciek zauważy dopiero ktoś na produkcji.
  it.each(Object.entries(LOCALES))('%s carries every new event key', (_name, dict) => {
    const event = (dict as { event: Record<string, unknown> }).event
    for (const key of NEW_EVENT_KEYS) {
      expect(typeof event[key]).toBe('string')
      expect(event[key]).not.toBe('')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: FAIL — `expected undefined to be 'string'` (5 razy)

- [ ] **Step 3: Add the keys**

W `src/locales/pl.ts`, w sekcji `event: {`, przed zamykającym `},` dopisz:

```ts
    attend: 'Wezmę udział',
    attending: 'Biorę udział',
    readMore: 'Czytaj więcej',
    readLess: 'Zwiń',
    backToEvent: 'Wróć do wydarzenia',
    photoPrev: 'Poprzednie zdjęcie',
    photoNext: 'Następne zdjęcie',
```

W `src/locales/en.ts`:

```ts
    attend: "I'll be there",
    attending: 'Going',
    readMore: 'Read more',
    readLess: 'Show less',
    backToEvent: 'Back to event',
    photoPrev: 'Previous photo',
    photoNext: 'Next photo',
```

W `src/locales/es.ts`:

```ts
    attend: 'Voy a ir',
    attending: 'Voy',
    readMore: 'Leer más',
    readLess: 'Mostrar menos',
    backToEvent: 'Volver al evento',
    photoPrev: 'Foto anterior',
    photoNext: 'Foto siguiente',
```

W `src/locales/de.ts`:

```ts
    attend: 'Ich komme',
    attending: 'Ich bin dabei',
    readMore: 'Mehr lesen',
    readLess: 'Weniger anzeigen',
    backToEvent: 'Zurück zum Event',
    photoPrev: 'Vorheriges Foto',
    photoNext: 'Nächstes Foto',
```

W `src/locales/sl.ts`:

```ts
    attend: 'Se udeležim',
    attending: 'Grem',
    readMore: 'Preberi več',
    readLess: 'Prikaži manj',
    backToEvent: 'Nazaj na dogodek',
    photoPrev: 'Prejšnja fotografija',
    photoNext: 'Naslednja fotografija',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/locales && git commit -m "Say 'I'll be there' in every language the app speaks"
```

---

## Task 3: Obrys chipa taga

Chipy w jasnych kolorach (`kids`, `nature`, `sunshine`) znikają na jasnym zdjęciu. Obrys jest opcjonalny, żeby nie zmieniać wyglądu chipów w `TagPickerModal` i `CreateSheet`.

**Files:**
- Modify: `src/components/TagChip.tsx`
- Test: `src/components/TagChip.test.tsx` (nowy)

- [ ] **Step 1: Write the failing test**

Create `src/components/TagChip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TagChip from './TagChip'
import '../lib/i18n'

// Czytamy surowy atrybut, a nie `style.border` — jsdom bywa wybiórczy przy
// rozkładaniu skrótów CSS i potrafi oddać pusty łańcuch.
describe('TagChip', () => {
  it('stays borderless by default', () => {
    render(<TagChip category="music" />)
    expect(screen.getByRole('button').getAttribute('style')).toContain('transparent')
  })

  // Na zdjęciu chip musi mieć własną krawędź, bo tło jest nieprzewidywalne.
  it('draws an ink outline when asked', () => {
    render(<TagChip category="music" outlined />)
    const style = screen.getByRole('button').getAttribute('style') ?? ''
    expect(style).toContain('2px solid rgb(45, 43, 42)')
    expect(style).not.toContain('transparent')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TagChip.test.tsx`
Expected: FAIL — TypeScript/props error na `outlined`, oba testy przechodzą przez `border` transparent

- [ ] **Step 3: Implement**

W `src/components/TagChip.tsx` zmień import tokenów:

```tsx
import { C, INK, TAG_META } from '../lib/tokens';
```

Dodaj `outlined` do sygnatury propsów (po `removable`):

```tsx
  removable = false,
  onRemove,
  outlined = false,
}: {
  category: string;
  label?: string;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  /** Obrys w kolorze ink — dla chipów kładzionych na zdjęciu. */
  outlined?: boolean;
}) {
```

Zamień linię `border:` w obiekcie stylu na:

```tsx
        border: outlined ? `2px solid ${INK}` : '2px solid transparent',
        boxShadow: outlined ? `0 2px 0 ${INK}33` : 'none',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TagChip.test.tsx`
Expected: PASS — 2 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/TagChip.tsx src/components/TagChip.test.tsx && git commit -m "Give the tag chip an edge for when it lands on a photo"
```

---

## Task 4: Rząd akcji

**Files:**
- Create: `src/components/ActionRow.tsx`
- Test: `src/components/ActionRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ActionRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionRow, { ActionBtn } from './ActionRow'

describe('ActionRow', () => {
  it('reports a tap', () => {
    const onClick = vi.fn()
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Wezmę udział" ariaLabel="Wezmę udział" onClick={onClick} />
      </ActionRow>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Wezmę udział' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Czytnik ekranu musi usłyszeć, że przycisk jest włączony — sam kolor blobu
  // niczego mu nie mówi.
  it('announces the active state', () => {
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Biorę udział" ariaLabel="Biorę udział" active onClick={() => {}} />
      </ActionRow>,
    )
    expect(screen.getByRole('button', { name: 'Biorę udział' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not fire while disabled', () => {
    const onClick = vi.fn()
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Kalendarz" ariaLabel="Kalendarz" disabled onClick={onClick} />
      </ActionRow>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kalendarz' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ActionRow.test.tsx`
Expected: FAIL — `Failed to resolve import "./ActionRow"`

- [ ] **Step 3: Implement**

Create `src/components/ActionRow.tsx`:

```tsx
import { Children, Fragment, type ReactNode } from 'react';
import { C, INK, F } from '../lib/tokens';

/**
 * Trzykolumnowy pasek głównych akcji karty.
 *
 * Przegrody rysuje sam, na podstawie liczby dzieci — wywołujący podaje same
 * przyciski i nie musi pamiętać o kreskach między nimi.
 */
export default function ActionRow({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div style={{ display: 'flex', borderRadius: 20, background: C.cream, overflow: 'hidden' }}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <div style={{ width: 1, background: '#EDE0CC', margin: '9px 0' }} />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}

export function ActionBtn({
  icon,
  label,
  ariaLabel,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  /** Może być wielowierszowa, dlatego ReactNode — opis dla czytnika idzie osobno. */
  label: ReactNode;
  ariaLabel: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: '10px 6px 9px',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          flexShrink: 0,
          background: active ? C.primary : 'transparent',
          border: `2px solid ${INK}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? '#fff' : INK,
          transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontFamily: F.body,
          fontSize: 10.5,
          fontWeight: 800,
          color: INK,
          textAlign: 'center',
          lineHeight: 1.15,
          minHeight: 24,
        }}
      >
        {label}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ActionRow.test.tsx`
Expected: PASS — 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionRow.tsx src/components/ActionRow.test.tsx && git commit -m "Put a label under every action the card offers"
```

---

## Task 5: Pasek zdjęcia

Kadr 16:9 niosący cztery rzeczy naraz: carousel, pasek obserwujących (lewy górny), przycisk zamykania karty (prawy górny) i pasek wszystkich tagów (dół).

**Files:**
- Create: `src/screens/event/EventPhotoStrip.tsx`
- Test: `src/screens/event/EventPhotoStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/screens/event/EventPhotoStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventPhotoStrip from './EventPhotoStrip'
import '../../lib/i18n'

const base = {
  photos: null,
  category: 'culture' as const,
  tags: [] as string[],
  followers: [] as { avatar_color: string | null; display_name: string | null }[],
  followersLabel: '',
  onClose: () => {},
  onOpenPhoto: () => {},
}

describe('EventPhotoStrip', () => {
  // Bez zdjęcia kadr musi zostać, inaczej cały układ karty skacze o 200 px.
  it('keeps the frame when the event has no photo', () => {
    render(<EventPhotoStrip {...base} />)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByTestId('photo-frame')).toBeInTheDocument()
  })

  it('renders one slide per photo', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg', 'c.jpg']} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })

  // Właściciel produktu chce komplet tagów, nie trzy i "+N".
  it('shows every tag, not a truncated set', () => {
    render(<EventPhotoStrip {...base} tags={['music', 'art', 'food', 'sport', 'tech']} />)
    expect(screen.getByTestId('tag-bar').querySelectorAll('button')).toHaveLength(5)
  })

  it('hides the followers bar when nobody follows', () => {
    render(<EventPhotoStrip {...base} />)
    expect(screen.queryByTestId('followers-bar')).not.toBeInTheDocument()
  })

  it('shows the followers bar with a count', () => {
    render(
      <EventPhotoStrip
        {...base}
        followers={[{ avatar_color: '#fff', display_name: 'Ala' }]}
        followersLabel="obserwuje to"
      />,
    )
    expect(screen.getByTestId('followers-bar')).toHaveTextContent('obserwuje to')
  })

  it('reports a request to close the card', () => {
    const onClose = vi.fn()
    render(<EventPhotoStrip {...base} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('close-card'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens the tapped photo full screen', () => {
    const onOpenPhoto = vi.fn()
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg']} onOpenPhoto={onOpenPhoto} />)
    fireEvent.click(screen.getAllByRole('img')[1])
    expect(onOpenPhoto).toHaveBeenCalledWith(1)
  })

  // Jedno zdjęcie nie jest karuzelą — strzałki i kropki byłyby kłamstwem.
  it('hides the arrows for a single photo', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg']} />)
    expect(screen.queryByLabelText(/Następne zdjęcie|Next photo/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/event/EventPhotoStrip.test.tsx`
Expected: FAIL — `Failed to resolve import "./EventPhotoStrip"`

- [ ] **Step 3: Implement**

Create `src/screens/event/EventPhotoStrip.tsx`:

```tsx
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TagChip from '../../components/TagChip'
import OrganicBlob from '../../components/OrganicBlob'
import BlobFace from '../../components/BlobFace'
import { C, INK, F, TAG_META } from '../../lib/tokens'
import type { Category } from '../../lib/tokens'

/** Ile awatarów obserwujących mieści się w rogu, zanim zaczną zasłaniać zdjęcie. */
const MAX_FACES = 3

export default function EventPhotoStrip({
  photos,
  category,
  tags,
  followers,
  followersLabel,
  onClose,
  onOpenPhoto,
}: {
  photos: string[] | null
  category: Category
  tags: string[]
  followers: { avatar_color: string | null; display_name: string | null }[]
  followersLabel: string
  onClose: () => void
  onOpenPhoto: (idx: number) => void
}) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const list = photos ?? []
  const meta = TAG_META[category] || TAG_META.party

  // Indeks bierzemy z pozycji przewijania, a nie z własnego licznika — wtedy
  // swipe palcem i kliknięcie strzałki opowiadają tę samą historię.
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  function goTo(next: number) {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(list.length - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIdx(clamped)
  }

  const arrowStyle: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 32, height: 32, borderRadius: '50%', zIndex: 3,
    background: 'rgba(255,255,255,0.92)', border: `2px solid ${INK}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 900, color: INK,
  }

  return (
    <div
      data-testid="photo-frame"
      style={{
        position: 'relative', aspectRatio: '16 / 9', borderRadius: 20,
        overflow: 'hidden', marginBottom: 12,
        background: `linear-gradient(135deg, ${meta.color}, ${C.cream})`,
      }}
    >
      {list.length > 0 ? (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{
            display: 'flex', height: '100%', overflowX: 'auto', overflowY: 'hidden',
            scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
          }}
        >
          {list.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              onClick={() => onOpenPhoto(i)}
              style={{
                flex: '0 0 100%', width: '100%', height: '100%',
                objectFit: 'cover', scrollSnapAlign: 'center', cursor: 'pointer',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <OrganicBlob size={72} color={meta.color} idx={0} face={<BlobFace size={44} />} />
        </div>
      )}

      {/* Przyciemnienia pod treścią w rogach. pointerEvents none, żeby nie
          przechwytywały ani swipe'u, ani kliknięcia w tag. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(to bottom, rgba(0,0,0,0.38), transparent)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', pointerEvents: 'none', zIndex: 1 }} />

      {followers.length > 0 && (
        <div
          data-testid="followers-bar"
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <div style={{ display: 'flex' }}>
            {followers.slice(0, MAX_FACES).map((f, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: f.avatar_color || C.primary,
                border: `2px solid ${INK}`, marginLeft: i > 0 ? -7 : 0,
                zIndex: MAX_FACES - i, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: INK, fontFamily: F.display,
              }}>
                {(f.display_name || '?')[0].toUpperCase()}
              </div>
            ))}
          </div>
          <span style={{
            fontFamily: F.body, fontSize: 11.5, fontWeight: 800, color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
          }}>{followersLabel}</span>
        </div>
      )}

      <button
        data-testid="close-card"
        onClick={onClose}
        aria-label={t('common.close')}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 3,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(45,43,42,0.55)', border: '1.5px solid rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, fontWeight: 700,
        }}
      >×</button>

      {list.length > 1 && (
        <>
          <button aria-label={t('event.photoPrev')} onClick={() => goTo(idx - 1)}
            style={{ ...arrowStyle, left: 10, opacity: idx === 0 ? 0.4 : 1 }}>‹</button>
          <button aria-label={t('event.photoNext')} onClick={() => goTo(idx + 1)}
            style={{ ...arrowStyle, right: 10, opacity: idx === list.length - 1 ? 0.4 : 1 }}>›</button>
          <div style={{ position: 'absolute', bottom: 46, left: 0, right: 0, zIndex: 3, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {list.map((_, i) => (
              <button key={i} aria-hidden onClick={() => goTo(i)} style={{
                width: i === idx ? 18 : 6, height: 6, borderRadius: 999,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.55)',
                transition: 'width 200ms cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            ))}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <div
          data-testid="tag-bar"
          style={{
            position: 'absolute', bottom: 8, left: 0, right: 0, zIndex: 3,
            display: 'flex', gap: 6, overflowX: 'auto', padding: '0 10px',
            scrollbarWidth: 'none',
          }}
        >
          {tags.map(tag => (
            <div key={tag} style={{ flexShrink: 0 }}>
              <TagChip category={tag} selected outlined />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/event/EventPhotoStrip.test.tsx`
Expected: PASS — 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/screens/event/EventPhotoStrip.tsx src/screens/event/EventPhotoStrip.test.tsx && git commit -m "Let the photo carry the tags, the faces and the way out"
```

---

## Task 6: Podgląd pełnoekranowy

Naprawa zgłoszona wprost: przycisk zamykania nachodzi na pasek systemowy i jest nieklikalny.

**Files:**
- Create: `src/screens/event/PhotoLightbox.tsx`
- Test: `src/screens/event/PhotoLightbox.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/screens/event/PhotoLightbox.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhotoLightbox from './PhotoLightbox'
import '../../lib/i18n'

describe('PhotoLightbox', () => {
  it('shows every photo so the viewer can swipe on', () => {
    render(<PhotoLightbox photos={['a.jpg', 'b.jpg']} index={0} onClose={() => {}} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  // Zgłoszona usterka: przycisk siedział pod paskiem systemowym. Odsunięcie
  // liczymy od bezpiecznego obszaru, więc test pilnuje samego wzorca, nie liczby.
  // Surowy atrybut, nie `style.top` — jsdom nie zachowuje calc() po rozłożeniu.
  it('keeps the close button clear of the status bar', () => {
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={() => {}} />)
    const style = screen.getByTestId('lightbox-close').getAttribute('style') ?? ''
    expect(style).toContain('safe-area-inset-top')
  })

  it('reports a close', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('lightbox-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a tap outside the photo', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('lightbox-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/event/PhotoLightbox.test.tsx`
Expected: FAIL — `Failed to resolve import "./PhotoLightbox"`

- [ ] **Step 3: Implement**

Create `src/screens/event/PhotoLightbox.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Odsunięcie przycisku zamykania od górnej krawędzi.
 *
 * Sam bezpieczny obszar nie wystarczał: na natywnym Androidzie przycisk lądował
 * pod paskiem statusu i był nieklikalny. 72 px zostawia go poniżej wszystkiego,
 * co system rysuje po swojemu.
 */
const CLOSE_TOP = 'calc(env(safe-area-inset-top, 0px) + 72px)'

export default function PhotoLightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[]
  index: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [idx, setIdx] = useState(index)

  // Wejście od razu na klikniętym zdjęciu — bez animacji, bo widz nie prosił
  // o podróż od pierwszego.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = index * el.clientWidth
  }, [index])

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  function goTo(next: number) {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(photos.length - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIdx(clamped)
  }

  const arrowStyle: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 40, height: 40, borderRadius: '50%', zIndex: 3,
    background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
    color: '#fff', fontSize: 22, fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div
      data-testid="lightbox-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.92)' }}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', height: '100%', overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
        }}
      >
        {photos.map((src, i) => (
          <div key={i} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={src} alt="" style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, display: 'block' }} />
          </div>
        ))}
      </div>

      <button
        data-testid="lightbox-close"
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label={t('event.backToEvent')}
        style={{
          position: 'absolute', top: CLOSE_TOP, right: 16, zIndex: 4,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
          color: '#fff', fontSize: 20, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      {photos.length > 1 && (
        <>
          <button aria-label={t('event.photoPrev')} onClick={e => { e.stopPropagation(); goTo(idx - 1) }}
            style={{ ...arrowStyle, left: 16, opacity: idx === 0 ? 0.3 : 1 }}>‹</button>
          <button aria-label={t('event.photoNext')} onClick={e => { e.stopPropagation(); goTo(idx + 1) }}
            style={{ ...arrowStyle, right: 16, opacity: idx === photos.length - 1 ? 0.3 : 1 }}>›</button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/event/PhotoLightbox.test.tsx`
Expected: PASS — 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/screens/event/PhotoLightbox.tsx src/screens/event/PhotoLightbox.test.tsx && git commit -m "Move the way out from under the status bar"
```

---

## Task 7: Panel czatu

**Files:**
- Create: `src/screens/event/EventChatPanel.tsx`
- Test: `src/screens/event/EventChatPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/screens/event/EventChatPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventChatPanel from './EventChatPanel'
import '../../lib/i18n'
import type { Message } from '../../lib/types'

const msg = (id: string, text: string, author: string | null): Message => ({
  id, event_id: 'e1', author_id: author, author_name: 'Ala',
  author_color: '#fff', text, created_at: '2026-08-11T10:00:00Z',
})

const base = {
  messages: [] as Message[],
  meId: 'me',
  loc: 'pl-PL',
  deletedLabels: { deleted: 'Usunięty', unknown: '?' },
  title: 'Koncert w parku',
  onBack: () => {},
  input: '',
  onInputChange: () => {},
  onSend: () => {},
  sendErr: '',
  canWrite: true,
}

describe('EventChatPanel', () => {
  // Pasek nad czatem istnieje po to, żeby nie dało się zgubić, w którym
  // wydarzeniu się jest.
  it('names the event above the conversation', () => {
    render(<EventChatPanel {...base} />)
    expect(screen.getByTestId('chat-header')).toHaveTextContent('Koncert w parku')
  })

  it('reports a request to go back', () => {
    const onBack = vi.fn()
    render(<EventChatPanel {...base} onBack={onBack} />)
    fireEvent.click(screen.getByTestId('chat-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders every message', () => {
    render(<EventChatPanel {...base} messages={[msg('1', 'Cześć', 'a'), msg('2', 'Idę', 'me')]} />)
    expect(screen.getByText('Cześć')).toBeInTheDocument()
    expect(screen.getByText('Idę')).toBeInTheDocument()
  })

  it('sends on Enter', () => {
    const onSend = vi.fn()
    render(<EventChatPanel {...base} input="jestem" onSend={onSend} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  // Gość może czytać, ale nie pisać — pole ma to pokazywać, a nie udawać.
  it('locks the field for a guest', () => {
    render(<EventChatPanel {...base} canWrite={false} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('surfaces a send error', () => {
    render(<EventChatPanel {...base} sendErr="Nie udało się wysłać" />)
    expect(screen.getByText('Nie udało się wysłać')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/event/EventChatPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./EventChatPanel"`

- [ ] **Step 3: Implement**

Create `src/screens/event/EventChatPanel.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../../lib/tokens'
import { authorLabel, authorInitial } from '../../lib/authorLabel'
import type { Message } from '../../lib/types'

export default function EventChatPanel({
  messages,
  meId,
  loc,
  deletedLabels,
  title,
  onBack,
  input,
  onInputChange,
  onSend,
  sendErr,
  canWrite,
}: {
  messages: Message[]
  meId: string | null
  loc: string
  deletedLabels: { deleted: string; unknown: string }
  title: string
  onBack: () => void
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  sendErr: string
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement | null>(null)

  // Rozmowa otwiera się na najnowszej wiadomości i tam zostaje, gdy przyjdzie
  // następna — czat, w którym trzeba doprzewijać do teraźniejszości, jest
  // nieużywalny.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 8, background: '#fff',
      display: 'flex', flexDirection: 'column',
      animation: 'meuwe-fade-in 180ms ease',
    }}>
      <div
        data-testid="chat-header"
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid #F1E9DA',
        }}
      >
        <button
          data-testid="chat-back"
          onClick={onBack}
          aria-label={t('event.backToEvent')}
          style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: C.cream, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, fontWeight: 900, color: C.ink,
          }}
        >‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: F.display, fontSize: 14, fontWeight: 800, color: C.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft }}>
            {t('event.messageCount', { count: messages.length })}
          </div>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 8px' }}>
        <div style={{
          fontSize: 11, color: C.inkSoft, fontWeight: 700,
          textAlign: 'center', margin: '0 0 16px', letterSpacing: 0.5,
        }}>{t('event.today')}</div>
        {messages.map((m, i) => {
          const isMe = !!meId && m.author_id === meId
          return (
            <div key={m.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 10,
            }}>
              {!isMe && i % 3 === 0 && (
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, marginBottom: 4, marginLeft: 44 }}>
                  {authorLabel(m.author_id, m.author_name, deletedLabels)} · {new Date(m.created_at).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '82%' }}>
                {!isMe && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: m.author_color || C.sky, border: `2px solid ${INK}`, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, color: INK,
                  }}>
                    {authorInitial(m.author_id, m.author_name, deletedLabels)}
                  </div>
                )}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  background: isMe ? C.primarySoft : C.cream, color: C.ink,
                  fontSize: 14, fontWeight: 600, lineHeight: 1.4,
                }}>{m.text}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        flexShrink: 0, padding: '8px 16px calc(20px + env(safe-area-inset-bottom))',
        background: '#fff', borderTop: '1px solid #F1E9DA',
      }}>
        {sendErr && (
          <div style={{
            marginBottom: 8, padding: '6px 12px', borderRadius: 10,
            background: '#FFE8E8', color: '#c0392b', fontSize: 12, fontWeight: 700,
          }}>{sendErr}</div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            flex: 1, padding: '10px 18px', borderRadius: 999, background: C.cream,
            display: 'flex', alignItems: 'center',
          }}>
            <input
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSend() }}
              placeholder={canWrite ? t('event.writeMessage') : t('event.loginToWrite')}
              disabled={!canWrite}
              maxLength={500}
              style={{ flex: 1, fontSize: 16, fontWeight: 600 }}
            />
          </div>
          <button
            onClick={onSend}
            disabled={!canWrite || !input.trim()}
            aria-label={t('event.writeMessage')}
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && canWrite ? C.primary : '#E8DFD0',
              border: `2px solid ${INK}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms ease',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="M3 10 L17 10 M11 5 L17 10 L11 15"
                stroke={input.trim() && canWrite ? '#fff' : C.inkSoft}
                strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/event/EventChatPanel.test.tsx`
Expected: PASS — 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/screens/event/EventChatPanel.tsx src/screens/event/EventChatPanel.test.tsx && git commit -m "Give the conversation the whole card and a way back"
```

---

## Task 8: Przebudowa karty

Największe zadanie. `EventSheet.tsx` traci własną implementację zdjęcia, podglądu i czatu na rzecz komponentów z zadań 5–7, dostaje nowy układ i mierzoną wysokość trybu `half`.

**Files:**
- Modify: `src/screens/EventSheet.tsx` (przebudowa układu; logika bez zmian)

- [ ] **Step 1: Wymień importy**

W `src/screens/EventSheet.tsx` usuń nieużywane po przebudowie importy `TagChip` i `OrganicBlob`/`BlobFace` **tylko jeśli** tryb `peek` przestanie ich używać — `peek` je zachowuje, więc `OrganicBlob` i `BlobFace` **zostają**. Usuń `TagChip` (przeniesiony do `EventPhotoStrip`).

Dodaj:

```tsx
import EventPhotoStrip from './event/EventPhotoStrip'
import PhotoLightbox from './event/PhotoLightbox'
import EventChatPanel from './event/EventChatPanel'
import ActionRow, { ActionBtn } from '../components/ActionRow'
import { truncateDescription } from '../lib/text'
```

- [ ] **Step 2: Zamień stałe wysokości**

Usuń:

```tsx
const HEIGHTS: Record<Snap, string> = { peek: '130px', half: '56%', full: '93%' }
```

Wstaw w to miejsce:

```tsx
/**
 * Zawartość trybu half ma stałą wysokość, nie stały udział w ekranie: te same
 * ~480 px to 61% iPhone'a 15 i 72% iPhone'a SE. Procent zawsze gdzieś zawiedzie,
 * więc kartę ustawia pomiar, a te liczby tylko go ograniczają.
 */
const HALF_MIN = 320
const HALF_MAX_VH = 78
/** Uchwyt plus górny odstęp listy — pomiar obejmuje samą zawartość. */
const HALF_CHROME = 29
```

- [ ] **Step 3: Dodaj pomiar i sterowany czat do sygnatury**

`EventSheet` rozkłada propsy inline razem z ich typem, więc zmiana idzie w dwa miejsca tej samej deklaracji.

W rozkładzie, po `onProfileChanged,` — od razu pod nazwą `chatOpenProp`, bo `chatOpen` policzymy w kroku 5:

```tsx
  onProfileChanged,
  chatOpen: chatOpenProp,
  onChatOpenChange,
}: {
```

W typie, po `onProfileChanged?: () => void`:

```tsx
  onProfileChanged?: () => void
  /** Czat jest warstwą historii — stanem zarządza App, żeby „wstecz" go zamykał. */
  chatOpen?: boolean
  onChatOpenChange?: (open: boolean) => void
}) {
```

- [ ] **Step 4: Zamień stan czatu na sterowany i dodaj pomiar**

Usuń linię:

```tsx
  const [chatFocused, setChatFocused] = useState(false)
```

Dodaj obok pozostałych stanów:

```tsx
  const [halfContentH, setHalfContentH] = useState(0)
  const [descOpen, setDescOpen] = useState(false)
  const halfRef = useRef<HTMLDivElement | null>(null)
```

Dodaj efekt pomiaru (poniżej pozostałych `useEffect`):

```tsx
  // Wysokość karty w trybie half wynika z zawartości, więc dwuwierszowy tytuł,
  // ósmy tag czy pojawienie się paska obserwujących dopasowują ją same.
  useEffect(() => {
    const el = halfRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      setHalfContentH(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [event?.id])
```

- [ ] **Step 5: Policz wysokość karty**

Obok `const isFull = snap === 'full'` dodaj:

```tsx
  const chatOpen = !!chatOpenProp
  const sheetHeight =
    snap === 'peek' ? '130px'
      : snap === 'full' ? '93%'
      : `clamp(${HALF_MIN}px, ${Math.round(halfContentH + HALF_CHROME)}px, ${HALF_MAX_VH}vh)`
```

Zamień w stylu głównego kontenera `height: HEIGHTS[snap]` na `height: sheetHeight`.

- [ ] **Step 6: Rozwiń kartę gestem zamiast przewijaniem**

W trybie half zawartość mieści się co do piksela, więc zdarzenie `scroll` nigdy nie padnie. Rozwinięcie bierze się z gestu.

Do kontenera listy (`ref={listRef}`) dodaj, obok istniejących propsów:

```tsx
              onTouchStart={!isFull ? onTS : undefined}
              onTouchEnd={!isFull ? onTE : undefined}
              onWheel={!isFull ? (e) => { if (e.deltaY > 0) setSnap('full') } : undefined}
```

`onTS`/`onTE` już istnieją i obsługują oba kierunki — nic w nich nie zmieniamy. Poziomy swipe po zdjęciu ma `|dy| < 80`, więc nie przełącza snapa.

- [ ] **Step 7: Wymień zawartość trybu half**

Zastąp **cały** blok od `{/* Followers bar */}` do końca `{/* Description */}` (dziś linie ~353–560) poniższym. Fragmenty „Followers bar", „Title + close", „Photo carousel", „Status + time + Follow/Share row" i „Tags" **znikają** — zastępuje je `EventPhotoStrip` plus nowy układ.

```tsx
                  {/* Sekcje trybu half — mierzone, żeby karta miała ich wysokość */}
                  <div ref={halfRef}>
                    <EventPhotoStrip
                      photos={event.photos}
                      category={event.category}
                      tags={event.tags ?? []}
                      followers={followers}
                      followersLabel={
                        followers.length === 0 ? ''
                          : followers.length <= 3
                            ? t(followers.length === 1 ? 'follow.followsThis' : 'follow.followThis')
                            : t(followers.length - 3 === 1 ? 'follow.othersFollowOne' : 'follow.othersFollowMany', { count: followers.length - 3 })
                      }
                      onClose={onClose}
                      onOpenPhoto={setPhotoModal}
                    />

                    {/* Tytuł + status */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1, fontFamily: F.display, fontWeight: 900, fontSize: 19, letterSpacing: -0.3, lineHeight: 1.2, color: C.ink }}>
                        {event.title}
                      </div>
                      <div style={{ flexShrink: 0, marginTop: 3 }}>
                        <StatusPill status={computedStatus} />
                      </div>
                    </div>

                    {/* Fakty — data i miejsce w jednej karcie, najkrótsza ścieżka wzroku */}
                    <div style={{ borderRadius: 16, background: C.cream, overflow: 'hidden', marginBottom: 12 }}>
                      {event.start_time && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px' }}>
                          <span style={{ color: C.inkSoft, display: 'flex', flexShrink: 0, marginTop: 1 }}>
                            <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="4" width="15" height="13.5" rx="3.2" stroke="currentColor" strokeWidth="1.8"/><path d="M2.5 8 H17.5 M6 2.3 V5.3 M14 2.3 V5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </span>
                          <div style={{ flex: 1, fontFamily: F.body }}>
                            <div style={{ fontWeight: 800, fontSize: 12.5, color: C.ink }}>
                              {new Date(event.start_time).toLocaleDateString(loc, { day: 'numeric', month: 'long', weekday: 'long' })}
                            </div>
                            {event.end_time && (
                              <div style={{ fontWeight: 600, fontSize: 11, color: C.inkSoft }}>
                                {new Date(event.start_time).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                                {' – '}
                                {new Date(event.end_time).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div style={{ height: 1, background: '#EDE0CC', margin: '0 12px' }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 12px' }}>
                        <span style={{ marginTop: 1, flexShrink: 0, display: 'flex' }}>
                          <svg width="12" height="14" viewBox="0 0 14 16" fill="none"><path d="M7 1.2 C10.2 1.2 12.6 3.6 12.6 6.6 C12.6 10.4 7 14.8 7 14.8 C7 14.8 1.4 10.4 1.4 6.6 C1.4 3.6 3.8 1.2 7 1.2 Z" stroke={C.inkSoft} strokeWidth="2" strokeLinejoin="round"/><circle cx="7" cy="6.5" r="2" fill={C.inkSoft}/></svg>
                        </span>
                        <div style={{ flex: 1, minWidth: 0, fontFamily: F.body }}>
                          <div style={{ fontWeight: 800, fontSize: 12.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {event.place_name || t('event.directions')}
                          </div>
                          {distStr && (
                            <button
                              onClick={onLocate}
                              disabled={!onLocate}
                              style={{ padding: 0, fontWeight: 600, fontSize: 11, color: C.inkSoft, cursor: onLocate ? 'pointer' : 'default' }}
                            >
                              {t('event.distanceFrom', { dist: distStr })}
                            </button>
                          )}
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '6px 11px', borderRadius: 999, background: 'transparent',
                            border: `2px solid ${INK}`, color: C.ink, textDecoration: 'none',
                            fontFamily: F.body, fontSize: 11, fontWeight: 800,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 12 Q2 6 8 6 Q14 6 14 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M10.5 2 L14 2 L14 5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {t('event.directions')}
                        </a>
                      </div>
                    </div>

                    {/* Główne akcje */}
                    <div style={{ marginBottom: 16 }}>
                      <ActionRow>
                        <ActionBtn
                          active={isFollowing}
                          ariaLabel={isFollowing ? t('event.attending') : t('event.attend')}
                          label={isFollowing ? t('event.attending') : t('event.attend')}
                          onClick={toggleFollow}
                          icon={
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="8" cy="6" r="3.2"/><path d="M2.5 17 C2.5 13 5 11.3 8 11.3 C9 11.3 9.9 11.5 10.7 11.9"/><path d="M13 14.5 L15 16.5 L18.3 12.5" strokeWidth="2"/>
                            </svg>
                          }
                        />
                        <ActionBtn
                          disabled={calendarBusy}
                          ariaLabel={t('calendar.add')}
                          label={t('calendar.add')}
                          onClick={handleCalendar}
                          icon={
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                              <rect x="2.5" y="4" width="15" height="13.5" rx="3.2"/><path d="M2.5 8 H17.5 M6 2.3 V5.3 M14 2.3 V5.3"/><path d="M10 10.5 V15 M7.7 12.7 H12.3" strokeWidth="1.9"/>
                            </svg>
                          }
                        />
                        <ActionBtn
                          ariaLabel={t('share.share')}
                          label={t('share.share')}
                          onClick={() => handleShare(event, () => showToast(t('share.linkCopied')))}
                          icon={
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 2.5 L10 12"/><path d="M6.5 5.5 L10 2 L13.5 5.5"/><path d="M5.5 9 L4 9 C3.4 9 3 9.4 3 10 L3 16 C3 16.6 3.4 17 4 17 L16 17 C16.6 17 17 16.6 17 16 L17 10 C17 9.4 16.6 9 16 9 L14.5 9"/>
                            </svg>
                          }
                        />
                      </ActionRow>
                    </div>
                  </div>

                  {/* ── poniżej: tylko po rozwinięciu ── */}

                  {calendarHint && (
                    <button
                      onClick={() => { setCalendarChooser(true); setCalendarHint(null) }}
                      style={{
                        display: 'block', margin: '-4px 0 12px auto', padding: '6px 12px',
                        borderRadius: 999, background: 'transparent', border: `2px solid ${INK}22`,
                        fontSize: 12, fontWeight: 700, color: C.ink, cursor: 'pointer',
                      }}
                    >
                      {t('calendar.other')}
                    </button>
                  )}

                  {/* Opis — skrócony, na żądanie pełny */}
                  {event.description && (() => {
                    const { preview, truncated } = truncateDescription(event.description)
                    return (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, lineHeight: 1.55 }}>
                          {descOpen || !truncated ? event.description : `${preview}…`}
                        </div>
                        {truncated && (
                          <button
                            onClick={() => setDescOpen(o => !o)}
                            style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: C.primary }}
                          >
                            {descOpen ? t('event.readLess') : t('event.readMore')}
                          </button>
                        )}
                      </div>
                    )
                  })()}

                  {/* Dodane przez */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Avatar size={28} initials={authorInitial(event.creator_id, event.profiles?.display_name, deletedLabels)} color={event.profiles?.avatar_color || C.sky} />
                    <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>
                      {t('event.organizer')} <strong style={{ color: C.ink }}>{authorLabel(event.creator_id, event.profiles?.display_name, deletedLabels)}</strong>
                    </span>
                    {session?.user.id === event.creator_id && (
                      <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 999, background: C.primarySoft, color: C.primaryPress, fontSize: 11, fontWeight: 800 }}>{t('event.moderator')}</span>
                    )}
                  </div>

                  {/* Edytuj + Zakończ (twórca, dopóki niezakończone) */}
                  {session?.user.id === event.creator_id && computedStatus !== 'ended' && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <button
                        onClick={() => onEdit?.(event)}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: C.primary, border: `2px solid ${INK}`, color: '#fff', fontSize: 14, fontWeight: 800 }}
                      >
                        {t('event.editEvent')}
                      </button>
                      <button
                        onClick={handleEndEvent}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: 'transparent', border: `2px solid ${C.primarySoft}`, color: C.primaryPress, fontSize: 14, fontWeight: 800 }}
                      >
                        {t('event.endEvent')}
                      </button>
                    </div>
                  )}

                  {/* Zajawka czatu */}
                  <button
                    onClick={() => {
                      if (!session) { onChatAuthNeeded?.(); window.history.pushState({ layer: 'auth' }, ''); return }
                      if (!isFull) setSnap('full')
                      onChatOpenChange?.(true)
                    }}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 20, background: C.cream, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 24 }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, flexShrink: 0 }}>
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M2.5 9.8 C2.5 5.8 5.9 2.7 10 2.7 C14.1 2.7 17.5 5.8 17.5 9.8 C17.5 13.8 14.1 16.9 10 16.9 C8.9 16.9 7.9 16.7 7 16.3 L3.2 17.3 L4.1 13.8 C3.1 12.7 2.5 11.3 2.5 9.8 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: F.body, fontWeight: 800, fontSize: 14, color: C.ink }}>{t('event.conversation')}</div>
                      <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 12.5, color: C.inkSoft }}>{t('event.messageCount', { count: messages.length })}</div>
                    </div>
                    <span style={{ color: C.primary, fontSize: 18, fontWeight: 900 }}>›</span>
                  </button>
```

- [ ] **Step 8: Wymień region czatu na panel**

Usuń **cały** blok `{isFull && (<div onClick={() => setChatFocused(true)} …>…</div>)}` (dziś linie ~583–692) i wstaw w to miejsce:

```tsx
            {chatOpen && (
              <EventChatPanel
                messages={messages}
                meId={session?.user.id ?? null}
                loc={loc}
                deletedLabels={deletedLabels}
                title={event.title}
                onBack={() => onChatOpenChange?.(false)}
                input={input}
                onInputChange={setInput}
                onSend={send}
                sendErr={sendErr}
                canWrite={!!session}
              />
            )}
```

Kontener obejmujący listę i czat musi mieć `position: 'relative'`, żeby `inset: 0` panelu odnosiło się do karty:

```tsx
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
```

- [ ] **Step 9: Uprość regiony i wyczyść resztki po `chatFocused`**

Kontener listy traci podział 50/50 — zastąp jego `style`:

```tsx
              style={{ flex: 1, overflowY: isFull ? 'auto' : 'hidden', padding: '4px 20px 0' }}
```

i usuń z niego `onClick={isFull ? () => setChatFocused(false) : undefined}`.

W efekcie resetującym przewijanie usuń linię `if (!isFull) setChatFocused(false)`:

```tsx
  useEffect(() => {
    if (listRef.current && !isFull) listRef.current.scrollTop = 0
  }, [event?.id, isFull])
```

Usuń efekt przewijający `chatRef` (panel czatu robi to sam) oraz samą deklarację `const chatRef = useRef<HTMLDivElement | null>(null)`.

- [ ] **Step 10: Wymień podgląd pełnoekranowy**

Zastąp **cały** blok `{photoModal !== null && event?.photos && (…)}` (dziś linie ~697–758):

```tsx
      {photoModal !== null && event.photos && event.photos.length > 0 && (
        <PhotoLightbox
          photos={event.photos}
          index={photoModal}
          onClose={() => setPhotoModal(null)}
        />
      )}
```

- [ ] **Step 11: Sprawdź typy i lint**

Run: `npx tsc -b` oraz `npx eslint src/screens/EventSheet.tsx` (lint tylko własnych plików — patrz uwaga na początku planu)
Expected: brak błędów. Jeśli `tsc` zgłasza nieużywany import (`TagChip`, `chatRef`, `HEIGHTS`) — usuń go.

- [ ] **Step 12: Uruchom pełny zestaw testów**

Run: `npm test`
Expected: PASS — wszystkie pliki, w tym `useEvents`, `overlays`, `pushAsk`

- [ ] **Step 13: Commit**

```bash
git add src/screens/EventSheet.tsx && git commit -m "Rebuild the card around the photo, the facts and three named actions"
```

---

## Task 9: Czat jako warstwa historii

Bez tego kroku sprzętowy „wstecz" na Androidzie zamknie całą kartę zamiast czatu.

**Files:**
- Modify: `src/App.tsx` (linie ~176, ~189, ~225, ~238, ~598, ~1017–1058)

- [ ] **Step 1: Dodaj stan**

Obok `const [attendanceAskOpen, setAttendanceAskOpen] = useState(false)` (~linia 177):

```tsx
  const [eventChatOpen, setEventChatOpen] = useState(false)
```

- [ ] **Step 2: Dołóż warstwę do lustra warstw**

Typ `navLayersRef` jest wywnioskowany z wartości początkowej, więc pole trzeba dodać **w obu miejscach**.

W `useRef` (~linia 189), po `followedEventSelected,`:

```tsx
    eventChatOpen,
```

W przypisaniu w efekcie (~linia 225), po `followedEventSelected,`:

```tsx
      eventChatOpen,
```

i dopisz `eventChatOpen` do tablicy zależności tego efektu.

- [ ] **Step 3: Zamykaj czat przed wydarzeniem**

W `onPopState` (~linia 239), **po** gałęzi `authModal`, a **przed** gałęzią wydarzenia:

```tsx
      // Logowanie otwiera się nad czatem, czat nad wydarzeniem — kolejność
      // gałęzi jest tu jedyną definicją tego, co leży na czym.
      if (s.eventChatOpen) { setEventChatOpen(false); return }
```

- [ ] **Step 4: Uznaj czat za otwartą warstwę dla przycisku wstecz**

W obsłudze `CapApp.addListener('backButton')` (~linia 598) rozszerz warunek:

```tsx
      const layerOpen = !!(s.authModal || s.eventChatOpen || s.selEvent || s.myEventSelected || s.followedEventSelected ||
        s.createOpen || s.accountOpen || s.profileOpen ||
        s.screen === 'myEvents' || s.screen === 'followedEvents')
```

- [ ] **Step 5: Zeruj stan, gdy wydarzenie znika**

Poniżej efektu `onPopState`:

```tsx
  // Zamknięcie karty w dowolny sposób kończy też rozmowę — inaczej stan
  // przeciekłby na następne otwarte wydarzenie.
  useEffect(() => {
    if (!selEvent && !myEventSelected && !followedEventSelected) setEventChatOpen(false)
  }, [selEvent, myEventSelected, followedEventSelected])
```

- [ ] **Step 6: Podłącz trzy instancje karty**

Nad `return (` komponentu dodaj jeden wspólny obiekt propsów — trzy kopie tego samego rozjechałyby się przy pierwszej poprawce:

```tsx
  // Otwarcie dokłada wpis do historii, zamknięcie go zdejmuje przez back() —
  // tak samo jak każda inna warstwa w tej aplikacji.
  const eventChatProps = {
    chatOpen: eventChatOpen,
    onChatOpenChange: (open: boolean) => {
      if (open) {
        setEventChatOpen(true)
        window.history.pushState({ layer: 'eventChat' }, '')
      } else {
        window.history.back()
      }
    },
  }
```

Do **każdej** z trzech instancji `<EventSheet …>` (linie ~1018, ~1032, ~1046) dopisz jako ostatni prop:

```tsx
          {...eventChatProps}
```

- [ ] **Step 7: Sprawdź typy i lint**

Run: `npx tsc -b` oraz `npx eslint src/App.tsx` (lint tylko własnych plików — patrz uwaga na początku planu)
Expected: `tsc` bez błędów. `eslint src/App.tsx` zgłasza 7 uwag zastanych (puste bloki `catch`, `_data`, ostrzeżenie o `setState` w efekcie przy linii 291) — nowych nie może przybyć.

- [ ] **Step 8: Uruchom pełny zestaw testów**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx && git commit -m "Let back close the conversation, not the whole card"
```

---

## Task 10: Weryfikacja w przeglądarce

Testy jednostkowe nie powiedzą, czy karta się mieści ani czy tagi są czytelne na zdjęciu.

**Files:** brak zmian (chyba że weryfikacja coś wykaże)

- [ ] **Step 1: Uruchom podgląd**

Użyj narzędzia `preview_start` z `{name: "dev"}` (albo utwórz `.claude/launch.json` z `runtimeExecutable: "npm"`, `runtimeArgs: ["run","dev"]`, `port: 5173`).

- [ ] **Step 2: Sprawdź konsolę i sieć**

Użyj `read_console_messages` (`onlyErrors: true`) oraz `preview_logs` (`level: "error"`).
Expected: brak błędów. Ostrzeżenie o `ResizeObserver loop` byłoby sygnałem, że pomiar wpada w pętlę — wtedy owiń `setHalfContentH` w porównanie z poprzednią wartością.

- [ ] **Step 3: Przejdź listę kontrolną**

Otwórz wydarzenie z mapy i sprawdź kolejno, robiąc `computer {action:"screenshot"}` po każdym punkcie:

1. **half mieści całość** — zdjęcie, tytuł ze statusem, karta faktów, rząd akcji; nic nie jest ucięte i nie ma pustki pod akcjami,
2. **`resize_window {preset:"mobile"}`** (375×812) i ponownie — karta dopasowuje wysokość,
3. **wydarzenie bez zdjęcia** — kadr zastępczy trzyma proporcje, układ nie skacze,
4. **wydarzenie z ośmioma tagami** — pasek przewija się poziomo i nie zasłania zdjęcia,
5. **pasek obserwujących** — awatary w lewym górnym rogu, czytelne, nie kolidują z ×,
6. **przewinięcie w half** rozwija do full; w full treść przewija się normalnie,
7. **opis dłuższy niż 350 znaków** — `Czytaj więcej` rozwija, `Zwiń` składa,
8. **czat** — otwiera się na całą kartę pod paskiem z tytułem, przewija do ostatniej wiadomości, `‹` wraca bez utraty pozycji,
9. **podgląd pełnoekranowy** — przycisk zamykania widoczny i klikalny, zdjęcia przewijają się swipem.

- [ ] **Step 4: Sprawdź na twardo, że nic nie zniknęło**

Potwierdź obecność każdej funkcji: obserwowanie (z `FollowNotifyModal` po pierwszym follow), kalendarz (z `CalendarChooserModal` i „Inny kalendarz"), udostępnianie, Edytuj/Zakończ dla twórcy, tryb `peek` po zsunięciu karty w dół, dystans, trasa.

- [ ] **Step 5: Commit ewentualnych poprawek**

```bash
git add -A && git commit -m "Settle the card's numbers against a real screen"
```

---

## Self-review — pokrycie specu

| wymaganie ze specu | zadanie |
|---|---|
| podział pliku na jednostki | 4, 5, 6, 7, 8 |
| half: zdjęcie z carouselem | 5 |
| half: pasek wszystkich tagów na zdjęciu | 3, 5 |
| half: pasek obserwujących lewy górny róg | 5 |
| half: tytuł + status | 8 |
| half: data i godzina | 8 |
| half: miejsce + dystans + Trasa | 8 |
| half: trzy akcje z podpisami | 4, 8 |
| „Wezmę udział" = follow | 2, 8 |
| kadr zastępczy bez zdjęcia | 5 |
| wysokość half z pomiaru | 8 |
| przewinięcie rozwija do full | 8 (krok 6) |
| full: opis 350 znaków + rozwijanie | 1, 8 |
| full: Dodane przez | 8 |
| full: Edytuj/Zakończ | 8 |
| full: czat rozwijany na całą kartę | 7, 8 |
| czat przewija do ostatniej wiadomości | 7 |
| „wstecz" zamyka czat | 9 |
| naprawa przycisku podglądu | 6 |
| teksty w pięciu językach | 2 |
| weryfikacja wizualna | 10 |
