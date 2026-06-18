# meuwe — natywne aplikacje iOS i Android (Capacitor)

**Data:** 2026-06-18
**Status:** zaakceptowany do napisania planu

## Cel

Opakować istniejący web SPA `meuwe-web` w Capacitor i wydać natywne aplikacje
na **Android** i **iOS**, gotowe do **pełnej publikacji** w Google Play i App Store.
Jedno repo, jeden kod webowy współdzielony z natywką; gałęzie natywne wyłącznie
tam, gdzie WebView nie wystarcza (logowanie, push, lokalizacja).

Kolejność prac: **najpierw Android, potem iOS** (Apple Sign-In i recenzja Apple
wchodzą dopiero w fazie iOS — rdzeń Androida na nie nie czeka).

## Kontekst i ograniczenia

- App ID (oba systemy): **`eu.meuwe`** (reverse-DNS domeny meuwe.eu). Stały — nie zmieniać po publikacji.
- Nazwa aplikacji: **meuwe**.
- Stack: React 19 + Vite 8 SPA, `BrowserRouter`, Supabase (auth PKCE + DB + storage + realtime),
  Leaflet, GA, i18n (pl/en/es), react-snap (tylko SEO web — nieistotny dla natywki).
- `npm run build` (`tsc -b && vite build`) produkuje czysty `dist/` bez prerenderingu — to `webDir` Capacitora.
- Supabase: projekt `bcfhsbnbvsuxsiwmeway`. 4 edge functions push (`push-new-event`,
  `push-new-message`, `push-event-start`, `push-event-updated`) wysyłają obecnie tylko
  Web Push przez `_shared/webpush.ts` (z i18n w `_shared/notif-i18n.ts`).
- `src/lib/platform.ts` już udostępnia `isNativePlatform()` — punkt rozgałęzienia.

### Dlaczego problem redirectu OAuth nie wraca

Wersja Expo padła, bo Google OAuth wymagał powrotu deep-linkiem do aplikacji.
W tym podejściu **nie ma żadnego redirectu OAuth na natywce**: używamy natywnego
logowania, które zwraca `idToken` w procesie, a token wymieniamy lokalnie na sesję
Supabase. Brak skoku do przeglądarki = brak problemu.

## Decyzje architektoniczne

### Jeden SDK Firebase dla auth i push

Skoro FCM (push natywny) i tak wymaga Firebase, używamy go też do logowania:

- **`@capacitor-firebase/authentication`** z flagą `skipNativeAuth: true` —
  robi natywne logowanie Google/Apple, **nie** loguje do Firebase, zwraca surowy
  `idToken` (+ `nonce` dla Apple). Token → `supabase.auth.signInWithIdToken({ provider, token, nonce })`.
- **`@capacitor-firebase/messaging`** — token FCM na obu platformach (na iOS FCM
  przekazuje do APNs), jedna ścieżka wysyłki.

Jeden vendor, jeden `google-services.json` / `GoogleService-Info.plist`, spójna konfiguracja.

### Co zostaje webowe (bez zmian)

Na webie (`isNativePlatform() === false`) wszystko działa jak dziś: `signInWithOAuth`
z `redirectTo: location.origin`, Web Push (VAPID + service worker + `push_subscriptions`),
`navigator.geolocation`. Natywka tylko dokłada gałęzie, nie zastępuje weba.

## Komponenty

### 1. Capacitor shell

- Zależności: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`.
- `capacitor.config.ts`: `appId: 'eu.meuwe'`, `appName: 'meuwe'`, `webDir: 'dist'`.
- Foldery `android/` i `ios/` **commitowane** do repo (nie do `.gitignore`).
- Pluginy bazowe: `@capacitor/app` (lifecycle, back button), `@capacitor/status-bar`,
  `@capacitor/splash-screen`, `@capacitor/geolocation`, `@capacitor/preferences`.
- Przepływ buildu: `npm run build` → `npx cap sync` → otwarcie w Android Studio / Xcode.
  Dev z live-reload opcjonalnie przez `server.url` w configu (nie commitować).

**Interfejs / zależności:** shell nie wnosi logiki domenowej; jego „kontrakt" to
istnienie `dist/` i poprawny `cap sync`. Reszta apki nie wie o jego istnieniu
poza `isNativePlatform()`.

### 2. Auth natywny — `src/lib/nativeAuth.ts`

**Ekran welcome/login już istnieje i jest gotowy do reużycia.** W `App.tsx`
(`screen === 'welcome'`) jest już rozgałęzienie: na natywce renderuje się
**tylko** `src/screens/Welcome.tsx` (logo + tagline + przycisk Google + „przeglądaj
jako gość"), a pełny landing (`pages/Landing.tsx` z sekcjami Hero/Features/itd.)
renderuje się **wyłącznie na webie**. Nie budujemy nowego ekranu — dozbrajamy istniejący.

- `signInGoogleNative(): Promise<void>` — `FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })`
  → `credential.idToken` → `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
- `signInAppleNative(): Promise<void>` — generuje `nonce`, `signInWithApple({ skipNativeAuth: true, nonce })`
  → `idToken` + `nonce` → `signInWithIdToken({ provider: 'apple', token, nonce })`. (Faza iOS.)
- **`db.signInGoogle()`** (w `supabase.ts`) rozgałęzia się po `isNativePlatform()` —
  na natywce woła `signInGoogleNative()`. Dzięki temu istniejący przycisk Google
  w `Welcome.tsx` (`onSignIn('google')`) działa bez zmian w komponencie.
- **Apple (faza iOS):** do `Welcome.tsx` dochodzi przycisk **Sign in with Apple**,
  widoczny tylko na iOS (np. `isNativePlatform() && isIOS()`). Wymaga rozszerzenia
  sygnatury `onSignIn` o tryb `'apple'` lub osobnego callbacku. Apple Sign-In jest
  wymagany przez App Store Guideline 4.8, bo oferujemy Google.
- **Fix guard in-app-browser:** `Welcome.tsx` ma `isInAppBrowser()`, który na iOS
  zwraca `true`, gdy UA nie zawiera „safari" — natywny WKWebView Capacitora może go
  błędnie odpalić i ukryć logowanie. Owinąć w `!isNativePlatform()`.
- **Link do regulaminu:** `Welcome.tsx` linkuje `/terms.html` z `target="_blank"`.
  Zweryfikować zachowanie w WebView; w razie potrzeby otwierać przez `@capacitor/browser`.
- **„Przeglądaj jako gość"** (`onSignIn('skip')`) zostaje na natywce bez zmian.
- Storage sesji: Supabase domyślnie `localStorage`; na natywce rozważyć adapter na
  `@capacitor/preferences` dla trwałości — **decyzja w planie** (jeśli `localStorage`
  WebView jest stabilny, zostaje domyślny, by nie ryzykować regresji weba).
- Wylogowanie: `supabase.auth.signOut()` bez zmian (token natywny nie tworzy sesji Firebase).

**Wymaga w Supabase:** włączony provider Apple + Google idToken (client IDs natywne
dodane do listy dozwolonych audiences providera Google w Supabase).

### 3. Push natywny — gałąź w `src/lib/push.ts`

- Nowa gałąź `isNativePlatform()`:
  - `requestPermissions()` + `register()` przez `@capacitor-firebase/messaging`.
  - Pobranie tokena FCM (`getToken`), nasłuch `tokenReceived` (rotacja tokenów).
  - Zapis tokena do **nowej tabeli `push_devices`**: `(user_id, fcm_token unique, platform, updated_at)`.
  - Obsługa `notificationReceived` / `notificationActionPerformed` (deep-link do eventu po `event` param).
- `getPushStatus()` / `subscribePush()` / `unsubscribePush()` dostają gałąź natywną
  z tym samym kontraktem `PushStatus`, więc `ProfilePanel.tsx` nie wymaga zmian logiki.
- Web Push (VAPID, `push_subscriptions`, `sw.js`) zostaje nietknięty dla weba/PWA.

**Migracja DB:** nowa tabela `push_devices` z RLS (user widzi/edytuje tylko swoje tokeny).

### 4. Wysyłka push — `supabase/functions/_shared/fcm.ts` + fan-out

- Nowy helper `fcm.ts`: wysyłka FCM HTTP v1 (OAuth2 z service account przez env secret,
  np. `FCM_SERVICE_ACCOUNT_JSON`), payload z tytułem/treścią + data (`event` id) dla deep-linku.
- Każda z 4 edge functions: po zbudowaniu treści (już zlokalizowanej w `notif-i18n.ts`)
  robi **fan-out** — Web Push do odbiorców z `push_subscriptions` **oraz** FCM do
  odbiorców z `push_devices`. i18n współdzielone, bez duplikacji logiki adresatów.
- Wspólny selektor adresatów (followers/owner, z poszanowaniem `notification_mutes`
  i `push_enabled`) wyciągnięty tak, by obie ścieżki używały tej samej listy userów.

### 5. Geolokalizacja — gałąź w `src/lib/geo.ts`

- `getCurrentPosition()` i watch (`App.tsx`) na natywce przez `@capacitor/geolocation`
  (czystsze prompty uprawnień, pewniejsze niż `navigator.geolocation` w WebView).
- Web zostaje na `navigator.geolocation`.
- Uprawnienia natywne: Android `ACCESS_COARSE/FINE_LOCATION`; iOS `NSLocationWhenInUseUsageDescription`.

### 6. Konfiguracja platform (pełna publikacja)

**Android (faza 1):**
- `applicationId = eu.meuwe`, ikona adaptacyjna, splash, `google-services.json`.
- Uprawnienia: lokalizacja, `POST_NOTIFICATIONS` (Android 13+), internet.
- Podpisywanie release (keystore), `versionCode`/`versionName`.
- Internal testing → produkcja: listing, polityka prywatności, Data Safety form, screeny.

**iOS (faza 2):**
- Bundle ID `eu.meuwe`, capability **Sign in with Apple** + **Push Notifications**,
  klucz APNs wgrany do Firebase.
- `GoogleService-Info.plist`, `NSLocationWhenInUseUsageDescription`, ikony, splash.
- `PrivacyInfo.xcprivacy` (privacy manifest), App Privacy w App Store Connect.
- TestFlight → recenzja → produkcja: listing, screeny, polityka prywatności.

## Przepływ danych (logowanie natywne)

```
[UI Login] --isNativePlatform--> nativeAuth.signInGoogleNative()
   -> FirebaseAuthentication (skipNativeAuth) -> idToken
   -> supabase.auth.signInWithIdToken({provider, token[, nonce]})
   -> sesja Supabase -> onAuthChange -> reszta apki bez zmian
```

## Przepływ danych (push natywny)

```
[App start, zalogowany] -> push.ts (native) -> Firebase Messaging register
   -> token FCM -> push_devices (upsert)
Event/wiadomość -> trigger -> edge function -> lista adresatów
   -> fan-out: webpush.ts (push_subscriptions) + fcm.ts (push_devices)
   -> APNs/FCM -> urządzenie -> tap -> deep-link do eventu (?event=id)
```

## Obsługa błędów

- Logowanie: anulowanie przez usera (brak `idToken`) → cicho, bez toasta błędu;
  błąd `signInWithIdToken` → toast i log; brak sieci → komunikat.
- Push: brak zgody → status `denied`, UI to odzwierciedla (jak dziś na webie);
  błąd zapisu tokena → log, nie blokuje apki.
- FCM wysyłka: token nieważny (404/410 z FCM) → usunięcie z `push_devices` (czyszczenie martwych tokenów), analogicznie do Web Push.
- Geolokalizacja: brak zgody → fallback jak dziś (apka działa bez pozycji).

## Testowanie

- **Jednostkowe (vitest):** logika `nativeAuth` (mapowanie credential→idToken→provider),
  selektor adresatów push, `fcm.ts` budowanie payloadu — z mockami pluginów.
  Gałęzie `isNativePlatform()` testowane przez mock `platform.ts`.
- **Edge functions:** test fan-out na fake'owanych listach `push_subscriptions` + `push_devices`.
- **Manualne na urządzeniu/emulatorze (per platforma):** login Google (Android),
  login Apple+Google (iOS), otrzymanie pusha i deep-link, prompt lokalizacji,
  splash/ikona/status bar, back button (Android).
- **Regresja web:** istniejące testy + szybki smoke weba (login + push) — natywne
  gałęzie nie mogą ruszyć ścieżki webowej. W szczególności web nadal pokazuje pełny
  `Landing.tsx`, a nie `Welcome.tsx` (rozgałęzienie `isNativePlatform()` w `App.tsx`).

## Poza zakresem (YAGNI)

- Natywne mapy (zostaje Leaflet w WebView).
- Płatności in-app, biometria, offline-first/sync.
- Android <8 / iOS <15 (trzymamy się domyślnych minimów Capacitora).
- Migracja istniejących web-subskrypcji na FCM (web zostaje na Web Push).

## Ryzyka

- **Recenzja Apple** (4.8 Apple Sign-In, App Privacy, uzasadnienie lokalizacji) — adresowane w fazie iOS.
- **Wersje pluginów Firebase a React 19 / Vite 8** — zweryfikować kompatybilność na starcie.
- **Sesja w WebView** (trwałość `localStorage`) — fallback na `@capacitor/preferences`.
- **FCM service account secret** w edge functions — bezpieczne trzymanie w Supabase secrets.
