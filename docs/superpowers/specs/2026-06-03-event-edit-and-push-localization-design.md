# Event Edit + Push Localization — Design

**Date:** 2026-06-03
**Branch:** feature branch (new, off `main`)
**Status:** Approved design, pending implementation plan

## Summary

Two related pieces of work:

1. **Event editing** — the event creator (moderator) currently can only *end* an
   event. Add the ability to *edit* it. The single "Zakończ wydarzenie" button
   becomes two buttons: **Edytuj wydarzenie** and **Zakończ wydarzenie**. Editing
   opens a card visually identical to the create card, pre-filled with the event's
   data (including photos and location), all fields editable.

2. **Push notification localization** — the entire push stack is currently
   hardcoded Polish because `profiles` has no per-user language. Add language
   storage and localize all push notifications (the 3 existing functions + the new
   "event updated" notification) into pl/en/es/de.

These ship together on one branch but are independent enough to be sequenced in
the implementation plan.

## Part 1 — Event editing

### 1.1 Photo slot data model (core change)

`CreateSheet` photo slots become a tagged union so the same form handles both
freshly-picked files and already-uploaded URLs:

```ts
type PhotoSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; preview: string }
  | null
```

- **Entering edit:** existing `event.photos` map to `existing` slots, remaining
  slots `null` (array length stays 3).
- **Create:** all populated slots are `kind: 'new'` (today's behavior, wrapped).
- **Submit:** build the final `photos` array in slot order, skipping `null`:
  `existing` → keep `url`, `new` → `await db.uploadEventPhoto(file)`.
- **Removal:** removing an `existing` slot drops it from `photos` on save (we
  rebuild `photos` from slots). The storage object is left orphaned — acceptable,
  same as today's unused uploads. Removal reuses the existing circular `×` button
  (`CreateSheet.tsx:354-371`) for both slot kinds — no new UI pattern.

### 1.2 API — `db.updateEvent` (`src/lib/supabase.ts`)

Symmetric to `createEvent` / `endEvent`:

```ts
async updateEvent(eventId, {
  title, description, lat, lng, category, tags, start_time, end_time, photos
}) {
  const sess = await this.getSession()
  if (!sess) return { data: null, error: { message: 'not authenticated' } }
  // RLS enforces creator_id; .eq is defense-in-depth (mirrors endEvent).
  const { data, error } = await supabase.from('events')
    .update({ title, description, lat, lng, category, start_time, end_time, photos })
    .eq('id', eventId)
    .eq('creator_id', sess.user.id)
    .select('*,profiles(display_name,avatar_color),event_tags(tag)')
    .single()
  if (!error && data) {
    await supabase.from('event_tags').delete().eq('event_id', eventId)
    if (tags?.length) {
      await supabase.from('event_tags').insert(tags.map(tag => ({ event_id: eventId, tag })))
    }
  }
  return { data, error }
}
```

Returns the fresh, fully-joined event (with `profiles` + `event_tags`) so the UI
can re-render without a separate fetch. Caller maps `event_tags` → `tags` like
`getEventById` does.

### 1.3 `CreateSheet` dual-mode (`src/screens/CreateSheet.tsx`)

New props:

```ts
editEvent?: EventWithMeta | null
onUpdated?: (updated: EventWithMeta) => void
```

Behavior when `editEvent` is set:

- **Prefill** in a `useEffect` keyed on `editEvent?.id`, guarded by a
  `prefilledIdRef` so it runs once per event id and does **not** re-run after the
  location-picker round-trip (the component stays mounted, so its state survives;
  re-prefilling would wipe the moderator's edits). Prefill: `title`, `desc`,
  `tags`, `startTime`/`endTime` (from `event.start_time`/`end_time` via
  `toISOString().slice(0,16)`, matching create's existing convention), photo slots
  from `event.photos` as `existing`, and `timeExpanded = true`. When `editEvent`
  becomes `null`, reset fields to create defaults and clear `prefilledIdRef`.
- **Auto end-time coupling** (`CreateSheet.tsx:73-75`, "end = start + 24h") is
  **disabled in edit mode** (`if (editEvent) return`), otherwise the prefill of
  `startTime` would clobber the prefilled `endTime`. In create mode it stays as-is.
- **Header label:** `editEvent ? t('edit.title') : t('create.title')`.
- **Submit label:** `editEvent ? t('edit.submit') : t('create.submit')`.
- **Mini-map address:** already driven by `locationPicked` + `defaultPos`; App
  seeds these so the current location's address shows. Location is fully editable
  via the existing picker flow.
- **Submit branch:** build `photoUrls` from slots (existing→url, new→upload).
  Shared validation (title required, `end > start`). If `editEvent`:
  `db.updateEvent(editEvent.id, …)` → on success map tags and call
  `onUpdated(updated)`. Else: existing `db.createEvent` → `onSubmit(data)`.
- **Slot rendering:** `existing` uses `img src={slot.url}`, `new` uses
  `slot.preview`. The `×` handler revokes the object URL only for `new`. The
  add-photo (`+` / camera) controls always create `kind: 'new'`.

### 1.4 `EventSheet` — two buttons (`src/screens/EventSheet.tsx`)

New prop `onEdit?: (event: EventWithMeta) => void`.

Replace the single end button (lines 360-364) with a row of two pill buttons,
shown under the same condition (`session?.user.id === event.creator_id &&
computedStatus !== 'ended'`):

- **Edytuj wydarzenie** — filled accent button → `onEdit?.(event)`.
- **Zakończ wydarzenie** — outline button (current styling) → `handleEndEvent`.

Layout: `display:flex; gap:8` row, each `flex:1`. Match existing tokens/rounding;
defer final visual polish to frontend-design conventions already in the file.

### 1.5 Wiring (`src/App.tsx`)

New state: `editingEvent: EventWithMeta | null`.

```ts
function handleEdit(ev: EventWithMeta) {
  setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
  setProfileOpen(false)
  setScreen('map')                       // unify edit to the map context
  setEditingEvent(ev)
  setCreatePos({ lat: ev.lat, lng: ev.lng })
  setLocationPicked(true)                // show current location's address
  setCreateOpen(true)
}
```

Rationale for `setScreen('map')`: the creator edits mainly from "Moje wydarzenia"
(an overlay), but `CreateSheet` is gated `!isOverlay`. Routing edit through the map
context makes the single mounted `CreateSheet` usable from every launch point and
lets us re-open the updated event afterward.

Pass `onEdit={handleEdit}` to all three `EventSheet` instances (map `selEvent`,
`myEventSelected`, `followedEventSelected`).

`CreateSheet` gets `editEvent={editingEvent}` and:

```ts
onUpdated={(updated) => {
  setEditingEvent(null); setCreateOpen(false)
  setCreatePos(null); setLocationPicked(false)
  setEventsRefreshKey(k => k + 1)
  setSelEvent(updated)
  flyToFnRef.current?.(updated.lat, updated.lng)
  showToast(t('edit.updated'))
}}
```

`onClose` for the create sheet also clears `editingEvent`.

### 1.6 i18n (`src/locales/{pl,en,es,de}.ts`)

New `edit` namespace + the edit button label:

- `event.editEvent` — button label ("Edytuj wydarzenie" / "Edit event" /
  "Editar evento" / "Event bearbeiten").
- `edit.title` — card header ("Edytuj wydarzenie" / …).
- `edit.submit` — save button ("Zapisz zmiany" / "Save changes" /
  "Guardar cambios" / "Änderungen speichern").
- `edit.updated` — success toast ("Wydarzenie zaktualizowane" / "Event updated" /
  "Evento actualizado" / "Event aktualisiert").

## Part 2 — Push notification localization

### 2.1 Current state (verified)

All static push text is hardcoded Polish; only dynamic parts (event title, author
name, message text) carry user content. `profiles` has **no** language column, so
edge functions cannot localize per recipient.

| function | static Polish text today |
|----------|--------------------------|
| `push-new-message` | `💬 <title>` (emoji), `Ktoś` fallback name |
| `push-new-event` | `Nowe wydarzenie w pobliżu 📍` |
| `push-event-start` | `Wydarzenie zaraz się zaczyna! 🎉` |

The chat-message notification body is fully dynamic (`<author>: <text>`) and is
**not** translated — user message content is never machine-translated. Its only
static localizable token is the `Ktoś` anonymous-author fallback.

### 2.2 Language storage

- **Migration:** add `language text` to `profiles`, nullable, backfill existing
  rows to `'pl'` to preserve current behavior.
- **Type:** add `language: string | null` to `Profile` (`src/lib/types.ts`).
- **Client write:** `db.updateProfileLanguage(uid, language)` (upsert
  `{ id, language }`). Call from `App.tsx` when `session` + `i18n.language` are
  known, and again on i18next `languageChanged`. Language follows the user's
  real selection.

### 2.3 Shared translations module

`supabase/functions/_shared/notif-i18n.ts` — a `type × lang → { title?, body? }`
map plus `pickLang(lang)` that normalizes/falls back to `'pl'`. Only static text;
dynamic parts untouched. **No emoji.**

| type | pl | en | es | de |
|------|----|----|----|----|
| `new_event` (title) | Nowe wydarzenie w pobliżu | New event nearby | Nuevo evento cerca de ti | Neues Event in der Nähe |
| `event_start` (title) | Wydarzenie zaraz się zaczyna | An event is about to start | Un evento está por comenzar | Ein Event beginnt gleich |
| `update` (body) | Wydarzenie zostało zaktualizowane | The event has been updated | El evento ha sido actualizado | Das Event wurde aktualisiert |
| `message` (fallback name) | Ktoś | Someone | Alguien | Jemand |

`update` title = the event title itself (no static text). `message` title = the
event title (emoji removed).

### 2.4 Per-language send

All four functions change recipient resolution from `profiles.select('id')` to
`profiles.select('id, language')`, group subscriptions by the recipient's language
(fallback `'pl'`), and call `sendToMany` once per language group with the localized
payload. This touches the 3 existing functions + the new one.

### 2.5 New function — `push-event-updated`

`supabase/functions/push-event-updated/index.ts`, triggered by a Supabase
**database webhook on `events` UPDATE**, secured by `WEBHOOK_SECRET` (same pattern
as `push-new-message` / `push-new-event`).

- `events` receives `UPDATE` only from `endEvent` (status→`ended`) and the new
  `updateEvent`; status (live/upcoming/extended) is computed client-side and not
  persisted. So:
  - **Skip** when `record.status === 'ended'` (that's the end-event path, not an
    edit) → return `{ sent: 0, reason: 'event ended' }`.
- Recipients = followers − creator (the editor), minus muted, minus
  `push_enabled = false`, with push subscriptions — the exact pipeline from
  `push-new-message`, now grouped per language (§2.4).
- Payload: `{ title: '<event.title>', body: <localized 'event updated'>,
  type: 'update', eventId }`.

### 2.6 Service worker (`public/sw.js`)

Add `'update'` to the action branch that currently matches
`new_event`/`event_start` (line 36) so the click action reads the "view" label
rather than the reply label. `notificationclick` already opens `/?event=<id>` for
any type, so no other SW change is needed. (SW action labels themselves remain
Polish — out of scope, unchanged.)

## Deployment / ops steps (outside the repo)

1. Apply the `profiles.language` migration.
2. Deploy all four edge functions (3 updated + 1 new).
3. Configure the **`events` UPDATE database webhook** → `push-event-updated` in
   the Supabase dashboard, with the `x-webhook-secret` header set to
   `WEBHOOK_SECRET` (mirrors the existing INSERT webhooks).

## Testing

- **`db.updateEvent`** — unit test alongside `supabase.test.ts`: builds the right
  update payload, replaces tags, scopes by `creator_id`. Follow the existing mock
  style in that file.
- **Photo slot mapping** — pure helper that turns slots → `photos` array (existing
  kept, new uploaded) is the natural unit to extract and test.
- **CreateSheet edit mode** — prefill populates fields from `editEvent`; submit in
  edit mode calls `updateEvent` not `createEvent`; auto-end coupling is inert in
  edit mode.
- **Edge functions** — `notif-i18n` `pickLang` fallback + per-type lookups;
  `push-event-updated` skips `status==='ended'` and resolves the right recipient
  set. Match whatever harness the existing functions use (or document a manual
  verification if they're untested).

## Out of scope

- Translating chat message *content* (only static tokens are localized).
- Localizing service-worker action button labels.
- Deleting orphaned storage objects when a photo is removed during edit.
- Retroactively setting `language` for users who never revisit (covered lazily on
  next session via §2.2).
