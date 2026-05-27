# Security & Architecture Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical security issues (hardcoded credentials, missing RLS, missing server-side auth guards) and key architecture problems (client-side date filtering, N+1 message counts, missing ErrorBoundary, i18n gaps, CSP, rate limiting).

**Architecture:** Nine focused tasks, ordered by severity. Tasks 1–3 are critical security fixes that must ship before any public access. Tasks 4–9 are important architecture and UX fixes. Each task is self-contained and commits independently.

**Tech Stack:** Vite + React 19 + TypeScript, Supabase JS v2, i18next, vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `.gitignore` | Modify | Add `.env` to ignored files |
| `.env` | Modify | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| `.env.example` | Modify | Document all required env vars |
| `src/lib/supabase.ts` | Modify | Read credentials from env vars; fix `endEvent`; fix `getEvents` date filter; fix `getMyEvents` COUNT |
| `supabase/migrations/20260527_rls_core_tables.sql` | Create | RLS policies for `events`, `profiles`, `event_tags`, `event_messages` |
| `supabase/migrations/20260527_msg_count_rpc.sql` | Create | SQL function `get_event_message_counts` |
| `src/components/ErrorBoundary.tsx` | Create | Class-based React error boundary |
| `src/main.tsx` | Modify | Wrap `<App>` with `<ErrorBoundary>` |
| `index.html` | Modify | Add Content-Security-Policy meta tag |
| `src/screens/EventSheet.tsx` | Modify | Add 1.5 s send cooldown |
| `src/screens/CreateSheet.tsx` | Modify | Replace hardcoded Polish strings with `t()` calls |
| `src/locales/pl.ts` | Modify | Add `create.time*` keys |
| `src/locales/en.ts` | Modify | Add `create.time*` keys |
| `src/locales/es.ts` | Modify | Add `create.time*` keys |
| `src/locales/de.ts` | Modify | Add `create.time*` keys |
| `src/components/mapIcons.ts` | Modify | Add safety comment on SVG glyph rendering |

---

## Task 1: Fix credentials — move Supabase keys to env vars, untrack .env

**Files:**
- Modify: `.gitignore`
- Modify: `.env`
- Modify: `.env.example`
- Modify: `src/lib/supabase.ts:1-8`

- [ ] **Step 1.1: Add `.env` to `.gitignore` and untrack the file**

Open `.gitignore` and append `.env` (it currently only ignores `*.local`).

Replace this block in `.gitignore`:
```
*.local
```
With:
```
*.local
.env
```

Then untrack the already-committed file (keeps it on disk, just removes it from git index):
```bash
git rm --cached .env
```

Expected output: `rm '.env'`

- [ ] **Step 1.2: Update `.env.example` with all required keys**

Full content of `.env.example`:
```
# Copy to .env and fill in real values.
# VITE_ prefix = exposed to the browser bundle (intentional for anon/public keys).

# Supabase project — find in: Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Web Push VAPID public key — generate: npx web-push generate-vapid-keys
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
```

- [ ] **Step 1.3: Update `.env` with real values**

Full content of `.env` (fill in the actual values from the old hardcoded strings in `supabase.ts`):
```
VITE_SUPABASE_URL=https://bcfhsbnbvsuxsiwmeway.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZmhzYm5idnN1eHNpd21ld2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzM5NzgsImV4cCI6MjA5NDk0OTk3OH0.pA-qmhLr0ez3lZ_7WZb6kZGVQMgoMti3CkxM8fbFQbY
VITE_VAPID_PUBLIC_KEY=BByKsFDyPNn5_jrWpwPWgVsu5srYZ86jwlg2GaCDYMXZan7PMqd2PQiWmvOtHWDr1vHI-LyuFDMM1JJxkACtrZI
```

> **Note:** Since the anon key was previously hardcoded in public source code (`supabase.ts`), it is now in git history. The anon key is designed to be public (RLS enforces access), but if you want to rotate it: Supabase Dashboard → Settings → API → "Reset anon key".

- [ ] **Step 1.4: Update `src/lib/supabase.ts` to read credentials from env**

Replace lines 5–8 in `src/lib/supabase.ts`:
```ts
const SUPABASE_URL = 'https://bcfhsbnbvsuxsiwmeway.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZmhzYm5idnN1eHNpd21ld2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzM5NzgsImV4cCI6MjA5NDk0OTk3OH0.pA-qmhLr0ez3lZ_7WZb6kZGVQMgoMti3CkxM8fbFQbY'
```
With:
```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
```

- [ ] **Step 1.5: Verify build still works**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds, no TypeScript errors about missing env.

- [ ] **Step 1.6: Commit**

```bash
git add .gitignore .env.example src/lib/supabase.ts
git commit -m "security: move Supabase credentials to env vars, untrack .env"
```

---

## Task 2: Add RLS policies for core tables

**Files:**
- Create: `supabase/migrations/20260527_rls_core_tables.sql`

These policies must be applied in Supabase Dashboard → SQL Editor → Run (or via `supabase db push` if CLI is configured).

- [ ] **Step 2.1: Create the migration file**

Create `supabase/migrations/20260527_rls_core_tables.sql` with this content:

```sql
-- ============================================================
-- RLS policies for: events, profiles, event_tags, event_messages
-- Apply in Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── events ──────────────────────────────────────────────────

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Everyone can read events (map is public)
CREATE POLICY "events_select"
  ON events FOR SELECT
  USING (true);

-- Authenticated users can create events — they must be the creator
CREATE POLICY "events_insert"
  ON events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Only the creator can update their event (e.g. mark as ended)
CREATE POLICY "events_update"
  ON events FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Only the creator can delete their event
CREATE POLICY "events_delete"
  ON events FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

-- ── profiles ────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read profiles (needed to display organizer name/avatar)
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (true);

-- Users can create only their own profile
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update only their own profile
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── event_tags ───────────────────────────────────────────────

ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;

-- Everyone can read tags (needed for event display and filtering)
CREATE POLICY "event_tags_select"
  ON event_tags FOR SELECT
  USING (true);

-- Only the event's creator can add tags to it
CREATE POLICY "event_tags_insert"
  ON event_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_tags.event_id
        AND creator_id = auth.uid()
    )
  );

-- Only the event's creator can remove tags
CREATE POLICY "event_tags_delete"
  ON event_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE id = event_tags.event_id
        AND creator_id = auth.uid()
    )
  );

-- ── event_messages ───────────────────────────────────────────

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can read messages (public chat, needed for Realtime)
CREATE POLICY "event_messages_select"
  ON event_messages FOR SELECT
  USING (true);

-- Authenticated users can post — they must be the author
CREATE POLICY "event_messages_insert"
  ON event_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own messages
CREATE POLICY "event_messages_delete"
  ON event_messages FOR DELETE TO authenticated
  USING (auth.uid() = author_id);
```

- [ ] **Step 2.2: Apply the migration**

Go to **Supabase Dashboard → SQL Editor**, paste the contents of `supabase/migrations/20260527_rls_core_tables.sql`, and click **Run**.

Expected: no errors. If you see "policy already exists", the table already had a policy with that name — inspect it and adjust.

- [ ] **Step 2.3: Manual smoke test — unauthenticated read**

In the Supabase Dashboard SQL Editor:
```sql
-- Should return rows (SELECT USING true)
SELECT id, title FROM events LIMIT 3;
```
Expected: rows returned.

- [ ] **Step 2.4: Manual smoke test — unauthenticated write must fail**

In Supabase Dashboard → Table Editor, try to insert a row into `events` as anon. Expected: `new row violates row-level security policy`.

Alternatively, in the SQL editor:
```sql
-- Run as anon role to verify INSERT is blocked
SET ROLE anon;
INSERT INTO events (title, lat, lng, category, start_time, end_time, creator_id, status)
VALUES ('test', 0, 0, 'party', now(), now() + interval '1 day', gen_random_uuid(), 'live');
-- Expected: ERROR — new row violates row-level security policy
RESET ROLE;
```

- [ ] **Step 2.5: Commit**

```bash
git add supabase/migrations/20260527_rls_core_tables.sql
git commit -m "security: enable RLS on events, profiles, event_tags, event_messages"
```

---

## Task 3: Add server-side auth guard to endEvent

**Files:**
- Modify: `src/lib/supabase.ts:115-117`

With Task 2 done, the DB already rejects unauthorized updates via RLS. This task adds defense-in-depth at the client layer and makes the intent explicit.

- [ ] **Step 3.1: Fix `db.endEvent` to include creator check and auth guard**

Replace the current `endEvent` method in `src/lib/supabase.ts`:
```ts
  async endEvent(eventId:string) {
    return supabase.from('events').update({status:'ended'}).eq('id',eventId)
  },
```
With:
```ts
  async endEvent(eventId: string) {
    const sess = await this.getSession()
    if (!sess) return { data: null, error: { message: 'not authenticated' } }
    // `.eq('creator_id', sess.user.id)` is a defense-in-depth check.
    // The DB already enforces this via RLS (events_update policy).
    return supabase
      .from('events')
      .update({ status: 'ended' })
      .eq('id', eventId)
      .eq('creator_id', sess.user.id)
  },
```

- [ ] **Step 3.2: Write a unit test**

Add to `src/lib/supabase.test.ts` (create section for endEvent):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client — import the module after mocking
vi.mock('./supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./supabase')>()
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      from: vi.fn(),
    },
  }
})

describe('db.endEvent', () => {
  it('returns error when not authenticated', async () => {
    const { db } = await import('./supabase')
    const result = await db.endEvent('event-123')
    expect(result).toEqual({ data: null, error: { message: 'not authenticated' } })
  })
})
```

- [ ] **Step 3.3: Run the test**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A5 "endEvent"
```

Expected: test passes.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "security: add auth guard and creator check to endEvent"
```

---

## Task 4: Add ErrorBoundary component

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 4.1: Create `src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to error reporting service here
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#FFF6EC', gap: 16, padding: 24,
          fontFamily: '"Nunito",ui-rounded,system-ui,sans-serif',
        }}>
          <div style={{
            fontSize: 48, fontWeight: 900,
            fontFamily: '"Hanken Grotesk","Nunito",ui-rounded,system-ui,sans-serif',
            letterSpacing: -2, display: 'flex',
          }}>
            <span style={{ color: '#FF7A45' }}>me</span>
            <span style={{ color: '#4FC3F7' }}>u</span>
            <span style={{ color: '#7DD87A' }}>we</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D2B2A', textAlign: 'center' }}>
            Coś poszło nie tak
          </div>
          <div style={{ fontSize: 12, color: '#8A8580', fontWeight: 600, textAlign: 'center', maxWidth: 280 }}>
            {this.state.error?.message || 'Nieznany błąd'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '12px 24px', borderRadius: 999,
              background: '#FF7A45', color: '#fff', fontSize: 14, fontWeight: 800,
              border: '2.5px solid #2D2B2A',
            }}
          >
            Odśwież aplikację
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

- [ ] **Step 4.2: Wrap `<App>` in `src/main.tsx`**

Read the current `src/main.tsx` first. It likely looks like:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Replace it with:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 4.3: Write a unit test for ErrorBoundary**

Create `src/components/ErrorBoundary.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

// Component that always throws
function Bomb() {
  throw new Error('test explosion')
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('safe content')).toBeInTheDocument()
  })

  it('shows fallback UI when child throws', () => {
    // suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('Coś poszło nie tak')).toBeInTheDocument()
    expect(screen.getByText('test explosion')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders custom fallback when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('custom fallback')).toBeInTheDocument()
    spy.mockRestore()
  })
})
```

- [ ] **Step 4.4: Run the tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A10 "ErrorBoundary"
```

Expected: all 3 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx src/main.tsx
git commit -m "feat: add ErrorBoundary to prevent full-app crash on component errors"
```

---

## Task 5: Add Content Security Policy

**Files:**
- Modify: `index.html`

The app uses: Supabase (HTTPS + WSS), CartoCDN tiles, Nominatim geocoding, Google Fonts, Leaflet CSS from unpkg, inline styles (React), and the service worker.

- [ ] **Step 5.1: Add CSP meta tag to `index.html`**

Add the following `<meta>` tag inside `<head>`, right after `<meta charset="UTF-8" />`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob:
    https://*.basemaps.cartocdn.com
    https://*.tile.openstreetmap.org
    https://bcfhsbnbvsuxsiwmeway.supabase.co;
  connect-src 'self'
    https://bcfhsbnbvsuxsiwmeway.supabase.co
    wss://bcfhsbnbvsuxsiwmeway.supabase.co
    https://nominatim.openstreetmap.org;
  worker-src 'self';
  manifest-src 'self';
">
```

> **Note:** `'unsafe-inline'` for `style-src` is required because the app uses React inline styles (`style={{}}`). Without it, all inline styles would be blocked.

- [ ] **Step 5.2: Verify app loads without CSP violations**

```bash
npm run dev
```

Open browser DevTools → Console. There should be no `Content Security Policy` error lines. Test: open map, search a place (Nominatim), open an event (Supabase), check that tile images load.

If you see a violation for a source not listed (e.g., a photo URL from Supabase storage), add it to the relevant directive. Supabase Storage URLs follow the pattern `https://bcfhsbnbvsuxsiwmeway.supabase.co/storage/v1/object/public/...` which is already covered by the `img-src` above.

- [ ] **Step 5.3: Commit**

```bash
git add index.html
git commit -m "security: add Content Security Policy meta tag"
```

---

## Task 6: Add message send rate limiting

**Files:**
- Modify: `src/screens/EventSheet.tsx:87-97`

Adds a 1.5 s client-side cooldown so users cannot flood the chat.

- [ ] **Step 6.1: Add cooldown ref and guard to `send()` in `EventSheet.tsx`**

At the top of the `EventSheet` function body, after the existing `useRef` declarations (around line 44–46), add:

```ts
const lastSendRef = useRef<number>(0)
```

Then update the `send` function (lines 87–97):

```ts
  async function send() {
    if (!input.trim() || !session) return
    const now = Date.now()
    if (now - lastSendRef.current < 1500) return   // 1.5 s cooldown
    lastSendRef.current = now
    const text = input.trim()
    setInput('')
    setSendErr('')
    const authorName =
      profile?.display_name || session.user?.email?.split('@')[0] || '?'
    const authorColor = profile?.avatar_color || C.primary
    const result = await db.sendMessage(event.id, text, authorName, authorColor)
    if (result?.error) setSendErr(t('event.sendError'))
  }
```

- [ ] **Step 6.2: Verify manually**

```bash
npm run dev
```

Open an event, go to full-screen chat. Type a message, send it. Immediately try sending another — it should be silently ignored for 1.5 s.

- [ ] **Step 6.3: Commit**

```bash
git add src/screens/EventSheet.tsx
git commit -m "feat: add 1.5s send cooldown to prevent chat spam"
```

---

## Task 7: Fix `getEvents` to filter by date in SQL

**Files:**
- Modify: `src/lib/supabase.ts:33-48`

Currently the query fetches all events in the bounding box then filters by day in JS. This moves the date filter to the SQL query.

- [ ] **Step 7.1: Update `getEvents` in `src/lib/supabase.ts`**

Replace the current `getEvents` method:

```ts
  async getEvents(lat:number,lng:number,km=15,dayOffset=0):Promise<EventWithMeta[]> {
    const d=km/111
    const {data,error}=await supabase.from('events')
      .select('*,profiles(display_name,avatar_color),event_tags(tag)')
      .gte('lat',lat-d).lte('lat',lat+d).gte('lng',lng-d).lte('lng',lng+d)
      .in('status',['live','upcoming','extended'])
      .order('created_at',{ascending:false})
    if(error){console.error(error);return[]}
    const today=new Date()
    return (data||[])
      .filter((e:any)=>isOnDay(e.start_time,today,dayOffset))
      .map((e:any)=>{
        const dk=haversineKm(lat,lng,e.lat,e.lng)
        return {...e, tags:(e.event_tags||[]).map((t:any)=>t.tag),
          distKm:dk, distStr:dk<1?`${Math.round(dk*1000)} m`:`${dk.toFixed(1)} km`}
      })
  },
```

With:

```ts
  async getEvents(lat:number,lng:number,km=15,dayOffset=0):Promise<EventWithMeta[]> {
    const d=km/111
    // Compute the target day's start/end in local time, then convert to UTC
    // to replicate the same semantics as the previous toDateString() comparison.
    const target = new Date()
    target.setDate(target.getDate() + dayOffset)
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0)
    const dayEnd   = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999)

    const {data,error}=await supabase.from('events')
      .select('*,profiles(display_name,avatar_color),event_tags(tag)')
      .gte('lat',lat-d).lte('lat',lat+d).gte('lng',lng-d).lte('lng',lng+d)
      .in('status',['live','upcoming','extended'])
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString())
      .order('created_at',{ascending:false})
    if(error){console.error(error);return[]}
    return (data||[]).map((e:any)=>{
      const dk=haversineKm(lat,lng,e.lat,e.lng)
      return {...e, tags:(e.event_tags||[]).map((t:any)=>t.tag),
        distKm:dk, distStr:dk<1?`${Math.round(dk*1000)} m`:`${dk.toFixed(1)} km`}
    })
  },
```

The `isOnDay` function in `supabase.ts` is now unused. Remove the export keyword if desired — but leave the function in place for now since `supabase.test.ts` may reference it.

- [ ] **Step 7.2: Run existing tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass. The `isOnDay` unit tests in `supabase.test.ts` should still pass since the function still exists.

- [ ] **Step 7.3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "perf: move getEvents date filter from client JS to SQL query"
```

---

## Task 8: Fix `getMyEvents` to use SQL COUNT instead of fetching all messages

**Files:**
- Create: `supabase/migrations/20260527_msg_count_rpc.sql`
- Modify: `src/lib/supabase.ts:76-106`

Currently `getMyEvents` fetches every message row for every event to count them. This replaces it with a SQL aggregate function.

- [ ] **Step 8.1: Create the SQL function migration**

Create `supabase/migrations/20260527_msg_count_rpc.sql`:

```sql
-- Returns message counts per event — used by getMyEvents()
-- Apply in Supabase Dashboard → SQL Editor → Run
CREATE OR REPLACE FUNCTION get_event_message_counts(event_ids uuid[])
RETURNS TABLE(event_id uuid, msg_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT event_id, COUNT(*)::bigint AS msg_count
  FROM event_messages
  WHERE event_id = ANY(event_ids)
  GROUP BY event_id;
$$;
```

- [ ] **Step 8.2: Apply the migration**

Paste the content into **Supabase Dashboard → SQL Editor** and click **Run**.

Expected: `Success. No rows returned.`

Manual verification:
```sql
SELECT * FROM get_event_message_counts(ARRAY[]::uuid[]);
-- Expected: empty result, no error
```

- [ ] **Step 8.3: Update `getMyEvents` in `src/lib/supabase.ts`**

Replace the current `getMyEvents` method:

```ts
  async getMyEvents(userId:string):Promise<EventWithMsgCount[]> {
    const {data,error}=await supabase.from('events')
      .select('*, event_tags(tag)')
      .eq('creator_id',userId)
      .order('start_time',{ascending:false})
    if(error){console.error(error);return[]}

    // Get message counts separately — event_messages(count) selects a literal
    // column named "count" (which doesn't exist), not a COUNT aggregate.
    const eventIds=(data||[]).map((e:any)=>e.id)
    let countMap:Record<string,number>={}
    if(eventIds.length>0){
      const {data:counts}=await supabase.from('event_messages')
        .select('event_id')
        .in('event_id',eventIds)
      if(counts){
        counts.forEach((r:any)=>{
          countMap[r.event_id]=(countMap[r.event_id]||0)+1
        })
      }
    }

    return (data||[]).map((e:any)=>({
      ...e,
      tags:(e.event_tags||[]).map((t:any)=>t.tag),
      distKm:0,
      distStr:'',
      profiles:null,
      msgCount:countMap[e.id]??0,
    })) as EventWithMsgCount[]
  },
```

With:

```ts
  async getMyEvents(userId: string): Promise<EventWithMsgCount[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*, event_tags(tag)')
      .eq('creator_id', userId)
      .order('start_time', { ascending: false })
    if (error) { console.error(error); return [] }

    const eventIds = (data || []).map((e: any) => e.id)
    let countMap: Record<string, number> = {}

    if (eventIds.length > 0) {
      // Single SQL COUNT query via RPC — replaces fetching all message rows
      const { data: counts, error: countErr } = await supabase
        .rpc('get_event_message_counts', { event_ids: eventIds })
      if (countErr) console.error('[getMyEvents] count rpc error:', countErr)
      if (counts) {
        ;(counts as { event_id: string; msg_count: number }[]).forEach(r => {
          countMap[r.event_id] = r.msg_count
        })
      }
    }

    return (data || []).map((e: any) => ({
      ...e,
      tags: (e.event_tags || []).map((t: any) => t.tag),
      distKm: 0,
      distStr: '',
      profiles: null,
      msgCount: countMap[e.id] ?? 0,
    })) as EventWithMsgCount[]
  },
```

- [ ] **Step 8.4: Run existing tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add supabase/migrations/20260527_msg_count_rpc.sql src/lib/supabase.ts
git commit -m "perf: replace getMyEvents message fetch-all with SQL COUNT rpc"
```

---

## Task 9: Fix i18n gaps in CreateSheet

**Files:**
- Modify: `src/locales/pl.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/de.ts`
- Modify: `src/screens/CreateSheet.tsx:411-452`

The Time section in CreateSheet has hardcoded Polish strings: `"Czas"`, `"Teraz"`, `"za 24h"`, `"Wybierz godziny"`, `"OD"`, `"DO"`.

- [ ] **Step 9.1: Add missing keys to `src/locales/pl.ts`**

In the `create` section, add after `timeError`:
```ts
    timeLabel: 'Czas',
    timeNow: 'Teraz',
    timeIn24h: 'za 24h',
    timePick: 'Wybierz godziny',
    timeFrom: 'OD',
    timeTo: 'DO',
```

- [ ] **Step 9.2: Add missing keys to `src/locales/en.ts`**

In the `create` section, add after `timeError`:
```ts
    timeLabel: 'Time',
    timeNow: 'Now',
    timeIn24h: 'in 24h',
    timePick: 'Set hours',
    timeFrom: 'FROM',
    timeTo: 'TO',
```

- [ ] **Step 9.3: Add missing keys to `src/locales/es.ts`**

In the `create` section, add after `timeError`:
```ts
    timeLabel: 'Hora',
    timeNow: 'Ahora',
    timeIn24h: 'en 24h',
    timePick: 'Elige horas',
    timeFrom: 'DESDE',
    timeTo: 'HASTA',
```

- [ ] **Step 9.4: Add missing keys to `src/locales/de.ts`**

In the `create` section, add after `timeError`:
```ts
    timeLabel: 'Zeit',
    timeNow: 'Jetzt',
    timeIn24h: 'in 24h',
    timePick: 'Stunden wählen',
    timeFrom: 'VON',
    timeTo: 'BIS',
```

- [ ] **Step 9.5: Replace hardcoded strings in `CreateSheet.tsx`**

Find the Time section (around line 403–452). Replace the four hardcoded strings:

```tsx
// BEFORE:
<div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
}}>Czas</div>
<div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
  {timeExpanded ? 'Wybierz godziny' : (
    <>Teraz · <span style={{ color: C.primary }}>za 24h</span></>
  )}
</div>
```

With:
```tsx
<div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
}}>{t('create.timeLabel')}</div>
<div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
  {timeExpanded ? t('create.timePick') : (
    <>{t('create.timeNow')} · <span style={{ color: C.primary }}>{t('create.timeIn24h')}</span></>
  )}
</div>
```

And the OD/DO labels:
```tsx
// BEFORE:
<div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>OD</div>
// ...
<div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>DO</div>
```

With:
```tsx
<div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{t('create.timeFrom')}</div>
// ...
<div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{t('create.timeTo')}</div>
```

- [ ] **Step 9.6: Verify TypeScript is happy**

```bash
npm run build 2>&1 | tail -5
```

Expected: no errors. TypeScript checks locale types via the `Resources` type in `pl.ts`.

- [ ] **Step 9.7: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts src/screens/CreateSheet.tsx
git commit -m "fix: replace hardcoded Polish strings in CreateSheet Time section with i18n keys"
```

---

## Task 10: Document `dangerouslySetInnerHTML` safety in mapIcons / MapScreen

**Files:**
- Modify: `src/lib/tokens.ts:34-36`
- Modify: `src/screens/MapScreen.tsx:259-261`

The `meta.glyph` strings are compile-time SVG constants from `tokens.ts` — never user-supplied data — so `dangerouslySetInnerHTML` is safe here. Adding a comment documents this intent and prevents a well-meaning future developer from "fixing" it incorrectly.

- [ ] **Step 10.1: Add safety comment in `tokens.ts`**

Above the `icon()` helper (line 34), add:
```ts
// SAFETY: icon() returns a static, hardcoded SVG string — not user input.
// dangerouslySetInnerHTML in MapScreen.tsx is safe because these values
// are compile-time constants defined in this file only.
```

- [ ] **Step 10.2: Add inline comment in `MapScreen.tsx`**

At the `dangerouslySetInnerHTML` usage (around line 261), add a comment:
```tsx
{/* SAFETY: meta.glyph is a static SVG from tokens.ts — not user input */}
<span
  style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }}
  dangerouslySetInnerHTML={{ __html: meta.glyph }}
/>
```

- [ ] **Step 10.3: Commit**

```bash
git add src/lib/tokens.ts src/screens/MapScreen.tsx
git commit -m "docs: document dangerouslySetInnerHTML safety on static SVG glyphs"
```

---

## Self-Review

**Spec coverage:**

| Audit finding | Task |
|---|---|
| `.env` in git | Task 1 |
| Anon key hardcoded in source | Task 1 |
| No RLS on events/profiles/event_tags/event_messages | Task 2 |
| endEvent without server-side auth | Task 3 |
| No Error Boundary | Task 4 |
| No CSP | Task 5 |
| No rate limiting on messages | Task 6 |
| getEvents client-side date filter | Task 7 |
| getMyEvents N+1 message count | Task 8 |
| i18n gaps in CreateSheet | Task 9 |
| dangerouslySetInnerHTML safety | Task 10 |

**Items NOT addressed (deferred):**
- GPS opt-out/retention policy — requires product decision, no code fix
- MIME type server-side validation — requires Supabase Storage bucket config in the dashboard (not code); note: add `allowedMimeTypes: ['image/*']` in Supabase Dashboard → Storage → event-photos → Edit bucket
- App.tsx God Component / supabase.ts split — large refactor, deferred to its own plan
- getMyEvents/getEvents pagination — deferred
- subscribeEvents race condition — deferred

**Placeholder scan:** No TBD or TODO blocks found. All code steps show complete implementations.

**Type consistency:** `EventWithMsgCount`, `Profile`, `EventWithMeta`, `Message` — all used consistently with definitions in `src/lib/types.ts`. The new RPC return type `{ event_id: string; msg_count: number }[]` is inline-typed at the call site, consistent with the rest of the file's style.
