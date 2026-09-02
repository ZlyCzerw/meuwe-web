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

-- ── 3. Kontekst rejestracji: „wypełnij tylko puste" ──────────────────────────
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
