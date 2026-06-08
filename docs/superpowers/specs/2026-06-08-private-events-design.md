# Private Events — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow event creators to mark an event as private — invisible on the map to everyone except people who received the share link.

**Architecture:** RLS-based privacy (Approach B) — a new `is_private` column on `events`, updated SELECT policy, and a SECURITY DEFINER RPC for deep-link fetching. UI changes in CreateSheet (toggle) and MapScreen (private pin icon).

**Tech Stack:** React, Supabase (PostgreSQL + RLS), Leaflet (map markers), i18n (pl/en/es/de)

---

## 1. Database & RLS

### Migration: `supabase/migrations/20260608_private_events.sql`

```sql
-- 1. Add is_private column
ALTER TABLE events
  ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- 2. Replace events SELECT policy
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    NOT is_private
    OR auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM event_follows
      WHERE event_id = events.id
        AND user_id = auth.uid()
    )
  );

-- 3. SECURITY DEFINER RPC for deep-link access
-- Owning the UUID = owning the share link = authorized to view.
CREATE OR REPLACE FUNCTION get_event_by_id(p_event_id uuid)
RETURNS SETOF events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM events WHERE id = p_event_id;
$$;
```

**Effect:**
- Public events (`is_private = false`): visible to everyone as before.
- Private events: visible only to the creator and users with an `event_follows` row.
- `getEvents()` (map bounding-box query) returns private events only for followers — enforced by RLS automatically, no JS filter needed.
- `get_event_by_id` bypasses RLS so deep links work for anyone with the UUID.

---

## 2. TypeScript Types

### `src/lib/types.ts`

Add `is_private` to `EventRow`:

```ts
export interface EventRow {
  // ... existing fields ...
  is_private: boolean
}
```

---

## 3. Supabase client — `src/lib/supabase.ts`

### `createEvent`
Add `is_private` parameter and pass it to the INSERT:

```ts
async createEvent(ev: {
  // ... existing fields ...
  is_private?: boolean
}) {
  // ...
  await supabase.from('events').insert({
    // ... existing fields ...
    is_private: ev.is_private ?? false,
  })
}
```

### `getEventById`
Replace direct `.select()` with the new SECURITY DEFINER RPC so private events load via deep links:

```ts
async getEventById(id: string): Promise<EventWithMeta | null> {
  const { data, error } = await supabase
    .rpc('get_event_by_id', { p_event_id: id })
    .select('*,profiles(display_name,avatar_color),event_tags(tag)')
    .single()
  if (error || !data) return null
  const e = data as any
  return { ...e, tags: (e.event_tags || []).map((t: any) => t.tag), distKm: 0, distStr: '' }
}
```

> `rpc().select()` with relationship embedding works in Supabase JS v2 for functions returning `SETOF <tablename>` — PostgREST resolves foreign-key joins the same way as `.from().select()`. The joins to `profiles` and `event_tags` are not affected by the SECURITY DEFINER (both tables have `SELECT USING (true)` RLS).

---

## 4. CreateSheet — `src/screens/CreateSheet.tsx`

### State
```ts
const [isPrivate, setIsPrivate] = useState(false)
```

### UI — toggle row (placed between time section and photos section)
```jsx
{!editEvent && (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderRadius: 20, background: C.cream, marginBottom: 18,
  }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
        {t('create.privateEvent')}
      </div>
      {isPrivate && (
        <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 3 }}>
          🔒 {t('create.privateEventHint')}
        </div>
      )}
    </div>
    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 26 }}>
      <input
        type="checkbox"
        checked={isPrivate}
        onChange={e => setIsPrivate(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      {/* Toggle visual — CSS slider matching meuwe style */}
    </label>
  </div>
)}
```

Toggle is hidden in edit mode (`!editEvent` guard) — privacy is immutable after creation.

### Submit
Pass `is_private` to `db.createEvent`:
```ts
const { data, error } = await db.createEvent({
  // ... existing fields ...
  is_private: isPrivate,
})
```

---

## 5. i18n — `src/locales/{pl,en,es,de}.ts`

New keys in `create` namespace:

| Key | pl | en | es | de |
|-----|----|----|----|----|
| `create.privateEvent` | Wydarzenie prywatne | Private event | Evento privado | Privates Event |
| `create.privateEventHint` | Widoczny tylko dla osób z linkiem | Visible only to people with the link | Solo visible para personas con el enlace | Nur für Personen mit dem Link sichtbar |

---

## 6. Map marker — `src/components/mapIcons.ts`

### New `privateHTML(isLive?: boolean): string`

Same blob + dot structure as `pinHTML`, but:
- **Fill:** `#2D2B2A` (INK)
- **Stroke:** `#ffffff`
- **Glyph:** SVG mask-on-eyes icon (inline, no emoji — consistent with design system)
- **Dot:** `background: #2D2B2A`, `border: 2.5px solid #fff`
- Halo animation only when `isLive = true` (same as public pins), halo color: `#ffffff`

```ts
export function privateHTML(isLive = false): string {
  const path = BLOBS[0]
  const halos = isLive ? `
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid #fff;animation:halo 2.8s ease-out infinite;opacity:0;pointer-events:none"></div>
    <div style="position:absolute;top:-10px;left:-10px;width:64px;height:64px;border-radius:50%;border:2.5px solid #fff;animation:halo 2.8s 1.4s ease-out infinite;opacity:0;pointer-events:none"></div>
  ` : ''
  return `<div style="position:relative;width:44px;height:56px;">
    <div style="position:absolute;top:0;left:0;width:44px;height:44px;">
      ${halos}
      <svg width="44" height="44" viewBox="-3 -3 106 106" style="overflow:visible;filter:drop-shadow(0 3px 0 #2D2B2A22)">
        <path d="${path}" fill="#2D2B2A" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;top:10px;left:0;width:44px;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <svg width="20" height="14" viewBox="0 0 24 16" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 8C1 8 5 2 12 2s11 6 11 6-4 6-11 6S1 8 1 8z"/>
          <path d="M9 5.5 Q12 3 15 5.5 Q12 8 9 5.5z" fill="#2D2B2A" stroke="#2D2B2A"/>
          <rect x="3" y="4" width="18" height="3" rx="1.5" fill="#2D2B2A" stroke="none"/>
        </svg>
      </div>
    </div>
    <div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:#2D2B2A;border:2.5px solid #ffffff"></div>
  </div>`
}
```

> The mask SVG above is a starting point. During implementation, adjust the paths to render cleanly at 20×14px. A clean approach: draw a horizontal bar across the eyes (the "mask band") plus two eye-hole circles cut out — simpler than a realistic mask shape and more legible at small size.

### MapScreen usage
```ts
const icon = L.divIcon({
  html: ev.is_private
    ? privateHTML(isCurrentlyLive(ev))
    : pinHTML(ev.category, idx, ev.status, ev.start_time, ev.end_time),
  className: 'meuwe-icon',
  iconSize: [44, 56],
  iconAnchor: [22, 56],
})
```

---

## 7. Deep link auto-follow — `src/App.tsx`

In the existing `useEffect` that handles `deepLinkEvent`, add auto-follow for private events:

```ts
useEffect(() => {
  if (screen !== 'map' || !deepLinkEvent) return
  setSelEvent(deepLinkEvent)
  // Auto-follow private events for logged-in users
  if (deepLinkEvent.is_private && session) {
    db.isFollowingEvent(deepLinkEvent.id).then(following => {
      if (!following) db.followEvent(deepLinkEvent.id)
    })
  }
  // ... existing map pan logic ...
}, [screen, deepLinkEvent])
```

**Non-logged user behavior:** `get_event_by_id` RPC returns the event (SECURITY DEFINER bypasses RLS). EventSheet opens normally. No follow is created. Event disappears on page refresh — no `event_follows` row, no special mechanism needed.

---

## 8. New git branch

```bash
git checkout -b feat/private-events
```

---

## Out of Scope

- Changing privacy after creation (immutable by design)
- Private event invite management UI
- Expiring invite links / revocation
