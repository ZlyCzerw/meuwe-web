# Edycja profilu użytkownika - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel „Moje dane” z edycją nazwy, koloru avatara i opcjonalnych pól profilu (publicznych i prywatnych), automatyczny zapis kontekstu rejestracji, naprawa inicjału avatara na mapie.

**Architecture:** Dane publiczne dochodzą do `profiles`, prywatne i automatyczne do nowej tabeli `profiles_private` (RLS: tylko właściciel). Reguły (co pokazać, walidacja, „czy to rejestracja”, parsowanie Photon) żyją w czystych modułach w `src/lib/`, testowanych bez Reacta. Nowy panel `MyDataPanel` wsuwa się nad `ProfilePanel`/`AccountPanel` tą samą geometrią i tym samym mechanizmem `history`.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + RLS + RPC), Photon (komoot) do wyszukiwania miejscowości, vitest + testing-library, i18next (pl/en/es/de/sl), Capacitor 6.

**Spec:** `docs/superpowers/specs/2026-09-02-user-profile-design.md`

## Global Constraints

- Wszystkie nowe pola są nieobowiązkowe; `null` = nie podano.
- Każdy tekst UI przez `t('…')` i we **wszystkich pięciu** językach: `pl`, `en`, `es`, `de`, `sl`.
- Nowe elementy graficzne wyłącznie z istniejącego języka meuwe: tokeny `C`/`F`/`INK` z `src/lib/tokens.ts`, pigułki `borderRadius: 999`, obrysy `INK`, cienie `0 Npx 0 ${INK}33`, animacje `bubble-up`/`fadeIn`/`breathe-sm` z `src/index.css`. Zero nowych kolorów, fontów, ikon, bibliotek.
- Granice w kliencie (`profileFields.ts`) muszą być identyczne z constraintami w migracji: bio ≤ 160, home_name ≤ 80, link_url ≤ 200, university ≤ 80, field_of_study ≤ 80, birth_year 1900-2100 w bazie (w kliencie górna granica = rok bieżący − 16).
- Zapisy do `profiles` idą przez `db.updateProfile` (UPDATE + `.select('id')`, nigdy upsert). Zapisy do `profiles_private` idą przez upsert - to jedyna tabela, w której wiersz powstaje leniwie.
- Build sprawdzać przez `npx tsc -b` (nie `--noEmit`).
- Commity bez `Co-Authored-By`; komunikaty po polsku, w stylu repozytorium (krótkie, opisowe, bez prefiksów `feat:`).
- Migracja jest uruchamiana **ręcznie** w Supabase Dashboard → SQL Editor, najpierw staging. Nikt w tym planie nie uruchamia jej z kodu.
- Kolejność wdrożenia: migracja przed klientem (jawna lista kolumn w `getProfile` wywala się na brakującej kolumnie).

---

## Mapa plików

| Plik | Odpowiedzialność |
|---|---|
| `supabase/migrations/20260902_profile_fields.sql` | nowe kolumny w `profiles`, tabela `profiles_private`, RLS, RPC `record_signup_context` |
| `src/lib/profileFields.ts` (+ test) | stałe (paleta, limity, enumy), typ `ProfileForm`, `validateProfileForm`, `homeNameFromPlace` |
| `src/lib/profileDisplay.ts` (+ test) | jedna reguła „co pokazać”: `shownName`, `initial`, `avatarColor` |
| `src/lib/placeSearch.ts` (+ test) | zapytanie do Photon + `parsePhoton`, wyjęte z `SearchBar` |
| `src/components/PlaceSearchInput.tsx` | pigułka z lupą + lista wyników, wyjęte z `SearchBar`; wspólne dla mapy i „Moich danych” |
| `src/screens/SearchBar.tsx` | cienka nakładka na `PlaceSearchInput` dla mapy |
| `src/lib/signupContext.ts` (+ test) | `shouldRecordSignup`, `signupSourceFromUrl`, `buildSignupContext` |
| `src/lib/invite.ts` | `?src=invite` w linku zaproszenia |
| `src/lib/types.ts` | `Profile` + 4 pola, nowy `ProfilePrivate` |
| `src/lib/supabase.ts` | `getProfile` (nowe kolumny), `getProfilePrivate`, `upsertProfilePrivate`, `recordSignupContext`, `trackClick('profile_save')` |
| `src/locales/{pl,en,es,de,sl}.ts` | klucze `myData.*`, `account.myData`; usunięcie kluczy modalu nazwy |
| `src/locales/parity.test.ts` | parytet kluczy `myData` |
| `src/screens/MyDataPanel.tsx` (+ test) | panel edycji |
| `src/screens/ProfilePanel.tsx`, `src/screens/AccountPanel.tsx`, `src/App.tsx` | wejścia do panelu, warstwa `myDataOpen`, efekty kontekstu rejestracji |
| `src/components/NicknameModal.tsx` | **usunięty** |
| `src/screens/MapScreen.tsx`, `src/screens/EventSheet.tsx` | przejście na `profileDisplay` (naprawa buga) |
| `docs/legal/privacy-policy.md`, `docs/legal/compliance-requirements.md` | nowe wiersze w tabelach danych |

---

### Task 1: Migracja bazy

**Files:**
- Create: `supabase/migrations/20260902_profile_fields.sql`

**Interfaces:**
- Produces: kolumny `profiles.bio/home_name/creator_kind/link_url`; tabela `public.profiles_private`; RPC `record_signup_context(p_ip_lat, p_ip_lng, p_country, p_gps_lat, p_gps_lng, p_platform, p_app_version, p_provider, p_source)`.

- [ ] **Step 1: Napisz migrację**

```sql
-- Edycja profilu: pola publiczne w profiles, prywatne i automatyczne w
-- profiles_private. Spec: docs/superpowers/specs/2026-09-02-user-profile-design.md
--
-- Dlaczego dwie tabele: profiles ma politykę SELECT `using (true)`, a
-- uprawnienia kolumnowe działają per rola, nie per wiersz. Gdyby authenticated
-- dostało select na birth_year, każdy zalogowany czytałby rok urodzenia
-- każdego. Osobna tabela z RLS auth.uid() = id załatwia to jedną polityką.
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).
-- Idempotentna: można puścić drugi raz bez szkody.

-- ── 1. profiles: kolumny publiczne ───────────────────────────────────────────
alter table public.profiles
  add column if not exists bio          text,
  add column if not exists home_name    text,
  add column if not exists creator_kind text,
  add column if not exists link_url     text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_bio_len') then
    alter table public.profiles add constraint profiles_bio_len
      check (bio is null or char_length(bio) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_home_name_len') then
    alter table public.profiles add constraint profiles_home_name_len
      check (home_name is null or char_length(home_name) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_creator_kind') then
    alter table public.profiles add constraint profiles_creator_kind
      check (creator_kind is null or creator_kind in ('person','organizer','venue','community'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_link_url_len') then
    alter table public.profiles add constraint profiles_link_url_len
      check (link_url is null or char_length(link_url) <= 200);
  end if;
end $$;

-- Migracja 20260702_profiles_hide_location zastąpiła tabelaryczny GRANT SELECT
-- grantem kolumnowym: kolumny dodane później są domyślnie niewidoczne. Bez tego
-- wiersza getProfile dostałby 42501 na każdej z nich.
grant select (bio, home_name, creator_kind, link_url) on public.profiles to anon, authenticated;

-- ── 2. profiles_private ──────────────────────────────────────────────────────
create table if not exists public.profiles_private (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  -- grupa B: podaje użytkownik, widzi tylko on
  birth_year         smallint check (birth_year is null or birth_year between 1900 and 2100),
  gender             text check (gender is null or gender in ('female','male','other')),
  residence_status   text check (residence_status is null or residence_status in ('local','newcomer','visitor')),
  occupation         text check (occupation is null or occupation in ('student','working','other')),
  university         text check (university is null or char_length(university) <= 80),
  field_of_study     text check (field_of_study is null or char_length(field_of_study) <= 80),
  found_via          text check (found_via is null or found_via in ('friend','poster','social','store','university','other')),
  -- grupa C: zapisuje aplikacja, użytkownik tego nie widzi
  home_lat           float8,
  home_lng           float8,
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
  updated_at         timestamptz not null default now(),
  -- współrzędne miejscowości: oba albo żadne
  constraint profiles_private_home_pair check ((home_lat is null) = (home_lng is null))
);

alter table public.profiles_private enable row level security;

drop policy if exists "profiles_private_select" on public.profiles_private;
create policy "profiles_private_select" on public.profiles_private
  for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_private_insert" on public.profiles_private;
create policy "profiles_private_insert" on public.profiles_private
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_private_update" on public.profiles_private;
create policy "profiles_private_update" on public.profiles_private
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.profiles_private from anon;
grant select, insert, update on public.profiles_private to authenticated;

-- Usuwanie konta: archive_and_anonymize_user (20260728) kasuje profiles,
-- kaskada zabiera ten wiersz. Nic więcej nie trzeba.

-- ── 3. Kontekst rejestracji: „wypełnij tylko puste” ──────────────────────────
-- Klient woła to raz zaraz po pierwszym logowaniu (IP, platforma, wersja,
-- provider, źródło) i ewentualnie drugi raz, gdy w tej samej sesji pojawi się
-- GPS. coalesce(stara, nowa) per kolumna: nic już zapisanego nie da się
-- nadpisać, a brakujące pola dopisują się w kolejnym wywołaniu.
create or replace function public.record_signup_context(
  p_ip_lat      float8,
  p_ip_lng      float8,
  p_country     text,
  p_gps_lat     float8,
  p_gps_lng     float8,
  p_platform    text,
  p_app_version text,
  p_provider    text,
  p_source      text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into profiles_private (
    id, signup_ip_lat, signup_ip_lng, signup_country,
    signup_gps_lat, signup_gps_lng, signup_platform,
    signup_app_version, signup_provider, signup_source, signup_recorded_at
  ) values (
    auth.uid(), p_ip_lat, p_ip_lng, p_country,
    p_gps_lat, p_gps_lng, p_platform,
    p_app_version, p_provider, p_source, now()
  )
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

revoke all on function public.record_signup_context(float8, float8, text, float8, float8, text, text, text, text)
  from public, anon;
grant execute on function public.record_signup_context(float8, float8, text, float8, float8, text, text, text, text)
  to authenticated;
```

- [ ] **Step 2: Sprawdź składnię przez przeczytanie**

Nie ma lokalnego Postgresa w tym projekcie. Przeczytaj plik od góry do dołu i porównaj z sekcją „Pola” specu: każdy enum i limit w kliencie (Task 2) musi mieć tu identyczny constraint. Sprawdź, że `grant select` wymienia dokładnie cztery nowe kolumny `profiles`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260902_profile_fields.sql
git commit -m "Migracja: pola profilu, tabela profiles_private, kontekst rejestracji"
```

---

### Task 2: `profileFields.ts` - stałe i walidacja

**Files:**
- Create: `src/lib/profileFields.ts`
- Test: `src/lib/profileFields.test.ts`

**Interfaces:**
- Consumes: `C`, `TAG_META` z `src/lib/tokens.ts`.
- Produces:
  - `DEFAULT_AVATAR_COLOR: string`, `AVATAR_COLORS: readonly string[]`
  - `BIO_MAX`, `HOME_NAME_MAX`, `LINK_URL_MAX`, `UNIVERSITY_MAX`, `FIELD_OF_STUDY_MAX`, `BIRTH_YEAR_MIN`, `MIN_AGE`
  - `CREATOR_KINDS`, `GENDERS`, `RESIDENCE_STATUSES`, `OCCUPATIONS`, `FOUND_VIA` (readonly tuple) + typy `CreatorKind`, `Gender`, `ResidenceStatus`, `Occupation`, `FoundVia`
  - `interface HomePlace { name: string; lat: number; lng: number }`
  - `interface ProfileForm` (stan formularza, teksty surowe)
  - `interface ProfileFormValue` (znormalizowany wynik, `null` zamiast pustych)
  - `type ProfileField`, `type ProfileFieldReason`, `interface ProfileFieldError`
  - `maxBirthYear(now: Date): number`
  - `homeNameFromPlace(p: { primary: string; secondary: string }): string`
  - `emptyProfileForm(): ProfileForm`
  - `validateProfileForm(form: ProfileForm, now: Date): { ok: true; value: ProfileFormValue } | { ok: false; errors: ProfileFieldError[] }`

- [ ] **Step 1: Napisz testy**

```ts
// src/lib/profileFields.test.ts
import { describe, it, expect } from 'vitest'
import {
  AVATAR_COLORS, DEFAULT_AVATAR_COLOR, BIO_MAX, LINK_URL_MAX, UNIVERSITY_MAX,
  BIRTH_YEAR_MIN, maxBirthYear, homeNameFromPlace, emptyProfileForm, validateProfileForm,
} from './profileFields'

const NOW = new Date('2026-09-02T12:00:00Z')

describe('avatar palette', () => {
  it('has eight distinct colours and the default is the first of them', () => {
    expect(AVATAR_COLORS).toHaveLength(8)
    expect(new Set(AVATAR_COLORS).size).toBe(8)
    expect(AVATAR_COLORS[0]).toBe(DEFAULT_AVATAR_COLOR)
  })
  it('default matches what handle_new_user writes', () => {
    expect(DEFAULT_AVATAR_COLOR).toBe('#FF7A45')
  })
})

describe('maxBirthYear', () => {
  it('is sixteen years before now, the age floor from the terms', () => {
    expect(maxBirthYear(NOW)).toBe(2010)
  })
})

describe('homeNameFromPlace', () => {
  it('joins primary and secondary with a comma', () => {
    expect(homeNameFromPlace({ primary: 'Puerto de la Cruz', secondary: 'Santa Cruz de Tenerife, España' }))
      .toBe('Puerto de la Cruz, Santa Cruz de Tenerife, España')
  })
  it('drops an empty secondary', () => {
    expect(homeNameFromPlace({ primary: 'Rzeszów', secondary: '' })).toBe('Rzeszów')
  })
  it('never exceeds the column limit', () => {
    const long = homeNameFromPlace({ primary: 'x'.repeat(70), secondary: 'y'.repeat(70) })
    expect(long.length).toBe(80)
  })
})

describe('validateProfileForm', () => {
  it('turns an untouched form into all nulls', () => {
    const res = validateProfileForm(emptyProfileForm(), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({
      bio: null, home: null, creatorKind: null, linkUrl: null,
      birthYear: null, gender: null, residenceStatus: null, occupation: null,
      university: null, fieldOfStudy: null, foundVia: null,
    })
  })

  it('trims and collapses whitespace, and empties become null', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), bio: '  robię   koncerty \n w piwnicy ', linkUrl: '   ' }, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.bio).toBe('robię koncerty w piwnicy')
    expect(res.value.linkUrl).toBeNull()
  })

  it('rejects a bio over the limit', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), bio: 'a'.repeat(BIO_MAX + 1) }, NOW)
    expect(res).toEqual({ ok: false, errors: [{ field: 'bio', reason: 'tooLong' }] })
  })

  it('adds https:// to a bare host and keeps an explicit scheme', () => {
    const bare = validateProfileForm({ ...emptyProfileForm(), linkUrl: 'instagram.com/klub' }, NOW)
    expect(bare.ok && bare.value.linkUrl).toBe('https://instagram.com/klub')
    const http = validateProfileForm({ ...emptyProfileForm(), linkUrl: 'http://meuwe.eu' }, NOW)
    expect(http.ok && http.value.linkUrl).toBe('http://meuwe.eu')
  })

  it('rejects a link that is not a web address', () => {
    for (const bad of ['tylko tekst', 'javascript:alert(1)', 'http://', 'https://nodot']) {
      const res = validateProfileForm({ ...emptyProfileForm(), linkUrl: bad }, NOW)
      expect(res).toEqual({ ok: false, errors: [{ field: 'linkUrl', reason: 'invalidUrl' }] })
    }
  })

  it('rejects a link over the limit even when it parses', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), linkUrl: 'https://a.pl/' + 'x'.repeat(LINK_URL_MAX) }, NOW)
    expect(res).toEqual({ ok: false, errors: [{ field: 'linkUrl', reason: 'tooLong' }] })
  })

  it('parses a four-digit birth year within range and nulls an empty one', () => {
    const ok = validateProfileForm({ ...emptyProfileForm(), birthYear: ' 1998 ' }, NOW)
    expect(ok.ok && ok.value.birthYear).toBe(1998)
    const empty = validateProfileForm({ ...emptyProfileForm(), birthYear: '' }, NOW)
    expect(empty.ok && empty.value.birthYear).toBeNull()
  })

  it('rejects a birth year outside 1900..now-16 or not four digits', () => {
    for (const bad of ['1899', '2011', '98', 'abcd']) {
      const res = validateProfileForm({ ...emptyProfileForm(), birthYear: bad }, NOW)
      expect(res).toEqual({ ok: false, errors: [{ field: 'birthYear', reason: 'outOfRange' }] })
    }
    expect(BIRTH_YEAR_MIN).toBe(1900)
  })

  it('keeps university and field only for a student', () => {
    const student = validateProfileForm({ ...emptyProfileForm(), occupation: 'student', university: 'PRz', fieldOfStudy: 'Informatyka' }, NOW)
    expect(student.ok && student.value.university).toBe('PRz')
    expect(student.ok && student.value.fieldOfStudy).toBe('Informatyka')
    const working = validateProfileForm({ ...emptyProfileForm(), occupation: 'working', university: 'PRz', fieldOfStudy: 'Informatyka' }, NOW)
    expect(working.ok && working.value.university).toBeNull()
    expect(working.ok && working.value.fieldOfStudy).toBeNull()
  })

  it('rejects a university name over the limit', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), occupation: 'student', university: 'u'.repeat(UNIVERSITY_MAX + 1) }, NOW)
    expect(res).toEqual({ ok: false, errors: [{ field: 'university', reason: 'tooLong' }] })
  })

  it('passes chips and the home place through untouched', () => {
    const home = { name: 'Rzeszów, Podkarpackie, Polska', lat: 50.04, lng: 22.0 }
    const res = validateProfileForm({
      ...emptyProfileForm(), home, creatorKind: 'venue', gender: 'other',
      residenceStatus: 'newcomer', occupation: 'other', foundVia: 'poster',
    }, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.home).toEqual(home)
    expect(res.value.creatorKind).toBe('venue')
    expect(res.value.gender).toBe('other')
    expect(res.value.residenceStatus).toBe('newcomer')
    expect(res.value.foundVia).toBe('poster')
  })

  it('reports every failing field at once', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), bio: 'a'.repeat(BIO_MAX + 1), birthYear: '1' }, NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.errors.map(e => e.field).sort()).toEqual(['bio', 'birthYear'])
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/lib/profileFields.test.ts`
Expected: FAIL - `Cannot find module './profileFields'`

- [ ] **Step 3: Napisz moduł**

```ts
// src/lib/profileFields.ts
//
// Pola panelu „Moje dane”: paleta avatara, limity, listy wartości i walidacja.
//
// Granice muszą się zgadzać z constraintami w migracji
// 20260902_profile_fields. Walidacja tutaj jest po to, żeby użytkownik dostał
// zrozumiały komunikat zamiast błędu z Postgresa - baza zostaje ostatnią linią
// obrony. Ten sam podział co w nickname.ts.

import { C, TAG_META } from './tokens'

/** To, co handle_new_user wpisuje każdemu nowemu kontu. */
export const DEFAULT_AVATAR_COLOR: string = C.primary

/**
 * Osiem kolorów z palety aplikacji. Nie ma dowolnego pickera: każdy z tych
 * kolorów ma sprawdzony kontrast z czarnym inicjałem i pasuje do pinezek.
 */
export const AVATAR_COLORS: readonly string[] = [
  C.primary, C.sky, C.grass, C.sunshine, C.berry,
  TAG_META.music.color, TAG_META.festival.color, TAG_META.art.color,
]

export const BIO_MAX = 160
export const HOME_NAME_MAX = 80
export const LINK_URL_MAX = 200
export const UNIVERSITY_MAX = 80
export const FIELD_OF_STUDY_MAX = 80
export const BIRTH_YEAR_MIN = 1900
/** Próg wieku z regulaminu (RODO art. 8). */
export const MIN_AGE = 16

export const CREATOR_KINDS = ['person', 'organizer', 'venue', 'community'] as const
export const GENDERS = ['female', 'male', 'other'] as const
export const RESIDENCE_STATUSES = ['local', 'newcomer', 'visitor'] as const
export const OCCUPATIONS = ['student', 'working', 'other'] as const
export const FOUND_VIA = ['friend', 'poster', 'social', 'store', 'university', 'other'] as const

export type CreatorKind = typeof CREATOR_KINDS[number]
export type Gender = typeof GENDERS[number]
export type ResidenceStatus = typeof RESIDENCE_STATUSES[number]
export type Occupation = typeof OCCUPATIONS[number]
export type FoundVia = typeof FOUND_VIA[number]

/** Miejscowość wybrana z listy: nazwa do profiles, współrzędne do profiles_private. */
export interface HomePlace { name: string; lat: number; lng: number }

/** Stan formularza - teksty tak, jak wpisał je użytkownik. */
export interface ProfileForm {
  bio: string
  home: HomePlace | null
  creatorKind: CreatorKind | null
  linkUrl: string
  /** Tekst z inputu; '' = nie podano. */
  birthYear: string
  gender: Gender | null
  residenceStatus: ResidenceStatus | null
  occupation: Occupation | null
  university: string
  fieldOfStudy: string
  foundVia: FoundVia | null
}

/** Znormalizowany wynik walidacji - gotowy do zapisu, null zamiast pustych. */
export interface ProfileFormValue {
  bio: string | null
  home: HomePlace | null
  creatorKind: CreatorKind | null
  linkUrl: string | null
  birthYear: number | null
  gender: Gender | null
  residenceStatus: ResidenceStatus | null
  occupation: Occupation | null
  university: string | null
  fieldOfStudy: string | null
  foundVia: FoundVia | null
}

export type ProfileField = 'bio' | 'linkUrl' | 'birthYear' | 'university' | 'fieldOfStudy'
export type ProfileFieldReason = 'tooLong' | 'invalidUrl' | 'outOfRange'
export interface ProfileFieldError { field: ProfileField; reason: ProfileFieldReason }

export function emptyProfileForm(): ProfileForm {
  return {
    bio: '', home: null, creatorKind: null, linkUrl: '', birthYear: '',
    gender: null, residenceStatus: null, occupation: null,
    university: '', fieldOfStudy: '', foundVia: null,
  }
}

export function maxBirthYear(now: Date): number {
  return now.getFullYear() - MIN_AGE
}

/** Etykieta z wyniku Photon, przycięta do limitu kolumny. */
export function homeNameFromPlace(p: { primary: string; secondary: string }): string {
  return [p.primary, p.secondary].filter(Boolean).join(', ').slice(0, HOME_NAME_MAX)
}

/** Spacje w środku do jednej, znaki nowej linii ze schowka znikają; pusty → null. */
function tidy(raw: string): string | null {
  const v = raw.replace(/\s+/g, ' ').trim()
  return v === '' ? null : v
}

/** Adres strony: bez schematu dostaje https://, musi się parsować i mieć kropkę w hoście. */
function normalizeUrl(raw: string): { ok: true; value: string | null } | { ok: false; reason: ProfileFieldReason } {
  const t = tidy(raw)
  if (t === null) return { ok: true, value: null }
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  let parsed: URL
  try { parsed = new URL(withScheme) } catch { return { ok: false, reason: 'invalidUrl' } }
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) return { ok: false, reason: 'invalidUrl' }
  if (withScheme.length > LINK_URL_MAX) return { ok: false, reason: 'tooLong' }
  return { ok: true, value: withScheme }
}

export function validateProfileForm(
  form: ProfileForm,
  now: Date,
): { ok: true; value: ProfileFormValue } | { ok: false; errors: ProfileFieldError[] } {
  const errors: ProfileFieldError[] = []

  const bio = tidy(form.bio)
  if (bio !== null && bio.length > BIO_MAX) errors.push({ field: 'bio', reason: 'tooLong' })

  const link = normalizeUrl(form.linkUrl)
  if (!link.ok) errors.push({ field: 'linkUrl', reason: link.reason })

  let birthYear: number | null = null
  const yearText = form.birthYear.trim()
  if (yearText !== '') {
    const n = /^\d{4}$/.test(yearText) ? Number(yearText) : NaN
    if (!Number.isFinite(n) || n < BIRTH_YEAR_MIN || n > maxBirthYear(now)) {
      errors.push({ field: 'birthYear', reason: 'outOfRange' })
    } else {
      birthYear = n
    }
  }

  // Uczelnia i kierunek mają sens tylko dla studenta. Kto przełączył chip na
  // „pracuję”, nie zostawia po sobie starych wartości w bazie.
  const isStudent = form.occupation === 'student'
  const university = isStudent ? tidy(form.university) : null
  const fieldOfStudy = isStudent ? tidy(form.fieldOfStudy) : null
  if (university !== null && university.length > UNIVERSITY_MAX) errors.push({ field: 'university', reason: 'tooLong' })
  if (fieldOfStudy !== null && fieldOfStudy.length > FIELD_OF_STUDY_MAX) errors.push({ field: 'fieldOfStudy', reason: 'tooLong' })

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      bio,
      home: form.home,
      creatorKind: form.creatorKind,
      linkUrl: link.ok ? link.value : null,
      birthYear,
      gender: form.gender,
      residenceStatus: form.residenceStatus,
      occupation: form.occupation,
      university,
      fieldOfStudy,
      foundVia: form.foundVia,
    },
  }
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/lib/profileFields.test.ts`
Expected: PASS (wszystkie)

- [ ] **Step 5: Commit**

```bash
git add src/lib/profileFields.ts src/lib/profileFields.test.ts
git commit -m "Stałe i walidacja pól profilu"
```

---

### Task 3: `profileDisplay.ts` i naprawa inicjału na mapie

**Files:**
- Create: `src/lib/profileDisplay.ts`, `src/lib/profileDisplay.test.ts`
- Modify: `src/screens/MapScreen.tsx:597-603`, `src/screens/ProfilePanel.tsx:135-147` i `:218`, `src/screens/EventSheet.tsx:376-378`, `src/App.tsx:1234` i `:1244`
- Test: `src/screens/ProfilePanel.push.test.tsx` (dopisany przypadek)

**Interfaces:**
- Consumes: `DEFAULT_AVATAR_COLOR` z Task 2.
- Produces:
  - `type NameSource = { name_shown?: string | null; display_name?: string | null } | null | undefined`
  - `shownName(profile: NameSource, email?: string | null): string` - `''` gdy nic nie ma
  - `initial(profile: NameSource, email?: string | null): string` - zawsze jedna wielka litera, `'?'` gdy nic
  - `avatarColor(profile: { avatar_color?: string | null } | null | undefined): string`

- [ ] **Step 1: Napisz testy**

```ts
// src/lib/profileDisplay.test.ts
import { describe, it, expect } from 'vitest'
import { shownName, initial, avatarColor } from './profileDisplay'

describe('shownName', () => {
  it('prefers name_shown, then display_name, then the email prefix', () => {
    expect(shownName({ name_shown: 'Ala', display_name: 'Kasia' }, 'x@y.z')).toBe('Ala')
    expect(shownName({ name_shown: null, display_name: 'Kasia' }, 'x@y.z')).toBe('Kasia')
    expect(shownName({ name_shown: null, display_name: null }, 'k7f3@privaterelay.appleid.com')).toBe('k7f3')
    expect(shownName(null, null)).toBe('')
  })
  it('treats a missing name_shown key like null', () => {
    expect(shownName({ display_name: 'Kasia' })).toBe('Kasia')
  })
})

describe('initial', () => {
  // Bug: MapScreen took display_name while the menu took name_shown, so a
  // renamed user saw two different letters in the same app.
  it('comes from the same name the menu shows', () => {
    expect(initial({ name_shown: 'ala', display_name: 'Kasia' })).toBe('A')
  })
  it('falls back to the email and then to ?', () => {
    expect(initial(null, 'zoe@x.y')).toBe('Z')
    expect(initial(null)).toBe('?')
    expect(initial({ name_shown: '', display_name: '' }, '')).toBe('?')
  })
})

describe('avatarColor', () => {
  it('uses the stored colour and the app default when none', () => {
    expect(avatarColor({ avatar_color: '#4FC3F7' })).toBe('#4FC3F7')
    expect(avatarColor({ avatar_color: null })).toBe('#FF7A45')
    expect(avatarColor(null)).toBe('#FF7A45')
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/lib/profileDisplay.test.ts`
Expected: FAIL - `Cannot find module './profileDisplay'`

- [ ] **Step 3: Napisz moduł**

```ts
// src/lib/profileDisplay.ts
//
// Jedno miejsce dla reguły „co pokazać jako mnie”: nazwa, inicjał, kolor.
//
// Ta reguła była skopiowana w pięciu miejscach i w jednym (MapScreen) skopiowana
// źle - avatar na mapie liczył literę z display_name, a menu z name_shown, więc
// po zmianie nazwy użytkownik widział dwie różne litery w tej samej aplikacji.
// Dla cudzych profili (autor wydarzenia, wiadomości) obowiązuje authorLabel.ts,
// bo tam liczy się jeszcze „konto usunięte”.

import { DEFAULT_AVATAR_COLOR } from './profileFields'

export type NameSource = { name_shown?: string | null; display_name?: string | null } | null | undefined

/** name_shown (nickname albo nazwa od dostawcy) → display_name → przedrostek e-maila → ''. */
export function shownName(profile: NameSource, email?: string | null): string {
  return profile?.name_shown || profile?.display_name || email?.split('@')[0] || ''
}

/** Pierwsza litera shownName, wielka; '?' gdy nie ma z czego. */
export function initial(profile: NameSource, email?: string | null): string {
  return (shownName(profile, email).charAt(0) || '?').toUpperCase()
}

export function avatarColor(profile: { avatar_color?: string | null } | null | undefined): string {
  return profile?.avatar_color || DEFAULT_AVATAR_COLOR
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/lib/profileDisplay.test.ts`
Expected: PASS

- [ ] **Step 5: Dopisz test regresji do ProfilePanel**

Do `src/screens/ProfilePanel.push.test.tsx`, na końcu pliku, nowy `describe`. `renderPanel` w tym pliku buduje profil przez `profile(pushEnabled)` z `display_name: 'Ala'`; ten test potrzebuje własnego profilu, więc renderuje bezpośrednio:

```ts
describe('ProfilePanel identity', () => {
  it('shows the initial of the name the user chose, not the provider name', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'granted', registered: true, confirmed: true })
    render(
      <ProfilePanel
        open
        onClose={() => {}}
        session={session}
        profile={{ ...profile(false), display_name: 'Kasia', nickname: 'Ala', name_shown: 'Ala' }}
        onSignOut={() => {}}
        reloadProfile={() => {}}
        onOpenMyEvents={() => {}}
        onOpenFollowedEvents={() => {}}
        onOpenAccount={() => {}}
        onOpenMyData={() => {}}
      />
    )
    expect(await screen.findByText('Ala')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByText('K')).not.toBeInTheDocument()
  })
})
```

Uwaga: prop `onOpenMyData` jeszcze nie istnieje - test skompiluje się dopiero po Task 9. Do tego czasu przekaż go i tak (TypeScript w vitest nie blokuje nadmiarowego propa w JSX? Blokuje - dlatego ten krok dodaj, ale **uruchom** test dopiero w Task 9, Step 6). W tym tasku zapisz go bez uruchamiania i przejdź dalej.

- [ ] **Step 6: Zamień pięć miejsc na funkcje**

`src/screens/MapScreen.tsx` - dopisz import i zamień avatar:

```tsx
import { initial, avatarColor } from '../lib/profileDisplay'
// …
          <Avatar
            size={48}
            onClick={onOpenProfile}
            initials={initial(profile, session?.user?.email)}
            color={avatarColor(profile)}
            hasUnread={unreadMenu}
          />
```

Jeśli po tej zmianie `C` w MapScreen nie jest już nigdzie używane, usuń je z importu (lint `no-unused-vars`).

`src/screens/ProfilePanel.tsx` - usuń blok `shownName`/`initials`/`displayName` (linie 135-147) i zastąp:

```tsx
import { shownName, initial, avatarColor } from '../lib/profileDisplay'
// …
  const initials = session ? initial(profile, session.user.email) : '?'
  const displayName = session ? shownName(profile, session.user.email) : t('profile.guest')
```

oraz tło avatara (linia 218): `background: avatarColor(profile),`.

`src/screens/EventSheet.tsx` (376-378):

```tsx
import { shownName, avatarColor } from '../lib/profileDisplay'
// …
    const authorName = shownName(profile, session.user?.email) || '?'
    const authorColor = avatarColor(profile)
```

Zostaw komentarz nad `authorName` o wpisywaniu nazwy do wiadomości na stałe - dalej jest prawdziwy.

`src/App.tsx` (1234 i 1244):

```tsx
import { shownName, initial } from './lib/profileDisplay'
// …
        currentName={shownName(profile, session?.user.email)}
// …
          initial={initial(profile, session.user.email)}
```

- [ ] **Step 7: Sprawdź typy i pozostałe testy**

Run: `npx tsc -b && npx vitest run src/lib src/screens/EventSheet* src/components`
Expected: `tsc` bez błędów poza `ProfilePanel.push.test.tsx` (nieznany prop `onOpenMyData` - spodziewane do Task 9); vitest PASS dla wskazanych.

Jeśli `tsc -b` zgłasza tylko ten jeden błąd, idź dalej. Każdy inny błąd napraw tutaj.

- [ ] **Step 8: Commit**

```bash
git add src/lib/profileDisplay.ts src/lib/profileDisplay.test.ts src/screens/MapScreen.tsx src/screens/ProfilePanel.tsx src/screens/ProfilePanel.push.test.tsx src/screens/EventSheet.tsx src/App.tsx
git commit -m "Jedna reguła nazwy i inicjału; mapa pokazuje literę z wybranej nazwy"
```

---

### Task 4: `placeSearch.ts` i `PlaceSearchInput` wyjęte z `SearchBar`

**Files:**
- Create: `src/lib/placeSearch.ts`, `src/lib/placeSearch.test.ts`, `src/components/PlaceSearchInput.tsx`
- Modify: `src/screens/SearchBar.tsx` (cała treść)

**Interfaces:**
- Consumes: `haversineKm` z `src/lib/geo.ts`.
- Produces (`placeSearch.ts`):
  - `interface PhotonFeature` (jak dziś w SearchBar)
  - `interface PlaceResult { id: string; primary: string; secondary: string; lat: number; lng: number }`
  - `PLACE_RESULT_LIMIT = 5`, `SETTLEMENT_TAGS = ['place:city','place:town','place:village']`
  - `photonLang(uiLang: string): string`
  - `photonUrl(query: string, opts: { lang: string; near: LatLng | null; settlementsOnly: boolean }): string`
  - `parsePhoton(features: PhotonFeature[], near: LatLng | null): PlaceResult[]`
  - `searchPlaces(query: string, opts: { lang: string; near: LatLng | null; settlementsOnly?: boolean; signal?: AbortSignal }): Promise<PlaceResult[]>`
- Produces (`PlaceSearchInput.tsx`) - props:
  - `placeholder: string`
  - `near: LatLng | null`
  - `onSelect: (r: PlaceResult) => void`
  - `settlementsOnly?: boolean` (domyślnie false)
  - `initialQuery?: string` (tekst w polu przy montowaniu / zmianie tej wartości)
  - `labelFor?: (r: PlaceResult) => string` (co wpisać w pole po wyborze; domyślnie `r.primary`)
  - `onQueryChange?: (q: string) => void` (każda ręczna zmiana tekstu, w tym `×`)
  - `dropdownZIndex?: number` (domyślnie 20)

- [ ] **Step 1: Napisz testy `placeSearch`**

```ts
// src/lib/placeSearch.test.ts
import { describe, it, expect } from 'vitest'
import { parsePhoton, photonUrl, photonLang, PLACE_RESULT_LIMIT, type PhotonFeature } from './placeSearch'

function feature(name: string, lat: number, lng: number, extra: Partial<PhotonFeature['properties']> = {}): PhotonFeature {
  return { geometry: { coordinates: [lng, lat] }, properties: { osm_id: Math.round(lat * 1000 + lng), name, ...extra } }
}

describe('parsePhoton', () => {
  it('keeps the first of two features with the same name', () => {
    const out = parsePhoton([feature('Rzeszów', 50.04, 22.0), feature('rzeszów', 51, 21)], null)
    expect(out).toHaveLength(1)
    expect(out[0].lat).toBe(50.04)
  })
  it('skips features without a name', () => {
    expect(parsePhoton([feature('', 1, 1)], null)).toEqual([])
  })
  it('builds the secondary line from city, state, country - first two only', () => {
    const [r] = parsePhoton([feature('Puerto de la Cruz', 28.41, -16.55, { state: 'Canarias', country: 'España' })], null)
    expect(r.secondary).toBe('Canarias, España')
  })
  it('sorts by distance from `near` and caps the list', () => {
    const near = { lat: 50, lng: 22 }
    const many = Array.from({ length: 8 }, (_, i) => feature(`P${i}`, 50 + (8 - i) * 0.1, 22))
    const out = parsePhoton(many, near)
    expect(out).toHaveLength(PLACE_RESULT_LIMIT)
    expect(out[0].primary).toBe('P7')
  })
})

describe('photonUrl', () => {
  it('passes query, limit, lang and the bias point', () => {
    const u = new URL(photonUrl('rzesz', { lang: 'en', near: { lat: 50, lng: 22 }, settlementsOnly: false }))
    expect(u.origin + u.pathname).toBe('https://photon.komoot.io/api/')
    expect(u.searchParams.get('q')).toBe('rzesz')
    expect(u.searchParams.get('limit')).toBe('8')
    expect(u.searchParams.get('lang')).toBe('en')
    expect(u.searchParams.get('lat')).toBe('50')
    expect(u.searchParams.get('lon')).toBe('22')
    expect(u.searchParams.getAll('osm_tag')).toEqual([])
  })
  it('restricts to settlements with one osm_tag per kind', () => {
    const u = new URL(photonUrl('puerto', { lang: 'en', near: null, settlementsOnly: true }))
    expect(u.searchParams.getAll('osm_tag')).toEqual(['place:city', 'place:town', 'place:village'])
    expect(u.searchParams.has('lat')).toBe(false)
  })
})

describe('photonLang', () => {
  it('maps to what Photon supports and falls back to en', () => {
    expect(photonLang('de')).toBe('de')
    expect(photonLang('pl')).toBe('en')
    expect(photonLang('sl')).toBe('en')
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/lib/placeSearch.test.ts`
Expected: FAIL - `Cannot find module './placeSearch'`

- [ ] **Step 3: Napisz `placeSearch.ts`**

```ts
// src/lib/placeSearch.ts
//
// Wyszukiwanie miejsc przez Photon (komoot). Wyjęte z SearchBar, bo to samo
// pytanie zadaje pole „Miejscowość” w Moich danych - z jedną różnicą: tam lista
// ma zawierać wyłącznie miejscowości, nigdy ulicę ani adres.

import { haversineKm } from './geo'

export interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id: number
    name: string
    city?: string
    state?: string
    country?: string
  }
}

export interface PlaceResult {
  id: string
  primary: string
  secondary: string
  lat: number
  lng: number
}

type LatLng = { lat: number; lng: number }

export const PLACE_RESULT_LIMIT = 5
const PHOTON_FETCH_LIMIT = 8
/** Filtr „tylko miejscowości”: miasto, miasteczko, wieś. */
export const SETTLEMENT_TAGS = ['place:city', 'place:town', 'place:village'] as const

/** Photon zna tylko kilka języków; reszta UI dostaje angielskie nazwy. */
export function photonLang(uiLang: string): string {
  return ['de', 'en', 'fr', 'it'].includes(uiLang) ? uiLang : 'en'
}

export function photonUrl(query: string, opts: { lang: string; near: LatLng | null; settlementsOnly: boolean }): string {
  const params = new URLSearchParams({ q: query, limit: String(PHOTON_FETCH_LIMIT), lang: opts.lang })
  if (opts.near) {
    params.set('lat', String(opts.near.lat))
    params.set('lon', String(opts.near.lng))
  }
  if (opts.settlementsOnly) for (const tag of SETTLEMENT_TAGS) params.append('osm_tag', tag)
  return `https://photon.komoot.io/api/?${params}`
}

export function parsePhoton(features: PhotonFeature[], near: LatLng | null): PlaceResult[] {
  const seen = new Set<string>()
  const results: PlaceResult[] = []

  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const { name, city, state, country } = f.properties
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const parts = [city, state, country].filter(Boolean)
    results.push({
      id: `${f.properties.osm_id}-${lat}-${lng}`,
      primary: name,
      secondary: parts.slice(0, 2).join(', '),
      lat,
      lng,
    })
  }

  if (near) {
    results.sort((a, b) =>
      haversineKm(near.lat, near.lng, a.lat, a.lng) -
      haversineKm(near.lat, near.lng, b.lat, b.lng)
    )
  }

  return results.slice(0, PLACE_RESULT_LIMIT)
}

export async function searchPlaces(
  query: string,
  opts: { lang: string; near: LatLng | null; settlementsOnly?: boolean; signal?: AbortSignal },
): Promise<PlaceResult[]> {
  const res = await fetch(
    photonUrl(query, { lang: opts.lang, near: opts.near, settlementsOnly: opts.settlementsOnly ?? false }),
    { signal: opts.signal },
  )
  const data = await res.json()
  return parsePhoton(data.features ?? [], opts.near)
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/lib/placeSearch.test.ts`
Expected: PASS

- [ ] **Step 5: Napisz `PlaceSearchInput.tsx`**

Treść to dzisiejszy `SearchBar` z zamienionymi propsami; wygląd (pigułka, lupa, spinner, `×`, lista) **bez zmian**.

```tsx
// src/components/PlaceSearchInput.tsx
//
// Pole „wpisz kilka liter, wybierz z listy”. Jedno dla mapy (SearchBar) i dla
// miejscowości w Moich danych, żeby oba wyglądały identycznie. Wartość istnieje
// tylko po wyborze z listy: samo wpisanie tekstu niczego nie wybiera.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchPlaces, photonLang, type PlaceResult } from '../lib/placeSearch'
import { C, INK } from '../lib/tokens'

interface Props {
  placeholder: string
  near: { lat: number; lng: number } | null
  onSelect: (r: PlaceResult) => void
  settlementsOnly?: boolean
  /** Tekst w polu na start i przy każdej zmianie tej wartości. */
  initialQuery?: string
  /** Co wpisać w pole po wyborze; domyślnie sama nazwa. */
  labelFor?: (r: PlaceResult) => string
  /** Każda ręczna zmiana tekstu, także wyczyszczenie. */
  onQueryChange?: (q: string) => void
  dropdownZIndex?: number
}

export default function PlaceSearchInput({
  placeholder, near, onSelect, settlementsOnly = false, initialQuery = '',
  labelFor = r => r.primary, onQueryChange, dropdownZIndex = 20,
}: Props) {
  const { i18n } = useTranslation()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PlaceResult[]>([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setQuery(initialQuery) }, [initialQuery])

  async function search(val: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      setResults(await searchPlaces(val, { lang: photonLang(i18n.language), near, settlementsOnly, signal: controller.signal }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    onQueryChange?.(val)
    if (val.trim().length < 2) {
      abortRef.current?.abort()
      setResults([])
      setLoading(false)
      return
    }
    search(val.trim())
  }

  function handleSelect(item: PlaceResult) {
    onSelect(item)
    setQuery(labelFor(item))
    setResults([])
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      handleSelect(results[0])
    }
  }

  function handleClear() {
    setQuery('')
    onQueryChange?.('')
    setResults([])
    setLoading(false)
    abortRef.current?.abort()
    inputRef.current?.focus()
  }

  const showDropdown = focused && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: '#fff', borderRadius: 999, border: `2px solid ${INK}`,
        boxShadow: `0 3px 0 ${INK}22`, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13 13 L17 17" stroke={C.inkSoft} strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          style={{
            flex: 1,
            // >=16px prevents iOS from auto-zooming the page when the field is focused.
            fontSize: 16, fontWeight: 600, color: C.ink,
            border: 'none', outline: 'none', background: 'transparent', minWidth: 0,
          }}
        />

        {query.length > 0 && !loading && (
          <button
            aria-label="clear"
            onMouseDown={e => { e.preventDefault(); handleClear() }}
            style={{
              flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
              color: C.inkSoft, fontSize: 16, fontWeight: 900, lineHeight: 1, padding: '0 2px',
            }}
          >
            ×
          </button>
        )}

        {loading && (
          <div style={{
            flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
            border: `2px solid rgba(255,122,69,0.25)`, borderTopColor: C.primary,
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: '#fff', borderRadius: 18, border: `2px solid ${INK}`,
          boxShadow: `0 3px 0 ${INK}22`, overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
          zIndex: dropdownZIndex, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease',
        }}>
          {results.map((item, idx) => {
            const isLast = idx === results.length - 1
            return (
              <div
                key={item.id}
                onMouseDown={() => handleSelect(item)}
                style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : `1px solid ${C.cream}`, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.cream }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.primary}
                </div>
                {item.secondary && (
                  <div style={{ fontSize: 12, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {item.secondary}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Zamień `SearchBar.tsx` na cienką nakładkę**

Cała treść pliku:

```tsx
// src/screens/SearchBar.tsx
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../components/PlaceSearchInput'

// Wyszukiwarka na mapie. Sam wygląd i zachowanie mieszkają w PlaceSearchInput,
// bo to samo pole służy w Moich danych do wyboru miejscowości.

interface Props {
  userPos: { lat: number; lng: number } | null
  onSelect: (p: { lat: number; lng: number }) => void
}

function SearchBar({ userPos, onSelect }: Props) {
  const { t } = useTranslation()
  return (
    <PlaceSearchInput
      placeholder={t('map.search')}
      near={userPos}
      onSelect={r => onSelect({ lat: r.lat, lng: r.lng })}
    />
  )
}

export default SearchBar
```

- [ ] **Step 7: Sprawdź typy i zachowanie mapy**

Run: `npx tsc -b 2>&1 | grep -v ProfilePanel.push.test; npx vitest run src/lib/placeSearch.test.ts`
Expected: `tsc` bez nowych błędów, vitest PASS.

Ręcznie (dev server `npm run dev`, mapa): wpisz „rzesz”, lista pokazuje wyniki, wybór przenosi mapę, `×` czyści. To ma wyglądać dokładnie tak jak przed zmianą.

- [ ] **Step 8: Commit**

```bash
git add src/lib/placeSearch.ts src/lib/placeSearch.test.ts src/components/PlaceSearchInput.tsx src/screens/SearchBar.tsx
git commit -m "Wyszukiwanie miejsc jako moduł i wspólne pole z listą"
```

---

### Task 5: `signupContext.ts` i `?src=invite`

**Files:**
- Create: `src/lib/signupContext.ts`, `src/lib/signupContext.test.ts`
- Modify: `src/lib/invite.ts:11`

**Interfaces:**
- Produces:
  - `SIGNUP_WINDOW_MS = 24 * 60 * 60_000`
  - `type SignupSource = 'direct' | 'event_link' | 'digest' | 'invite'`
  - `type SignupPlatform = 'ios' | 'android' | 'web'`, `type SignupProvider = 'google' | 'apple'`
  - `interface SignupContext { ipLat: number|null; ipLng: number|null; country: string|null; gpsLat: number|null; gpsLng: number|null; platform: SignupPlatform|null; appVersion: string|null; provider: SignupProvider|null; source: SignupSource|null }`
  - `shouldRecordSignup(ctx: { profileCreatedAt: string; alreadyRecorded: boolean; now: number }): boolean`
  - `signupSourceFromUrl(url: string): SignupSource`
  - `signupProvider(raw: unknown): SignupProvider | null`
  - `buildSignupContext(input: { ipGeo: { lat: number; lng: number; country: string } | null; gps: { lat: number; lng: number } | null; platform: SignupPlatform; appVersion: string | null; provider: unknown; startUrl: string }): SignupContext`
  - `gpsOnlyContext(gps: { lat: number; lng: number }): SignupContext` - wszystko null poza GPS

- [ ] **Step 1: Napisz testy**

```ts
// src/lib/signupContext.test.ts
import { describe, it, expect } from 'vitest'
import {
  shouldRecordSignup, signupSourceFromUrl, signupProvider, buildSignupContext, gpsOnlyContext, SIGNUP_WINDOW_MS,
} from './signupContext'

const NOW = Date.parse('2026-09-02T12:00:00Z')

describe('shouldRecordSignup', () => {
  it('records an account created two hours ago', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '2026-09-02T10:00:00Z', alreadyRecorded: false, now: NOW })).toBe(true)
  })
  it('leaves an account from three days ago alone - it predates the feature', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '2026-08-30T12:00:00Z', alreadyRecorded: false, now: NOW })).toBe(false)
  })
  it('never records twice', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '2026-09-02T11:59:00Z', alreadyRecorded: true, now: NOW })).toBe(false)
  })
  it('treats the window edge as outside', () => {
    expect(shouldRecordSignup({ profileCreatedAt: new Date(NOW - SIGNUP_WINDOW_MS).toISOString(), alreadyRecorded: false, now: NOW })).toBe(false)
  })
  it('refuses an unparseable date rather than guessing', () => {
    expect(shouldRecordSignup({ profileCreatedAt: '', alreadyRecorded: false, now: NOW })).toBe(false)
  })
})

describe('signupSourceFromUrl', () => {
  it('reads the four sources and defaults to direct', () => {
    expect(signupSourceFromUrl('https://meuwe.eu/?event=abc')).toBe('event_link')
    expect(signupSourceFromUrl('https://meuwe.eu/?lat=1&lng=2&src=digest')).toBe('digest')
    expect(signupSourceFromUrl('https://meuwe.eu/?src=invite')).toBe('invite')
    expect(signupSourceFromUrl('https://meuwe.eu/')).toBe('direct')
    expect(signupSourceFromUrl('capacitor://localhost/')).toBe('direct')
    expect(signupSourceFromUrl('not a url')).toBe('direct')
  })
  it('an event link wins over src', () => {
    expect(signupSourceFromUrl('https://meuwe.eu/?event=abc&src=digest')).toBe('event_link')
  })
})

describe('signupProvider', () => {
  it('accepts only google and apple', () => {
    expect(signupProvider('google')).toBe('google')
    expect(signupProvider('apple')).toBe('apple')
    expect(signupProvider('email')).toBeNull()
    expect(signupProvider(undefined)).toBeNull()
  })
})

describe('buildSignupContext', () => {
  it('assembles every field and nulls what is missing', () => {
    expect(buildSignupContext({
      ipGeo: { lat: 28.4, lng: -16.5, country: 'ES' }, gps: null,
      platform: 'ios', appVersion: '1.1.7', provider: 'apple', startUrl: 'https://meuwe.eu/?src=invite',
    })).toEqual({
      ipLat: 28.4, ipLng: -16.5, country: 'ES', gpsLat: null, gpsLng: null,
      platform: 'ios', appVersion: '1.1.7', provider: 'apple', source: 'invite',
    })
    expect(buildSignupContext({ ipGeo: null, gps: { lat: 50, lng: 22 }, platform: 'web', appVersion: null, provider: 'google', startUrl: 'https://meuwe.eu/' }))
      .toMatchObject({ ipLat: null, country: null, gpsLat: 50, gpsLng: 22, platform: 'web', appVersion: null, source: 'direct' })
  })
  it('stores an empty country as null', () => {
    expect(buildSignupContext({ ipGeo: { lat: 1, lng: 2, country: '' }, gps: null, platform: 'web', appVersion: null, provider: 'google', startUrl: 'https://meuwe.eu/' }).country).toBeNull()
  })
})

describe('gpsOnlyContext', () => {
  it('carries the fix and nothing else, so coalesce keeps the first write', () => {
    expect(gpsOnlyContext({ lat: 50, lng: 22 })).toEqual({
      ipLat: null, ipLng: null, country: null, gpsLat: 50, gpsLng: 22,
      platform: null, appVersion: null, provider: null, source: null,
    })
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/lib/signupContext.test.ts`
Expected: FAIL - `Cannot find module './signupContext'`

- [ ] **Step 3: Napisz moduł**

```ts
// src/lib/signupContext.ts
//
// Skąd, na czym i którędy powstało konto. Trigger handle_new_user działa w
// bazie i nie zna ani platformy, ani lokalizacji, więc zapisuje to klient -
// przez RPC record_signup_context, które wypełnia tylko puste kolumny. Dzięki
// temu wolno je zawołać dwa razy: raz zaraz po logowaniu, drugi raz gdy w tej
// samej sesji pojawi się GPS.

export const SIGNUP_WINDOW_MS = 24 * 60 * 60_000

export type SignupSource = 'direct' | 'event_link' | 'digest' | 'invite'
export type SignupPlatform = 'ios' | 'android' | 'web'
export type SignupProvider = 'google' | 'apple'

export interface SignupContext {
  ipLat: number | null
  ipLng: number | null
  country: string | null
  gpsLat: number | null
  gpsLng: number | null
  platform: SignupPlatform | null
  appVersion: string | null
  provider: SignupProvider | null
  source: SignupSource | null
}

/**
 * Czy to jest rejestracja, a nie zwykłe logowanie: konto młodsze niż dobę i
 * nic jeszcze nie zapisano. Konta sprzed wdrożenia zostają z nullem - uczciwiej
 * niż zapisać im „rejestrację” w dniu deployu.
 */
export function shouldRecordSignup(ctx: { profileCreatedAt: string; alreadyRecorded: boolean; now: number }): boolean {
  if (ctx.alreadyRecorded) return false
  const created = Date.parse(ctx.profileCreatedAt)
  if (!Number.isFinite(created)) return false
  return ctx.now - created < SIGNUP_WINDOW_MS
}

/** Z adresu, pod którym aplikacja wystartowała. Link do wydarzenia bije `src`. */
export function signupSourceFromUrl(url: string): SignupSource {
  let params: URLSearchParams
  try { params = new URL(url).searchParams } catch { return 'direct' }
  if (params.get('event')) return 'event_link'
  const src = params.get('src')
  if (src === 'digest') return 'digest'
  if (src === 'invite') return 'invite'
  return 'direct'
}

/** session.user.app_metadata.provider, przepuszczone przez listę tego, co znamy. */
export function signupProvider(raw: unknown): SignupProvider | null {
  return raw === 'google' || raw === 'apple' ? raw : null
}

export function buildSignupContext(input: {
  ipGeo: { lat: number; lng: number; country: string } | null
  gps: { lat: number; lng: number } | null
  platform: SignupPlatform
  appVersion: string | null
  provider: unknown
  startUrl: string
}): SignupContext {
  return {
    ipLat: input.ipGeo?.lat ?? null,
    ipLng: input.ipGeo?.lng ?? null,
    country: input.ipGeo?.country || null,
    gpsLat: input.gps?.lat ?? null,
    gpsLng: input.gps?.lng ?? null,
    platform: input.platform,
    appVersion: input.appVersion,
    provider: signupProvider(input.provider),
    source: signupSourceFromUrl(input.startUrl),
  }
}

/** Drugie wywołanie: tylko GPS, reszta null - coalesce w bazie zostawia pierwszy zapis. */
export function gpsOnlyContext(gps: { lat: number; lng: number }): SignupContext {
  return {
    ipLat: null, ipLng: null, country: null,
    gpsLat: gps.lat, gpsLng: gps.lng,
    platform: null, appVersion: null, provider: null, source: null,
  }
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/lib/signupContext.test.ts`
Expected: PASS

- [ ] **Step 5: Oznacz link zaproszenia**

W `src/lib/invite.ts` zamień `const url = WEB_ORIGIN` na:

```ts
  // ?src=invite: dzięki temu konto założone z zaproszenia da się odróżnić od
  // wejścia bezpośredniego (signupSourceFromUrl w lib/signupContext).
  const url = `${WEB_ORIGIN}/?src=invite`
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/signupContext.ts src/lib/signupContext.test.ts src/lib/invite.ts
git commit -m "Reguły kontekstu rejestracji; link zaproszenia ze źródłem"
```

---

### Task 6: Typy i warstwa danych w `supabase.ts`

**Files:**
- Modify: `src/lib/types.ts:7-27`, `src/lib/supabase.ts:106-111` (getProfile), `:147-149` (po updateProfileLanguage), `:505-511` (trackClick)

**Interfaces:**
- Consumes: typy z Task 2 i Task 5.
- Produces:
  - `Profile` + `bio: string | null`, `home_name: string | null`, `creator_kind: CreatorKind | null`, `link_url: string | null`
  - `interface ProfilePrivate` (poniżej)
  - `db.getProfilePrivate(uid: string): Promise<ProfilePrivate | null>`
  - `db.upsertProfilePrivate(p: Partial<ProfilePrivate> & { id: string })` - zwraca wynik PostgREST (`{ data, error }`)
  - `db.recordSignupContext(ctx: SignupContext)` - zwraca wynik `rpc`
  - `db.trackClick('profile_save')`

- [ ] **Step 1: Rozszerz `types.ts`**

Po imporcie `Category` dodaj:

```ts
import type { CreatorKind, Gender, ResidenceStatus, Occupation, FoundVia } from './profileFields'
import type { SignupPlatform, SignupProvider, SignupSource } from './signupContext'
```

W `Profile`, po `avatar_color`:

```ts
  /** Jedno zdanie o sobie, ≤ 160 znaków. Publiczne. */
  bio: string | null
  /** Miejscowość wybrana z listy; współrzędne leżą w profiles_private. Publiczne. */
  home_name: string | null
  /** Osoba prywatna / organizator / lokal / społeczność. Publiczne. */
  creator_kind: CreatorKind | null
  /** Jedna strona lub profil w social mediach. Publiczne. */
  link_url: string | null
```

Po `Profile` nowy interfejs:

```ts
/**
 * Dane, które widzi tylko właściciel (RLS auth.uid() = id) - to, co podał w
 * „O Tobie”, i to, co aplikacja zapisała sama przy rejestracji. Wiersz powstaje
 * leniwie, przy pierwszym zapisie, więc może go nie być.
 */
export interface ProfilePrivate {
  id: string
  birth_year: number | null
  gender: Gender | null
  residence_status: ResidenceStatus | null
  occupation: Occupation | null
  university: string | null
  field_of_study: string | null
  found_via: FoundVia | null
  home_lat: number | null
  home_lng: number | null
  signup_ip_lat: number | null
  signup_ip_lng: number | null
  signup_country: string | null
  signup_gps_lat: number | null
  signup_gps_lng: number | null
  signup_platform: SignupPlatform | null
  signup_app_version: string | null
  signup_provider: SignupProvider | null
  signup_source: SignupSource | null
  signup_recorded_at: string | null
  updated_at: string
}
```

- [ ] **Step 2: Napraw fabryki profilu w testach**

`Profile` ma cztery nowe wymagane pola, więc każdy literał `Profile` w testach przestanie się kompilować. Znajdź je:

Run: `grep -rln "interests_onboarded_at" src --include='*.test.tsx' --include='*.test.ts' --include='*.tsx'`

W każdym literale `Profile` (na pewno `src/screens/ProfilePanel.push.test.tsx` funkcja `profile()` i `src/dev/pushPreview.tsx`) dopisz: `bio: null, home_name: null, creator_kind: null, link_url: null,`.

- [ ] **Step 3: `getProfile` czyta nowe kolumny**

W `src/lib/supabase.ts` linia 110 - rozszerz jawną listę kolumn:

```ts
    const {data}=await supabase.from('profiles').select('id,display_name,nickname,name_shown,avatar_color,bio,home_name,creator_kind,link_url,radius_km,interests,interests_onboarded_at,created_at,push_enabled,language').eq('id',uid).single(); return data as Profile|null
```

- [ ] **Step 4: Dodaj metody dla `profiles_private`**

Import na górze `supabase.ts`: dopisz `ProfilePrivate` do importu typów z `./types` i `import type { SignupContext } from './signupContext'`.

Po `updateProfileLanguage` (linia 149) wstaw:

```ts
  // profiles_private: tylko własny wiersz (RLS), wszystkie kolumny czytelne dla
  // właściciela - stąd '*' jest tu bezpieczne, inaczej niż w getProfile.
  // maybeSingle, bo wiersz powstaje leniwie i może go jeszcze nie być.
  async getProfilePrivate(uid: string): Promise<ProfilePrivate | null> {
    const { data, error } = await supabase.from('profiles_private').select('*').eq('id', uid).maybeSingle()
    if (error) { console.error('[getProfilePrivate]', error); return null }
    return (data as ProfilePrivate | null) ?? null
  },
  // Jedyna tabela profilu, w której upsert jest właściwy: nie ma triggera, który
  // zakładałby wiersz przy rejestracji, więc pierwszy zapis musi go stworzyć.
  async upsertProfilePrivate(p: Partial<ProfilePrivate> & { id: string }) {
    return supabase.from('profiles_private').upsert(p, { onConflict: 'id' }).select('id')
  },
  // RPC „wypełnij tylko puste” - patrz migracja 20260902_profile_fields.
  async recordSignupContext(ctx: SignupContext) {
    return supabase.rpc('record_signup_context', {
      p_ip_lat: ctx.ipLat, p_ip_lng: ctx.ipLng, p_country: ctx.country,
      p_gps_lat: ctx.gpsLat, p_gps_lng: ctx.gpsLng,
      p_platform: ctx.platform, p_app_version: ctx.appVersion,
      p_provider: ctx.provider, p_source: ctx.source,
    })
  },
```

W unii `trackClick` dopisz `| 'profile_save'` obok `'nickname_save'`.

- [ ] **Step 5: Sprawdź typy**

Run: `npx tsc -b 2>&1 | grep -v "ProfilePanel.push.test"`
Expected: brak błędów (jedyny dopuszczalny to `onOpenMyData` w teście ProfilePanel, do Task 9).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/supabase.ts src/screens/ProfilePanel.push.test.tsx src/dev/pushPreview.tsx
git commit -m "Typy i dostęp do profiles_private"
```

---

### Task 7: Teksty w pięciu językach

**Files:**
- Modify: `src/locales/pl.ts`, `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/de.ts`, `src/locales/sl.ts` (blok `account`, nowy blok `myData`)
- Modify: `src/locales/parity.test.ts`

**Interfaces:**
- Produces: klucze `account.myData`, `myData.*` (lista poniżej). Usunięte: `account.nickname`, `account.nicknameTitle`, `account.nicknameCurrent`, `account.nicknameNew`, `account.nicknameSave`, `account.nicknameSaved`. Zostają: `account.nicknameHint`, `account.nicknameFailed`, `account.nickname_empty`, `account.nickname_tooShort`, `account.nickname_tooLong`.

- [ ] **Step 1: Rozszerz test parytetu**

W `src/locales/parity.test.ts` po `APP_UPDATE_KEYS` dodaj:

```ts
const MY_DATA_KEYS = [
  'title', 'back', 'avatarColor', 'name', 'namePlaceholder',
  'aboutMe', 'aboutMeHint', 'bio', 'bioPlaceholder', 'home', 'homePlaceholder',
  'creatorKind', 'creatorKind_person', 'creatorKind_organizer', 'creatorKind_venue', 'creatorKind_community',
  'link', 'linkPlaceholder',
  'aboutYou', 'aboutYouHint', 'birthYear', 'birthYearPlaceholder',
  'gender', 'gender_female', 'gender_male', 'gender_other',
  'residence', 'residence_local', 'residence_newcomer', 'residence_visitor',
  'occupation', 'occupation_student', 'occupation_working', 'occupation_other',
  'university', 'fieldOfStudy',
  'foundVia', 'foundVia_friend', 'foundVia_poster', 'foundVia_social', 'foundVia_store', 'foundVia_university', 'foundVia_other',
  'save', 'saved', 'saveFailed',
  'error_tooLong', 'error_invalidUrl', 'error_outOfRange',
] as const
```

i na końcu pliku:

```ts
describe('my data panel', () => {
  it.each(Object.entries(LOCALES))('%s carries every myData key and the account entry', (_name, dict) => {
    const d = dict as { myData: Record<string, unknown>; account: Record<string, unknown> }
    for (const key of MY_DATA_KEYS) {
      expect(typeof d.myData[key]).toBe('string')
      expect(d.myData[key]).not.toBe('')
    }
    expect(typeof d.account.myData).toBe('string')
    // Modal nazwy zniknął; jego klucze nie mają prawa zostać jako martwe.
    expect(d.account.nicknameTitle).toBeUndefined()
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: FAIL - `myData` undefined dla każdego języka

- [ ] **Step 3: Dodaj teksty**

W każdym pliku: w bloku `account` usuń sześć kluczy wymienionych wyżej, dopisz `myData` na początku bloku i zaktualizuj `body`. Nowy blok `myData` wstaw bezpośrednio po bloku `account`.

**pl.ts**

```ts
  account: {
    myData: 'Moje dane',
    nicknameHint: 'Od 2 do 30 znaków',
    nicknameFailed: 'Nie udało się zapisać, spróbuj ponownie',
    nickname_empty: 'Wpisz nazwę',
    nickname_tooShort: 'Nazwa jest za krótka',
    nickname_tooLong: 'Nazwa jest za długa',
    entry: 'Konto i dane',
    back: 'Profil',
    title: 'Konto i dane',
    body: 'Trzymamy adres e-mail z logowania, Twój pseudonim i kolor avatara, ustawienia powiadomień, treść wydarzeń i wiadomości, które dodajesz, oraz dane, które dobrowolnie podasz w Moich danych. Ostatnia lokalizacja służy wyłącznie do filtrowania powiadomień o tym, co dzieje się w okolicy.',
    // … reszta bez zmian (privacy, delete, …)
  },
  myData: {
    title: 'Moje dane',
    back: 'Wstecz',
    avatarColor: 'Kolor avatara',
    name: 'Nazwa',
    namePlaceholder: 'Jak mamy Cię pokazywać',
    aboutMe: 'O mnie',
    aboutMeHint: 'Inni to widzą',
    bio: 'O sobie',
    bioPlaceholder: 'Jedno zdanie o Tobie',
    home: 'Miejscowość',
    homePlaceholder: 'Wpisz nazwę miejscowości',
    creatorKind: 'Kim jestem',
    creatorKind_person: 'Osoba prywatna',
    creatorKind_organizer: 'Organizator',
    creatorKind_venue: 'Lokal',
    creatorKind_community: 'Społeczność',
    link: 'Link',
    linkPlaceholder: 'Strona lub Instagram',
    aboutYou: 'O Tobie',
    aboutYouHint: 'Widzisz tylko Ty',
    birthYear: 'Rok urodzenia',
    birthYearPlaceholder: 'RRRR',
    gender: 'Płeć',
    gender_female: 'Kobieta',
    gender_male: 'Mężczyzna',
    gender_other: 'Inna',
    residence: 'Mieszkam tu',
    residence_local: 'Od lat',
    residence_newcomer: 'Od niedawna',
    residence_visitor: 'Przejazdem',
    occupation: 'Zajęcie',
    occupation_student: 'Studiuję',
    occupation_working: 'Pracuję',
    occupation_other: 'Inne',
    university: 'Uczelnia',
    fieldOfStudy: 'Kierunek',
    foundVia: 'Skąd wiesz o meuwe',
    foundVia_friend: 'Od znajomych',
    foundVia_poster: 'Z plakatu',
    foundVia_social: 'Z social mediów',
    foundVia_store: 'Ze sklepu z aplikacjami',
    foundVia_university: 'Z uczelni',
    foundVia_other: 'Inaczej',
    save: 'Zapisz',
    saved: 'Zapisano',
    saveFailed: 'Nie udało się zapisać, spróbuj ponownie',
    error_tooLong: 'Za długie',
    error_invalidUrl: 'To nie wygląda na adres strony',
    error_outOfRange: 'Podaj rok w formacie RRRR',
  },
```

**en.ts**

```ts
  account: {
    myData: 'My details',
    nicknameHint: 'Between 2 and 30 characters',
    nicknameFailed: 'Could not save, please try again',
    nickname_empty: 'Enter a name',
    nickname_tooShort: 'That name is too short',
    nickname_tooLong: 'That name is too long',
    entry: 'Account and data',
    back: 'Profile',
    title: 'Account and data',
    body: 'We keep the email address you sign in with, your nickname and avatar colour, your notification settings, the events and messages you post, and whatever you choose to share in My details. Your last location is used only to filter notifications about what is happening nearby.',
    // … reszta bez zmian
  },
  myData: {
    title: 'My details',
    back: 'Back',
    avatarColor: 'Avatar colour',
    name: 'Name',
    namePlaceholder: 'How should we show you',
    aboutMe: 'About me',
    aboutMeHint: 'Others can see this',
    bio: 'Bio',
    bioPlaceholder: 'One sentence about you',
    home: 'Town',
    homePlaceholder: 'Type a town name',
    creatorKind: 'I am',
    creatorKind_person: 'A person',
    creatorKind_organizer: 'An organiser',
    creatorKind_venue: 'A venue',
    creatorKind_community: 'A community',
    link: 'Link',
    linkPlaceholder: 'Website or Instagram',
    aboutYou: 'About you',
    aboutYouHint: 'Only you can see this',
    birthYear: 'Year of birth',
    birthYearPlaceholder: 'YYYY',
    gender: 'Gender',
    gender_female: 'Female',
    gender_male: 'Male',
    gender_other: 'Other',
    residence: 'I live here',
    residence_local: 'For years',
    residence_newcomer: 'Recently moved',
    residence_visitor: 'Just visiting',
    occupation: 'Occupation',
    occupation_student: 'Student',
    occupation_working: 'Working',
    occupation_other: 'Other',
    university: 'University',
    fieldOfStudy: 'Field of study',
    foundVia: 'How did you find meuwe',
    foundVia_friend: 'From friends',
    foundVia_poster: 'A poster',
    foundVia_social: 'Social media',
    foundVia_store: 'The app store',
    foundVia_university: 'My university',
    foundVia_other: 'Other',
    save: 'Save',
    saved: 'Saved',
    saveFailed: 'Could not save, please try again',
    error_tooLong: 'Too long',
    error_invalidUrl: 'That does not look like a web address',
    error_outOfRange: 'Enter a year as YYYY',
  },
```

**es.ts**

```ts
  account: {
    myData: 'Mis datos',
    nicknameHint: 'Entre 2 y 30 caracteres',
    nicknameFailed: 'No se pudo guardar, inténtalo de nuevo',
    nickname_empty: 'Escribe un nombre',
    nickname_tooShort: 'El nombre es demasiado corto',
    nickname_tooLong: 'El nombre es demasiado largo',
    entry: 'Cuenta y datos',
    back: 'Perfil',
    title: 'Cuenta y datos',
    body: 'Guardamos el correo con el que inicias sesión, tu apodo y el color de tu avatar, tus ajustes de notificaciones, los eventos y mensajes que publicas y lo que decidas compartir en Mis datos. Tu última ubicación sirve solo para filtrar avisos sobre lo que ocurre cerca de ti.',
    // … reszta bez zmian
  },
  myData: {
    title: 'Mis datos',
    back: 'Atrás',
    avatarColor: 'Color del avatar',
    name: 'Nombre',
    namePlaceholder: 'Cómo quieres que te mostremos',
    aboutMe: 'Sobre mí',
    aboutMeHint: 'Los demás lo ven',
    bio: 'Bio',
    bioPlaceholder: 'Una frase sobre ti',
    home: 'Localidad',
    homePlaceholder: 'Escribe el nombre de tu localidad',
    creatorKind: 'Soy',
    creatorKind_person: 'Una persona',
    creatorKind_organizer: 'Organizador',
    creatorKind_venue: 'Un local',
    creatorKind_community: 'Una comunidad',
    link: 'Enlace',
    linkPlaceholder: 'Web o Instagram',
    aboutYou: 'Sobre ti',
    aboutYouHint: 'Solo tú lo ves',
    birthYear: 'Año de nacimiento',
    birthYearPlaceholder: 'AAAA',
    gender: 'Género',
    gender_female: 'Mujer',
    gender_male: 'Hombre',
    gender_other: 'Otro',
    residence: 'Vivo aquí',
    residence_local: 'Desde hace años',
    residence_newcomer: 'Desde hace poco',
    residence_visitor: 'De paso',
    occupation: 'Ocupación',
    occupation_student: 'Estudio',
    occupation_working: 'Trabajo',
    occupation_other: 'Otra',
    university: 'Universidad',
    fieldOfStudy: 'Carrera',
    foundVia: 'Cómo conociste meuwe',
    foundVia_friend: 'Por amigos',
    foundVia_poster: 'Por un cartel',
    foundVia_social: 'Redes sociales',
    foundVia_store: 'Tienda de apps',
    foundVia_university: 'En la universidad',
    foundVia_other: 'De otra forma',
    save: 'Guardar',
    saved: 'Guardado',
    saveFailed: 'No se pudo guardar, inténtalo de nuevo',
    error_tooLong: 'Demasiado largo',
    error_invalidUrl: 'Eso no parece una dirección web',
    error_outOfRange: 'Escribe el año como AAAA',
  },
```

**de.ts**

```ts
  account: {
    myData: 'Meine Daten',
    nicknameHint: 'Zwischen 2 und 30 Zeichen',
    nicknameFailed: 'Speichern fehlgeschlagen, bitte erneut versuchen',
    nickname_empty: 'Gib einen Namen ein',
    nickname_tooShort: 'Der Name ist zu kurz',
    nickname_tooLong: 'Der Name ist zu lang',
    entry: 'Konto und Daten',
    back: 'Profil',
    title: 'Konto und Daten',
    body: 'Wir speichern die E-Mail-Adresse deiner Anmeldung, deinen Namen und deine Avatarfarbe, deine Benachrichtigungseinstellungen, die Events und Nachrichten, die du schreibst, sowie das, was du freiwillig unter Meine Daten angibst. Dein letzter Standort dient nur dazu, Benachrichtigungen über Events in der Nähe zu filtern.',
    // … reszta bez zmian
  },
  myData: {
    title: 'Meine Daten',
    back: 'Zurück',
    avatarColor: 'Avatarfarbe',
    name: 'Name',
    namePlaceholder: 'Wie sollen wir dich anzeigen',
    aboutMe: 'Über mich',
    aboutMeHint: 'Für andere sichtbar',
    bio: 'Bio',
    bioPlaceholder: 'Ein Satz über dich',
    home: 'Ort',
    homePlaceholder: 'Ortsnamen eingeben',
    creatorKind: 'Ich bin',
    creatorKind_person: 'Privatperson',
    creatorKind_organizer: 'Veranstalter',
    creatorKind_venue: 'Lokal',
    creatorKind_community: 'Community',
    link: 'Link',
    linkPlaceholder: 'Website oder Instagram',
    aboutYou: 'Über dich',
    aboutYouHint: 'Nur du siehst das',
    birthYear: 'Geburtsjahr',
    birthYearPlaceholder: 'JJJJ',
    gender: 'Geschlecht',
    gender_female: 'Weiblich',
    gender_male: 'Männlich',
    gender_other: 'Divers',
    residence: 'Ich wohne hier',
    residence_local: 'Seit Jahren',
    residence_newcomer: 'Seit Kurzem',
    residence_visitor: 'Nur zu Besuch',
    occupation: 'Beschäftigung',
    occupation_student: 'Studiere',
    occupation_working: 'Arbeite',
    occupation_other: 'Sonstiges',
    university: 'Hochschule',
    fieldOfStudy: 'Studiengang',
    foundVia: 'Wie hast du meuwe gefunden',
    foundVia_friend: 'Über Freunde',
    foundVia_poster: 'Über ein Plakat',
    foundVia_social: 'Social Media',
    foundVia_store: 'App Store',
    foundVia_university: 'Über die Hochschule',
    foundVia_other: 'Anders',
    save: 'Speichern',
    saved: 'Gespeichert',
    saveFailed: 'Speichern fehlgeschlagen, bitte erneut versuchen',
    error_tooLong: 'Zu lang',
    error_invalidUrl: 'Das sieht nicht nach einer Webadresse aus',
    error_outOfRange: 'Jahr als JJJJ eingeben',
  },
```

**sl.ts**

```ts
  account: {
    myData: 'Moji podatki',
    nicknameHint: 'Med 2 in 30 znaki',
    nicknameFailed: 'Shranjevanje ni uspelo, poskusite znova',
    nickname_empty: 'Vnesite ime',
    nickname_tooShort: 'Ime je prekratko',
    nickname_tooLong: 'Ime je predolgo',
    entry: 'Račun in podatki',
    back: 'Profil',
    title: 'Račun in podatki',
    body: 'Hranimo e-poštni naslov, s katerim se prijavljaš, tvoj vzdevek in barvo avatarja, nastavitve obvestil, dogodke in sporočila, ki jih objaviš, ter podatke, ki jih prostovoljno vneseš v Mojih podatkih. Zadnja lokacija služi le filtriranju obvestil o dogajanju v bližini.',
    // … reszta bez zmian
  },
  myData: {
    title: 'Moji podatki',
    back: 'Nazaj',
    avatarColor: 'Barva avatarja',
    name: 'Ime',
    namePlaceholder: 'Kako naj te prikažemo',
    aboutMe: 'O meni',
    aboutMeHint: 'Drugi to vidijo',
    bio: 'Opis',
    bioPlaceholder: 'En stavek o tebi',
    home: 'Kraj',
    homePlaceholder: 'Vpiši ime kraja',
    creatorKind: 'Sem',
    creatorKind_person: 'Zasebna oseba',
    creatorKind_organizer: 'Organizator',
    creatorKind_venue: 'Lokal',
    creatorKind_community: 'Skupnost',
    link: 'Povezava',
    linkPlaceholder: 'Spletna stran ali Instagram',
    aboutYou: 'O tebi',
    aboutYouHint: 'Vidiš samo ti',
    birthYear: 'Leto rojstva',
    birthYearPlaceholder: 'LLLL',
    gender: 'Spol',
    gender_female: 'Ženska',
    gender_male: 'Moški',
    gender_other: 'Drugo',
    residence: 'Tu živim',
    residence_local: 'Že leta',
    residence_newcomer: 'Od nedavnega',
    residence_visitor: 'Na obisku',
    occupation: 'Zaposlitev',
    occupation_student: 'Študiram',
    occupation_working: 'Delam',
    occupation_other: 'Drugo',
    university: 'Univerza',
    fieldOfStudy: 'Smer študija',
    foundVia: 'Kako si izvedel/a za meuwe',
    foundVia_friend: 'Od prijateljev',
    foundVia_poster: 'S plakata',
    foundVia_social: 'Družbena omrežja',
    foundVia_store: 'Trgovina z aplikacijami',
    foundVia_university: 'Na univerzi',
    foundVia_other: 'Drugače',
    save: 'Shrani',
    saved: 'Shranjeno',
    saveFailed: 'Shranjevanje ni uspelo, poskusite znova',
    error_tooLong: 'Predolgo',
    error_invalidUrl: 'To ni videti kot spletni naslov',
    error_outOfRange: 'Vpiši leto kot LLLL',
  },
```

- [ ] **Step 4: Uruchom test parytetu, ma przejść**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: PASS

- [ ] **Step 5: Sprawdź, że nic nie używa usuniętych kluczy**

Run: `grep -rn "account.nicknameTitle\|account.nicknameCurrent\|account.nicknameNew\|account.nicknameSave\|account.nicknameSaved\|'account.nickname'" src`
Expected: trafienia tylko w `src/components/NicknameModal.tsx`, `src/screens/AccountPanel.tsx` i `src/App.tsx` - wszystkie znikną w Task 9. `tsc -b` będzie tam do tego czasu zgłaszał błędy typu `Resources` (klucze i18n są typowane z `pl.ts`) - to spodziewane.

- [ ] **Step 6: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts src/locales/sl.ts src/locales/parity.test.ts
git commit -m "Teksty panelu Moje dane w pięciu językach"
```

---

### Task 8: `MyDataPanel`

**Files:**
- Create: `src/screens/MyDataPanel.tsx`, `src/screens/MyDataPanel.test.tsx`

**Interfaces:**
- Consumes: `db.updateProfile`, `db.getProfilePrivate`, `db.upsertProfilePrivate`, `db.trackClick` (Task 6); `validateNickname`, `NICKNAME_MAX` z `nickname.ts`; wszystko z Task 2, 3, 4.
- Produces - props:
  - `open: boolean`
  - `onClose: () => void`
  - `session: Session | null`
  - `profile: Profile | null`
  - `onSaved: () => void` - wołane po udanym zapisie; rodzic robi `reloadProfile`, toast i cofa historię

- [ ] **Step 1: Napisz testy**

```tsx
// src/screens/MyDataPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import MyDataPanel from './MyDataPanel'
import type { Profile, ProfilePrivate } from '../lib/types'
import type { PlaceResult } from '../lib/placeSearch'
import '../lib/i18n'

const updateProfile = vi.fn()
const getProfilePrivate = vi.fn<() => Promise<ProfilePrivate | null>>()
const upsertProfilePrivate = vi.fn()
const trackClick = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    updateProfile: (...a: unknown[]) => updateProfile(...a),
    getProfilePrivate: () => getProfilePrivate(),
    upsertProfilePrivate: (...a: unknown[]) => upsertProfilePrivate(...a),
    trackClick: (...a: unknown[]) => trackClick(...a),
  },
  supabase: {},
}))

// Photon nie jest tu potrzebny: pole miejscowości dostaje atrapę, która na
// kliknięcie „pick” oddaje gotowy wynik, a na „clear” zgłasza pusty tekst.
vi.mock('../components/PlaceSearchInput', () => ({
  default: ({ onSelect, onQueryChange, initialQuery }: {
    onSelect: (r: PlaceResult) => void; onQueryChange?: (q: string) => void; initialQuery?: string
  }) => (
    <div>
      <span data-testid="home-query">{initialQuery}</span>
      <button onClick={() => onSelect({ id: '1', primary: 'Rzeszów', secondary: 'Podkarpackie, Polska', lat: 50.04, lng: 22.0 })}>pick</button>
      <button onClick={() => onQueryChange?.('')}>clear</button>
    </div>
  ),
}))

const session = { user: { id: 'u1', email: 'a@b.c' } } as unknown as Session

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u1', display_name: 'Kasia', nickname: 'Ala', name_shown: 'Ala',
    avatar_color: '#FF7A45', bio: null, home_name: null, creator_kind: null, link_url: null,
    radius_km: 10, interests: [], interests_onboarded_at: null,
    last_lat: null, last_lng: null, last_seen_at: null,
    created_at: '2026-09-01T00:00:00Z', push_enabled: false, language: 'en',
    ...over,
  }
}

function renderPanel(p: Profile = profile(), onSaved = vi.fn()) {
  render(<MyDataPanel open onClose={() => {}} session={session} profile={p} onSaved={onSaved} />)
  return onSaved
}

beforeEach(() => {
  vi.clearAllMocks()
  updateProfile.mockResolvedValue({ data: [{ id: 'u1' }], error: null })
  upsertProfilePrivate.mockResolvedValue({ data: [{ id: 'u1' }], error: null })
  getProfilePrivate.mockResolvedValue(null)
})

describe('MyDataPanel', () => {
  it('starts from the current name and colour', async () => {
    renderPanel()
    expect((await screen.findByLabelText('Name') as HTMLInputElement).value).toBe('Ala')
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows university and field only for a student', async () => {
    renderPanel()
    await screen.findByLabelText('Name')
    expect(screen.queryByLabelText('University')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Student'))
    expect(screen.getByLabelText('University')).toBeInTheDocument()
    expect(screen.getByLabelText('Field of study')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Working'))
    expect(screen.queryByLabelText('University')).not.toBeInTheDocument()
  })

  it('tapping a selected chip deselects it', async () => {
    renderPanel()
    await screen.findByLabelText('Name')
    const chip = screen.getByText('A venue')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('previews a colour on the avatar before saving', async () => {
    renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.click(screen.getByLabelText('colour #4FC3F7'))
    expect(screen.getByTestId('avatar-preview')).toHaveStyle({ background: '#4FC3F7' })
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('saves public fields to profiles and private ones to profiles_private', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ala  Nowa ' } })
    fireEvent.click(screen.getByLabelText('colour #4FC3F7'))
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: ' koncerty w piwnicy ' } })
    fireEvent.click(screen.getByText('pick'))
    fireEvent.click(screen.getByText('A venue'))
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'instagram.com/klub' } })
    fireEvent.change(screen.getByLabelText('Year of birth'), { target: { value: '1998' } })
    fireEvent.click(screen.getByText('Student'))
    fireEvent.change(screen.getByLabelText('University'), { target: { value: 'PRz' } })
    fireEvent.click(screen.getByText('A poster'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({
      id: 'u1', nickname: 'Ala Nowa', avatar_color: '#4FC3F7',
      bio: 'koncerty w piwnicy', home_name: 'Rzeszów, Podkarpackie, Polska',
      creator_kind: 'venue', link_url: 'https://instagram.com/klub',
    })
    expect(upsertProfilePrivate).toHaveBeenCalledWith({
      id: 'u1', birth_year: 1998, gender: null, residence_status: null, occupation: 'student',
      university: 'PRz', field_of_study: null, found_via: 'poster', home_lat: 50.04, home_lng: 22.0,
    })
    expect(trackClick).toHaveBeenCalledWith('profile_save')
  })

  it('an empty name means "use the provider name" - nickname null, no error', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ nickname: null }))
  })

  it('does not create a private row when nothing private was filled in', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'tylko bio' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(upsertProfilePrivate).not.toHaveBeenCalled()
  })

  it('clearing the town clears name and both coordinates', async () => {
    getProfilePrivate.mockResolvedValue({
      id: 'u1', birth_year: null, gender: null, residence_status: null, occupation: null,
      university: null, field_of_study: null, found_via: null, home_lat: 50.04, home_lng: 22.0,
      signup_ip_lat: null, signup_ip_lng: null, signup_country: null, signup_gps_lat: null, signup_gps_lng: null,
      signup_platform: null, signup_app_version: null, signup_provider: null, signup_source: null,
      signup_recorded_at: null, updated_at: '',
    })
    const onSaved = renderPanel(profile({ home_name: 'Rzeszów, Podkarpackie, Polska' }))
    expect(await screen.findByTestId('home-query')).toHaveTextContent('Rzeszów, Podkarpackie, Polska')
    fireEvent.click(screen.getByText('clear'))
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ home_name: null }))
    // Wiersz istnieje, więc upsert idzie mimo pustych pól - i zeruje współrzędne.
    expect(upsertProfilePrivate).toHaveBeenCalledWith(expect.objectContaining({ home_lat: null, home_lng: null }))
  })

  it('shows a field error and does not save', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'tylko tekst' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('That does not look like a web address')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('a rejected name keeps the panel open with the nickname message', async () => {
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('That name is too short')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('states a failed write and stays open', async () => {
    updateProfile.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const onSaved = renderPanel()
    await screen.findByLabelText('Name')
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('Could not save, please try again')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/screens/MyDataPanel.test.tsx`
Expected: FAIL - `Cannot find module './MyDataPanel'`

- [ ] **Step 3: Napisz komponent**

```tsx
// src/screens/MyDataPanel.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'
import {
  AVATAR_COLORS, BIO_MAX, LINK_URL_MAX, UNIVERSITY_MAX, FIELD_OF_STUDY_MAX,
  CREATOR_KINDS, GENDERS, RESIDENCE_STATUSES, OCCUPATIONS, FOUND_VIA,
  emptyProfileForm, validateProfileForm, homeNameFromPlace,
  type ProfileForm, type ProfileField, type ProfileFieldError,
} from '../lib/profileFields'
import { initial, avatarColor } from '../lib/profileDisplay'
import PlaceSearchInput from '../components/PlaceSearchInput'

// „Moje dane”: jedno miejsce na nazwę, kolor avatara i wszystko, co użytkownik
// zechce o sobie powiedzieć. Wsuwa się nad ProfilePanel i AccountPanel tą samą
// geometrią, warstwę wyżej, bo wchodzi się tu z obu.
//
// Żadne pole nie jest wymagane: puste = placeholder, nie ostrzeżenie. Chipy
// nie mają wartości domyślnej, a tap na wybrany odznacza. Zapis jest jeden, na
// dole - pól jest kilkanaście i człowiek chce raz przejrzeć, raz potwierdzić.

interface Props {
  open: boolean
  onClose: () => void
  session: Session | null
  profile: Profile | null
  onSaved: () => void
}

export default function MyDataPanel({ open, onClose, session, profile, onSaved }: Props) {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState('')
  const [color, setColor] = useState<string>(avatarColor(profile))
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm())
  // Czy wiersz w profiles_private już istnieje: wtedy zapis idzie zawsze, bo
  // wyczyszczenie pola też jest zmianą do zapisania.
  const [privateExists, setPrivateExists] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nickError, setNickError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ProfileFieldError[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  // Stan formularza odświeża się przy każdym otwarciu, nie przy montowaniu:
  // panel jest zamontowany na stałe, jak AccountPanel.
  useEffect(() => {
    if (!open || !session) return
    setNickname(profile?.nickname ?? '')
    setColor(avatarColor(profile))
    setNickError(null); setErrors([]); setSaveError(null)
    const base: ProfileForm = {
      ...emptyProfileForm(),
      bio: profile?.bio ?? '',
      creatorKind: profile?.creator_kind ?? null,
      linkUrl: profile?.link_url ?? '',
    }
    setForm(base)
    setPrivateExists(false)
    let cancelled = false
    db.getProfilePrivate(session.user.id).then(priv => {
      if (cancelled) return
      setPrivateExists(!!priv)
      setForm(f => ({
        ...f,
        home: profile?.home_name && priv?.home_lat != null && priv?.home_lng != null
          ? { name: profile.home_name, lat: priv.home_lat, lng: priv.home_lng }
          : profile?.home_name ? { name: profile.home_name, lat: NaN, lng: NaN } : null,
        birthYear: priv?.birth_year != null ? String(priv.birth_year) : '',
        gender: priv?.gender ?? null,
        residenceStatus: priv?.residence_status ?? null,
        occupation: priv?.occupation ?? null,
        university: priv?.university ?? '',
        fieldOfStudy: priv?.field_of_study ?? '',
        foundVia: priv?.found_via ?? null,
      }))
    })
    return () => { cancelled = true }
  }, [open, session, profile])

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors.length) setErrors(es => es.filter(e => e.field !== key))
  }
  const toggle = <K extends 'creatorKind' | 'gender' | 'residenceStatus' | 'occupation' | 'foundVia'>(key: K, value: ProfileForm[K]) =>
    set(key, (form[key] === value ? null : value) as ProfileForm[K])

  const errorFor = (field: ProfileField) => {
    const e = errors.find(x => x.field === field)
    return e ? t(`myData.error_${e.reason}`) : null
  }

  async function handleSave() {
    if (!session || busy) return
    // Pusta nazwa = „pokazuj tę od dostawcy”, nie błąd. Reszta jak w validateNickname.
    const nickCheck = nickname.trim() === '' ? { ok: true as const, value: null } : validateNickname(nickname)
    if (!nickCheck.ok) { setNickError(t(`account.nickname_${nickCheck.reason}`)); return }
    const check = validateProfileForm(form, new Date())
    if (!check.ok) { setErrors(check.errors); return }
    const v = check.value
    // Miejscowość bez współrzędnych (wiersz prywatny nie istniał, gdy ją zapisano)
    // zostaje nazwą; nie wymyślamy punktu.
    const homeCoords = v.home && Number.isFinite(v.home.lat) ? { lat: v.home.lat, lng: v.home.lng } : null

    setBusy(true); setSaveError(null); setNickError(null)
    const uid = session.user.id
    const pub = await db.updateProfile({
      id: uid, nickname: nickCheck.value, avatar_color: color,
      bio: v.bio, home_name: v.home?.name ?? null, creator_kind: v.creatorKind, link_url: v.linkUrl,
    })
    if (pub.error) {
      console.error('[myData] zapis profiles nieudany:', pub.error)
      setBusy(false); setSaveError(t('myData.saveFailed')); return
    }
    const priv = {
      birth_year: v.birthYear, gender: v.gender, residence_status: v.residenceStatus,
      occupation: v.occupation, university: v.university, field_of_study: v.fieldOfStudy,
      found_via: v.foundVia, home_lat: homeCoords?.lat ?? null, home_lng: homeCoords?.lng ?? null,
    }
    // Kto nic z „O Tobie” nie wypełnił, nie dostaje pustego wiersza.
    const worthWriting = privateExists || Object.values(priv).some(x => x !== null)
    if (worthWriting) {
      const res = await db.upsertProfilePrivate({ id: uid, ...priv })
      if (res.error) {
        console.error('[myData] zapis profiles_private nieudany:', res.error)
        setBusy(false); setSaveError(t('myData.saveFailed')); return
      }
    }
    db.trackClick('profile_save')
    setBusy(false)
    onSaved()
  }

  const initialLetter = initial({ name_shown: nickname.trim() || profile?.display_name, display_name: profile?.display_name }, session?.user.email)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 34,
          background: 'rgba(45,43,42,0.4)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0,
          width: '88%', maxWidth: 380,
          background: C.cream,
          borderTopRightRadius: 32, borderBottomRightRadius: 32,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 380ms cubic-bezier(0.32,1.4,0.4,1)',
          boxShadow: '8px 0 32px rgba(45,43,42,0.15)',
          zIndex: 35, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: 'calc(24px + env(safe-area-inset-top)) 24px 24px', overflowY: 'auto', flex: 1 }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              padding: 0, marginBottom: 20, color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900 }}>‹</span>
            {t('myData.back')}
          </button>

          <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink, marginBottom: 20 }}>
            {t('myData.title')}
          </div>

          {/* Avatar + paleta */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div
              data-testid="avatar-preview"
              style={{
                width: 96, height: 96, borderRadius: '50%', background: color,
                border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.display, fontWeight: 900, fontSize: 38, color: INK,
                animation: 'breathe-sm 4s ease-in-out infinite',
              }}
            >
              {initialLetter}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {AVATAR_COLORS.map(c => {
                const active = c === color
                return (
                  <button
                    key={c}
                    aria-label={`colour ${c}`}
                    aria-pressed={active}
                    onClick={() => setColor(c)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', background: c, padding: 0, cursor: 'pointer',
                      border: `${active ? 3 : 2.5}px solid ${INK}`,
                      boxShadow: active ? `0 4px 0 ${INK}33` : 'none',
                      transform: active ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Nazwa */}
          <Field id="md-name" label={t('myData.name')} hint={nickError ?? t('account.nicknameHint')} error={!!nickError}>
            <TextInput
              id="md-name" value={nickname} maxLength={NICKNAME_MAX} placeholder={t('myData.namePlaceholder')}
              error={!!nickError} disabled={busy}
              onChange={v => { setNickname(v); if (nickError) setNickError(null) }}
            />
          </Field>

          {/* O mnie */}
          <SectionTitle title={t('myData.aboutMe')} hint={t('myData.aboutMeHint')} />

          <Field id="md-bio" label={t('myData.bio')} hint={errorFor('bio') ?? `${form.bio.length}/${BIO_MAX}`} error={!!errorFor('bio')}>
            <textarea
              id="md-bio" value={form.bio} maxLength={BIO_MAX} rows={3} disabled={busy}
              placeholder={t('myData.bioPlaceholder')}
              onChange={e => set('bio', e.target.value)}
              style={{ ...inputStyle(!!errorFor('bio')), borderRadius: 20, resize: 'none', lineHeight: 1.4 }}
            />
          </Field>

          <Field id="md-home" label={t('myData.home')}>
            <PlaceSearchInput
              placeholder={t('myData.homePlaceholder')}
              near={null}
              settlementsOnly
              initialQuery={form.home?.name ?? ''}
              labelFor={homeNameFromPlace}
              onSelect={r => set('home', { name: homeNameFromPlace(r), lat: r.lat, lng: r.lng })}
              // Ręczna zmiana tekstu unieważnia wybór: wartość istnieje tylko po wyborze z listy.
              onQueryChange={() => set('home', null)}
              dropdownZIndex={36}
            />
          </Field>

          <ChipRow label={t('myData.creatorKind')} options={CREATOR_KINDS} value={form.creatorKind}
            labelOf={k => t(`myData.creatorKind_${k}`)} onToggle={k => toggle('creatorKind', k)} disabled={busy} />

          <Field id="md-link" label={t('myData.link')} hint={errorFor('linkUrl')} error={!!errorFor('linkUrl')}>
            <TextInput id="md-link" value={form.linkUrl} maxLength={LINK_URL_MAX} placeholder={t('myData.linkPlaceholder')}
              inputMode="url" error={!!errorFor('linkUrl')} disabled={busy} onChange={v => set('linkUrl', v)} />
          </Field>

          {/* O Tobie */}
          <SectionTitle title={t('myData.aboutYou')} hint={t('myData.aboutYouHint')} />

          <Field id="md-year" label={t('myData.birthYear')} hint={errorFor('birthYear')} error={!!errorFor('birthYear')}>
            <TextInput id="md-year" value={form.birthYear} maxLength={4} placeholder={t('myData.birthYearPlaceholder')}
              inputMode="numeric" error={!!errorFor('birthYear')} disabled={busy} onChange={v => set('birthYear', v)} />
          </Field>

          <ChipRow label={t('myData.gender')} options={GENDERS} value={form.gender}
            labelOf={g => t(`myData.gender_${g}`)} onToggle={g => toggle('gender', g)} disabled={busy} />

          <ChipRow label={t('myData.residence')} options={RESIDENCE_STATUSES} value={form.residenceStatus}
            labelOf={r => t(`myData.residence_${r}`)} onToggle={r => toggle('residenceStatus', r)} disabled={busy} />

          <ChipRow label={t('myData.occupation')} options={OCCUPATIONS} value={form.occupation}
            labelOf={o => t(`myData.occupation_${o}`)} onToggle={o => toggle('occupation', o)} disabled={busy} />

          {form.occupation === 'student' && (
            <div style={{ animation: 'fadeIn 180ms ease' }}>
              <Field id="md-uni" label={t('myData.university')} hint={errorFor('university')} error={!!errorFor('university')}>
                <TextInput id="md-uni" value={form.university} maxLength={UNIVERSITY_MAX} error={!!errorFor('university')}
                  disabled={busy} onChange={v => set('university', v)} />
              </Field>
              <Field id="md-field" label={t('myData.fieldOfStudy')} hint={errorFor('fieldOfStudy')} error={!!errorFor('fieldOfStudy')}>
                <TextInput id="md-field" value={form.fieldOfStudy} maxLength={FIELD_OF_STUDY_MAX} error={!!errorFor('fieldOfStudy')}
                  disabled={busy} onChange={v => set('fieldOfStudy', v)} />
              </Field>
            </div>
          )}

          <ChipRow label={t('myData.foundVia')} options={FOUND_VIA} value={form.foundVia}
            labelOf={f => t(`myData.foundVia_${f}`)} onToggle={f => toggle('foundVia', f)} disabled={busy} />
        </div>

        {/* Sticky dół */}
        <div style={{
          padding: '12px 24px calc(16px + env(safe-area-inset-bottom))',
          background: C.cream, borderTop: `1px solid ${INK}18`,
        }}>
          <div style={{ minHeight: 18, marginBottom: 6, fontSize: 12, fontWeight: 700, color: C.primaryPress, textAlign: 'center' }}>
            {saveError ?? ''}
          </div>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
              border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(232,90,42,0.28)',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? t('common.loading') : t('myData.save')}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              marginTop: 8, width: '100%', padding: '10px', background: 'none', border: 'none',
              color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Klocki w stylu NicknameModal / przełącznika języka ────────────────────────

function inputStyle(error: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '13px 16px', borderRadius: 999,
    border: `2.5px solid ${error ? C.primaryPress : INK}`,
    background: '#fff', color: C.ink,
    fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }
}

function TextInput({ id, value, onChange, maxLength, placeholder, inputMode, error, disabled }: {
  id: string; value: string; onChange: (v: string) => void; maxLength: number
  placeholder?: string; inputMode?: 'url' | 'numeric'; error: boolean; disabled: boolean
}) {
  return (
    <input
      id={id} value={value} maxLength={maxLength} placeholder={placeholder} inputMode={inputMode}
      autoComplete="off" disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={inputStyle(error)}
    />
  )
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string | null; error?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
        {label}
      </label>
      {children}
      <div style={{ minHeight: 18, marginTop: 6, fontSize: 12, fontWeight: 700, lineHeight: 1.4, color: error ? C.primaryPress : C.inkSoft }}>
        {hint ?? ''}
      </div>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>{title}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, fontWeight: 600 }}>{hint}</div>
    </div>
  )
}

function ChipRow<T extends string>({ label, options, value, labelOf, onToggle, disabled }: {
  label: string; options: readonly T[]; value: T | null
  labelOf: (v: T) => string; onToggle: (v: T) => void; disabled: boolean
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const active = value === opt
          return (
            <button
              key={opt}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onToggle(opt)}
              style={{
                padding: '8px 14px', borderRadius: 999, border: `2px solid ${INK}`,
                background: active ? C.primary : 'transparent',
                color: active ? '#fff' : C.ink,
                fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              {labelOf(opt)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/screens/MyDataPanel.test.tsx`
Expected: PASS. Jeśli `toHaveStyle({ background })` nie dopasuje (jsdom normalizuje kolory do `rgb(...)`), zmień asercję na `expect(screen.getByTestId('avatar-preview').style.background).toBe('rgb(79, 195, 247)')`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/MyDataPanel.tsx src/screens/MyDataPanel.test.tsx
git commit -m "Panel Moje dane: nazwa, kolor avatara, pola o mnie i o Tobie"
```

---

### Task 9: Wejścia do panelu i warstwa `myDataOpen`

**Files:**
- Modify: `src/screens/ProfilePanel.tsx` (props + avatar jako przycisk)
- Modify: `src/screens/AccountPanel.tsx` (pozycja „Moje dane”, bez modalu)
- Modify: `src/App.tsx` (stan, warstwa w history/popstate/back-button/overlays, render)
- Modify: `src/lib/overlays.ts` (flaga `myDataOpen`)
- Delete: `src/components/NicknameModal.tsx`
- Test: `src/screens/ProfilePanel.push.test.tsx` (z Task 3), `src/lib/overlays.test.ts` (jeśli istnieje - dopisz flagę)

**Interfaces:**
- Consumes: `MyDataPanel` (Task 8).
- Produces: `ProfilePanel` prop `onOpenMyData: () => void`; `AccountPanel` props `currentName: string`, `onOpenMyData: () => void` (znika `onNicknameSaved`); `OverlayFlags.myDataOpen: boolean`.

- [ ] **Step 1: `overlays.ts`**

W `OverlayFlags` po `accountOpen` dodaj `myDataOpen: boolean`, a w `isScreenClear` linię `&& !f.myDataOpen` po `!f.accountOpen`. Jeśli istnieje `src/lib/overlays.test.ts`, dopisz `myDataOpen: false` do każdego obiektu flag w nim (inaczej `tsc` się wywali).

- [ ] **Step 2: `ProfilePanel.tsx`**

Do propsów dodaj `onOpenMyData: () => void` (wymagany). Blok avatara + nazwy (od `{/* Avatar circle */}` do e-maila włącznie) opakuj w przycisk:

```tsx
          <button
            onClick={session ? onOpenMyData : undefined}
            aria-label={t('myData.title')}
            disabled={!session}
            style={{
              display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0,
              cursor: session ? 'pointer' : 'default', width: '100%',
            }}
          >
            {/* Avatar circle */}
            <div style={{ /* … bez zmian, tylko background: avatarColor(profile) … */ }}>
              {initials}
            </div>
            {/* Name */}
            <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: C.ink }}>
              {displayName}
            </div>
            {session && (
              <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
                {session.user.email}
              </div>
            )}
          </button>
```

- [ ] **Step 3: `AccountPanel.tsx`**

Usuń import `NicknameModal`, stan `nicknameOpen` i blok `{nicknameOpen && <NicknameModal …/>}`. Props: zamień `onNicknameSaved: () => void` na `onOpenMyData: () => void` (komentarz przy `currentName` zostaje). Przycisk „Nazwa użytkownika” zmień na:

```tsx
          <button
            onClick={onOpenMyData}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              textAlign: 'left', padding: '12px 0', background: 'none', border: 'none',
              fontSize: 14, fontWeight: 700, color: C.ink, cursor: 'pointer',
            }}
          >
            {t('account.myData')}
            <span style={{ fontSize: 20, fontWeight: 900 }}>›</span>
          </button>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
            {currentName}
          </div>
```

- [ ] **Step 4: Usuń modal**

```bash
git rm src/components/NicknameModal.tsx
```

Run: `grep -rn "NicknameModal" src` → Expected: brak trafień.

- [ ] **Step 5: `App.tsx`**

Import: `import MyDataPanel from './screens/MyDataPanel'` obok `AccountPanel`.

Stan (po linii 81): `const [myDataOpen, setMyDataOpen] = useState(false)`.

`navLayersRef` - w obu miejscach (inicjalizacja ~222 i efekt ~262) dopisz `myDataOpen,` po `accountOpen,`; do zależności efektu (~271) dopisz `myDataOpen`.

`overlayRef.current` (~247) - dopisz `myDataOpen,` po `accountOpen,`.

`onPopState` (~286) - **przed** linią `if (s.accountOpen)` wstaw: `if (s.myDataOpen) { setMyDataOpen(false); return }`.

Warunek `busy` w kroku zainteresowań (~494): dopisz `|| layers.myDataOpen` po `layers.accountOpen`.

Android `backButton` (~670): dopisz `s.myDataOpen ||` obok `s.accountOpen ||`.

`handleAccountDeleted` (~958) i `handleSignOut` (znajdź: `grep -n "function handleSignOut" src/App.tsx`; jeśli zeruje `accountOpen`/`profileOpen`, dopisz obok): `setMyDataOpen(false)`.

`ProfilePanel` (~1195) - nowy prop:

```tsx
        onOpenMyData={() => {
          setMyDataOpen(true)
          window.history.pushState({ layer: 'myData' }, '')
        }}
```

`AccountPanel` (~1230) - zamień `onNicknameSaved={…}` na:

```tsx
        onOpenMyData={() => {
          setMyDataOpen(true)
          window.history.pushState({ layer: 'myData' }, '')
        }}
```

Bezpośrednio po `</AccountPanel …/>` (przed `{locationModalOpen && …}`):

```tsx
      <MyDataPanel
        open={myDataOpen && !isOverlay}
        onClose={() => window.history.back()}
        session={session}
        profile={profile}
        onSaved={() => { reloadProfile(); showToast(t('myData.saved')); window.history.back() }}
      />
```

- [ ] **Step 6: Typy, lint, testy**

Run: `npx tsc -b && npm run lint && npx vitest run`
Expected: wszystko przechodzi, w tym `ProfilePanel.push.test.tsx` z przypadkiem z Task 3 i `MyDataPanel.test.tsx`.

- [ ] **Step 7: Sprawdź ręcznie na dev serwerze**

`npm run dev:staging` (staging ma już migrację - patrz Task 12, Step 1; bez niej `getProfile` padnie na nieznanej kolumnie). Zaloguj się:
1. Menu → tap na avatar → otwiera się „Moje dane”. Wstecz wraca do menu.
2. Menu → „Konto i dane” → „Moje dane” → to samo miejsce. Wstecz wraca do „Konto i dane”.
3. Zmień kolor i nazwę, Zapisz → toast „Zapisano”, avatar w menu **i na mapie** ma nowy kolor i nową literę.
4. Gość: avatar w menu nie reaguje.
5. Android/przeglądarka mobilna: gest wstecz zamyka panel, nie aplikację.

- [ ] **Step 8: Commit**

```bash
git add -A src/App.tsx src/screens/ProfilePanel.tsx src/screens/AccountPanel.tsx src/lib/overlays.ts src/lib/overlays.test.ts src/components/NicknameModal.tsx
git commit -m "Moje dane dostępne z avatara i z Konta i danych; modal nazwy znika"
```

---

### Task 10: Zapis kontekstu rejestracji w `App.tsx`

**Files:**
- Modify: `src/App.tsx` (nowe refy, efekty, `appUrlOpen`)

**Interfaces:**
- Consumes: `shouldRecordSignup`, `buildSignupContext`, `gpsOnlyContext` (Task 5); `db.getProfilePrivate`, `db.recordSignupContext` (Task 6); `getIpLocation` z `geo.ts`; `isIOS`, `isAndroid`, `isNativePlatform` z `platform.ts`; `CapApp` (już importowane).

- [ ] **Step 1: Importy**

```ts
import { shouldRecordSignup, buildSignupContext, gpsOnlyContext } from './lib/signupContext'
```

`isIOS` dopisz do istniejącego importu z `./lib/platform` (jest tam `isNativePlatform, isAndroid`).

- [ ] **Step 2: Refy**

Obok `deepLinkIdRef` (~111):

```ts
  // Adres startowy, złapany przed tym, jak efekt montujący wyczyści ?event= z
  // URL-a. Natywnie boot ma capacitor://localhost; prawdziwy deep link przychodzi
  // przez appUrlOpen i nadpisuje to, dopóki kontekst rejestracji nie jest zapisany.
  const startUrlRef = useRef<string>(window.location.href)
  // 'unknown' → sprawdzamy; 'skip' → nie rejestracja; 'awaiting_gps' → zapisano
  // bez GPS, czekamy na pozycję; 'done' → koniec. W refie, nie w state: to nie
  // ma prawa niczego przerenderować.
  const signupRef = useRef<'unknown' | 'skip' | 'awaiting_gps' | 'done'>('unknown')
```

- [ ] **Step 3: `appUrlOpen` łapie źródło**

W handlerze `CapApp.addListener('appUrlOpen', ({ url }) => {` (~602), jako pierwszą linię ciała:

```ts
      if (signupRef.current === 'unknown') startUrlRef.current = url
```

- [ ] **Step 4: Efekt „zapisz kontekst rejestracji”**

Po efekcie z `getIpLocation` (~706) dodaj:

```tsx
  // Kontekst rejestracji: skąd, na czym i którędy powstało konto. Raz na konto,
  // tylko dla kont młodszych niż doba (shouldRecordSignup) - starsze zostają z
  // nullem zamiast dostać „rejestrację” w dniu wdrożenia. GPS dopisuje się
  // drugim wywołaniem, gdy pozycja pojawi się w tej samej sesji.
  useEffect(() => {
    if (!session || !profile || signupRef.current !== 'unknown') return
    let cancelled = false
    ;(async () => {
      const priv = await db.getProfilePrivate(session.user.id)
      if (cancelled) return
      if (!shouldRecordSignup({ profileCreatedAt: profile.created_at, alreadyRecorded: !!priv?.signup_recorded_at, now: Date.now() })) {
        signupRef.current = 'skip'
        return
      }
      let appVersion: string | null = null
      if (isNativePlatform()) {
        try { appVersion = (await CapApp.getInfo()).version } catch (err) { console.error('[signup] getInfo:', err) }
      }
      const ipGeo = await getIpLocation()
      if (cancelled) return
      const ctx = buildSignupContext({
        ipGeo, gps: userPosRef.current,
        platform: isIOS() ? 'ios' : isAndroid() ? 'android' : 'web',
        appVersion, provider: session.user.app_metadata?.provider, startUrl: startUrlRef.current,
      })
      const { error } = await db.recordSignupContext(ctx)
      if (error) { console.error('[signup] record_signup_context:', error); return }
      signupRef.current = ctx.gpsLat != null ? 'done' : 'awaiting_gps'
    })()
    return () => { cancelled = true }
  }, [session, profile])

  useEffect(() => {
    if (!session || !userPos || signupRef.current !== 'awaiting_gps') return
    signupRef.current = 'done'
    db.recordSignupContext(gpsOnlyContext(userPos)).then(({ error }) => {
      if (error) console.error('[signup] gps follow-up:', error)
    })
  }, [session, userPos])
```

Sprawdź, że `userPosRef` (linia ~140) jest aktualizowany przy każdym `setUserPos` - jest, bo istnieje po to samo dla zapisu lokalizacji (`grep -n "userPosRef.current =" src/App.tsx` musi coś zwrócić; jeśli nie, dopisz `userPosRef.current = pos` w `onPos` obok `setUserPos(pos)`).

- [ ] **Step 5: Typy i testy**

Run: `npx tsc -b && npx vitest run src/lib/signupContext.test.ts`
Expected: PASS

- [ ] **Step 6: Sprawdź na staging**

Nowe konto (albo usuń konto testowe i zaloguj ponownie): po wejściu na mapę w Supabase Dashboard → Table Editor → `profiles_private` pojawia się wiersz z `signup_platform`, `signup_provider`, `signup_source`, `signup_ip_*`, `signup_recorded_at`. Po zgodzie na lokalizację dochodzą `signup_gps_*`, a reszta zostaje bez zmian. Konto sprzed wdrożenia: brak wiersza.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Zapis kontekstu rejestracji: IP, GPS, platforma, wersja, provider, źródło"
```

---

### Task 11: Polityka prywatności i wymogi compliance

**Files:**
- Modify: `docs/legal/privacy-policy.md` (tabele w PL, EN, DE, ES)
- Modify: `docs/legal/compliance-requirements.md` (tabela w sekcji 1)

- [ ] **Step 1: `privacy-policy.md`**

W każdej z czterech tabel „Dane / Cel / Podstawa prawna” zamień wiersz o pseudonimie i kolorze oraz dopisz dwa wiersze po nim.

PL:

```
| Pseudonim, kolor avatara (wybrany przez Ciebie) | Wyświetlanie w aplikacji | Zgoda |
| Opcjonalne pola profilu: opis, miejscowość, rodzaj konta, link | Wyświetlanie w aplikacji | Zgoda |
| Opcjonalne dane o Tobie: rok urodzenia, płeć, status zamieszkania, zajęcie, uczelnia, kierunek, skąd znasz aplikację | Personalizacja i analiza korzystania z aplikacji; widoczne tylko dla Ciebie | Zgoda |
| Kontekst rejestracji: przybliżona lokalizacja z adresu IP, pozycja GPS (jeśli wyraziłeś zgodę), platforma, wersja aplikacji, dostawca logowania, źródło wejścia | Analiza korzystania z aplikacji | Uzasadniony interes (art. 6 ust. 1 lit. f RODO) |
```

EN:

```
| Nickname, avatar colour (chosen by you) | Display in the app | Consent |
| Optional profile fields: bio, town, account type, link | Display in the app | Consent |
| Optional details about you: year of birth, gender, residence status, occupation, university, field of study, how you found the app | Personalisation and usage analysis; visible only to you | Consent |
| Sign-up context: approximate location from IP address, GPS position (if you allowed it), platform, app version, sign-in provider, entry source | Usage analysis | Legitimate interest (Art. 6(1)(f) GDPR) |
```

DE:

```
| Nickname, Avatarfarbe (von dir gewählt) | Anzeige in der App | Einwilligung |
| Optionale Profilfelder: Bio, Ort, Kontotyp, Link | Anzeige in der App | Einwilligung |
| Optionale Angaben über dich: Geburtsjahr, Geschlecht, Wohnstatus, Beschäftigung, Hochschule, Studiengang, wie du die App gefunden hast | Personalisierung und Nutzungsanalyse; nur für dich sichtbar | Einwilligung |
| Registrierungskontext: ungefährer Standort aus der IP-Adresse, GPS-Position (falls erlaubt), Plattform, App-Version, Anmeldeanbieter, Einstiegsquelle | Nutzungsanalyse | Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) |
```

ES:

```
| Apodo, color del avatar (elegido por ti) | Mostrar en la aplicación | Consentimiento |
| Campos opcionales del perfil: bio, localidad, tipo de cuenta, enlace | Mostrar en la aplicación | Consentimiento |
| Datos opcionales sobre ti: año de nacimiento, género, situación de residencia, ocupación, universidad, carrera, cómo conociste la app | Personalización y análisis de uso; visibles solo para ti | Consentimiento |
| Contexto de registro: ubicación aproximada por dirección IP, posición GPS (si la autorizaste), plataforma, versión de la app, proveedor de inicio de sesión, origen de entrada | Análisis de uso | Interés legítimo (art. 6.1.f RGPD) |
```

Podbij `**Wersja:**` / `**Version:**` na `1.1` i datę na `2026-09-02` w każdej wersji językowej.

- [ ] **Step 2: `compliance-requirements.md`**

W tabeli sekcji 1 zamień wiersz „Kolor avatara | Generowany losowo” na „Kolor avatara | Użytkownik wybiera z palety” i dopisz:

```
| Pola profilu (`bio`, `home_name`, `creator_kind`, `link_url`) | Użytkownik podaje opcjonalnie | `profiles` | Wyświetlanie w UI, karta twórcy |
| Dane o użytkowniku (`birth_year`, `gender`, `residence_status`, `occupation`, `university`, `field_of_study`, `found_via`) | Użytkownik podaje opcjonalnie | `profiles_private` (RLS: tylko właściciel) | Personalizacja, analiza. **Do badań naukowych dopiero po dodaniu osobnej zgody** (`research_consent_at`, art. 6 ust. 1 lit. a z art. 89 RODO) |
| Współrzędne miejscowości (`home_lat/lng`) | Pochodna wyboru miejscowości | `profiles_private` | Ranking twórców per widok mapy, analiza |
| Kontekst rejestracji (`signup_*`) | Aplikacja zapisuje raz | `profiles_private` | Analiza korzystania |
```

- [ ] **Step 3: Commit**

```bash
git add docs/legal/privacy-policy.md docs/legal/compliance-requirements.md
git commit -m "Polityka prywatności i compliance: pola profilu i kontekst rejestracji"
```

---

### Task 12: Weryfikacja końcowa i notatka wdrożeniowa

**Files:**
- Modify: `docs/superpowers/plans/2026-09-02-user-profile.md` (sekcja „Co wyszło inaczej”, jeśli coś)

- [ ] **Step 1: Migracja na staging**

Jeśli jeszcze nie zrobione w Task 9: Supabase Dashboard (projekt staging) → SQL Editor → wklej `supabase/migrations/20260902_profile_fields.sql` → Run. Sprawdź w Table Editor, że `profiles` ma 4 nowe kolumny i istnieje `profiles_private`.

- [ ] **Step 2: Pełna weryfikacja**

Run: `npx tsc -b && npm run lint && npx vitest run && npm run build`
Expected: wszystko zielone. `npm run build` musi przejść, bo Cloudflare buduje tym samym poleceniem.

- [ ] **Step 3: Przejście ręczne na staging (web + jedna platforma natywna)**

Lista z Task 9 Step 7 i Task 10 Step 6, plus:
- Wyszukiwarka na mapie działa jak wcześniej.
- Pole „Miejscowość”: „puerto” → lista tylko miejscowości (bez ulic), wybór → nazwa w polu; po ponownym otwarciu panelu nazwa jest, `×` czyści; zapis → `profiles.home_name` i `profiles_private.home_lat/lng`.
- Chip „Studiuję” pokazuje uczelnię i kierunek; przełączenie na „Pracuję” chowa je, a po zapisie w bazie są `null`.
- Błędny link → komunikat pod polem, nic nie zapisane.

- [ ] **Step 4: Odnotuj rozjazdy**

Jeśli przy wykonaniu coś poszło inaczej niż w planie (jak w commitach `5537043`, `993c5f4`), dopisz na końcu tego pliku sekcję `## Co wyszło inaczej` z listą. Znane z góry: test regresji buga #7 jest na `ProfilePanel` i na czystej funkcji, nie na `MapScreen` (Leaflet w jsdom nie jest tego wart) - spec mówił o `MapScreen`.

- [ ] **Step 5: Commit i wdrożenie**

```bash
git add docs/superpowers/plans/2026-09-02-user-profile.md
git commit -m "Odnotuj w planie, co przy wykonaniu wyszło inaczej"
```

Kolejność: PR `user_profile` → `staging` (Cloudflare buduje staging) → test → migracja na PROD → merge do `main`. Migracja **zawsze** przed klientem.

## Co wyszło inaczej

- Test regresji buga #7 jest na `ProfilePanel` (`ProfilePanel.push.test.tsx`, describe `ProfilePanel identity`) i na czystej funkcji `initial()`, nie na `MapScreen` — Leaflet w jsdom nie jest tego wart.
- Task 3 dodał ten test bez propa `onOpenMyData`; prop dopisał dopiero Task 9 — dzięki temu `tsc -b` był zielony po każdym zadaniu, zamiast czerwony między Task 3 a 9.
- Task 7 zostawił sześć starych kluczy `account.nickname*`; usunął je Task 9 razem z `NicknameModal` (i przeniósł tam asercję, że `nicknameTitle` jest undefined, w teście parytetu) — z tego samego powodu co wyżej.
- `profileFields.normalizeUrl` odrzuca dodatkowo userinfo (`user@host`) i schematy inne niż http(s) (`mailto:`, `ftp:`) — recenzja znalazła, że wersja z planu przepuszczała `facebook.com@phishing-site.co`.
- `PlaceSearchInput` liczy stan z propsa `initialQuery` w renderze (`prevInitialQuery`), nie w `useEffect` — wymóg lintu `react-hooks/set-state-in-effect`. Dodatkowo input ma `minWidth: 0`, a `×` ma `aria-label="clear"` (nie było w starym `SearchBar`).
- `MyDataPanel`: tekst startowy pola miejscowości trzyma osobny stan `homeInitial` ustawiany tylko przy otwarciu panelu (wersja z planu gubiła pierwszy znak przy nadpisywaniu wybranej miejscowości), a efekt resetujący formularz zależy od `[open, session]` i czyta profil przez `profileRef` (wersja z planu kasowała edycję przy każdym `reloadProfile`). Efekt ma `eslint-disable`, jak pięć innych miejsc w kodzie.
- Task 9 musiał też poprawić `src/dev/pushPreview.tsx` (importował usunięty `NicknameModal`) i trzeci render `ProfilePanel` w teście.
- Fallback koloru avatara gościa zmienił się z `C.berry` na `DEFAULT_AVATAR_COLOR` (`C.primary`) — jeden domyślny kolor zamiast dwóch; dotyczy tylko avatara „?” bez sesji.
- Kroki wymagające Supabase Dashboard i przeglądarki (migracja na staging, przejście ręczne, sprawdzenie `profiles_private` po rejestracji) NIE zostały wykonane w tej sesji — zostają dla właściciela przed merge.
- Źródło wejścia jest zapamiętywane w `sessionStorage` (`meuwe_entry_src`) przy pierwszym renderze i przy `appUrlOpen`, bo przekierowanie OAuth wraca gołym adresem i wersja z planu zapisywałaby `direct` każdemu.
- `MyDataPanel`: efekt resetu zależy od `[open, uid]`, nie od obiektu `session` (odświeżenie tokena tworzy nowy obiekt); `PlaceSearchInput` dostaje `key` zmieniany przy każdym otwarciu, żeby porzucony tekst nie wracał.
- Miejscowość zapisana przed istnieniem wiersza `profiles_private` może mieć nazwę bez współrzędnych — spec mówił „nigdy jedno bez drugiego”; nazwę zostawiamy, punktu nie wymyślamy.
- Toast po zapisie używa `myData.saved`, nie `account.profileSaved` z specu.
- `upsertProfilePrivate` ustawia `updated_at` przy każdym zapisie.
