# Edycja profilu użytkownika - projekt

**Status:** zatwierdzony w rozmowie 2026-09-02, czeka na plan wdrożenia.
**Branch:** `user_profile` (ze `staging`).

## Po co

Profil ma dziś jedno edytowalne pole (nazwa, schowana w modalu dwa poziomy od mapy) i jeden kolor avatara dla wszystkich. To zadanie buduje pełną edycję profilu, a razem z nią fundament pod cztery rzeczy, które właściciel produktu zaplanował na później:

1. **Obserwowanie twórców** - powiadomienia o wydarzeniach danej osoby. Profil musi mieć co pokazać na karcie twórcy.
2. **Lista twórców** - ranking punktów za organizowanie wydarzeń i przyciąganie na nie ludzi. Lista jest **dynamiczna, liczona dla aktualnego widoku mapy (bbox)**, dokładnie tak jak dziś `getEvents`. Nie ma pojęcia „regionu” w bazie: punkty przypina się do wydarzeń (mają lat/lng), geografia liczy się sama. Ten sam mechanizm posłuży później liście wydarzeń.
3. **Analiza zachowań** - gdzie, na czym i skąd powstało konto.
4. **Badania naukowe z uczelniami** - dane demograficzne studentów. Przełącznik zgody na badania **nie wchodzi teraz**; właściciel doda go, gdy badania ruszą. Schemat jest tak ułożony, żeby był to jeden `alter table` i jeden filtr w eksporcie.

Poza tym: zmiana koloru avatara i naprawa błędu - po zmianie nazwy avatar w menu pokazuje nową literę, a avatar na mapie starą.

Wszystkie nowe pola są **nieobowiązkowe**. Null znaczy „nie podano” i nigdzie nie jest traktowany jako brak.

## Stan obecny

- `profiles`: `display_name` (od dostawcy logowania), `nickname` (ręczny), `name_shown` (generowana: nickname → display_name), `avatar_color` (trigger wpisuje `#FF7A45` każdemu, UI zmiany nie ma), `radius_km`, `interests`, `interests_onboarded_at`, `language`, `push_enabled`, ukryte `last_lat/last_lng/last_seen_at`.
- Edycja: `AccountPanel` („Konto i dane”) → pozycja „Nazwa użytkownika” → `NicknameModal`.
- **Bug**: [MapScreen.tsx:600](../../../src/screens/MapScreen.tsx#L600) liczy inicjał z `profile?.display_name`, podczas gdy `ProfilePanel` i `App.tsx` używają `name_shown`. Reguła „którą nazwę pokazać” jest skopiowana w pięciu miejscach (`MapScreen`, `ProfilePanel`, `App.tsx` ×2, `EventSheet:377`) i w jednym skopiowana źle.
- Kolumny dodane do `profiles` są domyślnie **niewidoczne** dla `anon`/`authenticated` (grant kolumnowy z migracji 20260702). Każda nowa kolumna publiczna wymaga jawnego `grant select`.
- Trigger `handle_new_user` działa w bazie i nie zna platformy ani lokalizacji - kontekst rejestracji musi dopisać klient.
- Cloudflare `/api/geo` daje już kraj i zgrubne lat/lng z IP; aplikacja pobiera to przy starcie.

## Decyzje podjęte w rozmowie

| Pytanie | Decyzja |
|---|---|
| Czym jest „region” dla rankingu | Aktualnym widokiem mapy. Brak tabeli regionów. |
| „Gdzie utworzono konto” | Oba: zgrubna pozycja z IP od razu **i** GPS, jeśli/kiedy się pojawi. Plus platforma, wersja aplikacji, provider logowania, źródło wejścia. |
| Zgoda na badania naukowe | Nie teraz. Przełącznik dojdzie, gdy badania ruszą. |
| Lista pól | Grupy A/B/C poniżej. Odrzucone: ikona zamiast litery, linki społecznościowe ×3, „moje miejsce”, języki wydarzeń, weryfikacja, handle - do rozważenia osobno. |
| Wejście do edycji | Dwa: `AccountPanel` → „Moje dane” (zastępuje „Nazwa użytkownika”) oraz tap na avatar w menu. Oba prowadzą w to samo miejsce. Edycja nazwy mieszka w „Moich danych”. |
| Kolor avatara | Paleta 8 kolorów z tokenów aplikacji, nie dowolny picker. |

## Pola

### A. Publiczne - `profiles`, widzą inni

| Kolumna | Typ / ograniczenie | Po co |
|---|---|---|
| `nickname`, `avatar_color` | istnieją | avatar_color dostaje UI |
| `bio` | text, ≤ 160 znaków | jedno zdanie na karcie twórcy |
| `home_label` | text, ≤ 60 | „Puerto de la Cruz” - gdzie działam; wolny tekst, bez geokodowania |
| `creator_kind` | `person` / `organizer` / `venue` / `community` | osoba prywatna vs lokal vs stowarzyszenie - dla rankingu (nie mieszać knajpy z sąsiadem) i dla badań |
| `link_url` | text, ≤ 200 | jedna strona / Instagram |

### B. Prywatne - `profiles_private`, widzi tylko właściciel

| Kolumna | Typ / ograniczenie | Wartość badawcza |
|---|---|---|
| `birth_year` | smallint, 1900-2100 | wiek; celowo rok, nie data (minimalizacja danych) |
| `gender` | `female` / `male` / `other` | brak odpowiedzi = null |
| `residence_status` | `local` / `newcomer` / `visitor` | kluczowe dla aplikacji hiperlokalnej: mieszkaniec od lat, świeżo przybyły (student, ekspat), turysta - te grupy zachowują się najbardziej różnie |
| `occupation` | `student` / `working` / `other` | student to główna grupa badawcza |
| `university` | text, ≤ 80 | tylko przy `student`; UI pokazuje warunkowo |
| `field_of_study` | text, ≤ 80 | jw. |
| `found_via` | `friend` / `poster` / `social` / `store` / `university` / `other` | kanał pozyskania - marketing i badania |

### C. Automatyczne - `profiles_private`, zapisuje aplikacja, nieedytowalne

| Kolumna | Skąd |
|---|---|
| `signup_ip_lat`, `signup_ip_lng`, `signup_country` | `/api/geo` (Cloudflare, z IP) |
| `signup_gps_lat`, `signup_gps_lng` | pierwsza pozycja GPS w sesji rejestracji, jeśli użytkownik dał zgodę |
| `signup_platform` | `ios` / `android` / `web` z `platform.ts` |
| `signup_app_version` | `CapApp.getInfo().version` natywnie; web → null |
| `signup_provider` | `google` / `apple` z `session.user.app_metadata.provider` |
| `signup_source` | `event_link` (`?event=`), `digest` (`?src=digest`), `invite` (`?src=invite`), inaczej `direct` |
| `signup_recorded_at` | `now()` przy pierwszym zapisie |

Celowo pominięte: pełna data urodzenia, imię i nazwisko, telefon, zdjęcie profilowe (moderacja, storage, RODO - osobny temat), publiczny e-mail.

## Architektura

### 1. Dwie tabele, nie jedna

Dane publiczne idą do `profiles`. Dane prywatne (B) i automatyczne (C) idą do **nowej tabeli `profiles_private`** (1:1, `id` → `profiles.id on delete cascade`).

Powód: w `profiles` polityka SELECT to `USING (true)`, a uprawnienia kolumnowe działają per rola, nie per wiersz. Gdyby `authenticated` dostało `select` na `birth_year`, każdy zalogowany czytałby rok urodzenia każdego. Osobna tabela z RLS `auth.uid() = id` załatwia to jedną polityką. Bonus: przyszły `research_consent_at` i eksport dla uczelni to `select … from profiles_private where research_consent_at is not null` - czysta granica między „profil” a „dane badawcze”.

### 2. Migracja `supabase/migrations/20260902_profile_fields.sql`

Uruchamiana ręcznie w Supabase Dashboard → SQL Editor, **najpierw staging**. Idempotentna (`if not exists`, `do $$ … $$` dla constraintów), jak pozostałe.

```sql
-- profiles: kolumny publiczne
alter table public.profiles
  add column if not exists bio          text,
  add column if not exists home_label   text,
  add column if not exists creator_kind text,
  add column if not exists link_url     text;

-- constrainty (każdy w bloku do $$ if not exists … $$):
--   profiles_bio_len          check (bio is null or char_length(bio) <= 160)
--   profiles_home_label_len   check (home_label is null or char_length(home_label) <= 60)
--   profiles_creator_kind     check (creator_kind is null or creator_kind in ('person','organizer','venue','community'))
--   profiles_link_url_len     check (link_url is null or char_length(link_url) <= 200)

-- bez tego nowe kolumny są niewidoczne (reguła z 20260702_profiles_hide_location)
grant select (bio, home_label, creator_kind, link_url) on public.profiles to anon, authenticated;

-- profiles_private
create table if not exists public.profiles_private (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  birth_year         smallint check (birth_year is null or birth_year between 1900 and 2100),
  gender             text check (gender is null or gender in ('female','male','other')),
  residence_status   text check (residence_status is null or residence_status in ('local','newcomer','visitor')),
  occupation         text check (occupation is null or occupation in ('student','working','other')),
  university         text check (university is null or char_length(university) <= 80),
  field_of_study     text check (field_of_study is null or char_length(field_of_study) <= 80),
  found_via          text check (found_via is null or found_via in ('friend','poster','social','store','university','other')),
  signup_ip_lat      float8,
  signup_ip_lng      float8,
  signup_country     text,
  signup_gps_lat     float8,
  signup_gps_lng     float8,
  signup_platform    text check (signup_platform is null or signup_platform in ('ios','android','web')),
  signup_app_version text,
  signup_provider    text check (signup_provider is null or signup_provider in ('google','apple')),
  signup_source      text check (signup_source is null or signup_source in ('direct','event_link','digest','invite')),
  signup_recorded_at timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.profiles_private enable row level security;
-- select / insert / update wyłącznie właściciel; anon nic; delete tylko przez kaskadę
create policy "profiles_private_select" on public.profiles_private for select to authenticated using (auth.uid() = id);
create policy "profiles_private_insert" on public.profiles_private for insert to authenticated with check (auth.uid() = id);
create policy "profiles_private_update" on public.profiles_private for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
revoke all on public.profiles_private from anon;
grant select, insert, update on public.profiles_private to authenticated;
```

Wiersz w `profiles_private` powstaje **leniwie** - upsertem z klienta przy pierwszym zapisie (pól B albo kontekstu C). Trigger `handle_new_user` zostaje nietknięty: jest SECURITY DEFINER i raz już sprawił kłopoty na staging; nie ma powodu dokładać mu pracy.

Usuwanie konta: `archive_and_anonymize_user` kasuje `profiles`, kaskada zabiera `profiles_private`. Do funkcji dochodzi tylko komentarz, że tak jest - żeby nikt nie szukał brakującego `delete`.

### 3. RPC `record_signup_context` - „wypełnij tylko puste”

```sql
create or replace function public.record_signup_context(
  p_ip_lat float8, p_ip_lng float8, p_country text,
  p_gps_lat float8, p_gps_lng float8,
  p_platform text, p_app_version text, p_provider text, p_source text
) returns void
language plpgsql
security invoker            -- RLS właściciela wystarcza, to własny wiersz
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into profiles_private (id, signup_ip_lat, signup_ip_lng, signup_country,
                                signup_gps_lat, signup_gps_lng, signup_platform,
                                signup_app_version, signup_provider, signup_source,
                                signup_recorded_at)
  values (auth.uid(), p_ip_lat, p_ip_lng, p_country, p_gps_lat, p_gps_lng,
          p_platform, p_app_version, p_provider, p_source, now())
  on conflict (id) do update set
    signup_ip_lat      = coalesce(profiles_private.signup_ip_lat,      excluded.signup_ip_lat),
    signup_ip_lng      = coalesce(profiles_private.signup_ip_lng,      excluded.signup_ip_lng),
    signup_country     = coalesce(profiles_private.signup_country,     excluded.signup_country),
    signup_gps_lat     = coalesce(profiles_private.signup_gps_lat,     excluded.signup_gps_lat),
    signup_gps_lng     = coalesce(profiles_private.signup_gps_lng,     excluded.signup_gps_lng),
    signup_platform    = coalesce(profiles_private.signup_platform,    excluded.signup_platform),
    signup_app_version = coalesce(profiles_private.signup_app_version, excluded.signup_app_version),
    signup_provider    = coalesce(profiles_private.signup_provider,    excluded.signup_provider),
    signup_source      = coalesce(profiles_private.signup_source,      excluded.signup_source),
    signup_recorded_at = coalesce(profiles_private.signup_recorded_at, excluded.signup_recorded_at),
    updated_at         = now();
end $$;
revoke all on function public.record_signup_context(float8,float8,text,float8,float8,text,text,text,text) from public, anon;
grant execute on function public.record_signup_context(float8,float8,text,float8,float8,text,text,text,text) to authenticated;
```

Każda kolumna wypełnia się raz. Dzięki temu RPC wolno wywołać dwukrotnie:

1. **Zaraz po pierwszym zalogowaniu**: IP lat/lng, kraj, platforma, wersja, provider, źródło. GPS jako null, jeśli jeszcze nie ma.
2. **Gdy pojawi się `userPos`** w tej samej sesji (zgoda w kroku onboardingu): tylko `signup_gps_lat/lng`, reszta null - `coalesce` zostawia to, co już jest.

### 4. Kiedy „rejestracja”, a nie zwykłe logowanie

Czysta funkcja w `src/lib/signupContext.ts`, testowalna bez Reacta:

```ts
export const SIGNUP_WINDOW_MS = 24 * 60 * 60_000

export function shouldRecordSignup(ctx: {
  profileCreatedAt: string        // profiles.created_at
  alreadyRecorded: boolean        // profiles_private.signup_recorded_at != null
  now: number
}): boolean
// true, gdy konto młodsze niż SIGNUP_WINDOW_MS i nic jeszcze nie zapisano

export function signupSourceFromUrl(url: string): 'direct' | 'event_link' | 'digest' | 'invite'
```

Konta sprzed wdrożenia zostają z nullem - uczciwiej niż zapisać im „rejestrację” w dniu deployu. Test: konto sprzed 2 h → true; sprzed 3 dni → false; już zapisane → false.

Źródło wejścia trzeba odczytać z **URL startowego** (web: `window.location`; natywnie: pierwszy `appUrlOpen` albo brak) i zapamiętać w refie zanim aplikacja przepisze adres. Zaproszenie: `invite.ts` dokleja `?src=invite` do `WEB_ORIGIN` - dziś link jest gołym `https://meuwe.eu` i zaproszenia nie da się odróżnić od wejścia bezpośredniego.

W `App.tsx` jeden efekt po załadowaniu profilu: `getProfilePrivate` → `shouldRecordSignup` → `recordSignupContext(...)`. Drugi efekt zależny od `userPos`: jeśli w tej sesji zapisano kontekst bez GPS i pozycja właśnie się pojawiła, dopisz GPS. Flaga „zapisano w tej sesji” żyje w refie, nie w state.

Wersja aplikacji: `CapApp.getInfo().version` natywnie (zwraca `1.1.7`); na webie null - wersji webu nigdzie nie ma i nie warto jej wymyślać.

### 5. Warstwa danych klienta

**`src/lib/profileDisplay.ts`** (nowy, czyste funkcje) - jedno miejsce dla reguły „co pokazać”:

```ts
export function shownName(profile: Pick<Profile,'name_shown'|'display_name'> | null, email?: string | null, guestLabel?: string): string
export function initial(profile, email?): string       // pierwsza litera shownName, '?' gdy nic
export function avatarColor(profile): string           // profile.avatar_color ?? DEFAULT_AVATAR_COLOR
```

Pięć istniejących kopii (`MapScreen:600`, `ProfilePanel:138-147`, `App.tsx:1234`, `App.tsx:1244`, `EventSheet:377`) przechodzi na te funkcje. Bug #7 znika w ten sposób i nie ma jak wrócić. `authorLabel.ts` zostaje - to inna reguła (konto usunięte vs brak nazwy), dla cudzych profili.

**`src/lib/profileFields.ts`** (nowy): stałe i walidacja, wzorem `nickname.ts`:

```ts
export const AVATAR_COLORS = [C.primary, C.sky, C.grass, C.sunshine, C.berry, TAG_META.music.color, TAG_META.festival.color, TAG_META.art.color] as const
export const DEFAULT_AVATAR_COLOR = '#FF7A45'   // to, co wpisuje handle_new_user
export const BIO_MAX = 160, HOME_LABEL_MAX = 60, LINK_URL_MAX = 200, UNIVERSITY_MAX = 80, FIELD_MAX = 80
export const CREATOR_KINDS = ['person','organizer','venue','community'] as const
export const GENDERS = ['female','male','other'] as const
export const RESIDENCE_STATUSES = ['local','newcomer','visitor'] as const
export const OCCUPATIONS = ['student','working','other'] as const
export const FOUND_VIA = ['friend','poster','social','store','university','other'] as const
export const BIRTH_YEAR_MIN = 1900
export function maxBirthYear(now: Date): number   // now.getFullYear() - 16, próg wieku z regulaminu

export type ProfileFieldError = { field: string; reason: 'tooLong' | 'invalidUrl' | 'outOfRange' }
export function validateProfileForm(form: ProfileForm, now: Date): { ok: true; value: ProfileForm } | { ok: false; errors: ProfileFieldError[] }
// normalizuje: trim, wielokrotne spacje → jedna, pusty string → null,
// link bez schematu dostaje https://, wynik ma być zgodny z constraintami w bazie
```

Granice muszą się zgadzać z constraintami w migracji; baza zostaje ostatnią linią obrony.

**`types.ts`**: `Profile` dostaje `bio`, `home_label`, `creator_kind`, `link_url`. Nowy `ProfilePrivate` z polami B i C.

**`supabase.ts`**:
- `getProfile` - jawna lista kolumn rozszerzona o cztery nowe (nie `*`, jak dziś).
- `getProfilePrivate(uid): Promise<ProfilePrivate | null>` - `maybeSingle`, bo wiersza może nie być.
- `upsertProfilePrivate(p: Partial<ProfilePrivate> & { id })` - `upsert(..., { onConflict: 'id' }).select('id')`. Tu upsert jest właściwy: wiersz powstaje leniwie, inaczej niż w `profiles`.
- `recordSignupContext(ctx)` - `rpc('record_signup_context', …)`.
- `trackClick` dostaje `'profile_save'`.

### 6. UI - panel „Moje dane”

**`src/screens/MyDataPanel.tsx`** - wsuwany panel tej samej geometrii co `AccountPanel` (88% / max 380 px, `C.cream`, zaokrąglone prawe rogi 32, ten sam `cubic-bezier(0.32,1.4,0.4,1)`), warstwę wyżej (scrim z-index 34, panel 35), bo wchodzi się do niego także z `AccountPanel`. Otwieranie i zamykanie przez `history` jak pozostałe panele, więc gest wstecz na Androidzie działa i `onClose = () => window.history.back()`.

**Dwa wejścia, jedno miejsce:**
- `ProfilePanel`: avatar i nazwa u góry stają się jednym przyciskiem (`aria-label` = „Moje dane”) → `onOpenMyData`. Dla gościa przycisk jest nieaktywny, jak reszta panelu.
- `AccountPanel`: pozycja „Nazwa użytkownika” zmienia się w **„Moje dane”** (nowy klucz `account.myData`) z podpisem = aktualna nazwa → `onOpenMyData`. `NicknameModal.tsx` znika, jego klucze i18n dla walidacji nazwy zostają i są używane w nowym panelu.

**Układ, jeden scroll od góry:**
1. Przycisk „‹ Profil” jak w `AccountPanel`, tytuł „Moje dane” (`F.display`, 26, 900).
2. **Avatar 96 px** z inicjałem (ten sam styl co w `ProfilePanel`: obrys `3px INK`, cień `0 4px 0 INK33`, `breathe-sm`), pod nim rząd **8 kółek koloru** (36 px, obrys `2.5px INK`; wybrane ma grubszy obrys i cień jak avatar). Tap = natychmiastowy podgląd na avatarze; zapis dopiero przy „Zapisz”.
3. **Nazwa** - pole w stylu z `NicknameModal` (pigułka, obrys `2.5px INK`, czerwony `C.primaryPress` przy błędzie), podpis „Od 2 do 30 znaków”, ta sama walidacja `validateNickname`.
4. **Sekcja „O mnie”** z podpisem *„Inni to widzą”*: bio (textarea 3 linie, licznik `n/160` w `C.inkSoft`), „Gdzie działam”, „Kim jestem” jako 4 chipy w stylu przełącznika języka z `ProfilePanel` (pigułka, obrys `2px INK`, wybrany `C.primary` z białym tekstem), „Link”.
5. **Sekcja „O Tobie”** z podpisem *„Widzisz tylko Ty”* (ikona kłódki nie jest potrzebna - wystarczy tekst w `C.inkSoft`): rok urodzenia (input numeryczny, `inputMode="numeric"`), płeć (chipy), „Mieszkam tu” (chipy: od lat / od niedawna / przejazdem), zajęcie (chipy) - przy „student” rozwijają się pod spodem „Uczelnia” i „Kierunek” (animacja `fadeIn`), „Skąd wiesz o meuwe” (chipy).
6. **Sticky dół**: „Zapisz” (pełna szerokość, `C.primary`, obrys `2.5px INK`, cień `0 6px 16px rgba(232,90,42,0.28)` - identyczny z przyciskiem w `NicknameModal`) i pod nim tekstowy „Anuluj”. Pasek ma tło `C.cream` i `padding-bottom: env(safe-area-inset-bottom)`.

**Zapis:** jeden handler. Walidacja `validateNickname` + `validateProfileForm`; błędy pod polami. Następnie dwa żądania: `updateProfile` (nickname, avatar_color, bio, home_label, creator_kind, link_url) i `upsertProfilePrivate` (pola B). Zapis `profiles_private` idzie tylko wtedy, gdy któreś pole B ma wartość albo wiersz już istnieje - kto nic z „O Tobie” nie wypełnił, nie dostaje pustego wiersza. Błąd = komunikat pod przyciskiem, panel zostaje otwarty (zasada z `NicknameModal`: nie udawać sukcesu). Sukces = `db.trackClick('profile_save')`, toast „Zapisano” (klucz `account.profileSaved`), `reloadProfile`, `history.back()`.

**Zasady UX:**
- Żadne pole nie ma gwiazdki ani słowa „wymagane”. Puste pole = placeholder, nie ostrzeżenie. Panel ma czytać się jak wizytówka do uzupełnienia, nie formularz do wypełnienia.
- Chipy mają stan „nic nie wybrano” bez wartości domyślnej; tap na wybrany chip odznacza go (wraca null).
- Wstecz bez zapisu porzuca zmiany - bez dialogu, bo „Zapisz” jest zawsze na ekranie.
- Stan formularza inicjalizuje się z `profile` + `profilePrivate` przy otwarciu (`useEffect` na `open`), nie przy montowaniu - panel jest zamontowany na stałe jak `AccountPanel`.
- Dane grupy C nie pojawiają się w UI wcale.

**Styl - zasada nadrzędna:** każdy nowy element graficzny używa wyłącznie istniejącego języka meuwe - tokeny `C`/`F`/`INK` z `tokens.ts`, pigułki `borderRadius: 999`, obrysy `INK`, cienie „offsetowe” (`0 Npx 0 INK33`), animacje `bubble-up` / `fadeIn` / `breathe-sm` z `index.css`. Żadnych nowych kolorów, fontów, ikon ani bibliotek UI. Wzorcem są `AccountPanel`, `NicknameModal` i przełącznik języka w `ProfilePanel`.

### 7. Teksty i dokumenty

- i18n: wszystkie napisy w **pl/en/es/de/sl** (test `locales/parity.test.ts` to wymusza), włącznie z etykietami enumów (`myData.creatorKind_person` itd.) i komunikatami błędów (`myData.error_tooLong`, `myData.error_invalidUrl`, `myData.error_outOfRange`).
- `account.nickname` → `account.myData` = „Moje dane”. `account.body` rozszerzone o „…oraz dane, które dobrowolnie podasz w Moich danych”.
- `docs/legal/privacy-policy.md` (PL/EN/DE/ES): nowe wiersze w tabeli danych - „Opcjonalne pola profilu (bio, miejsce, rodzaj konta, link)” cel: wyświetlanie w aplikacji; „Opcjonalne dane o Tobie (rok urodzenia, płeć, status zamieszkania, zajęcie, uczelnia, kierunek, źródło)” cel: personalizacja i analiza korzystania z aplikacji, widoczne tylko dla Ciebie; „Kontekst rejestracji (przybliżona lokalizacja z IP, pozycja GPS jeśli wyrażono zgodę, platforma, wersja, dostawca logowania, źródło wejścia)” cel: analiza korzystania. Kolor avatara przestaje być „generowany losowo” - „wybierany przez użytkownika”.
- `docs/legal/compliance-requirements.md`: te same wiersze w tabeli sekcji 1, plus notatka: dane grupy B mogą posłużyć badaniom naukowym **dopiero po** dodaniu osobnej zgody (`research_consent_at`) - art. 6 ust. 1 lit. a z art. 89 RODO.

### 8. Kolejność wdrożenia

1. Migracja na **staging** (Dashboard → SQL Editor).
2. Klient na staging; sprawdzić: zapis, ponowne otwarcie panelu z danymi, gość, zmiana koloru widoczna na mapie i w menu, gest wstecz.
3. Migracja na PROD, potem klient.

Odwrotnie klient wywali się na brakujących kolumnach w `getProfile` (jawna lista kolumn → 42703 na nieistniejącej).

## Testy

Vitest, wzorem istniejących testów obok modułów:

- `profileDisplay.test.ts`: kolejność name_shown → display_name → e-mail → `?`; inicjał wielką literą; kolor domyślny.
- `profileFields.test.ts`: każda granica długości, `maxBirthYear`, normalizacja (trim, spacje, pusty → null, link bez schematu), niepoprawny URL, wartości spoza enumów odrzucone.
- `signupContext.test.ts`: `shouldRecordSignup` (2 h → true, 3 dni → false, już zapisane → false), `signupSourceFromUrl` dla czterech źródeł i dla adresu bez parametrów.
- `MyDataPanel.test.tsx` (testing-library, jak `ProfilePanel.push.test.tsx`): pola studenta pojawiają się tylko przy `student`; tap na kolor zmienia avatar przed zapisem; zapis woła `updateProfile` i `upsertProfilePrivate` z znormalizowanymi wartościami; błąd zapisu zostawia panel otwarty z komunikatem; pusta sekcja „O Tobie” nie tworzy wiersza.
- Test regresji buga #7: `MapScreen` z profilem `{ display_name: 'Kasia', name_shown: 'Ala' }` renderuje avatar z „A”.

Na koniec `npx tsc -b`, `npm test`, `npm run lint`.

## Poza zakresem (następne kroki, dla których ten profil jest fundamentem)

- Karta twórcy (tap na „Organizator: X” w `EventSheet`) i obserwowanie twórców.
- Lista twórców dla widoku mapy: punkty za wydarzenia i frekwencję (`event_attendance` już zbiera dotarcia), RPC po bboxie.
- Przełącznik zgody na badania (`research_consent_at` w `profiles_private`) i eksport dla uczelni.
- Statystyki dla organizatora, odznaki, publiczna strona `/u/handle`.
