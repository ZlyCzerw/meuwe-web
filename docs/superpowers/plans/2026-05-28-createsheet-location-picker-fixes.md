# CreateSheet & Location Picker Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Time section above Photos/Tags in CreateSheet, add address autocomplete to the location picker, and fix the SearchBar dropdown z-index on the main map.

**Architecture:** Three independent edits — one JSX reorder in `CreateSheet.tsx`, one set of i18n key additions across 4 locale files, and one structural + z-index change in `MapScreen.tsx`. No new components, no new dependencies; reuses existing `SearchBar` component.

**Tech Stack:** React 18, TypeScript, react-i18next, Nominatim (already used by SearchBar), Vitest.

---

## File Map

| Action | Path | Change |
|---|---|---|
| Modify | `src/screens/CreateSheet.tsx` | Move Time block from after Tags to after Title input |
| Modify | `src/locales/pl.ts` | Add `map.pickLocationHintAlt` |
| Modify | `src/locales/en.ts` | Add `map.pickLocationHintAlt` |
| Modify | `src/locales/de.ts` | Add `map.pickLocationHintAlt` |
| Modify | `src/locales/es.ts` | Add `map.pickLocationHintAlt` |
| Modify | `src/screens/MapScreen.tsx` | Raise SearchBar wrapper zIndex; restructure location picker banner |

---

## Task 1: Move Time section in CreateSheet

**Files:**
- Modify: `src/screens/CreateSheet.tsx`

- [ ] **Step 1a: Remove Time block from its current position**

In `src/screens/CreateSheet.tsx`, find and delete the Time section block (currently between the Tags section and the Description section). It starts with:

```tsx
        {/* Time section */}
        <button
          onClick={() => setTimeExpanded(te => !te)}
```

and ends with:

```tsx
        </button>

        {/* Description */}
```

Delete everything from `{/* Time section */}` up to (but not including) `{/* Description */}`.

- [ ] **Step 1b: Insert Time block after the Title input**

Find the Title input block (ends with `marginBottom: 20`):

```tsx
        {/* Title input */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('create.namePlaceholder')}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 24,
            background: C.cream,
            fontSize: 18,
            fontWeight: 700,
            color: C.ink,
            marginBottom: 20,
            display: 'block',
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Photos section */}
```

Replace with (inserting the Time block between Title and Photos):

```tsx
        {/* Title input */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('create.namePlaceholder')}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 24,
            background: C.cream,
            fontSize: 18,
            fontWeight: 700,
            color: C.ink,
            marginBottom: 20,
            display: 'block',
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Time section */}
        <button
          onClick={() => setTimeExpanded(te => !te)}
          style={{
            width: '100%', textAlign: 'left',
            padding: '14px 16px', borderRadius: 20,
            background: C.cream, marginBottom: 18, display: 'block',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 11, color: C.inkSoft, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
              }}>{t('create.timeLabel')}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                {timeExpanded ? t('create.timePick') : (
                  <>{t('create.timeNow')} · <span style={{ color: C.primary }}>{t('create.timeIn24h')}</span></>
                )}
              </div>
            </div>
            <div style={{
              fontSize: 18, color: C.inkSoft, fontWeight: 800,
              transform: timeExpanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 220ms ease',
            }}>⌄</div>
          </div>
          {timeExpanded && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{t('create.timeFrom')}</div>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
                />
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{t('create.timeTo')}</div>
                <input
                  type="datetime-local"
                  value={endTime}
                  min={startTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
                />
              </div>
            </div>
          )}
        </button>

        {/* Photos section */}
```

- [ ] **Step 1c: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1d: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 1e: Commit**

```bash
git add src/screens/CreateSheet.tsx
git commit -m "feat: move Time section above Photos/Tags in CreateSheet"
```

---

## Task 2: Add `pickLocationHintAlt` i18n keys

**Files:**
- Modify: `src/locales/pl.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/de.ts`
- Modify: `src/locales/es.ts`

- [ ] **Step 2a: Add key to `src/locales/pl.ts`**

Find:
```ts
    pickLocationHint: 'Przesuń mapę, aby wybrać lokalizację',
```

Replace with:
```ts
    pickLocationHint: 'Przesuń mapę, aby wybrać lokalizację',
    pickLocationHintAlt: 'lub przesuń mapę, aby wybrać lokalizację',
```

- [ ] **Step 2b: Add key to `src/locales/en.ts`**

Find:
```ts
    pickLocationHint: 'Move the map to select a location',
```

Replace with:
```ts
    pickLocationHint: 'Move the map to select a location',
    pickLocationHintAlt: 'or move the map to select a location',
```

- [ ] **Step 2c: Add key to `src/locales/de.ts`**

Find:
```ts
    pickLocationHint: 'Karte verschieben, um Standort zu wählen',
```

Replace with:
```ts
    pickLocationHint: 'Karte verschieben, um Standort zu wählen',
    pickLocationHintAlt: 'oder Karte verschieben, um Standort zu wählen',
```

- [ ] **Step 2d: Add key to `src/locales/es.ts`**

Find:
```ts
    pickLocationHint: 'Mueve el mapa para elegir la ubicación',
```

Replace with:
```ts
    pickLocationHint: 'Mueve el mapa para elegir la ubicación',
    pickLocationHintAlt: 'o mueve el mapa para elegir la ubicación',
```

- [ ] **Step 2e: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2f: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/de.ts src/locales/es.ts
git commit -m "i18n: add pickLocationHintAlt key to all locales"
```

---

## Task 3: MapScreen — SearchBar z-index fix + search in location picker

**Files:**
- Modify: `src/screens/MapScreen.tsx`

- [ ] **Step 3a: Raise SearchBar wrapper z-index**

Find (around line 210):
```tsx
      {/* Search bar */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', top: 16, left: 80, right: 16, zIndex: 10 }}>
          <SearchBar onSelect={p => leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })} />
        </div>
      )}
```

Replace with:
```tsx
      {/* Search bar */}
      {!pickingLocation && (
        <div style={{ position: 'absolute', top: 16, left: 80, right: 16, zIndex: 20 }}>
          <SearchBar onSelect={p => leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })} />
        </div>
      )}
```

- [ ] **Step 3b: Restructure location picker banner to include SearchBar**

Find the entire top banner block:
```tsx
          {/* Top banner */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            padding: '52px 20px 16px',
            background: 'linear-gradient(180deg, rgba(255,246,236,0.97) 0%, rgba(255,246,236,0.85) 100%)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <button
              onClick={() => onLocationPicked?.(userPos || WARSAW)}
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: '#fff', border: `2px solid ${INK}22`,
                fontSize: 18, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >‹</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 17, color: C.ink }}>
                {t('map.pickLocation')}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
                {t('map.pickLocationHint')}
              </div>
            </div>
            <div style={{ width: 40 }} />
          </div>
```

Replace with:
```tsx
          {/* Top banner */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            padding: '52px 20px 16px',
            background: 'linear-gradient(180deg, rgba(255,246,236,0.97) 0%, rgba(255,246,236,0.85) 100%)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => onLocationPicked?.(userPos || WARSAW)}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: '#fff', border: `2px solid ${INK}22`,
                  fontSize: 18, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >‹</button>
              <div style={{ flex: 1, textAlign: 'center', fontFamily: F.display, fontWeight: 900, fontSize: 17, color: C.ink }}>
                {t('map.pickLocation')}
              </div>
              <div style={{ width: 40 }} />
            </div>
            {/* Address search */}
            <div style={{ position: 'relative', zIndex: 50 }}>
              <SearchBar onSelect={p => leafRef.current?.flyTo([p.lat, p.lng], 15, { duration: 0.7 })} />
            </div>
            {/* Hint */}
            <div style={{ textAlign: 'center', fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
              {t('map.pickLocationHintAlt')}
            </div>
          </div>
```

- [ ] **Step 3c: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3d: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3e: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "feat: add address search to location picker, fix SearchBar dropdown z-index"
```
