# meuwe v1.1 — Design Parity

_2026-05-23_

Source: Claude Design handoff bundle (`meuwe/project/`), chat transcript `chats/chat1.md`.

## Goal

Bring `meuwe-web` to full visual and functional parity with the approved Claude Design prototype. Three axes: comic visual style, EventSheet forum upgrade, and new screens/components.

---

## Section A — Architecture

### New files
| File | Purpose |
|---|---|
| `src/screens/MyEventsScreen.tsx` | "Moje wydarzenia" screen |
| `src/components/ConfettiBurst.tsx` | Post-create confetti animation |
| `src/components/RecenterButton.tsx` | Map recenter button |

### Modified files
| File | Change |
|---|---|
| `src/components/OrganicBlob.tsx` | Comic stroke + shadow |
| `src/components/Avatar.tsx` | Dark border + offset shadow + black letters |
| `src/components/mapIcons.ts` | Pins with BlobFace + tail |
| `src/components/AddButton.tsx` | Thick dark outline on SVG blob |
| `src/screens/EventSheet.tsx` | Chat bubbles, organizer row, sticky header, preview |
| `src/screens/CreateSheet.tsx` | Photos, Time, mini-map, loading spinner |
| `src/screens/ProfilePanel.tsx` | Navigate to MyEventsScreen |
| `src/screens/MapScreen.tsx` | RecenterButton + ConfettiBurst trigger |
| `src/lib/supabase.ts` | `db.getMyEvents()`, `db.endEvent()` |
| `src/lib/types.ts` | `EventWithMsgCount` type |
| `src/App.tsx` | `myEvents` screen state, confetti state |

### No DB migrations needed
All queries use existing schema. `getMyEvents` filters by `creator_id`, joins `event_messages` for count.

---

## Section B — Comic Visual Style

**Principle:** flat fill + thick dark outline (`#2D2B2A`) + offset comic shadow. No radial gradients, no glow blur.

### OrganicBlob
```
SVG <path>:
  stroke="#2D2B2A"
  strokeWidth={size <= 28 ? 4 : size <= 44 ? 4.5 : 5}
  strokeLinejoin="round"
SVG wrapper filter:
  drop-shadow(0 3px 0 rgba(45,43,42,0.18))
```

### Avatar
```
border: "2.5px solid #2D2B2A"
boxShadow: "0 3px 0 rgba(45,43,42,0.33)"
color: "#2D2B2A"
fontWeight: 900
```
Notification dot (hasUnread): 14px orange circle, `border: "2.5px solid #2D2B2A"`, breathe animation, top-right.

### MeMarker
```
blob div:
  border: "3px solid #2D2B2A"
  boxShadow: "0 3px 0 rgba(45,43,42,0.33)"
```
Halo rings unchanged.

### AddButton
```
SVG <path>:
  stroke="#2D2B2A"
  strokeWidth="5"
SVG filter:
  drop-shadow(0 5px 0 rgba(45,43,42,0.27))
Outer glow ring removed → single pulsing ring opacity 0.22
```

### mapIcons.ts — pinHTML rewrite
Each pin:
1. Outer blob SVG with category color fill + `stroke="#2D2B2A" strokeWidth="4"`
2. BlobFace SVG centered inside (eyes + smile, `color="#2D2B2A"`)
3. Tail: small circle below blob, same category color + stroke
4. Status halo: `upcoming` → sunshine yellow, `extended` → primary orange (blurred circle, opacity 0.35)
5. Bob animation preserved

---

## Section C — EventSheet Redesign

### Snap PEEK (unchanged structure)
OrganicBlob with BlobFace + title + StatusPill + distance + organizer Avatar.

### Snap HALF additions
- **Organizer row**: 40px Avatar + display_name + "Organizator" label. If `session.user.id === event.creator_id` → "Moderator" pill (`background: C.primarySoft, color: C.primaryPressed`).
- **"Zakończ wydarzenie"** ghost button: only for moderator. Calls `db.endEvent(eventId)` → sets `status: 'ended'` via `supabase.from('events').update({status:'ended'}).eq('id',eventId)`.
- **"Rozmowa trwa" preview row**: stacked avatars (3 circles, last 3 unique `author_color` from messages), message count, `↑` arrow. Tap → snap to FULL.
- Photo carousel: skipped in v1 (no photo upload field in DB). Section omitted when no photos.

### Snap FULL — forum mode
**Sticky compact header** (position: sticky, top: 0, backdropFilter: blur(8px)):
- 36px OrganicBlob + title (truncated) + green live dot + message count + `×` close button

**Chat bubbles:**
```
Own messages:
  alignSelf: "flex-end"
  background: C.primarySoft (#FFD4C0)
  borderRadius: "20px 20px 6px 20px"
  animation: bubble-up on last message

Others' messages:
  alignSelf: "flex-start"
  background: "#FFFFFF"
  boxShadow: shadow.softer
  borderRadius: "20px 20px 20px 6px"
  preceded by 32px Avatar (dark border)
```

**Author name**: shown above message when `i % 3 === 0` and message is not own.

**Input bar** (position: absolute, bottom: 0):
- Pill input `background: C.cream`
- Send button: 44px circle, `background: C.primary`, SVG arrow, `opacity: 0.5 + scale(0.85)` when empty, `opacity: 1 + scale(1)` when has text

---

## Section D — CreateSheet Additions

### Mini-map preview (top of sheet)
- 76×76px rounded box with static SVG: cream bg, blue stripe (water), green blob (park), white stripe (road)
- Place name from `userPos` via reverse geocode (Nominatim, already in `geo.ts`)
- "Edytuj" pill → `setCreateOpen(false)` to return to map for repositioning

### Photos section (optional)
- 3 × 80px square slots, `borderRadius: 22`, dashed border when empty
- Tap empty → `<input type="file" accept="image/*" capture="environment">` → local blob URL preview
- Tap filled → remove (× overlay)
- **v1: local preview only, no Supabase Storage upload**
- Stored in local state `photos: string[]` (blob URLs), not sent to DB

### Time section (collapsed by default)
- Collapsed: "Zaczyna się **teraz** · kończy się **za 24h**", tap to expand, `⌄` chevron rotates
- Expanded: two fields OD/DO using `<input type="datetime-local">`, defaults: `now` and `now + 24h`
- Values passed to `db.createEvent({start_time, end_time})`
- Current CreateSheet hardcodes `start_time: new Date().toISOString()`, `end_time: +24h` — time section makes this editable

### Loading state
- Submit button: disabled during submit, shows 22px spinner (`border: "3px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: meuwe-spin`)
- Already have `meuwe-spin` keyframe in `index.css`

---

## Section E — My Events Screen

### Access flow
`ProfilePanel` → tap "Moje wydarzenia" row → `App.tsx` sets `screen: 'myEvents'` → renders `<MyEventsScreen>`.

Back button → `setScreen('map')`.

### Layout
```
Header: back button (‹) + "Moje wydarzenia" title
Segmented toggle: Aktywne | Zakończone (pill style, primary bg when active)
Scrollable list of EventCard items
```

### EventCard
```
56px OrganicBlob (face: happy if active, sleepy if ended)
  + title (truncated, 1 line)
  + StatusPill (sm)
  + date string (formatted from start_time)
  + place_name
  + message count badge (top-right, primary color)
Opacity 0.72 + saturate(0.7) for ended events
Tap → opens EventSheet (same component, passes event data)
```

### Supabase — new functions

**`db.getMyEvents(userId: string): Promise<EventWithMsgCount[]>`**
```ts
supabase
  .from('events')
  .select('*, event_messages(count), event_tags(tag)')
  .eq('creator_id', userId)
  .order('start_time', { ascending: false })
```
Maps count from `event_messages[0].count`.

**`db.endEvent(eventId: string)`**
```ts
supabase.from('events').update({ status: 'ended' }).eq('id', eventId)
```

**New type `EventWithMsgCount`** extends `EventWithMeta` with `msgCount: number`. When opening EventSheet from MyEventsScreen, `distKm` and `distStr` are set to `0` / `''` respectively (distance not relevant in own-events context). Tags come from `event_tags` join.

---

## Section F — Animations

### ConfettiBurst
- Component: `src/components/ConfettiBurst.tsx`
- Props: `visible: boolean`
- 6 colored blobs (primary, grass, berry, sunshine, sky, primary) with randomized dx/dy
- CSS keyframes per blob: `0% {transform: translate(0,0) scale(0); opacity:1}` → `100% {transform: translate(dx,dy+80px) scale(0.6); opacity:0}`
- Duration 680–800ms, ease-out
- Rendered in `App.tsx` at `position: fixed, top: 50%, left: 50%`
- Triggered by `handleSubmit` in CreateSheet → `setShowConfetti(true)` → auto-clear after 900ms

### RecenterButton
- Component: `src/components/RecenterButton.tsx`
- Props: `visible: boolean, onClick: () => void`
- 48px white circle, `border: "2.5px solid #2D2B2A"`, `boxShadow: "0 3px 0 rgba(...)"`, orange dot inside
- Positioned: `position: absolute, bottom: 160px, right: 20px` (above timeline)
- Appear/disappear: `opacity + scale(0.6→1)` with `cubic-bezier(0.34,1.56,0.64,1)` transition

**Detection in MapScreen:**
```ts
map.on('moveend', () => {
  if (!userPos) return
  const center = map.getCenter()
  const dist = haversineKm(center.lat, center.lng, userPos.lat, userPos.lng)
  setShowRecenter(dist > 0.3)
})
```
Tap: `map.flyTo([userPos.lat, userPos.lng], 15, { duration: 0.8 })`

---

## Out of scope (v2)
- Photo upload to Supabase Storage
- Long-press message actions (Usuń / Ukryj)
- Hidden message placeholders
- Push notifications / notification dot on Avatar
- "Rozmowa wydłuża życie wydarzenia" event extension logic
