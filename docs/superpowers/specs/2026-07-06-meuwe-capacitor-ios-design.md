# meuwe iOS (Capacitor) — Design

**Date:** 2026-07-06
**Branch:** `iOS_app` (odgałęziony od `Android_app`)
**Status:** zatwierdzony, gotowy do rozpisania planu

## Cel

Wypuścić natywną aplikację **iOS** dla meuwe w App Store, opakowując istniejący web (React 19 + Vite, `dist`) w Capacitor 6 — lustrzane odbicie tego, co zrobiliśmy dla Androida na branchu `Android_app`. Nie przepisujemy logiki aplikacji; dokładamy warstwę natywną iOS i jeden brakujący sposób logowania (Sign in with Apple).

App ID / bundle: `eu.meuwe`.

## Kontekst i stan wyjściowy

- Web jest już gotowy i cross-platform; natywne zachowania są za `isNativePlatform()` / `isIOS()` w `src/lib/platform.ts`.
- Auth w aplikacji to **wyłącznie Google + tryb gościa** (brak email/hasło) — patrz `src/screens/Welcome.tsx`, `src/lib/supabase.ts`, `src/lib/nativeAuth.ts`.
- Backend push jest gotowy na iOS: tabela `push_devices` akceptuje `platform='ios'`, RPC `register_push_device` obsługuje przypisanie tokenu, a edge functions robią fan-out FCM (`_shared/fcm.ts`).
- `@capacitor-firebase/messaging` (FCM→APNs), `@capacitor/geolocation`, `@capacitor/camera` i `@capacitor/assets` są już w `package.json` i działają cross-platform.
- Brakuje: `@capacitor/ios`, folderu `ios/`, pełnego Xcode.app (jest tylko Command Line Tools), CocoaPods, iOS app w Firebase, konta Apple Developer Program.

## Kluczowa decyzja: Sign in with Apple jest wymagany

App Store Review Guideline **4.8** wymaga oferowania „Sign in with Apple", gdy aplikacja używa zewnętrznej usługi logowania społecznościowego (Google) do zakładania/uwierzytelniania konta. Żaden wyjątek (własny system kont firmy, konto enterprise/edu, rządowe ID, klient konkretnej usługi) nas nie dotyczy, a sam tryb gościa nie zwalnia. **Bez Apple Sign-In build zostanie odrzucony w review.**

### Zakres przycisku Apple: wszędzie (web + Android + iOS)

Decyzja produktowa: przycisk „Sign in with Apple" pojawia się na **wszystkich** platformach (nie tylko iOS). To wymaga skonfigurowania Apple providera również dla flow webowego/redirect i powrotu deep-linkiem na Androidzie.

## Architektura logowania (model „sesją zarządza Supabase")

Spójny z obecnym Google: natywnie zdobywamy `idToken`, sesję trzyma Supabase; web używa redirectu Supabase OAuth.

- **iOS (native):** `@capacitor-firebase/authentication` → `signInWithApple({ skipNativeAuth: true })` → `credential.idToken` + `nonce` → `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })`.
- **Web:** `supabase.auth.signInWithOAuth({ provider: 'apple' })` (redirect).
- **Android:** `supabase.auth.signInWithOAuth({ provider: 'apple' })` przez Chrome Custom Tab + powrót deep-linkiem (dodatkowy `intent-filter` / URL scheme).

### Konfiguracja usług

- **Apple Developer:** App ID `eu.meuwe` z capability „Sign in with Apple"; **Services ID** (identyfikator dla web/redirect); **Sign in with Apple Key (.p8)** → Key ID + Team ID.
- **Supabase Auth → Apple provider:** Services ID, Team ID, Key ID, treść klucza .p8; **authorized client IDs** = `eu.meuwe` (native) **oraz** Services ID (web); redirect URL Supabase.

### Zmiany w kodzie (minimalne, wzorowane na Google)

- `src/lib/nativeAuth.ts`: dodać `signInAppleNative()` (analogicznie do `signInGoogleNative()`, z obsługą `nonce`).
- `src/lib/supabase.ts`: dodać `db.signInApple()` z gałęziami: iOS → native; web/Android → `signInWithOAuth({ provider: 'apple' })`.
- `src/screens/Welcome.tsx`: przycisk Apple na wszystkich platformach; zgodnie z Apple HIG min. tak samo widoczny jak Google; i18n `pl`/`en`/`es`.

## Google na iOS

`reversed client ID` jako URL scheme w `Info.plist` + `GoogleService-Info.plist` z Firebase (iOS app `eu.meuwe`). Logowanie działa przez ten sam plugin `@capacitor-firebase/authentication`, bez zmian w logice aplikacji.

## Push (APNs)

- **APNs Auth Key (.p8)** utworzony w Apple Developer i wgrany do Firebase (Cloud Messaging) — FCM tłumaczy na APNs.
- Capabilities w Xcode: **Push Notifications** + **Background Modes → Remote notifications**.
- Rejestracja tokenu (`register_push_device` z `platform='ios'`) i edge functions są już gotowe — pozostaje test end-to-end na **fizycznym** iPhonie (symulator nie dostaje push).

## Geolokalizacja i inne uprawnienia

Bez zmian w kodzie; dodać opisy w `Info.plist`:
- `NSLocationWhenInUseUsageDescription` (geolokalizacja mapy),
- `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` (`@capacitor/camera`, jeśli używany dla avatara/zdjęć).

## Ikony, splash, assets

Reużywamy `resources/icon.svg` i `resources/splash.svg` — `@capacitor/assets` generuje zestaw iOS (AppIcon + LaunchScreen). Utrzymujemy istniejący branding (zielona buźka z nieregularną komiksową obwódką na kremowym tle, splash pomarańczowy `#FF7A45`).

## Dystrybucja

- **App Store Connect:** utworzenie aplikacji, TestFlight (internal), screenshoty iPhone w wymaganych rozmiarach.
- **App Privacy (nutrition labels):** lokalizacja (funkcjonalność aplikacji), email/konto (funkcjonalność), identyfikatory push.
- Age rating, export compliance (standardowy wyjątek dla HTTPS), notatki do review (konto testowe + informacja o trybie gościa i o tym, że Apple/Google Sign-In są równorzędne).

## Zależności między etapami (co blokuje co)

- **Konta Apple Developer jeszcze nie ma** → to pierwszy krok blokujący (aktywacja bywa 24–48h). Blokuje: App ID, Services ID, klucze .p8 (Apple Sign-In + APNs), profile provisioning, App Store Connect.
- **Można zacząć bez płatnego konta:** dodanie platformy iOS, build w symulatorze (tryb gościa), a nawet logowanie **Google** w symulatorze (wymaga tylko `GoogleService-Info.plist`).
- **Wymaga płatnego konta:** native Sign in with Apple (capability), push APNs, testy na fizycznym urządzeniu >7 dni, publikacja.

Dlatego prace są rozdzielone na etapy tak, by nie czekać bezczynnie na aktywację konta.

## Etapy (do rozpisania w planie)

0. **Prereqs:** Apple Developer enrollment; pełny Xcode.app + `xcodebuild -license accept`; CocoaPods; iOS app w Firebase (`GoogleService-Info.plist`).
1. **Platforma iOS:** `@capacitor/ios` + `npx cap add ios` + `pod install`; build web; pierwszy build w symulatorze w trybie gościa.
2. **Google na iOS:** `Info.plist` (reversed client ID), `GoogleService-Info.plist`; test logowania.
3. **Sign in with Apple:** konfiguracja Apple Developer + Supabase provider; kod (`nativeAuth`, `supabase`, `Welcome` + i18n); Android deep-link powrotu; test na web/Android/iOS.
4. **Push APNs:** APNs key → Firebase; capabilities; test end-to-end na fizycznym iPhonie.
5. **Assets i polish:** ikony/splash iOS przez `@capacitor/assets`; opisy `Info.plist`; status bar / safe-area / drobne poprawki natywne.
6. **App Store Connect:** aplikacja, TestFlight, screenshoty, App Privacy, age rating, submit do review.

## Poza zakresem

- Dedykowany layout na iPad (start = iPhone-only).
- Weryfikacja obsługi Apple „Hide My Email" (relay) — Supabase to obsługuje; potwierdzimy jedynie, że profil dostaje email.
- Plan iOS nie obejmuje zmian w logice web ani w scraperach/event-sync (osobne prace na `codex`).

## Ryzyka

- **Odrzucenie w review** przy braku Apple Sign-In lub gdy jest mniej widoczny niż Google (HIG) — mitygacja: Apple button równorzędny, wdrożony w Etapie 3 przed submitem.
- **Aktywacja konta Apple** może opóźnić etapy 3–6 — mitygacja: równoległe prowadzenie etapów 1–2.
- **Rozbieżność audience `idToken`** (native bundle `eu.meuwe` vs web Services ID) — mitygacja: oba wpisane jako authorized client IDs w Supabase.
- **Android deep-link** dla Apple redirect to nowy element (Google tego nie potrzebował, bo idzie natywnie) — testowany osobno w Etapie 3.
