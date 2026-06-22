# meuwe Capacitor — Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing `meuwe-web` SPA in Capacitor and ship a publishable native **Android** app (Google Play), building the platform-agnostic native core (auth, push, geo) that the later iOS plan reuses.

**Architecture:** One repo, one web codebase. Native behaviour lives behind `isNativePlatform()` branches. Native Google sign-in via `@capacitor-firebase/authentication` with `skipNativeAuth: true` → `idToken` → `supabase.auth.signInWithIdToken` (no OAuth redirect). Native push via `@capacitor-firebase/messaging` (FCM) → new `push_devices` table; the 4 existing edge functions fan out to both Web Push and FCM. Web behaviour is untouched.

**Tech Stack:** Capacitor 6, `@capacitor-firebase/authentication`, `@capacitor-firebase/messaging`, `@capacitor/geolocation`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, Supabase (auth idToken, edge functions Deno), FCM HTTP v1, Vitest, Deno test.

**Branch:** `Android_app` (already created, tracks `origin/Android_app`). All commits go here.

**iOS is out of scope** — a follow-up plan adds Apple Sign-In, APNs, Xcode config, App Store. This plan only builds shared core + Android.

---

## File Structure

**Created:**
- `capacitor.config.ts` — Capacitor app config (appId `eu.meuwe`, webDir `dist`)
- `src/lib/nativeAuth.ts` — native sign-in (Google now; Apple stub for iOS plan)
- `src/lib/nativeAuth.test.ts` — unit tests for the orchestration logic
- `supabase/migrations/20260618_push_devices.sql` — native FCM token table + RLS
- `supabase/functions/_shared/fcm.ts` — FCM HTTP v1 sender + payload builder
- `supabase/functions/_shared/fcm.test.ts` — Deno test for payload builder
- `android/` — generated native project (committed)

**Modified:**
- `package.json` — Capacitor deps + scripts
- `src/lib/platform.ts` — add `isAndroid()` / `isIOS()` helpers
- `src/lib/supabase.ts` — `db.signInGoogle()` branches to native
- `src/lib/push.ts` — native registration branch (FCM token → `push_devices`)
- `src/lib/geo.ts` — native `getCurrentPosition()` branch
- `src/App.tsx` — native geolocation watch branch
- `src/screens/Welcome.tsx` — guard `isInAppBrowser()` with `!isNativePlatform()`
- `supabase/functions/push-new-message/index.ts` — FCM fan-out
- `supabase/functions/push-new-event/index.ts` — FCM fan-out
- `supabase/functions/push-event-start/index.ts` — FCM fan-out
- `supabase/functions/push-event-updated/index.ts` — FCM fan-out

---

## Stage 0: Capacitor + Android shell

### Task 0.1: Install Capacitor and create config

**Files:**
- Modify: `package.json`
- Create: `capacitor.config.ts`

- [ ] **Step 1: Install Capacitor core + CLI + platforms**

Run:
```bash
cd /Users/wiktormarc/meuwe-web
npm install @capacitor/core@^6 @capacitor/app@^6 @capacitor/status-bar@^6 @capacitor/splash-screen@^6 @capacitor/geolocation@^6
npm install -D @capacitor/cli@^6 @capacitor/android@^6
```
Expected: packages added to `package.json`, no peer-dep errors that block install.

- [ ] **Step 2: Create `capacitor.config.ts`**

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'eu.meuwe',
  appName: 'meuwe',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#FF7A45',
      showSpinner: false,
    },
  },
}

export default config
```

- [ ] **Step 3: Add cap scripts to `package.json`**

In the `"scripts"` block add:
```json
"cap:sync": "npm run build && npx cap sync",
"cap:android": "npm run build && npx cap sync android && npx cap open android"
```

- [ ] **Step 4: Verify build still works**

Run: `npm run build`
Expected: `dist/` produced, exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json capacitor.config.ts
git commit -m "feat(cap): add Capacitor core deps and config (eu.meuwe)"
```

### Task 0.2: Add Android platform and first sync

**Files:**
- Create: `android/` (generated)
- Modify: `.gitignore` (ensure android build artifacts ignored, project committed)

- [ ] **Step 1: Build web then add Android**

Run:
```bash
npm run build
npx cap add android
```
Expected: `android/` directory created, `cap sync` runs automatically.

- [ ] **Step 2: Append Android build-artifact ignores to `.gitignore`**

Append:
```
# Capacitor / Android build artifacts
android/.gradle/
android/app/build/
android/build/
android/local.properties
android/app/release/
android/captures/
*.keystore
!android/app/debug.keystore
```

- [ ] **Step 3: Sync**

Run: `npx cap sync android`
Expected: "Sync finished" with no errors; `android/app/src/main/assets/public/` contains the web build.

- [ ] **Step 4: Manual device check (you, on emulator)**

Run: `npx cap open android`, then Run ▶ on a **Google Play–enabled AVD**.
Expected: app launches, shows the meuwe `Welcome` screen (native branch already renders `Welcome`, not the landing). Google button will not work yet — that is Stage 2.

- [ ] **Step 5: Commit**

```bash
git add android .gitignore
git commit -m "feat(cap): add committed Android platform project"
```

### Task 0.3: Platform helpers

**Files:**
- Modify: `src/lib/platform.ts`

- [ ] **Step 1: Add `isAndroid()` / `isIOS()` helpers**

Replace the file contents with:
```ts
export const isNativePlatform = (): boolean => {
  try { return (window as any)?.Capacitor?.isNativePlatform?.() ?? false }
  catch { return false }
}

const getPlatform = (): string => {
  try { return (window as any)?.Capacitor?.getPlatform?.() ?? 'web' }
  catch { return 'web' }
}

export const isAndroid = (): boolean => getPlatform() === 'android'
export const isIOS = (): boolean => getPlatform() === 'ios'
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/platform.ts
git commit -m "feat(cap): add isAndroid/isIOS platform helpers"
```

---

## Stage 1: Firebase project + native auth/messaging plugins

### Task 1.1: Firebase project + `google-services.json` (manual)

**Files:**
- Create: `android/app/google-services.json` (from Firebase console; **gitignored as it contains project config — see step 4**)

- [ ] **Step 1: Create Firebase project (you, in console)**

In <https://console.firebase.google.com>: create project `meuwe` (or reuse existing). Add an **Android app** with package name `eu.meuwe`.

- [ ] **Step 2: Add SHA-1 + SHA-256 signing certs**

Get debug SHA-1:
```bash
cd /Users/wiktormarc/meuwe-web/android
./gradlew signingReport
```
Copy the `SHA1` and `SHA-256` of the `debug` variant into Firebase → Project settings → your Android app. (Repeat with the release keystore in Stage 6.)

> SHA fingerprints are **required** for native Google Sign-In to work.

- [ ] **Step 3: Download `google-services.json` into `android/app/`**

Place the downloaded file at `android/app/google-services.json`.

- [ ] **Step 4: Decide gitignore for `google-services.json`**

`google-services.json` contains no secrets (only public config) but pins the Firebase project. Commit it so CI/other machines build. Confirm it is **not** matched by `.gitignore`.

- [ ] **Step 5: Commit**

```bash
git add android/app/google-services.json
git commit -m "feat(firebase): add Android google-services.json"
```

### Task 1.2: Install Firebase Capacitor plugins + Gradle wiring

**Files:**
- Modify: `package.json`
- Modify: `android/build.gradle`, `android/app/build.gradle` (Gradle plugin wiring per plugin docs)

- [ ] **Step 1: Install plugins**

Run:
```bash
npm install @capacitor-firebase/authentication@^6 @capacitor-firebase/messaging@^6 firebase
```

- [ ] **Step 2: Configure plugin in `capacitor.config.ts`**

Add to the `plugins` block:
```ts
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
```
(`skipNativeAuth` is passed per-call as `true`; this global stays default. Apple added in iOS plan.)

- [ ] **Step 2b: Add the Google provider native dependency**

`@capacitor-firebase/authentication` needs `play-services-auth` for the Google provider
(`com.google.android.gms.auth.api.signin.GoogleSignIn`); without it the app crashes at
`Bridge.<init>` on launch with `ClassNotFoundException`. In `android/app/build.gradle`,
inside the `dependencies { }` block, add:
```
    implementation "com.google.android.gms:play-services-auth:21.2.0"
```

- [ ] **Step 3: Add Google Services Gradle plugin**

In `android/build.gradle` under `dependencies` of `buildscript`:
```
classpath 'com.google.gms:google-services:4.4.2'
```
At the **bottom** of `android/app/build.gradle`:
```
apply plugin: 'com.google.gms.google-services'
```

- [ ] **Step 4: Sync**

Run: `npm run build && npx cap sync android`
Expected: "Sync finished", plugins listed (FirebaseAuthentication, FirebaseMessaging).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json capacitor.config.ts android/build.gradle android/app/build.gradle
git commit -m "feat(firebase): install auth+messaging plugins, wire Gradle"
```

---

## Stage 2: Native Google sign-in

### Task 2.1: `nativeAuth.ts` — Google sign-in orchestration (TDD)

**Files:**
- Create: `src/lib/nativeAuth.ts`
- Test: `src/lib/nativeAuth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithGoogle = vi.fn()
const signInWithIdToken = vi.fn()

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithGoogle: (...a: any[]) => signInWithGoogle(...a) },
}))
vi.mock('./supabase', () => ({
  supabase: { auth: { signInWithIdToken: (...a: any[]) => signInWithIdToken(...a) } },
}))

import { signInGoogleNative } from './nativeAuth'

describe('signInGoogleNative', () => {
  beforeEach(() => { signInWithGoogle.mockReset(); signInWithIdToken.mockReset() })

  it('passes the Google idToken to supabase signInWithIdToken', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInGoogleNative()

    expect(signInWithGoogle).toHaveBeenCalledWith({ skipNativeAuth: true })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'GTOKEN' })
  })

  it('throws when no idToken is returned', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: null } })
    await expect(signInGoogleNative()).rejects.toThrow(/idToken/)
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it('surfaces supabase errors', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: null, error: { message: 'bad token' } })
    await expect(signInGoogleNative()).rejects.toThrow(/bad token/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- nativeAuth`
Expected: FAIL — cannot find module `./nativeAuth`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { supabase } from './supabase'

export async function signInGoogleNative(): Promise<void> {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error('Google sign-in returned no idToken')
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- nativeAuth`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nativeAuth.ts src/lib/nativeAuth.test.ts
git commit -m "feat(auth): native Google sign-in via Firebase idToken -> Supabase"
```

### Task 2.2: Branch `db.signInGoogle()` to native

**Files:**
- Modify: `src/lib/supabase.ts:19`

- [ ] **Step 1: Add import at top of `supabase.ts`**

After the existing imports add:
```ts
import { isNativePlatform } from './platform'
```

- [ ] **Step 2: Replace `signInGoogle` in the `db` object**

Replace:
```ts
  signInGoogle() { return supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin } }) },
```
with:
```ts
  signInGoogle() {
    if (isNativePlatform()) {
      // native: dynamic import keeps the Firebase plugin out of the web bundle
      return import('./nativeAuth').then(m => m.signInGoogleNative())
    }
    return supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin } })
  },
```

- [ ] **Step 3: Typecheck + run full unit suite**

Run: `npx tsc -b && npm test`
Expected: exit 0, all tests pass (web tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(auth): route db.signInGoogle to native on Capacitor"
```

### Task 2.3: Fix `isInAppBrowser` guard on native

**Files:**
- Modify: `src/screens/Welcome.tsx`

- [ ] **Step 1: Import the platform helper**

In `Welcome.tsx`, add to imports:
```ts
import { isNativePlatform } from '../lib/platform'
```

- [ ] **Step 2: Short-circuit `isInAppBrowser` on native**

Change the first line of the `isInAppBrowser` function body from:
```ts
  const ua = navigator.userAgent
```
to:
```ts
  if (isNativePlatform()) return false
  const ua = navigator.userAgent
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Welcome.tsx
git commit -m "fix(auth): never show in-app-browser screen on native WebView"
```

### Task 2.4: Configure Supabase to accept the Google idToken (manual)

- [ ] **Step 1: Get the Android OAuth client ID**

From `android/app/google-services.json`, find the OAuth client of type 3 (web client) — Firebase auto-creates it. Also note the Web client ID in Firebase → Authentication → Sign-in method → Google.

- [ ] **Step 2: Add authorized client IDs in Supabase**

Supabase Dashboard → Authentication → Providers → Google → enable, and add the **Web client ID** (and any Android client ID) to "Authorized Client IDs". This lets `signInWithIdToken` validate the native token's audience.

- [ ] **Step 3: Verify on emulator (you)**

Run: `npm run build && npx cap sync android && npx cap open android`, Run ▶ on Play-enabled AVD, tap **Sign in with Google**, pick the emulator's Google account.
Expected: returns to the map screen logged in; `profiles` row exists in Supabase. No browser bounce.

> No commit — config + manual verification only.

---

## Stage 3: Native push client (FCM token capture)

### Task 3.1: `push_devices` migration

**Files:**
- Create: `supabase/migrations/20260618_push_devices.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Native push targets (FCM). Separate from web push_subscriptions.
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_id_idx on public.push_devices(user_id);

alter table public.push_devices enable row level security;

create policy "own devices select" on public.push_devices
  for select using (auth.uid() = user_id);
create policy "own devices insert" on public.push_devices
  for insert with check (auth.uid() = user_id);
create policy "own devices update" on public.push_devices
  for update using (auth.uid() = user_id);
create policy "own devices delete" on public.push_devices
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via the Supabase SQL editor if not using the CLI link).
Expected: `push_devices` table visible in the dashboard with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260618_push_devices.sql
git commit -m "feat(push): add push_devices table for native FCM tokens"
```

### Task 3.2: Native registration branch in `push.ts`

**Files:**
- Modify: `src/lib/push.ts`

- [ ] **Step 1: Add imports at top of `push.ts`**

```ts
import { isNativePlatform, isAndroid } from './platform'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
```

- [ ] **Step 2: Add native registration function**

Add near the top of the file (after imports):
```ts
async function saveFcmToken(_userId: string, token: string): Promise<void> {
  // Use the SECURITY DEFINER RPC (not a direct upsert) so a token previously
  // owned by another account on this device is reassigned to the current user.
  const { error } = await supabase.rpc('register_push_device', {
    p_fcm_token: token,
    p_platform: isAndroid() ? 'android' : 'ios',
  })
  if (error) console.error('[push] register_push_device failed:', error)
}

export async function registerNativePush(userId: string): Promise<PushStatus> {
  const perm = await FirebaseMessaging.requestPermissions()
  if (perm.receive !== 'granted') return 'denied'

  const { token } = await FirebaseMessaging.getToken()
  if (!token) return 'unsubscribed'
  await saveFcmToken(userId, token)

  // Token rotation
  await FirebaseMessaging.removeAllListeners()
  await FirebaseMessaging.addListener('tokenReceived', ({ token: t }) => {
    if (t) saveFcmToken(userId, t)
  })
  return 'subscribed'
}
```

- [ ] **Step 3: Branch the public entry points to native**

At the very top of `subscribePush`, add:
```ts
  if (isNativePlatform()) return registerNativePush(userId)
```
At the very top of `getPushStatus`, add:
```ts
  if (isNativePlatform()) {
    const perm = await FirebaseMessaging.checkPermissions()
    return perm.receive === 'granted' ? 'subscribed' : perm.receive === 'denied' ? 'denied' : 'unsubscribed'
  }
```
At the very top of `unsubscribePush`, add:
```ts
  if (isNativePlatform()) {
    const { token } = await FirebaseMessaging.getToken().catch(() => ({ token: null }))
    if (token) await supabase.from('push_devices').delete().eq('fcm_token', token)
    await FirebaseMessaging.deleteToken().catch(() => {})
    return
  }
```

- [ ] **Step 4: Guard the web service-worker registration so it never runs on native**

At the top of the exported `registerServiceWorker` function in `push.ts`, add:
```ts
  if (isNativePlatform()) return null
```
This stops the Web Push service worker from registering inside the native WebView (native uses FCM). The `App.tsx` SW effect (`App.tsx:179`) already no-ops when `registerServiceWorker()` returns `null`.

- [ ] **Step 5: Typecheck + unit suite**

Run: `npx tsc -b && npm test`
Expected: exit 0, all pass (web push path unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/lib/push.ts
git commit -m "feat(push): native FCM registration branch writing to push_devices"
```

### Task 3.3: Notification tap → deep-link to event

**Files:**
- Modify: `src/lib/push.ts`

- [ ] **Step 1: Add a tap-handler registrar**

Add to `push.ts`:
```ts
export async function registerNativePushTapHandler(navigateToEvent: (eventId: string) => void): Promise<void> {
  if (!isNativePlatform()) return
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    const data = (event.notification?.data ?? {}) as Record<string, string>
    if (data.eventId) navigateToEvent(data.eventId)
  })
}
```

- [ ] **Step 2: Wire it in `App.tsx`**

In `App.tsx`, inside the existing startup effect (where push/session is handled), call once:
```ts
  useEffect(() => {
    registerNativePushTapHandler((eventId) => {
      window.history.pushState({}, '', `/?event=${eventId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
  }, [])
```
Import: `import { registerNativePushTapHandler } from './lib/push'`.

> The web app already reads `?event=` from the URL to open an EventSheet (see `EventSheet.tsx` share URL format `/?event=<id>`). Confirm the existing `?event=` handler runs on `popstate`; if it only runs on mount, also set the param before navigation as above.

- [ ] **Step 3: Typecheck + unit suite**

Run: `npx tsc -b && npm test`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/push.ts src/App.tsx
git commit -m "feat(push): open event when a native notification is tapped"
```

---

## Stage 4: Push sending (FCM fan-out in edge functions)

### Task 4.1: `fcm.ts` payload builder (TDD with Deno test)

**Files:**
- Create: `supabase/functions/_shared/fcm.ts`
- Test: `supabase/functions/_shared/fcm.test.ts`

- [ ] **Step 1: Write the failing Deno test**

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildFcmMessage } from './fcm.ts'

Deno.test('buildFcmMessage maps payload to FCM v1 shape', () => {
  const msg = buildFcmMessage('TOKEN123', {
    title: 'Festyn', body: 'Ala: cześć', type: 'message', eventId: 'e1',
  })
  assertEquals(msg.token, 'TOKEN123')
  assertEquals(msg.notification.title, 'Festyn')
  assertEquals(msg.notification.body, 'Ala: cześć')
  assertEquals(msg.data.eventId, 'e1')
  assertEquals(msg.data.type, 'message')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `deno test supabase/functions/_shared/fcm.test.ts --allow-net`
Expected: FAIL — module not found / `buildFcmMessage` undefined.

- [ ] **Step 3: Implement `fcm.ts`**

```ts
import { SignJWT, importPKCS8 } from 'npm:jose@5'

export interface FcmPayload {
  title: string
  body: string
  type: 'new_event' | 'event_start' | 'update' | 'message'
  eventId: string
}

export interface FcmMessage {
  token: string
  notification: { title: string; body: string }
  data: Record<string, string>
}

export function buildFcmMessage(token: string, p: FcmPayload): FcmMessage {
  return {
    token,
    notification: { title: p.title, body: p.body },
    data: { type: p.type, eventId: p.eventId },
  }
}

interface ServiceAccount { client_email: string; private_key: string; project_id: string }

let cachedToken: { value: string; exp: number } | null = null

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value

  const key = await importPKCS8(sa.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status}`)
  const json = await res.json()
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) }
  return cachedToken.value
}

/**
 * Send one FCM message per device token. Deletes dead tokens (404/410/UNREGISTERED)
 * from push_devices via the provided admin client. Returns number sent OK.
 */
export async function sendFcmToMany(
  tokens: string[],
  payload: FcmPayload,
  admin: { from: (t: string) => any },
): Promise<number> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!raw) { console.error('[fcm] FCM_SERVICE_ACCOUNT_JSON not set'); return 0 }
  const sa: ServiceAccount = JSON.parse(raw)
  const accessToken = await getAccessToken(sa)
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

  let sent = 0
  for (const token of tokens) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: buildFcmMessage(token, payload) }),
    })
    if (res.ok) { sent++; continue }
    if (res.status === 404 || res.status === 410) {
      await admin.from('push_devices').delete().eq('fcm_token', token)
    } else {
      console.error(`[fcm] send failed ${res.status}:`, (await res.text()).slice(0, 200))
    }
  }
  return sent
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/_shared/fcm.test.ts --allow-net`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/fcm.ts supabase/functions/_shared/fcm.test.ts
git commit -m "feat(push): FCM HTTP v1 sender + payload builder for edge functions"
```

### Task 4.2: Fan out in `push-new-message`

**Files:**
- Modify: `supabase/functions/push-new-message/index.ts`

- [ ] **Step 1: Import the FCM sender**

Add to the imports:
```ts
import { sendFcmToMany } from '../_shared/fcm.ts'
```

- [ ] **Step 2: Add FCM fan-out after the existing web-push send loop**

After the `for (const [lang, langSubs] of groups) { ... }` block, before the final `return`, add:
```ts
  // FCM fan-out to native devices (reuses enabledRecipients + langByUser)
  const { data: devices } = await admin
    .from('push_devices')
    .select('fcm_token, user_id')
    .in('user_id', enabledRecipients)

  if (devices && devices.length > 0) {
    const byLang = new Map<Lang, string[]>()
    for (const d of devices as { fcm_token: string; user_id: string }[]) {
      const lang = langByUser.get(d.user_id) ?? 'en'
      const arr = byLang.get(lang) ?? []
      arr.push(d.fcm_token)
      byLang.set(lang, arr)
    }
    for (const [lang, tokens] of byLang) {
      const authorName = (rawName ?? NOTIF_TEXT.message.body![lang]).slice(0, 50)
      await sendFcmToMany(tokens, { title: event.title, body: `${authorName}: ${preview}`, type: 'message', eventId: event.id }, admin)
    }
  }
```

- [ ] **Step 3: Lint-check the function compiles**

Run: `deno check supabase/functions/push-new-message/index.ts`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-new-message/index.ts
git commit -m "feat(push): FCM fan-out in push-new-message"
```

### Task 4.3: Fan out in `push-new-event`

**Files:**
- Modify: `supabase/functions/push-new-event/index.ts`

- [ ] **Step 1: Read the function to find its recipient/lang variables and payload**

Run: `sed -n '1,200p' supabase/functions/push-new-event/index.ts`
Identify the equivalents of `enabledRecipients`, `langByUser`, the per-lang title/body, and the event id used in the web-push send.

- [ ] **Step 2: Add the same import**

```ts
import { sendFcmToMany } from '../_shared/fcm.ts'
```

- [ ] **Step 3: Add FCM fan-out mirroring the web-push send**

After the web-push send loop, insert the same `push_devices` fetch + per-lang grouping as Task 4.2 Step 2, but use **this function's** title/body builder and `type: 'new_event'`. Concretely:
```ts
  const { data: devices } = await admin
    .from('push_devices')
    .select('fcm_token, user_id')
    .in('user_id', enabledRecipients)

  if (devices && devices.length > 0) {
    const byLang = new Map<Lang, string[]>()
    for (const d of devices as { fcm_token: string; user_id: string }[]) {
      const lang = langByUser.get(d.user_id) ?? 'en'
      const arr = byLang.get(lang) ?? []
      arr.push(d.fcm_token)
      byLang.set(lang, arr)
    }
    for (const [lang, tokens] of byLang) {
      await sendFcmToMany(
        tokens,
        { title: NOTIF_TEXT.new_event.title![lang], body: event.title, type: 'new_event', eventId: event.id },
        admin,
      )
    }
  }
```

> If this function's variable names differ from `enabledRecipients` / `langByUser` / `event`, adapt to the names found in Step 1. The title/body must match exactly what the web-push branch sends for parity.

- [ ] **Step 4: deno check + commit**

```bash
deno check supabase/functions/push-new-event/index.ts
git add supabase/functions/push-new-event/index.ts
git commit -m "feat(push): FCM fan-out in push-new-event"
```

### Task 4.4: Fan out in `push-event-start`

**Files:**
- Modify: `supabase/functions/push-event-start/index.ts`

- [ ] **Step 1: Read to find recipient/lang/payload variables**

Run: `sed -n '1,200p' supabase/functions/push-event-start/index.ts`

- [ ] **Step 2: Add import + fan-out**

Add `import { sendFcmToMany } from '../_shared/fcm.ts'` and after the web-push send loop add the same `push_devices` fetch + per-lang grouping, using this function's title/body and `type: 'event_start'`:
```ts
  const { data: devices } = await admin
    .from('push_devices').select('fcm_token, user_id').in('user_id', enabledRecipients)
  if (devices && devices.length > 0) {
    const byLang = new Map<Lang, string[]>()
    for (const d of devices as { fcm_token: string; user_id: string }[]) {
      const lang = langByUser.get(d.user_id) ?? 'en'
      const arr = byLang.get(lang) ?? []; arr.push(d.fcm_token); byLang.set(lang, arr)
    }
    for (const [lang, tokens] of byLang) {
      await sendFcmToMany(
        tokens,
        { title: NOTIF_TEXT.event_start.title![lang], body: event.title, type: 'event_start', eventId: event.id },
        admin,
      )
    }
  }
```

- [ ] **Step 3: deno check + commit**

```bash
deno check supabase/functions/push-event-start/index.ts
git add supabase/functions/push-event-start/index.ts
git commit -m "feat(push): FCM fan-out in push-event-start"
```

### Task 4.5: Fan out in `push-event-updated`

**Files:**
- Modify: `supabase/functions/push-event-updated/index.ts`

- [ ] **Step 1: Read to find recipient/lang/payload variables**

Run: `sed -n '1,200p' supabase/functions/push-event-updated/index.ts`

- [ ] **Step 2: Add import + fan-out**

Add `import { sendFcmToMany } from '../_shared/fcm.ts'` and after the web-push send loop add the same grouping, using this function's title/body and `type: 'update'`:
```ts
  const { data: devices } = await admin
    .from('push_devices').select('fcm_token, user_id').in('user_id', enabledRecipients)
  if (devices && devices.length > 0) {
    const byLang = new Map<Lang, string[]>()
    for (const d of devices as { fcm_token: string; user_id: string }[]) {
      const lang = langByUser.get(d.user_id) ?? 'en'
      const arr = byLang.get(lang) ?? []; arr.push(d.fcm_token); byLang.set(lang, arr)
    }
    for (const [lang, tokens] of byLang) {
      await sendFcmToMany(
        tokens,
        { title: NOTIF_TEXT.update.title![lang], body: event.title, type: 'update', eventId: event.id },
        admin,
      )
    }
  }
```

- [ ] **Step 3: deno check + commit**

```bash
deno check supabase/functions/push-event-updated/index.ts
git add supabase/functions/push-event-updated/index.ts
git commit -m "feat(push): FCM fan-out in push-event-updated"
```

### Task 4.6: Deploy functions + set FCM secret (manual)

- [ ] **Step 1: Create an FCM service account key**

Firebase console → Project settings → Service accounts → Generate new private key. Download the JSON.

- [ ] **Step 2: Set the secret**

Run:
```bash
npx supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat /path/to/service-account.json)"
```

- [ ] **Step 3: Deploy the 4 functions**

Run:
```bash
npx supabase functions deploy push-new-message push-new-event push-event-start push-event-updated
```
Expected: all deploy OK.

- [ ] **Step 4: End-to-end verify (you, on emulator)**

Logged in on the emulator with push enabled, have a second account post a message / create an event nearby. Expected: native notification arrives; tapping it opens the event.

> No commit — deploy + manual verification.

---

## Stage 5: Native geolocation

### Task 5.1: Native branch in `geo.ts`

**Files:**
- Modify: `src/lib/geo.ts:20`

- [ ] **Step 1: Add imports**

At the top of `geo.ts`:
```ts
import { isNativePlatform } from './platform'
import { Geolocation } from '@capacitor/geolocation'
```

- [ ] **Step 2: Add native path to `getCurrentPosition`**

At the very top of the `getCurrentPosition` function body, before the existing `new Promise(...)`:
```ts
  if (isNativePlatform()) {
    try {
      const perm = await Geolocation.requestPermissions()
      if (perm.location === 'denied') return null
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch { return null }
  }
```
> Make `getCurrentPosition` `async` if it is not already (it returns a `Promise` today; adding `async` is safe — the existing `return new Promise(...)` becomes the resolved value).

- [ ] **Step 3: Typecheck + unit suite**

Run: `npx tsc -b && npm test`
Expected: exit 0 (existing `geo.test.ts` covers pure helpers, unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/lib/geo.ts
git commit -m "feat(geo): native getCurrentPosition via Capacitor Geolocation"
```

### Task 5.2: Native watch branch in `App.tsx`

**Files:**
- Modify: `src/App.tsx:161-175`

- [ ] **Step 1: Add a native watch using the Capacitor plugin**

Replace the existing geolocation `useEffect` (currently `App.tsx:162-176`) with a branched version. The original persists each fix to `localStorage` and calls `setUserPos` + `refineLangByGeo()` — keep that behaviour on both paths:
```ts
  // Start geo only after user enters the map (avoids permission prompt on landing page)
  useEffect(() => {
    if (screen !== 'map') return
    refineLangByGeo()

    const onPos = (lat: number, lng: number) => {
      const pos = { lat, lng }
      try { localStorage.setItem('meuwe_last_pos', JSON.stringify(pos)) } catch {}
      setUserPos(pos)
    }

    if (isNativePlatform()) {
      let watchId: string | null = null
      Geolocation.watchPosition({ enableHighAccuracy: false, timeout: 8000 }, (p) => {
        if (p) onPos(p.coords.latitude, p.coords.longitude)
      }).then(id => { watchId = id })
      return () => { if (watchId) Geolocation.clearWatch({ id: watchId }) }
    }

    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      p => onPos(p.coords.latitude, p.coords.longitude),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [screen])
```
Imports: add `import { Geolocation } from '@capacitor/geolocation'` and ensure `isNativePlatform` is imported from `./lib/platform`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(geo): native watchPosition via Capacitor on map screen"
```

### Task 5.3: Android location permissions + sync

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add permissions**

Inside `<manifest>`, above `<application>`, ensure these exist:
```xml
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- [ ] **Step 2: Sync + verify on emulator (you)**

Run: `npm run build && npx cap sync android && npx cap open android`, Run ▶.
Expected: entering the map prompts for location; injecting a location in the emulator (Extended controls → Location) recenters the map.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): add location + notifications permissions"
```

---

## Stage 6: Android release configuration + Play Store

### Task 6.1: App icon + splash

**Files:**
- Modify: `android/app/src/main/res/**` (icons), splash assets

- [ ] **Step 1: Generate icons + splash**

Place a 1024×1024 `icon.png` and a splash image under a `resources/` folder at repo root, then run:
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```
Expected: adaptive icons + splash generated under `android/app/src/main/res/`.

- [ ] **Step 2: Sync + visual check on emulator (you)**

Run: `npx cap sync android` and relaunch.
Expected: launcher icon is the meuwe logo; splash shows on cold start with the `#FF7A45` background.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res resources package.json package-lock.json
git commit -m "feat(android): app icon and splash screen"
```

### Task 6.2: App label + version

**Files:**
- Modify: `android/app/src/main/res/values/strings.xml`
- Modify: `android/app/build.gradle`

- [ ] **Step 1: Set the visible app name**

In `strings.xml` ensure:
```xml
    <string name="app_name">meuwe</string>
    <string name="title_activity_main">meuwe</string>
```

- [ ] **Step 2: Set version**

In `android/app/build.gradle` `defaultConfig`:
```
        versionCode 1
        versionName "1.0.0"
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/values/strings.xml android/app/build.gradle
git commit -m "feat(android): app label and version 1.0.0"
```

### Task 6.3: Release signing

**Files:**
- Create: `android/keystore.properties` (gitignored)
- Modify: `android/app/build.gradle`

- [ ] **Step 1: Generate an upload keystore (you)**

Run:
```bash
keytool -genkey -v -keystore ~/meuwe-upload.keystore -alias meuwe -keyalg RSA -keysize 2048 -validity 10000
```
Store the passwords in a password manager. **Back up this keystore** — losing it blocks future updates.

- [ ] **Step 2: Create `android/keystore.properties` (gitignored)**

```
storeFile=/Users/wiktormarc/meuwe-upload.keystore
storePassword=...
keyAlias=meuwe
keyPassword=...
```
Confirm `android/keystore.properties` and `*.keystore` are in `.gitignore` (added in Task 0.2).

- [ ] **Step 3: Wire signing in `android/app/build.gradle`**

Above `android {`:
```
def keystoreProps = new Properties()
def keystorePropsFile = rootProject.file("keystore.properties")
if (keystorePropsFile.exists()) { keystoreProps.load(new FileInputStream(keystorePropsFile)) }
```
Inside `android { }` add:
```
    signingConfigs {
        release {
            if (keystorePropsFile.exists()) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
```

- [ ] **Step 4: Get release SHA + add to Firebase**

Run: `cd android && ./gradlew signingReport` and add the **release** SHA-1/SHA-256 to the Firebase Android app (so Google Sign-In works in the released build).

- [ ] **Step 5: Commit (build.gradle only — never the keystore/properties)**

```bash
git add android/app/build.gradle
git commit -m "feat(android): release signing config from keystore.properties"
```

### Task 6.4: Build the release AAB

- [ ] **Step 1: Build**

Run:
```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```
Expected: `android/app/build/outputs/bundle/release/app-release.aab` produced and signed.

- [ ] **Step 2: Smoke-install the release build (you)**

Build an APK for local install:
```bash
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```
Expected: app installs, Google Sign-In + push + geolocation all work in the signed release build.

> No commit — build artifacts are gitignored.

### Task 6.5: Play Console — internal testing + listing (manual)

- [ ] **Step 1: Create the app in Play Console**

Google Play Console → Create app: name "meuwe", language, app type, free.

- [ ] **Step 2: Complete required declarations**

Fill **App content**: Privacy policy URL (host `terms.html`/privacy page on the meuwe.eu site), Data safety (collected: location, account/email; used for app functionality), Ads (none), Target audience, Content rating questionnaire.

- [ ] **Step 3: Upload the AAB to Internal testing**

Testing → Internal testing → create release → upload `app-release.aab` → add tester emails → roll out.

- [ ] **Step 4: Install from the internal track (you)**

Open the opt-in link on a device, install from Play, verify the full flow (login, map, push, event create).

- [ ] **Step 5: Store listing assets**

Main store listing: short + full description (reuse landing copy, pl/en/es), feature graphic (1024×500), phone screenshots (min 2), app icon (512×512). Then promote to Production review when ready.

> No commit — Play Console configuration only.

---

## Self-Review Notes (coverage vs spec)

- Capacitor shell → Stage 0. Firebase setup → Stage 1.
- Native Google auth (idToken, no redirect) → Stage 2; `db.signInGoogle` branch + Welcome guard fix covered.
- Apple Sign-In → intentionally deferred to the iOS plan (spec §2; Android shows Google only).
- Native push (FCM, `push_devices`, fan-out, dead-token cleanup) → Stages 3–4; Web Push untouched.
- Native geolocation + permissions → Stage 5.
- Full Play publication (icon, splash, signing, AAB, data safety, listing) → Stage 6.
- Session storage adapter (`@capacitor/preferences`) from spec §2 is **not** included: keep Supabase default `localStorage` unless device testing in Stage 2 shows the session does not persist across app restarts. If it does not, add a task to plug a Preferences-backed storage adapter into `createClient({ auth: { storage } })`.
- iOS privacy manifest, APNs, TestFlight → iOS plan.
