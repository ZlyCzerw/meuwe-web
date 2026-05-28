# EventSheet DateTime Range + Photo Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show full start→end datetime in the EventSheet status row, and open photos fullscreen in a modal on tap.

**Architecture:** Both changes are isolated to `src/screens/EventSheet.tsx`. Task 1 restructures the status row JSX from a single flex row to a two-line layout. Task 2 adds a `photoModal` state and a `position: fixed` overlay rendered at the end of the return.

**Tech Stack:** React 18, TypeScript, existing `C` / `INK` / `F` / `LOC_MAP` tokens, Vitest.

---

## File Map

| Action | Path | Change |
|---|---|---|
| Modify | `src/screens/EventSheet.tsx` | Status row layout + photo modal state + modal JSX |

---

## Task 1: Datetime range in status row

**Files:**
- Modify: `src/screens/EventSheet.tsx` — lines ~272–302 (full-view status row)

- [ ] **Step 1a: Locate the full-view status row**

Open `src/screens/EventSheet.tsx`. Find the comment `{/* Date + distance — one line */}` (around line 271). The block looks like this:

```tsx
                  {/* Date + distance — one line */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'nowrap',
                  }}>
                    <StatusPill status={computedStatus} />
                    {event.start_time && (
                      <span style={{ fontSize: 13, color: C.ink, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {new Date(event.start_time).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <span style={{ color: C.inkSoft, fontWeight: 700, fontSize: 13 }}>·</span>
                    <button
                      onClick={onLocate}
                      disabled={!onLocate}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none', padding: 0,
                        cursor: onLocate ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: C.primary, boxShadow: `0 0 0 3px ${C.primarySoft}` }} />
                      <span style={{
                        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                        color: onLocate ? C.primary : C.inkSoft,
                        textDecoration: onLocate ? 'underline' : 'none',
                        textDecorationStyle: 'dotted',
                        textUnderlineOffset: 3,
                      }}>
                        {t('event.distanceFrom', { dist: distStr })}
                      </span>
                    </button>
                  </div>
```

- [ ] **Step 1b: Replace with two-line layout**

Replace the entire block above with:

```tsx
                  {/* Status + datetime range + distance */}
                  <div style={{ marginBottom: 12 }}>
                    <StatusPill status={computedStatus} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'nowrap' }}>
                      {event.start_time && event.end_time && (
                        <span style={{ fontSize: 12, color: C.ink, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {new Date(event.start_time).toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {new Date(event.end_time).toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <span style={{ color: C.inkSoft, fontWeight: 700, fontSize: 13 }}>·</span>
                      <button
                        onClick={onLocate}
                        disabled={!onLocate}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: 'none', border: 'none', padding: 0,
                          cursor: onLocate ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: C.primary, boxShadow: `0 0 0 3px ${C.primarySoft}` }} />
                        <span style={{
                          fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                          color: onLocate ? C.primary : C.inkSoft,
                          textDecoration: onLocate ? 'underline' : 'none',
                          textDecorationStyle: 'dotted',
                          textUnderlineOffset: 3,
                        }}>
                          {t('event.distanceFrom', { dist: distStr })}
                        </span>
                      </button>
                    </div>
                  </div>
```

- [ ] **Step 1c: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 1d: Run tests**

```bash
npm test
```

Expected: all 49 tests pass

- [ ] **Step 1e: Commit**

```bash
git add src/screens/EventSheet.tsx
git commit -m "feat: show full datetime range in EventSheet status row"
```

---

## Task 2: Photo modal

**Files:**
- Modify: `src/screens/EventSheet.tsx` — add state, img onClick, modal JSX

- [ ] **Step 2a: Add `photoModal` state**

In `src/screens/EventSheet.tsx`, find the existing state declarations (around lines 39–43):

```ts
  const [snap, setSnap] = useState<Snap>('half')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sendErr, setSendErr] = useState('')
  const [photoIdx, setPhotoIdx] = useState(0)
```

Add one line after `photoIdx`:

```ts
  const [photoModal, setPhotoModal] = useState<number | null>(null)
```

- [ ] **Step 2b: Add `onClick` to carousel image**

Find the carousel `<img>` (around line 214):

```tsx
                      <img
                        src={event.photos[Math.min(photoIdx, event.photos.length - 1)]}
                        alt=""
                        style={{
                          width: '100%', height: 180, borderRadius: 20,
                          objectFit: 'cover', display: 'block',
                          border: `2px solid ${INK}11`,
                        }}
                      />
```

Replace with:

```tsx
                      <img
                        src={event.photos[Math.min(photoIdx, event.photos.length - 1)]}
                        alt=""
                        onClick={() => setPhotoModal(photoIdx)}
                        style={{
                          width: '100%', height: 180, borderRadius: 20,
                          objectFit: 'cover', display: 'block',
                          border: `2px solid ${INK}11`,
                          cursor: 'pointer',
                        }}
                      />
```

- [ ] **Step 2c: Add modal JSX**

Find the closing `</div>` of the outermost container in the EventSheet return (the last `</div>` before the final `)`). Just before it, add the photo modal:

```tsx
      {/* Photo modal */}
      {photoModal !== null && event?.photos && (
        <div
          onClick={() => setPhotoModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setPhotoModal(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
              color: '#fff', fontSize: 20, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >×</button>

          <img
            src={event.photos[photoModal]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain', borderRadius: 12,
              display: 'block',
            }}
          />

          {event.photos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setPhotoModal(Math.max(0, photoModal - 1)) }}
                disabled={photoModal === 0}
                style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
                  color: '#fff', fontSize: 22, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: photoModal === 0 ? 0.3 : 1,
                }}
              >‹</button>
              <button
                onClick={e => { e.stopPropagation(); setPhotoModal(Math.min(event.photos!.length - 1, photoModal + 1)) }}
                disabled={photoModal === event.photos!.length - 1}
                style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
                  color: '#fff', fontSize: 22, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: photoModal === event.photos!.length - 1 ? 0.3 : 1,
                }}
              >›</button>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 2d: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2e: Run tests**

```bash
npm test
```

Expected: all 49 tests pass

- [ ] **Step 2f: Manual smoke test**

Start dev server (`npm run dev`). Open an event with photos:

1. Tap a photo — modal opens with dark background and the photo centred
2. Tap outside the photo (dark area) — modal closes
3. Tap `×` button — modal closes
4. If event has multiple photos: `‹` / `›` buttons navigate between photos; first photo disables `‹`, last disables `›`
5. Modal renders on top of everything (status bar, buttons, chat)

- [ ] **Step 2g: Commit**

```bash
git add src/screens/EventSheet.tsx
git commit -m "feat: tap photo to open fullscreen modal with navigation"
```
