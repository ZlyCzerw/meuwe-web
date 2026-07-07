# meuwe iOS (Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship meuwe as a native iOS app in the App Store by wrapping the existing web build in Capacitor, adding the mandatory Sign in with Apple, Google-on-iOS, and APNs push.

**Architecture:** Mirror the `Android_app` Capacitor setup. The web bundle (`dist`) runs unchanged inside a Capacitor iOS shell; native behavior sits behind `isIOS()`/`isNativePlatform()`. Auth follows the "Supabase owns the session" model already used for Google: iOS acquires a native `idToken` and hands it to `supabase.auth.signInWithIdToken`, while web/Android use `signInWithOAuth`. Because `Welcome.tsx` is reused by the web landing hero, one Apple button covers all platforms.

**Tech Stack:** Capacitor 6, `@capacitor/ios`, `@capacitor-firebase/authentication` (Apple + Google), `@capacitor-firebase/messaging` (FCM→APNs), Supabase Auth, Xcode + CocoaPods, Vitest.

**Working directory:** `/Users/wiktormarc/meuwe-web-ios` (git worktree on branch `iOS_app`). The main checkout `/Users/wiktormarc/meuwe-web` stays on `codex` — never `git checkout iOS_app` there.

**Legend:** 🔧 = manual/external step (user performs in a browser/GUI or installs tooling; no code). 💻 = code/CLI step the agent performs.

---

## File Structure

Code changes are small and additive — no restructuring.

- `src/lib/nativeAuth.ts` (modify) — add `signInAppleNative()` alongside `signInGoogleNative()`.
- `src/lib/nativeAuth.test.ts` (modify) — add Apple sign-in tests.
- `src/lib/supabase.ts` (modify) — add `db.signInApple()`; extend `trackClick` union with `'signin_apple'`.
- `src/screens/Welcome.tsx` (modify) — add the Apple button; extend `onSignIn` union with `'apple'`.
- `src/App.tsx` (modify) — extend `signIn` to route `'apple'` → `db.signInApple()`.
- `src/pages/Landing.tsx`, `src/components/landing/sections/HeroSection.tsx`, `src/components/landing/LandingNav.tsx` (modify) — widen the `onSignIn` prop type to include `'apple'`.
- `src/locales/{pl,en,es,de}.ts` (modify) — add `welcome.apple` string.
- `capacitor.config.ts` (modify) — add Apple provider to `FirebaseAuthentication.providers`; Android custom URL scheme note.
- `ios/` (created by `npx cap add ios`) — native project. Config edited: `ios/App/App/Info.plist`, `ios/App/App/GoogleService-Info.plist`, entitlements, `Podfile`.
- `resources/icon.svg`, `resources/splash.svg` (existing) — reused by `@capacitor/assets` for iOS.

---

## Stage 0 — Prerequisites (blocking, mostly manual)

### Task 0.1: Enroll in Apple Developer Program 🔧

**This is the first blocking step. Activation can take 24–48h. Stages 1–2 can proceed in parallel while it activates.**

- [ ] **Step 1: Enroll**

Go to https://developer.apple.com/programs/enroll/ , sign in with the Apple ID that will own the app, and complete enrollment ($99/yr). Individual or Organization is fine; Organization requires a D-U-N-S number.

- [ ] **Step 2: Verify membership is active**

At https://developer.apple.com/account the "Membership details" section shows an active Apple Developer Program with a **Team ID** (10-char). Record the Team ID — it is needed in Tasks 3.1, 3.2, 4.1.

Expected: Team ID visible; "Certificates, Identifiers & Profiles" is accessible.

### Task 0.2: Install full Xcode + accept license 💻/🔧

- [ ] **Step 1: Install Xcode**

Install **Xcode** (full app, not just Command Line Tools) from the Mac App Store, or from https://developer.apple.com/download/applications/ .

- [ ] **Step 2: Point the toolchain at Xcode and accept the license**

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -version
```

Expected: `xcodebuild -version` prints e.g. `Xcode 16.x` (not an error). Previously it printed nothing because only Command Line Tools were installed.

- [ ] **Step 3: Install an iOS Simulator runtime**

Open Xcode → Settings → Components (or Platforms) → install an iOS Simulator runtime (latest iOS). Verify:

```bash
xcrun simctl list runtimes | grep iOS
```

Expected: at least one `iOS 1x.x` runtime listed.

### Task 0.3: Install CocoaPods 💻

- [ ] **Step 1: Install**

```bash
sudo gem install cocoapods
pod --version
```

Expected: prints a version (e.g. `1.15.x`). (If Ruby issues arise, `brew install cocoapods` is an alternative.)

### Task 0.4: Add iOS app to Firebase 🔧

The Firebase project is `meuwe-e2d12` (same as Android). Add an **iOS** app so Google-on-iOS and FCM work.

- [ ] **Step 1: Register the iOS app**

Firebase Console → project `meuwe-e2d12` → Project settings → gear → General → "Your apps" → Add app → **iOS**. Apple bundle ID: `eu.meuwe`. App nickname: `meuwe iOS`. (App Store ID optional, add later.)

- [ ] **Step 2: Download GoogleService-Info.plist**

Download `GoogleService-Info.plist` from that iOS app's config. Keep it — it is placed into the Xcode project in Task 2.1.

Expected: file contains `BUNDLE_ID = eu.meuwe`, a `CLIENT_ID`, and a `REVERSED_CLIENT_ID` (starts with `com.googleusercontent.apps.`).

---

## Stage 1 — Add iOS platform

### Task 1.1: Install @capacitor/ios and scaffold the native project 💻

**Files:**
- Modify: `package.json` (adds `@capacitor/ios`)
- Create: `ios/` (generated)

- [ ] **Step 1: Install the iOS platform package (pinned to the Capacitor 6 line)**

```bash
cd /Users/wiktormarc/meuwe-web-ios
npm install @capacitor/ios@^6.2.1
```

Expected: `@capacitor/ios` appears in `package.json` dependencies at `^6.2.x` (matching `@capacitor/core`).

- [ ] **Step 2: Build the web bundle**

```bash
npm run build
```

Expected: `dist/` is produced with no errors.

- [ ] **Step 3: Add the iOS platform**

```bash
npx cap add ios
```

Expected: `ios/App/` created; output ends with `pod install` running successfully (CocoaPods resolves Capacitor pods). If `pod install` did not run, do it manually: `cd ios/App && pod install && cd -`.

- [ ] **Step 4: Sync web assets + plugins into iOS**

```bash
npx cap sync ios
```

Expected: "Sync finished"; plugins (`FirebaseAuthentication`, `FirebaseMessaging`, `Geolocation`, `Camera`, `SplashScreen`, `StatusBar`, `App`) listed as found for iOS.

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json package-lock.json ios .gitignore
git commit -m "feat(ios): add Capacitor iOS platform"
```

### Task 1.2: First build in the simulator (guest mode) 💻

- [ ] **Step 1: Boot a simulator and run the app**

```bash
npx cap run ios
```

Choose an iOS Simulator device when prompted (e.g. iPhone 15). Expected: Xcode builds, the simulator launches meuwe, the orange splash shows, then the Welcome screen renders.

- [ ] **Step 2: Verify guest entry works**

In the simulator tap **"Browse without signing in →"**. Expected: the map loads (guest mode), proving the web bundle runs inside the iOS shell. (Google/Apple login not wired for iOS yet — next stages.)

- [ ] **Step 3: No commit** (runtime verification only).

---

## Stage 2 — Google Sign-In on iOS

### Task 2.1: Wire GoogleService-Info.plist + reversed-client URL scheme 🔧/💻

**Files:**
- Create: `ios/App/App/GoogleService-Info.plist`
- Modify: `ios/App/App/Info.plist`

- [ ] **Step 1: Add GoogleService-Info.plist to the Xcode target**

```bash
npx cap open ios
```

In Xcode: drag the `GoogleService-Info.plist` from Task 0.4 into the `App` group; check **"Copy items if needed"** and target **App**. It must appear at `ios/App/App/GoogleService-Info.plist` and in "Build Phases → Copy Bundle Resources".

- [ ] **Step 2: Add the reversed-client URL scheme to Info.plist**

Read `REVERSED_CLIENT_ID` from `GoogleService-Info.plist`. In `ios/App/App/Info.plist`, add (or extend) a `CFBundleURLTypes` entry with that value as a URL scheme:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.XXXXXXXX-XXXXXXXX</string>
    </array>
  </dict>
</array>
```

Replace the string with the exact `REVERSED_CLIENT_ID`.

- [ ] **Step 3: Confirm the Firebase Auth plugin config includes google**

`capacitor.config.ts` already has `FirebaseAuthentication.providers: ['google.com']`. Leave as-is for now (Apple added in Task 3.5). Re-sync:

```bash
npx cap sync ios
```

- [ ] **Step 4: Commit**

```bash
git add ios/App/App/GoogleService-Info.plist ios/App/App/Info.plist
git commit -m "feat(ios): add GoogleService-Info + reversed-client URL scheme"
```

### Task 2.2: Verify Google login in the simulator 💻

The existing `db.signInGoogle()` already branches to `signInGoogleNative()` on native platforms — no code change needed for iOS.

- [ ] **Step 1: Run and sign in**

```bash
npx cap run ios
```

Tap **"Sign in with Google"**, complete the Google account picker.

- [ ] **Step 2: Verify session**

Expected: after auth, the app lands on the map with the profile avatar (Supabase session established via `signInWithIdToken`). If it fails with a `DEVELOPER_ERROR`/audience error, confirm the iOS OAuth client from `GoogleService-Info.plist` is present and (if needed) its client ID is added to Supabase Auth → Google → Authorized Client IDs.

- [ ] **Step 3: No commit** (runtime verification only).

---

## Stage 3 — Sign in with Apple (web + Android + iOS)

### Task 3.1: Configure Apple identifiers for Sign in with Apple 🔧

Requires an active Apple Developer membership (Task 0.1).

- [ ] **Step 1: Enable the capability on the App ID**

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → App ID `eu.meuwe` (create it if absent, type App). Enable **"Sign In with Apple"**. Save.

- [ ] **Step 2: Create a Services ID (web/redirect client)**

Identifiers → + → **Services IDs** → description `meuwe web auth`, identifier e.g. `eu.meuwe.web`. Enable "Sign In with Apple" → Configure: primary App ID `eu.meuwe`; **Domains** = your Supabase auth domain (`<project-ref>.supabase.co`); **Return URLs** = `https://<project-ref>.supabase.co/auth/v1/callback`. Save. Record the Services ID string.

- [ ] **Step 3: Create the Sign in with Apple key (.p8)**

Keys → + → name `meuwe SIWA key` → enable **Sign In with Apple** → Configure primary App ID `eu.meuwe` → Register → **Download the `.p8`** (one-time download). Record the **Key ID** and the **Team ID** (from Task 0.2).

Expected: you now hold Team ID, Key ID, the `.p8` contents, the Services ID, and bundle ID `eu.meuwe`.

### Task 3.2: Configure the Apple provider in Supabase 🔧

- [ ] **Step 1: Enable Apple provider**

Supabase Dashboard → Authentication → Providers → **Apple** → enable.

- [ ] **Step 2: Fill credentials**

- **Client IDs (authorized)** = `eu.meuwe` (native audience) **and** the Services ID from Task 3.1 (web audience), comma-separated.
- **Team ID**, **Key ID**, and the **`.p8` secret key** contents from Task 3.1.

Save.

- [ ] **Step 3: Confirm redirect URL**

Supabase shows the callback `https://<project-ref>.supabase.co/auth/v1/callback` — it must match the Return URL set in Task 3.1 Step 2.

Expected: Apple provider shows "Enabled".

### Task 3.3: Implement `signInAppleNative()` (TDD) 💻

**Files:**
- Modify: `src/lib/nativeAuth.ts`
- Test: `src/lib/nativeAuth.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/nativeAuth.test.ts` (the file already mocks `@capacitor-firebase/authentication` and `./supabase`; extend both mocks to expose Apple):

```ts
// --- add to the existing mock factories at the top of the file ---
// In the '@capacitor-firebase/authentication' mock, add:
//   signInWithApple: (...a: any[]) => signInWithApple(...a)
// and declare: const signInWithApple = vi.fn()
// The './supabase' mock already exposes signInWithIdToken — reuse it.

describe('signInAppleNative', () => {
  beforeEach(() => { signInWithApple.mockReset(); signInWithIdToken.mockReset() })

  it('passes the Apple idToken and nonce to supabase signInWithIdToken', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: 'ATOKEN', nonce: 'NONCE1' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInAppleNative()

    expect(signInWithApple).toHaveBeenCalledWith({ skipNativeAuth: true })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'ATOKEN', nonce: 'NONCE1' })
  })

  it('omits nonce when the provider does not return one', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: 'ATOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })
    await signInAppleNative()
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'ATOKEN' })
  })

  it('throws when no idToken is returned', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: null } })
    await expect(signInAppleNative()).rejects.toThrow(/idToken/)
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it('surfaces supabase errors', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: 'ATOKEN', nonce: 'N' } })
    signInWithIdToken.mockResolvedValue({ data: null, error: { message: 'bad apple token' } })
    await expect(signInAppleNative()).rejects.toThrow(/bad apple token/)
  })
})
```

Also update the import line to `import { signInGoogleNative, signInAppleNative } from './nativeAuth'` and add `const signInWithApple = vi.fn()` next to the existing `signInWithGoogle` mock, plus `signInWithApple: (...a: any[]) => signInWithApple(...a)` inside the `FirebaseAuthentication` mock object.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/nativeAuth.test.ts
```

Expected: FAIL — `signInAppleNative is not a function` / not exported.

- [ ] **Step 3: Implement `signInAppleNative`**

Add to `src/lib/nativeAuth.ts`:

```ts
export async function signInAppleNative(): Promise<void> {
  const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error('Apple sign-in returned no idToken')
  const nonce = result.credential?.nonce
  const { error } = await supabase.auth.signInWithIdToken(
    nonce ? { provider: 'apple', token: idToken, nonce } : { provider: 'apple', token: idToken }
  )
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/nativeAuth.test.ts
```

Expected: PASS (all Apple + existing Google tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nativeAuth.ts src/lib/nativeAuth.test.ts
git commit -m "feat(auth): native Apple sign-in via Firebase idToken → Supabase"
```

### Task 3.4: Add `db.signInApple()` with platform branch (TDD) 💻

**Files:**
- Modify: `src/lib/supabase.ts`
- Test: `src/lib/supabase.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/supabase.test.ts`:

```ts
import { isIOS } from './platform'
vi.mock('./platform', async (orig) => {
  const actual = await orig<typeof import('./platform')>()
  return { ...actual, isNativePlatform: () => (globalThis as any).__native ?? false,
                       isIOS: () => (globalThis as any).__ios ?? false }
})

describe('db.signInApple', () => {
  afterEach(() => { (globalThis as any).__native = false; (globalThis as any).__ios = false })

  it('web/Android uses signInWithOAuth apple redirect', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({ data: {}, error: null } as any)
    ;(globalThis as any).__ios = false
    await db.signInApple()
    expect(spy).toHaveBeenCalledWith({ provider: 'apple', options: { redirectTo: location.origin } })
  })
})
```

(Note: the native/iOS branch dynamically imports `./nativeAuth`, which is covered by Task 3.3's tests; this test pins the web/Android redirect path.)

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/supabase.test.ts -t signInApple
```

Expected: FAIL — `db.signInApple is not a function`.

- [ ] **Step 3: Implement `signInApple` and extend `trackClick`**

In `src/lib/supabase.ts`, add to the `db` object next to `signInGoogle` (import `isIOS` from `./platform` alongside `isNativePlatform`):

```ts
  signInApple() {
    if (isIOS()) {
      // iOS: native Apple sign-in; dynamic import keeps Firebase out of the web bundle
      return import('./nativeAuth').then(m => m.signInAppleNative())
    }
    // web + Android: Supabase OAuth redirect
    return supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: location.origin } })
  },
```

And change the `trackClick` signature from:

```ts
  trackClick(action: 'browse_guest' | 'signin_google') {
```

to:

```ts
  trackClick(action: 'browse_guest' | 'signin_google' | 'signin_apple') {
```

Update the import: `import { isNativePlatform, isIOS } from './platform'`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/supabase.test.ts -t signInApple
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat(auth): db.signInApple (native iOS + web/Android redirect)"
```

### Task 3.5: Add the Apple button + i18n + widen onSignIn type 💻

**Files:**
- Modify: `src/App.tsx`, `src/screens/Welcome.tsx`, `src/pages/Landing.tsx`, `src/components/landing/sections/HeroSection.tsx`, `src/components/landing/LandingNav.tsx`, `src/locales/{pl,en,es,de}.ts`, `capacitor.config.ts`

- [ ] **Step 1: Add the `welcome.apple` string to all four locales**

In each of `src/locales/pl.ts`, `en.ts`, `es.ts`, `de.ts`, inside the `welcome:` block, add an `apple` line next to `google`:

- `en.ts`: `apple: 'Sign in with Apple',`
- `pl.ts`: `apple: 'Zaloguj się przez Apple',`
- `es.ts`: `apple: 'Iniciar sesión con Apple',`
- `de.ts`: `apple: 'Mit Apple anmelden',`

- [ ] **Step 2: Widen the `onSignIn` union everywhere it is declared**

Change every `onSignIn: (mode: 'google' | 'skip') => void` and `(mode: 'google' | 'skip')` occurrence to include `'apple'`:
- `src/App.tsx:384` — `const signIn = (mode: 'google' | 'apple' | 'skip') => {`
- `src/screens/Welcome.tsx` — `onSignIn: (mode: 'google' | 'apple' | 'skip') => void`
- `src/pages/Landing.tsx:13` and `src/components/landing/sections/HeroSection.tsx:7` — same widening.
- `src/components/landing/LandingNav.tsx` — if it declares the same prop type, widen it too (grep to confirm).

- [ ] **Step 3: Route `'apple'` in App.tsx `signIn`**

In `src/App.tsx`, update the handler body (currently only handles `skip` then falls through to Google):

```ts
    const signIn = (mode: 'google' | 'apple' | 'skip') => {
      if (mode === 'skip') { goToMap(); return }
      if (deepLinkIdRef.current) sessionStorage.setItem('pending_event', deepLinkIdRef.current)
      if (mode === 'apple') { db.signInApple(); return }
      db.signInGoogle()
    }
```

- [ ] **Step 4: Add the Apple button to `Welcome.tsx`**

In `src/screens/Welcome.tsx`, immediately after the Google `<button>...</button>` (the one calling `onSignIn('google')`), add an equally-prominent Apple button (Apple HIG: at least as prominent as other providers — black pill, white Apple glyph, full width):

```tsx
        <button
          onClick={() => { db.trackClick('signin_apple'); onSignIn('apple') }}
          style={{
            marginTop: 12, width: '100%', padding: '16px 24px', borderRadius: 999,
            background: '#000', border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 16, fontWeight: 700, color: '#fff',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
          </svg>
          {t('welcome.apple')}
        </button>
```

- [ ] **Step 5: Add Apple to the Firebase plugin providers**

In `capacitor.config.ts`, change `providers: ['google.com']` to `providers: ['google.com', 'apple.com']`.

- [ ] **Step 6: Run the test suite + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all tests pass; no type errors (the widened union resolves everywhere).

- [ ] **Step 7: Verify the button renders on web (preview)**

Build and eyeball the Welcome/landing hero: the black Apple button appears under the Google button on web.

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/screens/Welcome.tsx src/pages/Landing.tsx src/components/landing capacitor.config.ts src/locales
git commit -m "feat(auth): Apple sign-in button + i18n across web/native"
```

### Task 3.6: Android deep-link return for the Apple OAuth redirect 💻

On Android, `db.signInApple()` uses the Supabase OAuth redirect (Custom Tab). The redirect back into the app needs an intent-filter so Android reopens meuwe with the session.

- [ ] **Step 1: Add an App URL open listener that completes the Supabase session**

Confirm `@capacitor/app` `appUrlOpen` handling exists (Google native didn't need it). Add, in the app bootstrap (where `App.addListener` is set up, e.g. `src/lib/deepLinks.ts` or `App.tsx` init), handling that lets Supabase parse the returned URL:

```ts
import { App as CapApp } from '@capacitor/app'
import { supabase } from './supabase'

CapApp.addListener('appUrlOpen', async ({ url }) => {
  if (url.includes('code=') || url.includes('access_token=')) {
    // Supabase parses the OAuth return (PKCE) and stores the session
    await supabase.auth.exchangeCodeForSession(url).catch(() => {})
  }
})
```

(If a deep-link listener already exists, fold this branch in rather than adding a second listener.)

- [ ] **Step 2: Register the redirect scheme in AndroidManifest**

In `android/app/src/main/AndroidManifest.xml`, inside the main `<activity>`, add an intent-filter for the app's custom scheme (`eu.meuwe://`) used as the OAuth `redirectTo` on Android:

```xml
<intent-filter android:autoVerify="false">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="eu.meuwe" />
</intent-filter>
```

And in Supabase Auth → URL Configuration → Redirect URLs, add `eu.meuwe://` (and set the Android branch of `db.signInApple` to use `redirectTo: 'eu.meuwe://'` when `isAndroid()` — refine the Task 3.4 implementation so Android passes the app scheme instead of `location.origin`).

- [ ] **Step 3: Verify on the Android emulator**

Build/install the Android app (see `2026-06-18-meuwe-capacitor-android.md` for commands), tap the Apple button, complete Apple auth in the Custom Tab, confirm it returns to meuwe with a session.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml src/lib/supabase.ts src/lib/deepLinks.ts
git commit -m "feat(auth): Android deep-link return for Apple OAuth redirect"
```

### Task 3.7: Enable the iOS "Sign in with Apple" capability + verify on device 🔧/💻

- [ ] **Step 1: Add the capability in Xcode**

`npx cap open ios` → target **App** → Signing & Capabilities → set your Team (Task 0.1) → **+ Capability → Sign In with Apple**. This writes `ios/App/App/App.entitlements` with `com.apple.developer.applesignin`.

- [ ] **Step 2: Sync + run on a physical device**

```bash
npx cap sync ios
```

In Xcode select a connected iPhone, Run. Tap **"Sign in with Apple"**, complete Face/Touch ID + the Apple sheet.

Expected: native Apple sheet appears (not a web view), and after auth the app lands on the map with a Supabase session. If it fails with an audience error, re-check that `eu.meuwe` is in Supabase Apple "authorized client IDs" (Task 3.2).

- [ ] **Step 3: Commit the entitlements**

```bash
git add ios/App/App/App.entitlements ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat(ios): enable Sign in with Apple capability"
```

---

## Stage 4 — Push notifications (APNs)

### Task 4.1: Create the APNs key and upload it to Firebase 🔧

- [ ] **Step 1: Create an APNs Auth Key**

developer.apple.com → Keys → + → name `meuwe APNs` → enable **Apple Push Notifications service (APNs)** → Register → download the `.p8`. Record the **Key ID** and **Team ID**.

- [ ] **Step 2: Upload to Firebase**

Firebase Console → project `meuwe-e2d12` → Project settings → Cloud Messaging → under the iOS app `eu.meuwe` → **APNs Authentication Key** → Upload → provide the `.p8`, Key ID, Team ID.

Expected: Firebase shows the APNs key configured for the iOS app. (FCM now bridges to APNs — no server code changes; `_shared/fcm.ts` already sends v1 messages.)

### Task 4.2: Enable Push + Background Modes capabilities in Xcode 💻/🔧

**Files:** `ios/App/App/App.entitlements`, Xcode project

- [ ] **Step 1: Add capabilities**

`npx cap open ios` → target App → Signing & Capabilities → **+ Capability → Push Notifications**; **+ Capability → Background Modes** → check **Remote notifications**.

- [ ] **Step 2: Sync**

```bash
npx cap sync ios
```

- [ ] **Step 3: Commit**

```bash
git add ios/App/App/App.entitlements ios/App/App/Info.plist ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat(ios): enable Push + Remote-notifications background mode"
```

### Task 4.3: Verify push end-to-end on a physical iPhone 💻

The push client (`registerNativePush` → `register_push_device` RPC with `platform`) already runs on native. iOS reports `platform='ios'`.

- [ ] **Step 1: Register the device token**

Run on a physical iPhone (push does not work in the simulator). Sign in, enable push in the profile panel. Expected (Xcode console): permission prompt → FCM token obtained → RPC call succeeds. Confirm a row in `push_devices` with `platform = 'ios'`.

- [ ] **Step 2: Send a test push**

Trigger one of the notification paths (e.g. a new event/message that hits `push-new-event`), with the app backgrounded. Expected: the notification appears in the iOS notification tray; tapping it opens the relevant event (deep-link tap handler).

- [ ] **Step 3: No commit** (runtime verification only).

---

## Stage 5 — Assets, permissions, polish

### Task 5.1: Generate iOS icons + splash 💻

`resources/icon.svg` and `resources/splash.svg` already exist (green blob smiley / orange splash).

- [ ] **Step 1: Generate**

```bash
npx capacitor-assets generate --ios
```

Expected: `ios/App/App/Assets.xcassets/AppIcon.appiconset` and `Splash.imageset` populated.

- [ ] **Step 2: Verify in the simulator**

```bash
npx cap run ios
```

Expected: home-screen icon is the meuwe smiley; launch shows the orange splash.

- [ ] **Step 3: Commit**

```bash
git add ios/App/App/Assets.xcassets
git commit -m "feat(ios): app icon + splash from shared brand assets"
```

### Task 5.2: Add Info.plist usage descriptions 💻

**Files:** `ios/App/App/Info.plist`

- [ ] **Step 1: Add permission strings**

Add these keys (localized copy; English shown — mirror into `InfoPlist.strings` per language if desired later):

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>meuwe shows events near you and centers the map on your location.</string>
<key>NSCameraUsageDescription</key>
<string>Take a photo to set your profile picture or add it to an event.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Choose a photo for your profile or an event.</string>
```

(Keep camera/photo strings only if `@capacitor/camera` is actually used in a native path; grep `Camera.getPhoto` to confirm — if unused on native, omit those two to avoid App Review questions.)

- [ ] **Step 2: Verify geolocation prompt**

Run in the simulator; guest → map should prompt for location once; the map centers on the simulated location.

- [ ] **Step 3: Commit**

```bash
git add ios/App/App/Info.plist
git commit -m "feat(ios): Info.plist usage descriptions (location, camera/photos)"
```

### Task 5.3: Status bar + safe-area check 💻

- [ ] **Step 1: Verify layout on a notched device**

Run in the simulator (iPhone 15). Check the top bar (search/avatar) and the tag-filter bar are not obscured by the notch/Dynamic Island, and the bottom UI clears the home indicator. The web already uses safe-area insets; `@capacitor/status-bar` is installed.

- [ ] **Step 2: If overlap exists, fix via safe-area env() in CSS**

Only if needed: add `env(safe-area-inset-top)/bottom` padding to the affected fixed containers (e.g. the MapScreen top bar). Show the exact diff in the fixing commit. If no overlap, skip.

- [ ] **Step 3: Commit (only if changes were made)**

```bash
git add src/screens/MapScreen.tsx src/index.css
git commit -m "fix(ios): respect safe-area insets on notched devices"
```

---

## Stage 6 — App Store Connect + submission 🔧

### Task 6.1: Create the app record + set version 🔧/💻

- [ ] **Step 1: Create the app in App Store Connect**

https://appstoreconnect.apple.com → Apps → + → New App → iOS → name `meuwe`, primary language, bundle ID `eu.meuwe`, SKU (e.g. `meuwe-ios`).

- [ ] **Step 2: Set marketing/build version**

In Xcode target App → General → Version `1.0.0`, Build `1` (keep in step with the Android versioning convention where reasonable — see `project_meuwe_versioning`).

### Task 6.2: Prepare screenshots + listing copy 🔧

- [ ] **Step 1: Capture screenshots**

Required iPhone sizes: **6.7"** (e.g. iPhone 15 Pro Max) and one 6.5"/6.1" as needed. Capture: map with events, event detail, create-event, profile. Use the simulator (`Cmd+S`).

- [ ] **Step 2: Reuse store copy**

Reuse the Play listing copy (short/full description in pl/en/es) already drafted for Android; adapt tone for App Store. Provide keywords, support URL, marketing URL, privacy policy URL.

### Task 6.3: Complete App Privacy + review info 🔧

- [ ] **Step 1: App Privacy (nutrition labels)**

Declare: **Location** (Precise, "App Functionality", not used for tracking); **Email/Name** and **User ID** (account, "App Functionality"); **Push token** (identifiers, app functionality). No tracking / no third-party ads.

- [ ] **Step 2: Review notes + demo account**

Provide a demo Google/Apple account or explain guest mode ("Browse without signing in"). Note that Sign in with Apple and Google are both offered (Guideline 4.8 compliance). Export compliance: uses standard HTTPS → eligible for the exemption.

### Task 6.4: Archive + upload to TestFlight 💻

- [ ] **Step 1: Archive a release build**

In Xcode: select "Any iOS Device (arm64)" → Product → Archive. When the Organizer opens, **Distribute App → App Store Connect → Upload**. (Automatic signing with your Team handles provisioning.)

- [ ] **Step 2: Verify the build in TestFlight**

App Store Connect → TestFlight → the build appears "Processing" then ready. Add yourself to Internal Testing; install via TestFlight on your iPhone; smoke-test login (both providers), map, push.

### Task 6.5: Submit for review 🔧

- [ ] **Step 1: Attach build + submit**

Select the TestFlight build for the `1.0.0` App Store version, confirm screenshots/description/privacy are complete, and **Submit for Review**.

- [ ] **Step 2: Track review**

Monitor status; if rejected, address the note (most likely candidates: Apple button prominence, privacy labels, demo account) and resubmit.

---

## Self-Review notes (coverage vs. spec)

- Spec §"Sign in with Apple mandatory / everywhere" → Tasks 3.1–3.7 (services, Supabase, code, UI on shared `Welcome`, Android deep-link, iOS capability). ✅
- Spec §"Google on iOS" → Tasks 2.1–2.2. ✅
- Spec §"Push APNs" → Tasks 4.1–4.3 (backend already done). ✅
- Spec §"Geolocation / permissions" → Task 5.2. ✅
- Spec §"Icons/splash" → Task 5.1 (reuses `resources/*.svg`). ✅
- Spec §"Distribution / App Privacy" → Stage 6. ✅
- Spec §"Prereqs + ordering (parallelize while Apple Dev activates)" → Stage 0 + notes; Stages 1–2 explicitly runnable before paid account, Stages 3–4 require it. ✅
- Type consistency: `onSignIn` union widened in every declaring file (Task 3.5 Step 2); `trackClick` union extended (Task 3.4 Step 3); `signInAppleNative`/`db.signInApple` names consistent across tasks. ✅
- Out of scope per spec (iPad layout, Hide-My-Email verification deep-dive) intentionally omitted. ✅
