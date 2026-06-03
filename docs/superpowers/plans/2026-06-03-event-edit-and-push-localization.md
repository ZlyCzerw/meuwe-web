# Event Edit + Push Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an event's creator edit it (not just end it), and localize all push notifications into pl/en/es/de.

**Architecture:** Phase 1 turns the single-purpose `CreateSheet` into a dual-mode create/edit form driven by an optional `editEvent` prop, backed by a new `db.updateEvent`; `EventSheet` gains a second "Edytuj" button and `App` wires the edit launch + refresh. Phase 2 adds a `profiles.language` column written from the client, a shared edge-function translations module, and per-language push fan-out across the 3 existing functions plus a new `push-event-updated` function triggered by an `events` UPDATE webhook.

**Tech Stack:** React + TypeScript (Vite), Supabase (Postgres, RLS, Edge Functions on Deno), Vitest, web-push.

**Reference spec:** `docs/superpowers/specs/2026-06-03-event-edit-and-push-localization-design.md`

**Conventions for this repo:**
- Type-check / build with `npx tsc -b` (Cloudflare is stricter than `--noEmit`).
- Tests: `npx vitest run`.
- All user-facing UI/error strings go through `t('...')` in **all four** locales (`pl`, `en`, `es`, `de`).
- Commit messages: no `Co-Authored-By` trailer.

---

## Phase 1 — Event editing

### Task 1: Photo slot model + resolver

**Files:**
- Create: `src/lib/photoSlots.ts`
- Test: `src/lib/photoSlots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/photoSlots.test.ts
import { describe, it, expect, vi } from 'vitest'
import { resolvePhotoUrls, type PhotoSlot } from './photoSlots'

describe('resolvePhotoUrls', () => {
  it('keeps existing urls and uploads new files, preserving order, skipping null', async () => {
    const upload = vi.fn(async (f: File) => `uploaded://${f.name}`)
    const slots: PhotoSlot[] = [
      { kind: 'existing', url: 'https://old/1.jpg' },
      null,
      { kind: 'new', file: new File([''], 'fresh.png'), preview: 'blob:x' },
    ]
    const urls = await resolvePhotoUrls(slots, upload)
    expect(urls).toEqual(['https://old/1.jpg', 'uploaded://fresh.png'])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('returns empty array when all slots are null', async () => {
    const upload = vi.fn()
    expect(await resolvePhotoUrls([null, null, null], upload)).toEqual([])
    expect(upload).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/photoSlots.test.ts`
Expected: FAIL — cannot resolve module `./photoSlots`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/photoSlots.ts
export type PhotoSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; preview: string }
  | null

/**
 * Turn the create/edit photo slots into the final ordered `photos` URL array.
 * Existing slots keep their URL; new slots are uploaded via `upload`. Nulls skipped.
 */
export async function resolvePhotoUrls(
  slots: PhotoSlot[],
  upload: (file: File) => Promise<string>,
): Promise<string[]> {
  const urls: string[] = []
  for (const slot of slots) {
    if (!slot) continue
    if (slot.kind === 'existing') urls.push(slot.url)
    else urls.push(await upload(slot.file))
  }
  return urls
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/photoSlots.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/photoSlots.ts src/lib/photoSlots.test.ts
git commit -m "feat: photo slot model + resolver for create/edit form"
```

---

### Task 2: `db.updateEvent`

**Files:**
- Modify: `src/lib/supabase.ts` (add method after `endEvent`, ~line 203)
- Test: `src/lib/supabase.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/supabase.test.ts`:

```ts
describe('db.updateEvent', () => {
  it('returns error when session is null', async () => {
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(mockGetSession)

    const result = await db.updateEvent('some-event-id', {
      title: 'x', lat: 0, lng: 0, category: 'party',
      tags: [], start_time: 'a', end_time: 'b', photos: [],
    })
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase.test.ts`
Expected: FAIL — `db.updateEvent is not a function`.

- [ ] **Step 3: Implement `updateEvent`**

In `src/lib/supabase.ts`, immediately after the `endEvent` method (after line 203, before `getMessages`):

```ts
  async updateEvent(eventId: string, ev: {
    title: string; description?: string; lat: number; lng: number;
    category?: string; tags?: string[];
    start_time: string; end_time: string; photos: string[];
  }) {
    const sess = await this.getSession()
    if (!sess) return { data: null, error: { message: 'not authenticated' } }
    // `.eq('creator_id', …)` is defense-in-depth; RLS already enforces it (mirrors endEvent).
    const { data, error } = await supabase
      .from('events')
      .update({
        title: ev.title, description: ev.description, lat: ev.lat, lng: ev.lng,
        category: ev.category || 'party',
        start_time: ev.start_time, end_time: ev.end_time, photos: ev.photos,
      })
      .eq('id', eventId)
      .eq('creator_id', sess.user.id)
      .select('*,profiles(display_name,avatar_color),event_tags(tag)')
      .single()
    if (!error && data) {
      await supabase.from('event_tags').delete().eq('event_id', eventId)
      if (ev.tags?.length) {
        await supabase.from('event_tags').insert(ev.tags.map(tag => ({ event_id: eventId, tag })))
      }
    }
    return { data, error }
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/supabase.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat: db.updateEvent to edit an existing event"
```

---

### Task 3: i18n `edit` namespace + edit button label

**Files:**
- Modify: `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`

- [ ] **Step 1: Add `event.editEvent` key**

In each locale's `event: { … }` block, add a key next to `endEvent`:

- `pl.ts`: `editEvent: 'Edytuj wydarzenie',`
- `en.ts`: `editEvent: 'Edit event',`
- `es.ts`: `editEvent: 'Editar evento',`
- `de.ts`: `editEvent: 'Event bearbeiten',`

- [ ] **Step 2: Add the `edit` namespace block**

Add a new top-level `edit: { … }` block (place it right after the `create: { … }` block) in each locale:

`pl.ts`:
```ts
  edit: {
    title: 'Edytuj wydarzenie',
    submit: 'Zapisz zmiany',
    updated: 'Wydarzenie zaktualizowane',
  },
```
`en.ts`:
```ts
  edit: {
    title: 'Edit event',
    submit: 'Save changes',
    updated: 'Event updated',
  },
```
`es.ts`:
```ts
  edit: {
    title: 'Editar evento',
    submit: 'Guardar cambios',
    updated: 'Evento actualizado',
  },
```
`de.ts`:
```ts
  edit: {
    title: 'Event bearbeiten',
    submit: 'Änderungen speichern',
    updated: 'Event aktualisiert',
  },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors (locale shapes stay consistent across all four files).

- [ ] **Step 4: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts
git commit -m "i18n: add edit namespace + editEvent label (pl/en/es/de)"
```

---

### Task 4: `CreateSheet` dual-mode (create | edit)

**Files:**
- Modify: `src/screens/CreateSheet.tsx`

This task is mostly manual edits verified by `tsc -b` + the existing test suite. Apply the changes below in order.

- [ ] **Step 1: Update imports and props**

At the top, add the import:
```ts
import { resolvePhotoUrls, type PhotoSlot } from '../lib/photoSlots'
import type { EventWithMeta } from '../lib/types'
```
Remove the now-unused `useState` import only if nothing else needs it (it is still needed — keep it). Add `useRef` to the React import:
```ts
import { useState, useEffect, useRef } from 'react'
```

Extend the component prop type (the object after `function CreateSheet({ … }: { … }`):
```ts
  editEvent?: EventWithMeta | null
  onUpdated?: (updated: EventWithMeta) => void
```
And add `editEvent` and `onUpdated` to the destructured params list.

- [ ] **Step 2: Switch photo state to `PhotoSlot[]`**

Change the photos state declaration (line ~52):
```ts
  const [photos, setPhotos] = useState<PhotoSlot[]>([null, null, null])
```
Add a prefill guard ref near the other refs:
```ts
  const prefilledIdRef = useRef<string | null>(null)
```

- [ ] **Step 3: Add the prefill effect**

Add this effect (place it after the existing `useEffect` blocks, before `submit`):
```ts
  // Prefill the form when entering edit mode. Keyed on editEvent.id and guarded so
  // it runs once per event — it must NOT re-run after the location-picker round-trip
  // (the component stays mounted; re-prefilling would wipe the moderator's edits).
  useEffect(() => {
    if (editEvent) {
      if (prefilledIdRef.current === editEvent.id) return
      prefilledIdRef.current = editEvent.id
      setTitle(editEvent.title)
      setDesc(editEvent.description ?? '')
      setTags(editEvent.tags ?? [])
      setStartTime(new Date(editEvent.start_time).toISOString().slice(0, 16))
      setEndTime(new Date(editEvent.end_time).toISOString().slice(0, 16))
      const slots: PhotoSlot[] = [null, null, null]
      ;(editEvent.photos ?? []).slice(0, 3).forEach((url, i) => { slots[i] = { kind: 'existing', url } })
      setPhotos(slots)
      setTimeExpanded(true)
      setErr('')
    } else {
      prefilledIdRef.current = null
    }
  }, [editEvent?.id]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Disable auto end-time coupling in edit mode**

Change the existing "auto-set end" effect (lines ~73-75) so it is inert during edit:
```ts
  // Auto-set end time to start + 24h whenever start changes — create mode only.
  useEffect(() => {
    if (editEvent) return
    setEndTime(new Date(new Date(startTime).getTime() + 86_400_000).toISOString().slice(0, 16))
  }, [startTime, editEvent]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Update `submit` to branch create vs update**

Replace the body of `submit` from the photo-upload section through the success reset. The validation header (title/submitting guard, start/end check) stays. Replace the photo upload + create call + reset with:

```ts
    // Upload new photos, keep existing URLs, preserve slot order.
    let photoUrls: string[]
    try {
      photoUrls = await resolvePhotoUrls(photos, f => db.uploadEventPhoto(f))
    } catch {
      setErr(t('create.photoUploadError'))
      setSubmitting(false)
      return
    }
    const pos = defaultPos || { lat: 52.2297, lng: 21.0122 }

    if (editEvent) {
      const { data, error } = await db.updateEvent(editEvent.id, {
        title: title.trim(),
        description: desc,
        lat: pos.lat,
        lng: pos.lng,
        category: tags[0] || 'party',
        tags,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        photos: photoUrls,
      })
      setSubmitting(false)
      if (error || !data) { setErr(t('create.submitError')); return }
      const updated = { ...(data as any), tags: ((data as any).event_tags ?? []).map((x: any) => x.tag), distKm: 0, distStr: '' } as EventWithMeta
      onUpdated?.(updated)
      return
    }

    const { data, error } = await db.createEvent({
      title: title.trim(),
      description: desc,
      lat: pos.lat,
      lng: pos.lng,
      tags,
      category: tags[0] || 'party',
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      photos: photoUrls,
    })
    setSubmitting(false)
    if (error) {
      setErr(t('create.submitError'))
      return
    }
    setTitle('')
    setTags([])
    setDesc('')
    setPhotos([null, null, null])
    setTimeExpanded(false)
    onSubmit(data)
```

(The earlier `const files = photos.filter(...)` line and the old `Promise.all` upload block are removed — `resolvePhotoUrls` replaces them.)

- [ ] **Step 6: Update header + submit labels**

Header text (line ~164): `{editEvent ? t('edit.title') : t('create.title')}`.
Submit button label (line ~558): `{editEvent ? t('edit.submit') : t('create.submit')}`.
The submit button's `disabled`/`background`/`border` already key off `title.trim()` — leave as-is (prefill sets the title, so it renders enabled in edit mode).

- [ ] **Step 7: Update photo slot rendering for both kinds**

In the `[0,1,2].map(i => { const slot = photos[i] … })` block:
- The thumbnail `img` src becomes: `src={slot.kind === 'existing' ? slot.url : slot.preview}`.
- The `×` remove handler becomes (revoke only for new slots):
```ts
                          onClick={e => {
                            e.preventDefault()
                            if (slot.kind === 'new') URL.revokeObjectURL(slot.preview)
                            setPhotos(prev => {
                              const next = [...prev]
                              next[i] = null
                              return next
                            })
                          }}
```
- In the per-slot file `<input onChange>` and the camera `<input onChange>`, the object assigned to a slot becomes a tagged `new` slot:
```ts
                      next[i] = { kind: 'new', file, preview }
```
and for the camera handler:
```ts
                      if (emptyIdx !== -1) next[emptyIdx] = { kind: 'new', file, preview }
```
- The "all slots filled" guard `photos.filter(p => p !== null).length < 3` is unchanged.

- [ ] **Step 8: Type-check and run tests**

Run: `npx tsc -b`
Expected: no errors.
Run: `npx vitest run`
Expected: PASS (existing suite unaffected).

- [ ] **Step 9: Commit**

```bash
git add src/screens/CreateSheet.tsx
git commit -m "feat: CreateSheet dual-mode create/edit with prefill and photo slots"
```

---

### Task 5: `EventSheet` — Edit + End buttons

**Files:**
- Modify: `src/screens/EventSheet.tsx`

- [ ] **Step 1: Add the `onEdit` prop**

In the props object type add:
```ts
  onEdit?: (event: EventWithMeta) => void
```
and add `onEdit` to the destructured params.

- [ ] **Step 2: Replace the single end button with a two-button row**

Replace the block at lines ~359-364 (`{/* End event (creator only) */} … }`) with:

```tsx
                  {/* Edit + End (creator only, while not ended) */}
                  {session?.user.id === event.creator_id && computedStatus !== 'ended' && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <button
                        onClick={() => onEdit?.(event)}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: C.primary, border: `2px solid ${INK}`, color: '#fff', fontSize: 14, fontWeight: 800, boxShadow: '0 4px 12px rgba(255,122,69,0.30)' }}
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors (`EventWithMeta` is already imported in this file).

- [ ] **Step 4: Commit**

```bash
git add src/screens/EventSheet.tsx
git commit -m "feat: EventSheet shows Edit + End buttons for the creator"
```

---

### Task 6: `App` wiring — launch edit + refresh

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add editing state**

Next to the other `useState` calls (near line 43-44), add:
```ts
  const [editingEvent, setEditingEvent] = useState<EventWithMeta | null>(null)
```

- [ ] **Step 2: Add `handleEdit`**

Add this function near `handleSubmit` (after line ~181):
```ts
  function handleEdit(ev: EventWithMeta) {
    // Edit is launched from EventSheet, which can live in the MyEvents/Followed
    // overlays where CreateSheet is gated `!isOverlay`. Route every edit through
    // the map context so the single mounted CreateSheet is usable and we can
    // re-open the updated event afterward.
    setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
    setProfileOpen(false)
    setScreen('map')
    setEditingEvent(ev)
    setCreatePos({ lat: ev.lat, lng: ev.lng })
    setLocationPicked(true)
    setCreateOpen(true)
  }
```

- [ ] **Step 3: Pass `onEdit` to all three EventSheet instances**

Add `onEdit={handleEdit}` as a prop to each of the three `<EventSheet … />` usages (the `myEventSelected`, `followedEventSelected`, and `selEvent` blocks at lines ~259, ~270, ~281).

- [ ] **Step 4: Wire `editEvent` + `onUpdated` + clear-on-close into CreateSheet**

Update the `<CreateSheet … />` usage (line ~307):
```tsx
      <CreateSheet
        open={createOpen && !isOverlay}
        onClose={() => { setCreateOpen(false); setCreatePos(null); setLocationPicked(false); setEditingEvent(null) }}
        onSubmit={handleSubmit}
        editEvent={editingEvent}
        onUpdated={(updated) => {
          setEditingEvent(null)
          setCreateOpen(false)
          setCreatePos(null)
          setLocationPicked(false)
          setEventsRefreshKey(k => k + 1)
          setSelEvent(updated)
          flyToFnRef.current?.(updated.lat, updated.lng)
          showToast(t('edit.updated'))
        }}
        defaultPos={createPos || userPos}
        locationPicked={locationPicked}
        onPickLocation={() => { setCreateOpen(false); setPickingLocation(true) }}
      />
```

- [ ] **Step 5: Type-check, lint, test**

Run: `npx tsc -b`
Expected: no errors.
Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire event editing launch and post-save refresh in App"
```

---

### Task 7: Phase 1 manual verification checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: `tsc -b` + `vite build` succeed with no errors.

- [ ] **Step 2: Manual smoke test (dev server)**

Run: `npm run dev`, then as the event creator:
1. Open one of your own events → confirm **Edytuj wydarzenie** and **Zakończ wydarzenie** both appear.
2. Click **Edytuj** → card opens pre-filled: title, time (expanded), tags, description, existing photos in slots, current location address shown.
3. Remove an existing photo (×), add a new one, change the title, then **Save changes** → toast "Wydarzenie zaktualizowane", event re-opens with the new data.
4. Click **Edytuj** again → **Change location** (picker) → pick a new point → returns to the edit card with your edits intact (title/photos not reset) and the new address shown → Save.
5. Confirm a non-creator viewing the event sees neither button.

- [ ] **Step 3: Commit (if any fixups were needed)**

```bash
git commit -am "fix: phase 1 edit-flow fixups from manual verification"
```
(Skip if nothing changed.)

---

## Phase 2 — Push notification localization

### Task 8: `profiles.language` column + Profile type

**Files:**
- Create: `supabase/migrations/<timestamp>_add_profiles_language.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260603000000_add_profiles_language.sql` (use the actual current UTC timestamp if your tooling requires uniqueness):
```sql
alter table public.profiles
  add column if not exists language text;

-- Preserve current behavior: existing users default to Polish.
update public.profiles set language = 'pl' where language is null;
```

- [ ] **Step 2: Add `language` to the `Profile` type**

In `src/lib/types.ts`, inside `interface Profile`, add after `push_enabled`:
```ts
  language: string | null
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260603000000_add_profiles_language.sql src/lib/types.ts
git commit -m "feat: add profiles.language column + Profile type field"
```

> **Ops:** apply this migration to the Supabase project before deploying the edge functions in later tasks.

---

### Task 9: `db.updateProfileLanguage` + client write

**Files:**
- Modify: `src/lib/supabase.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the DB method**

In `src/lib/supabase.ts`, after `updateProfileLocation` (~line 32), add:
```ts
  async updateProfileLanguage(uid: string, language: string) {
    return supabase.from('profiles').upsert({ id: uid, language })
  },
```

- [ ] **Step 2: Write the language from the client**

In `src/App.tsx`, add an effect that persists the active language whenever it (or the session) changes, and on i18next `languageChanged`. Place it near the other session effects:
```ts
  // Persist the user's UI language so edge functions can localize push notifications.
  useEffect(() => {
    if (!session) return
    const write = () => db.updateProfileLanguage(session.user.id, i18n.language)
    write()
    i18n.on('languageChanged', write)
    return () => { i18n.off('languageChanged', write) }
  }, [session?.user.id]) // eslint-disable-line react-hooks/exhaustive-deps
```
Ensure `i18n` is available: `const { t, i18n } = useTranslation()` (update the existing `const { t } = useTranslation()` at line ~23).

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc -b`
Expected: no errors.
Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts src/App.tsx
git commit -m "feat: persist user UI language to profiles for push localization"
```

---

### Task 10: Shared edge-function translations module

**Files:**
- Create: `supabase/functions/_shared/notif-i18n.ts`
- Test: `supabase/functions/_shared/notif-i18n.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/notif-i18n.test.ts
import { describe, it, expect } from 'vitest'
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from './notif-i18n'

describe('pickLang', () => {
  it('normalizes supported languages and strips region', () => {
    expect(pickLang('en')).toBe('en')
    expect(pickLang('es-ES')).toBe('es')
    expect(pickLang('DE')).toBe('de')
  })
  it('falls back to pl for null/unknown', () => {
    expect(pickLang(null)).toBe('pl')
    expect(pickLang('fr')).toBe('pl')
    expect(pickLang(undefined)).toBe('pl')
  })
})

describe('NOTIF_TEXT', () => {
  it('has all four languages for new_event title', () => {
    expect(NOTIF_TEXT.new_event.title).toEqual({
      pl: 'Nowe wydarzenie w pobliżu',
      en: 'New event nearby',
      es: 'Nuevo evento cerca de ti',
      de: 'Neues Event in der Nähe',
    })
  })
  it('has update body and message fallback name', () => {
    expect(NOTIF_TEXT.update.body!.de).toBe('Das Event wurde aktualisiert')
    expect(NOTIF_TEXT.message.body!.es).toBe('Alguien')
  })
})

describe('groupSubsByLang', () => {
  it('buckets subs by their user language, defaulting to pl', () => {
    const langByUser = new Map<string, Lang>([['u1', 'en'], ['u2', 'de']])
    const subs = [
      { id: 's1', user_id: 'u1' },
      { id: 's2', user_id: 'u2' },
      { id: 's3', user_id: 'u3' }, // unknown → pl
    ]
    const groups = groupSubsByLang(subs, langByUser)
    expect(groups.get('en')!.map(s => s.id)).toEqual(['s1'])
    expect(groups.get('de')!.map(s => s.id)).toEqual(['s2'])
    expect(groups.get('pl')!.map(s => s.id)).toEqual(['s3'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/notif-i18n.test.ts`
Expected: FAIL — cannot resolve `./notif-i18n`.

- [ ] **Step 3: Implement the module**

```ts
// supabase/functions/_shared/notif-i18n.ts
// Static notification strings only. Dynamic parts (event title, author name,
// message text) are never translated here.
export type Lang = 'pl' | 'en' | 'es' | 'de'
export type NotifType = 'new_event' | 'event_start' | 'update' | 'message'

const SUPPORTED: readonly Lang[] = ['pl', 'en', 'es', 'de']

export function pickLang(lang: string | null | undefined): Lang {
  const l = (lang ?? '').slice(0, 2).toLowerCase()
  return (SUPPORTED as readonly string[]).includes(l) ? (l as Lang) : 'pl'
}

export const NOTIF_TEXT: Record<NotifType, Partial<Record<'title' | 'body', Record<Lang, string>>>> = {
  new_event: {
    title: {
      pl: 'Nowe wydarzenie w pobliżu',
      en: 'New event nearby',
      es: 'Nuevo evento cerca de ti',
      de: 'Neues Event in der Nähe',
    },
  },
  event_start: {
    title: {
      pl: 'Wydarzenie zaraz się zaczyna',
      en: 'An event is about to start',
      es: 'Un evento está por comenzar',
      de: 'Ein Event beginnt gleich',
    },
  },
  update: {
    body: {
      pl: 'Wydarzenie zostało zaktualizowane',
      en: 'The event has been updated',
      es: 'El evento ha sido actualizado',
      de: 'Das Event wurde aktualisiert',
    },
  },
  message: {
    // anonymous-author fallback name
    body: {
      pl: 'Ktoś',
      en: 'Someone',
      es: 'Alguien',
      de: 'Jemand',
    },
  },
}

export function groupSubsByLang<T extends { user_id: string }>(
  subs: T[],
  langByUser: Map<string, Lang>,
): Map<Lang, T[]> {
  const groups = new Map<Lang, T[]>()
  for (const sub of subs) {
    const lang = langByUser.get(sub.user_id) ?? 'pl'
    const arr = groups.get(lang) ?? []
    arr.push(sub)
    groups.set(lang, arr)
  }
  return groups
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/notif-i18n.test.ts`
Expected: PASS (all blocks).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/notif-i18n.ts supabase/functions/_shared/notif-i18n.test.ts
git commit -m "feat: shared edge-function notification translations module"
```

---

### Task 11: Localize `push-new-event` and `push-event-start`

**Files:**
- Modify: `supabase/functions/push-new-event/index.ts`
- Modify: `supabase/functions/push-event-start/index.ts`

These are Deno functions (not covered by `tsc -b`/vitest); verify by review + the deploy/manual check in Task 13.

- [ ] **Step 1: `push-new-event` — fetch language, carry user_id, fan out per language**

Import the helper at the top:
```ts
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
```
Add `language` to the profiles select (line ~63-68):
```ts
    .select('id, interests, radius_km, last_lat, last_lng, language')
```
and extend the `Profile` type (line ~73):
```ts
  type Profile = { id: string; interests: string[] | null; radius_km: number | null; last_lat: number; last_lng: number; language: string | null }
```
Build a `langByUser` map after computing `targetIds` (the filtered profiles are in scope — capture them):
```ts
  const langByUser = new Map<string, Lang>(
    (profiles ?? []).map((p: Profile) => [p.id, pickLang(p.language)])
  )
```
Add `user_id` to the subs select (line ~93-96):
```ts
    .select('id, endpoint, p256dh, auth_key, user_id')
```
Replace the single `sendToMany(...)` call (lines ~105-110) with a per-language loop:
```ts
  const groups = groupSubsByLang(subs, langByUser)
  for (const [lang, langSubs] of groups) {
    await sendToMany(
      langSubs,
      { title: NOTIF_TEXT.new_event.title![lang], body: eventTitle, type: 'new_event', eventId },
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
      admin
    )
  }
```

- [ ] **Step 2: `push-event-start` — same treatment**

Import the helper:
```ts
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
```
Add `language` to the profiles select (line ~58-63):
```ts
    .select('id, interests, radius_km, last_lat, last_lng, language')
```
Extend the `Profile` type (line ~56):
```ts
  type Profile = { id: string; interests: string[] | null; radius_km: number | null; last_lat: number; last_lng: number; language: string | null }
```
Build `langByUser` once after the profiles fetch (before the `for (const event of events)` loop):
```ts
  const langByUser = new Map<string, Lang>(
    (profiles ?? []).map((p: Profile) => [p.id, pickLang(p.language)])
  )
```
Add `user_id` to the subs select inside the loop (line ~82-83):
```ts
        .from('push_subscriptions').select('id, endpoint, p256dh, auth_key, user_id').in('user_id', targetIds)
```
Replace the `sendToMany(...)` block (lines ~85-90) with:
```ts
        const groups = groupSubsByLang(subs, langByUser)
        for (const [lang, langSubs] of groups) {
          await sendToMany(
            langSubs,
            { title: NOTIF_TEXT.event_start.title![lang], body: event.title, type: 'event_start', eventId: event.id },
            VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
            admin
          )
        }
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/push-new-event/index.ts supabase/functions/push-event-start/index.ts
git commit -m "feat: localize push-new-event and push-event-start per user language"
```

---

### Task 12: Localize `push-new-message`

**Files:**
- Modify: `supabase/functions/push-new-message/index.ts`

- [ ] **Step 1: Import helper + fetch language**

Import:
```ts
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'
```
Change the push-enabled profiles select (line ~89-93) to also fetch language:
```ts
  const { data: enabledProfiles } = await admin
    .from('profiles')
    .select('id, language')
    .in('id', finalRecipients)
    .eq('push_enabled', true)

  const enabledRecipients = (enabledProfiles ?? []).map((p: { id: string }) => p.id)
  const langByUser = new Map<string, Lang>(
    (enabledProfiles ?? []).map((p: { id: string; language: string | null }) => [p.id, pickLang(p.language)])
  )
```

- [ ] **Step 2: Carry user_id on subs**

Change the subs select (line ~103-106) to include `user_id`:
```ts
    .select('id, endpoint, p256dh, auth_key, user_id')
```

- [ ] **Step 3: Localize the anonymous-author fallback + fan out per language**

The fallback name is currently computed once at the top (`rawName = record.author_name ?? 'Ktoś'`). Change line ~30 so the fallback is resolved per-language at send time. Replace:
```ts
  const rawName = (record.author_name as string | null) ?? 'Ktoś'
  const authorName = rawName.slice(0, 50)
```
with:
```ts
  const rawName = record.author_name as string | null
```
Then replace the single `sendToMany(...)` block (lines ~118-123) with:
```ts
  const groups = groupSubsByLang(subs, langByUser)
  for (const [lang, langSubs] of groups) {
    const authorName = (rawName ?? NOTIF_TEXT.message.body![lang]).slice(0, 50)
    await sendToMany(
      langSubs,
      { title: event.title, body: `${authorName}: ${preview}`, type: 'message', eventId: event.id },
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
      admin
    )
  }
```
Note: the title emoji (`💬 `) is removed — title is now just `event.title`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-new-message/index.ts
git commit -m "feat: localize push-new-message fallback name + drop emoji"
```

---

### Task 13: New `push-event-updated` function

**Files:**
- Create: `supabase/functions/push-event-updated/index.ts`

- [ ] **Step 1: Implement the function**

```ts
// supabase/functions/push-event-updated/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendToMany } from '../_shared/webpush.ts'
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from '../_shared/notif-i18n.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let record: Record<string, unknown>
  try {
    const body = await req.json()
    console.log('[push-event-updated] received:', JSON.stringify(body).slice(0, 200))
    record = body.record ?? body
  } catch (e) {
    console.error('[push-event-updated] bad json:', e)
    return new Response('Bad Request', { status: 400 })
  }

  const eventId   = record.id as string
  const eventTitle = record.title as string
  const status    = record.status as string
  const creatorId = record.creator_id as string | null

  // `events` UPDATE fires from endEvent (status→ended) and updateEvent. Skip the
  // end-event path — that's not a content edit.
  if (status === 'ended') {
    return new Response(JSON.stringify({ sent: 0, reason: 'event ended' }), { status: 200 })
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-event-updated] VAPID keys not set!')
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Followers — single source of truth for notifications.
  const { data: followRows } = await admin
    .from('event_follows').select('user_id').eq('event_id', eventId)
  const recipientSet = new Set<string>((followRows ?? []).map((r: { user_id: string }) => r.user_id))
  if (creatorId) recipientSet.delete(creatorId) // the editor doesn't need it

  if (recipientSet.size === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), { status: 200 })
  }
  const recipientList = [...recipientSet]

  // Drop muted users.
  const { data: mutes } = await admin
    .from('notification_mutes').select('user_id').eq('event_id', eventId).in('user_id', recipientList)
  const mutedIds = new Set((mutes ?? []).map((m: { user_id: string }) => m.user_id))
  const afterMute = recipientList.filter(id => !mutedIds.has(id))
  if (afterMute.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'all muted' }), { status: 200 })
  }

  // push_enabled users + their language.
  const { data: enabledProfiles } = await admin
    .from('profiles').select('id, language').in('id', afterMute).eq('push_enabled', true)
  const enabledRecipients = (enabledProfiles ?? []).map((p: { id: string }) => p.id)
  if (enabledRecipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'push not enabled' }), { status: 200 })
  }
  const langByUser = new Map<string, Lang>(
    (enabledProfiles ?? []).map((p: { id: string; language: string | null }) => [p.id, pickLang(p.language)])
  )

  const { data: subs } = await admin
    .from('push_subscriptions').select('id, endpoint, p256dh, auth_key, user_id').in('user_id', enabledRecipients)
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no push subs' }), { status: 200 })
  }

  const groups = groupSubsByLang(subs, langByUser)
  for (const [lang, langSubs] of groups) {
    await sendToMany(
      langSubs,
      { title: eventTitle, body: NOTIF_TEXT.update.body![lang], type: 'update', eventId },
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
      admin
    )
  }

  return new Response(JSON.stringify({ sent: subs.length }), { status: 200 })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/push-event-updated/index.ts
git commit -m "feat: push-event-updated edge function (localized, skips ended)"
```

---

### Task 14: Service worker — `update` action label

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Add `update` to the "view" action branch**

In `public/sw.js`, the `actions` ternary (line ~36) currently reads:
```js
    actions: type === 'new_event' || type === 'event_start'
      ? [{ action: 'open', title: 'Zobacz' }]
      : [{ action: 'open', title: 'Odpisz' }],
```
Change the condition to include `'update'`:
```js
    actions: type === 'new_event' || type === 'event_start' || type === 'update'
      ? [{ action: 'open', title: 'Zobacz' }]
      : [{ action: 'open', title: 'Odpisz' }],
```
(`notificationclick` already opens `/?event=<id>` for any type — no other change needed.)

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: sw shows view action for event update notifications"
```

---

### Task 15: Phase 2 verification + deploy notes

**Files:** none (verification only).

- [ ] **Step 1: Build + full test run**

Run: `npm run build && npx vitest run`
Expected: both succeed (the new helper tests pass; Deno functions are not part of these but must compile-review clean).

- [ ] **Step 2: Ops / deploy checklist (outside the repo)**

1. Apply migration `20260603000000_add_profiles_language.sql` to the Supabase project.
2. Deploy all four edge functions: `push-new-message`, `push-new-event`, `push-event-start`, `push-event-updated`.
3. In the Supabase dashboard, create a **Database Webhook** on `public.events` for **UPDATE** → HTTP POST to the `push-event-updated` function URL, with header `x-webhook-secret: <WEBHOOK_SECRET>` (mirror the existing INSERT webhooks).

- [ ] **Step 3: Manual push verification (staging)**

With a second account following an event whose `profiles.language` is set to e.g. `en`:
1. Edit the event as the creator → the follower receives a push titled with the event name, body **"The event has been updated"**.
2. End the event → **no** "updated" push is sent (skipped on `status === 'ended'`).
3. Confirm a `pl` follower gets the Polish body, and the editor (creator) gets nothing.

---

## Self-review notes (for the implementer)

- **Spec coverage:** photo union (Task 1, 4), `updateEvent` (Task 2), dual-mode CreateSheet incl. prefill guard + auto-end disable + location reuse (Task 4), two buttons (Task 5), App wiring + refresh (Task 6), `edit` i18n (Task 3), language column/type (Task 8), client language write (Task 9), shared translations (Task 10), all 3 existing functions localized + emoji removed (Tasks 11-12), new function with `ended` skip + recipient pipeline (Task 13), sw.js `update` action (Task 14), ops/webhook (Task 15). All spec sections map to a task.
- **Type consistency:** `PhotoSlot`/`resolvePhotoUrls` (Task 1) reused verbatim in Task 4; `Lang`/`NotifType`/`NOTIF_TEXT`/`groupSubsByLang`/`pickLang` (Task 10) reused verbatim in Tasks 11-13; `db.updateEvent` signature (Task 2) matches its Task 4 call; `Profile.language` (Task 8) matches the selects in Tasks 9, 11-13.
- **Known inherited quirk:** edit reuses create's `toISOString().slice(0,16)` datetime convention (UTC wall-clock in the local input) — intentional, matches existing create behavior.
