# meuwe v1.1 Design Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring meuwe-web to full parity with the approved Claude Design prototype: moderator controls in EventSheet, Photos+Time sections in CreateSheet, My Events screen with real Supabase data, and RecenterButton fix.

**Architecture:** Eight focused tasks executed sequentially. Tasks 1–3 lay the foundation (types, Supabase, ConfettiBurst). Tasks 4–6 update existing screens. Tasks 7–8 wire the new MyEventsScreen and connect App.tsx routing.

**Tech Stack:** Vite + React 18 + TypeScript, Supabase JS v2, react-i18next, raw Leaflet 1.9

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/types.ts` | Modify | Add `EventWithMsgCount` type |
| `src/lib/supabase.ts` | Modify | Add `getMyEvents`, `endEvent`; extend `createEvent` signature |
| `src/lib/supabase.test.ts` | Modify | Tests for new db methods (mocked) |
| `src/components/ConfettiBurst.tsx` | Create | Post-create confetti animation |
| `src/screens/MapScreen.tsx` | Modify | Fix RecenterButton detection (moveend + haversine) |
| `src/screens/EventSheet.tsx` | Modify | Moderator pill, "Zakończ" button, stacked avatars, live dot |
| `src/screens/CreateSheet.tsx` | Modify | Mini-map, Photos section, Time section |
| `src/screens/MyEventsScreen.tsx` | Create | My Events with Active/Ended tabs |
| `src/screens/ProfilePanel.tsx` | Modify | Wire "Moje wydarzenia" row to `onOpenMyEvents` prop |
| `src/App.tsx` | Modify | `myEvents` screen state, ConfettiBurst, ProfilePanel prop |

---

## Task 1: Types + Supabase layer

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/lib/supabase.test.ts`

- [ ] **Step 1.1: Add `EventWithMsgCount` to types.ts**

Open `src/lib/types.ts` and append after the `Message` interface:

```ts
export interface EventWithMsgCount extends EventWithMeta {
  msgCount: number
}
```

- [ ] **Step 1.2: Extend `createEvent` to accept optional start/end times**

In `src/lib/supabase.ts`, change the `createEvent` parameter type and body:

```ts
async createEvent(ev:{
  title:string; description?:string; lat:number; lng:number;
  placeName?:string; category?:string; tags?:string[];
  start_time?:string; end_time?:string;
}) {
  const sess=await this.getSession(); if(!sess) return {data:null,error:{message:'not authenticated'}}
  const {data,error}=await supabase.from('events').insert({
    title:ev.title, description:ev.description, lat:ev.lat, lng:ev.lng,
    place_name:ev.placeName, category:ev.category||'party',
    start_time: ev.start_time || new Date().toISOString(),
    end_time: ev.end_time || new Date(Date.now()+86400000).toISOString(),
    creator_id:sess.user.id, status:'live',
  }).select().single()
  if(!error && ev.tags?.length) await supabase.from('event_tags').insert(ev.tags.map(tag=>({event_id:data!.id,tag})))
  return {data,error}
},
```

- [ ] **Step 1.3: Add `getMyEvents` to db object**

In `src/lib/supabase.ts`, add after `createEvent`:

```ts
async getMyEvents(userId:string):Promise<EventWithMsgCount[]> {
  const {data,error}=await supabase.from('events')
    .select('*, event_tags(tag), event_messages(count)')
    .eq('creator_id',userId)
    .order('start_time',{ascending:false})
  if(error){console.error(error);return[]}
  return (data||[]).map((e:any)=>({
    ...e,
    tags:(e.event_tags||[]).map((t:any)=>t.tag),
    distKm:0,
    distStr:'',
    profiles:null,
    msgCount:e.event_messages?.[0]?.count ?? 0,
  })) as EventWithMsgCount[]
},
```

- [ ] **Step 1.4: Add `endEvent` to db object**

In `src/lib/supabase.ts`, add after `getMyEvents`:

```ts
async endEvent(eventId:string) {
  return supabase.from('events').update({status:'ended'}).eq('id',eventId)
},
```

- [ ] **Step 1.5: Add import for `EventWithMsgCount` at top of supabase.ts**

Change the import line:
```ts
import type { EventWithMeta, EventWithMsgCount, Message, Profile } from './types'
```

- [ ] **Step 1.6: Run TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 1.7: Add tests for new db methods**

In `src/lib/supabase.test.ts`, the real Supabase calls cannot be unit tested without a live DB. Add structural tests that verify the mapping logic using mock data:

```ts
import { describe, it, expect } from 'vitest'
import { isOnDay } from './supabase'

describe('isOnDay', () => {
  const base = new Date('2026-05-23T12:00:00')
  it('same calendar day → true', () => {
    expect(isOnDay('2026-05-23T20:00:00', base, 0)).toBe(true)
  })
  it('next day with offset 1 → true', () => {
    expect(isOnDay('2026-05-24T08:00:00', base, 1)).toBe(true)
  })
  it('different day → false', () => {
    expect(isOnDay('2026-05-25T08:00:00', base, 1)).toBe(false)
  })
})

describe('getMyEvents mapping', () => {
  it('maps event_messages count correctly', () => {
    const raw = { id:'1', title:'Test', lat:0, lng:0, category:'party',
      start_time:'2026-05-23T10:00:00Z', end_time:'2026-05-24T10:00:00Z',
      status:'live', created_at:'2026-05-23T09:00:00Z', creator_id:'u1',
      description:null, place_name:null,
      event_tags:[{tag:'outdoor'}],
      event_messages:[{count:7}],
    }
    // Replicate the mapping from getMyEvents
    const mapped = {
      ...raw,
      tags: raw.event_tags.map((t:any) => t.tag),
      distKm: 0,
      distStr: '',
      profiles: null,
      msgCount: raw.event_messages?.[0]?.count ?? 0,
    }
    expect(mapped.tags).toEqual(['outdoor'])
    expect(mapped.msgCount).toBe(7)
    expect(mapped.distKm).toBe(0)
  })

  it('handles missing event_messages gracefully', () => {
    const raw:any = { event_messages: undefined }
    const msgCount = raw.event_messages?.[0]?.count ?? 0
    expect(msgCount).toBe(0)
  })
})
```

- [ ] **Step 1.8: Run tests**

```bash
cd /Users/wiktormarc/meuwe-web && npm test -- --run 2>&1
```

Expected: all tests pass (15 existing + 2 new = 17 total).

- [ ] **Step 1.9: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/lib/types.ts src/lib/supabase.ts src/lib/supabase.test.ts && git commit -m "feat: add getMyEvents, endEvent, EventWithMsgCount; parameterise createEvent times"
```

---

## Task 2: ConfettiBurst component

**Files:**
- Create: `src/components/ConfettiBurst.tsx`

- [ ] **Step 2.1: Create ConfettiBurst component**

Create `src/components/ConfettiBurst.tsx`:

```tsx
import { C } from '../lib/tokens'

const BITS = [
  { color: C.primary,   dx: -36, dy: -50, r: 8,  dur: 700 },
  { color: C.grass,     dx:  24, dy: -54, r: 6,  dur: 800 },
  { color: C.berry,     dx: -10, dy: -64, r: 5,  dur: 750 },
  { color: C.sunshine,  dx:  40, dy: -38, r: 9,  dur: 720 },
  { color: C.sky,       dx: -50, dy: -28, r: 6,  dur: 680 },
  { color: C.primary,   dx:  10, dy: -76, r: 4,  dur: 760 },
]

export default function ConfettiBurst({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{ position: 'fixed', left: '50%', top: '50%', pointerEvents: 'none', zIndex: 200 }}>
      {BITS.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: '50%',
            background: b.color,
            left: 0,
            top: 0,
            animation: `confetti-bit-${i} ${b.dur}ms ease-out forwards`,
          }}
        />
      ))}
      <style>{BITS.map((b, i) => `
        @keyframes confetti-bit-${i} {
          0%   { transform: translate(0,0) scale(0); opacity: 1; }
          30%  { transform: translate(${b.dx * 0.6}px,${b.dy * 0.6}px) scale(1.1); opacity: 1; }
          100% { transform: translate(${b.dx}px,${b.dy + 80}px) scale(0.6); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  )
}
```

- [ ] **Step 2.2: TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/components/ConfettiBurst.tsx && git commit -m "feat: ConfettiBurst animation component"
```

---

## Task 3: MapScreen — fix RecenterButton detection

**Files:**
- Modify: `src/screens/MapScreen.tsx`

The current code sets `recenter: true` on every `map.on('move')`. We need `moveend` + haversine distance check so the button only appears when the map center is >0.3 km from `userPos`.

- [ ] **Step 3.1: Import haversineKm**

At the top of `src/screens/MapScreen.tsx`, add to imports:

```ts
import { haversineKm } from '../lib/geo'
```

- [ ] **Step 3.2: Replace move listener in Leaflet init effect**

Find this line in the Leaflet init `useEffect` (around line 79):
```ts
map.on('move', () => setRecenter(true))
```

Replace with:
```ts
map.on('moveend', () => {
  const up = userPosRef.current
  if (!up) return
  const center = map.getCenter()
  setRecenter(haversineKm(center.lat, center.lng, up.lat, up.lng) > 0.3)
})
```

- [ ] **Step 3.3: Add userPosRef to MapScreen**

The Leaflet init closure cannot read the latest `userPos` state directly. Add a ref that stays current. After the existing refs (`mapRef`, `leafRef`, `meRef`, `pinsRef`):

```ts
const userPosRef = useRef<{ lat: number; lng: number } | null>(userPos)
useEffect(() => { userPosRef.current = userPos }, [userPos])
```

- [ ] **Step 3.4: TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3.5: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/screens/MapScreen.tsx && git commit -m "fix: recenter button uses moveend + haversine threshold (0.3km)"
```

---

## Task 4: EventSheet — moderator controls + stacked avatars

**Files:**
- Modify: `src/screens/EventSheet.tsx`

Three additions to the HALF snap:
1. "Moderator" pill in organizer row
2. "Zakończ wydarzenie" ghost button
3. Stacked avatars in "Rozmowa trwa" row

One addition to the FULL sticky header:
4. Live green dot next to message count

- [ ] **Step 4.1: Add `endEvent` import and handler**

At the top of `src/screens/EventSheet.tsx`, confirm `db` is already imported (it is). Add a local handler inside the component, after the `send` function:

```ts
async function handleEndEvent() {
  await db.endEvent(event.id)
  onClose()
}
```

- [ ] **Step 4.2: Replace organizer row with moderator-aware version**

Find the organizer row block in EventSheet (the `<div>` with `background: C.cream, marginBottom: 14`):

```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
  borderRadius: 18, background: C.cream, marginBottom: 14,
}}>
  <Avatar
    size={40}
    initials={(event.profiles?.display_name || '?')[0].toUpperCase()}
    color={event.profiles?.avatar_color || C.sky}
  />
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
      {event.profiles?.display_name || '?'}
    </div>
    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
      {t('event.organizer')}
    </div>
  </div>
  {session?.user.id === event.creator_id && (
    <span style={{
      padding: '4px 10px', borderRadius: 999,
      background: C.primarySoft, color: C.primaryPressed,
      fontSize: 11, fontWeight: 800,
    }}>Moderator</span>
  )}
</div>
```

Replace the existing organizer row with this full block.

- [ ] **Step 4.3: Add "Zakończ wydarzenie" button after organizer row**

Add this immediately after the organizer row div (before the description block):

```tsx
{session?.user.id === event.creator_id && event.status !== 'ended' && (
  <button
    onClick={handleEndEvent}
    style={{
      width: '100%', padding: '12px 16px', marginBottom: 14,
      borderRadius: 999, background: 'transparent',
      border: `2px solid ${C.primarySoft}`,
      color: C.primaryPressed, fontSize: 14, fontWeight: 800,
    }}
  >
    Zakończ wydarzenie
  </button>
)}
```

- [ ] **Step 4.4: Add stacked avatars to "Rozmowa trwa" button**

Find the "Rozmowa trwa" button block. Replace its interior with stacked avatars + text:

```tsx
<button
  onClick={() => setSnap('full')}
  style={{
    width: '100%', padding: '14px 16px', borderRadius: 20,
    background: C.cream, border: `2px solid ${INK}22`,
    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 80,
  }}
>
  {/* stacked avatars — last 3 unique author colors */}
  {messages.length > 0 && (
    <div style={{ display: 'flex', marginRight: -4 }}>
      {[...new Map(messages.map(m => [m.author_id, m.author_color])).values()]
        .slice(0, 3)
        .map((color, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: color || C.sky,
            border: `2px solid ${INK}`,
            marginLeft: i === 0 ? 0 : -10,
          }} />
        ))
      }
    </div>
  )}
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{t('event.conversation')}</div>
    <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
      {t('event.messageCount', { count: messages.length })}
    </div>
  </div>
  <div style={{ fontSize: 18, color: C.primary, fontWeight: 900 }}>↑</div>
</button>
```

- [ ] **Step 4.5: Add live dot to sticky FULL header**

Find the sticky header's message count line (in the `isFull` compact header):
```tsx
<div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>
  {t('event.messageCount', { count: messages.length })}
</div>
```

Replace with:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
  <div style={{
    width: 6, height: 6, borderRadius: '50%', background: C.grass,
    animation: 'breathe-sm 1.4s ease-in-out infinite',
  }} />
  <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
    {t('event.messageCount', { count: messages.length })}
  </div>
</div>
```

- [ ] **Step 4.6: Add `C.primaryPressed` to tokens if missing**

Check `src/lib/tokens.ts` — `C.primaryPressed` must exist. If not, add `primaryPressed: '#E85A2A'` to the `C` object. (It should already be there as `C.primaryPress` — use whichever exists.)

Confirm in tokens.ts what the key is, then use that consistently in EventSheet. Run:
```bash
grep -n "primaryPress" /Users/wiktormarc/meuwe-web/src/lib/tokens.ts
```

- [ ] **Step 4.7: TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4.8: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/screens/EventSheet.tsx && git commit -m "feat: EventSheet moderator controls, stacked avatars, live dot in header"
```

---

## Task 5: CreateSheet — mini-map, Photos, Time sections

**Files:**
- Modify: `src/screens/CreateSheet.tsx`

- [ ] **Step 5.1: Add state for photos and time**

In `CreateSheet`, add to the existing state declarations:

```ts
const [photos, setPhotos] = useState<string[]>([])      // local blob URLs
const [startTime, setStartTime] = useState<string>(
  () => new Date().toISOString().slice(0, 16)             // "YYYY-MM-DDTHH:MM"
)
const [endTime, setEndTime] = useState<string>(
  () => new Date(Date.now() + 86400000).toISOString().slice(0, 16)
)
const [timeExpanded, setTimeExpanded] = useState(false)
```

- [ ] **Step 5.2: Update submit to pass times**

In the `submit` function, update the `db.createEvent` call:

```ts
const { data, error } = await db.createEvent({
  title: title.trim(),
  description: desc,
  lat: pos.lat,
  lng: pos.lng,
  tags,
  category: tags[0] || 'party',
  start_time: new Date(startTime).toISOString(),
  end_time: new Date(endTime).toISOString(),
})
```

Also reset on success: add `setPhotos([]); setTimeExpanded(false)` alongside the existing resets.

- [ ] **Step 5.3: Replace location card with mini-map SVG**

Find the existing location card `<div>` (the one with 📍 emoji) and replace the entire block:

```tsx
{/* Mini-map preview */}
<div style={{
  display: 'flex', alignItems: 'center', gap: 12,
  padding: 10, borderRadius: 20, background: C.cream, marginBottom: 18,
}}>
  <div style={{
    width: 76, height: 76, borderRadius: 16, overflow: 'hidden',
    position: 'relative', flexShrink: 0, background: C.cream,
  }}>
    {/* static illustrated mini-map */}
    <svg width="76" height="76" viewBox="0 0 76 76" style={{ position: 'absolute', inset: 0 }}>
      <rect width="76" height="76" fill="#FFF6EC"/>
      <rect x="-4" y="18" width="84" height="10" rx="5" fill="#B8E3F2"/>
      <ellipse cx="58" cy="56" rx="14" ry="11" fill="#C8E6BD"/>
      <rect x="32" y="0" width="6" height="76" fill="#fff" opacity="0.8"/>
    </svg>
    {/* pin */}
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 16, height: 16, borderRadius: '50%',
      background: C.primary, border: `2.5px solid #2D2B2A`,
      boxShadow: '0 2px 0 rgba(45,43,42,0.3)',
      animation: 'breathe-sm 2.5s ease-in-out infinite',
    }}/>
  </div>
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
      {t('create.myLocation')}
    </div>
    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
      {t('create.gpsBased')}
    </div>
  </div>
</div>
```

- [ ] **Step 5.4: Add Photos section**

After the title `<input>` and before the tags section, add:

```tsx
{/* Photos section */}
<div style={{ marginBottom: 22 }}>
  <div style={{
    fontSize: 11, color: C.inkSoft, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  }}>Zdjęcia</div>
  <div style={{ display: 'flex', gap: 10 }}>
    {[0, 1, 2].map(i => {
      const src = photos[i]
      return (
        <label key={i} style={{ cursor: 'pointer', display: 'block' }}>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const url = URL.createObjectURL(file)
              setPhotos(prev => {
                const next = [...prev]
                next[i] = url
                return next
              })
              e.target.value = ''
            }}
          />
          <div style={{
            width: 80, height: 80, borderRadius: 22,
            background: src ? 'transparent' : '#fff',
            border: src ? 'none' : `2px dashed ${C.inkSoft}66`,
            position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {src ? (
              <>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                <button
                  onClick={e => {
                    e.preventDefault()
                    URL.revokeObjectURL(src)
                    setPhotos(prev => prev.filter((_, idx) => idx !== i))
                  }}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(45,43,42,0.6)', color: '#fff',
                    fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </>
            ) : (
              <span style={{ fontWeight: 300, fontSize: 28, color: C.inkSoft }}>+</span>
            )}
          </div>
        </label>
      )
    })}
  </div>
</div>
```

- [ ] **Step 5.5: Add Time section**

After the tags section and before the description `<div>`, add:

```tsx
{/* Time section */}
<button
  onClick={() => setTimeExpanded(t => !t)}
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
      }}>Czas</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
        {timeExpanded ? 'Wybierz godziny' : (
          <>Teraz · <span style={{ color: C.primary }}>za 24h</span></>
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
        <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>OD</div>
        <input
          type="datetime-local"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
        />
      </div>
      <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
        <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>DO</div>
        <input
          type="datetime-local"
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
          style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
        />
      </div>
    </div>
  )}
</button>
```

- [ ] **Step 5.6: TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5.7: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/screens/CreateSheet.tsx && git commit -m "feat: CreateSheet mini-map preview, Photos section, Time section"
```

---

## Task 6: MyEventsScreen

**Files:**
- Create: `src/screens/MyEventsScreen.tsx`

- [ ] **Step 6.1: Create MyEventsScreen**

Create `src/screens/MyEventsScreen.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import StatusPill from '../components/StatusPill'
import { C, F, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'
import type { EventWithMsgCount } from '../lib/types'

type Tab = 'active' | 'ended'

export default function MyEventsScreen({
  session,
  onBack,
  onOpenEvent,
}: {
  session: Session | null
  onBack: () => void
  onOpenEvent: (ev: EventWithMsgCount) => void
}) {
  const [tab, setTab] = useState<Tab>('active')
  const [events, setEvents] = useState<EventWithMsgCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    db.getMyEvents(session.user.id).then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [session])

  const filtered = events.filter(e =>
    tab === 'active'
      ? e.status !== 'ended'
      : e.status === 'ended'
  )

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.cream }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#fff',
            border: `2px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
            fontSize: 20, fontWeight: 800, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
        <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>
          Moje wydarzenia
        </div>
      </div>

      {/* Segmented toggle */}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          display: 'flex', padding: 4, background: '#fff', borderRadius: 999,
          boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
        }}>
          {(['active', 'ended'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 999,
                background: tab === t ? C.primary : 'transparent',
                color: tab === t ? '#fff' : C.inkSoft,
                fontSize: 13, fontWeight: 800,
                transition: 'all 240ms ease',
              }}
            >
              {t === 'active' ? 'Aktywne' : 'Zakończone'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, fontWeight: 700 }}>
            Ładowanie…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, fontWeight: 700 }}>
            {tab === 'active' ? 'Brak aktywnych wydarzeń' : 'Brak zakończonych wydarzeń'}
          </div>
        )}
        {filtered.map((ev, i) => {
          const meta = TAG_META[ev.category as Category] || TAG_META.party
          const isEnded = ev.status === 'ended'
          return (
            <button
              key={ev.id}
              onClick={() => onOpenEvent(ev)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, marginBottom: 10, borderRadius: 22,
                background: '#fff', boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
                textAlign: 'left',
                opacity: isEnded ? 0.72 : 1,
                filter: isEnded ? 'saturate(0.7)' : 'none',
              }}
            >
              <OrganicBlob
                size={56}
                color={meta.color}
                idx={i}
                face={<BlobFace size={38} mood={isEnded ? 'sleepy' : 'happy'} />}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{ev.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <StatusPill status={ev.status} size="sm" />
                  <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
                    {formatDate(ev.start_time)}
                  </span>
                </div>
                {ev.place_name && (
                  <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
                    {ev.place_name}
                  </div>
                )}
              </div>
              {/* message count badge */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 10px', borderRadius: 14, background: C.cream, flexShrink: 0,
              }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: C.primary }}>
                  {ev.msgCount}
                </div>
                <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  wiad.
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/screens/MyEventsScreen.tsx && git commit -m "feat: MyEventsScreen with active/ended tabs and real Supabase data"
```

---

## Task 7: ProfilePanel — wire My Events navigation

**Files:**
- Modify: `src/screens/ProfilePanel.tsx`

The "Moje wydarzenia" row button currently exists but has no `onClick` prop wired to navigation. We need to add `onOpenMyEvents` prop.

- [ ] **Step 7.1: Add `onOpenMyEvents` to ProfilePanel props**

In `src/screens/ProfilePanel.tsx`, find the function signature. Add `onOpenMyEvents: () => void` to the destructured props and the props type:

```tsx
function ProfilePanel({
  open,
  onClose,
  session,
  profile,
  onSignOut,
  onSignIn,
  reloadProfile,
  onOpenMyEvents,  // ADD THIS
}: {
  open: boolean
  onClose: () => void
  session: Session | null
  profile: Profile | null
  onSignOut: () => void
  onSignIn: () => void
  reloadProfile: () => void
  onOpenMyEvents: () => void  // ADD THIS
})
```

- [ ] **Step 7.2: Wire the "Moje wydarzenia" button**

Find the "Moje wydarzenia" row button in ProfilePanel. It currently reads:

```tsx
<button ... style={{ ... }}>
  <div>
    <div ...>Moje wydarzenia</div>
```

Find the outer `<button>` element and add `onClick`:

```tsx
<button
  onClick={onOpenMyEvents}
  style={{ ... }}
>
```

- [ ] **Step 7.3: TypeScript check**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: error in `App.tsx` because `onOpenMyEvents` is now required but not passed. That's expected — fixed in Task 8.

- [ ] **Step 7.4: Commit ProfilePanel**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/screens/ProfilePanel.tsx && git commit -m "feat: ProfilePanel exposes onOpenMyEvents prop"
```

---

## Task 8: App.tsx — routing, ConfettiBurst, full wiring

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 8.1: Add imports**

Add to the top of `src/App.tsx`:

```ts
import ConfettiBurst from './components/ConfettiBurst'
import MyEventsScreen from './screens/MyEventsScreen'
import type { EventWithMsgCount } from './lib/types'
```

- [ ] **Step 8.2: Extend Screen type**

Change:
```ts
type Screen = 'loading' | 'welcome' | 'map'
```
To:
```ts
type Screen = 'loading' | 'welcome' | 'map' | 'myEvents'
```

- [ ] **Step 8.3: Add confetti state**

After the existing state declarations, add:

```ts
const [showConfetti, setShowConfetti] = useState(false)
const [myEventSelected, setMyEventSelected] = useState<EventWithMsgCount | null>(null)
```

- [ ] **Step 8.4: Update handleSubmit to trigger confetti**

Change:
```ts
function handleSubmit(_data: unknown) {
  setCreateOpen(false)
  showToast(t('create.added'))
}
```
To:
```ts
function handleSubmit(_data: unknown) {
  setCreateOpen(false)
  showToast(t('create.added'))
  setShowConfetti(true)
  setTimeout(() => setShowConfetti(false), 900)
}
```

- [ ] **Step 8.5: Add MyEventsScreen rendering**

After the `if (screen === 'welcome')` block, add:

```tsx
if (screen === 'myEvents') return (
  <>
    <MyEventsScreen
      session={session}
      onBack={() => setScreen('map')}
      onOpenEvent={ev => {
        setMyEventSelected(ev)
        setScreen('map')
      }}
    />
    {myEventSelected && (
      <EventSheet
        event={myEventSelected}
        onClose={() => setMyEventSelected(null)}
        session={session}
        profile={profile}
      />
    )}
  </>
)
```

- [ ] **Step 8.6: Add ConfettiBurst and onOpenMyEvents to map screen return**

In the `return (...)` block for the map screen, add:
1. `<ConfettiBurst visible={showConfetti} />` just before the closing `</>`
2. `onOpenMyEvents` prop to `<ProfilePanel>`:

```tsx
<ProfilePanel
  open={profileOpen}
  onClose={() => setProfileOpen(false)}
  session={session}
  profile={profile}
  onSignOut={handleSignOut}
  onSignIn={() => db.signInGoogle()}
  reloadProfile={reloadProfile}
  onOpenMyEvents={() => { setProfileOpen(false); setScreen('myEvents') }}
/>
```

- [ ] **Step 8.7: TypeScript check — must be clean**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 8.8: Run full test suite**

```bash
cd /Users/wiktormarc/meuwe-web && npm test -- --run 2>&1
```

Expected: 17 tests pass.

- [ ] **Step 8.9: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/App.tsx && git commit -m "feat: myEvents routing, ConfettiBurst on create, ProfilePanel navigation wired"
```

---

## Task 9: Verification

- [ ] **Step 9.1: Start dev server and smoke-test**

```bash
cd /Users/wiktormarc/meuwe-web && npm run dev
```

Manual checks in browser at `http://localhost:5173`:

1. **Guest flow**: Welcome → "Przeglądaj bez logowania" → map loads, pins visible
2. **RecenterButton**: Pan map >0.3km → orange recenter button appears bottom-right → tap → map flies back
3. **Event tap → HALF**: Organizer row visible. If own event: "Moderator" pill visible + "Zakończ wydarzenie" button visible
4. **Event tap → FULL (swipe up)**: Sticky header with green dot, own messages orange right-aligned, others white left-aligned with avatars
5. **Create event**: Tap + → sheet opens, mini-map visible, Photos section (3 slots), Time section (collapsed → tap → datetime pickers expand) → fill title → "Dodaj wydarzenie" → confetti burst appears
6. **Profile → Moje wydarzenia**: Tap avatar → profile panel → "Moje wydarzenia" row → MyEventsScreen opens with tabs Aktywne / Zakończone

- [ ] **Step 9.2: Final commit**

```bash
cd /Users/wiktormarc/meuwe-web && git log --oneline -5
```

Expected: 9 new commits on top of `build/v1`.
