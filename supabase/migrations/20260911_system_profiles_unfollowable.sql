-- Konto systemowe (meuwe team - właściciel wydarzeń ze scrapera event-sync)
-- nie może być obserwowane. Zaobserwowanie go odpalałoby trigger
-- user_follows_follow_current, który wpisałby obserwację wszystkich jego
-- bieżących wydarzeń (tysiące wierszy), a każde kolejne zsynchronizowane
-- wydarzenie dokładałoby event_follows i push "nowe wydarzenie".
--
-- Flaga w kolumnie, nie UUID w kodzie: staging ma inne konto systemowe
-- (f4a8ba97-4e27-41f1-8746-ad0bb506f375) niż produkcja
-- (b864b6bf-4282-4644-ab8f-b17b661b7841, "meuwe team").
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).
-- Idempotentna: można puścić drugi raz bez szkody.

-- ── 1. profiles.is_system ────────────────────────────────────────────────────
-- Bez grantu SELECT dla anon/authenticated: klient czyta flagę tylko przez
-- get_public_profile (security definer). Żadne zapytanie w kliencie nie robi
-- select('*') na profiles, więc brak grantu niczego nie wywraca.
alter table public.profiles
  add column if not exists is_system boolean not null default false;

-- authenticated ma tabelaryczny UPDATE na profiles (20260707), więc bez tej
-- bramki każdy mógłby oflagować własne konto jako systemowe. Zmienia tylko
-- właściciel bazy / service_role (np. z SQL Editora).
create or replace function public.profiles_guard_is_system()
returns trigger
language plpgsql
as $$
begin
  if new.is_system is distinct from old.is_system
     and current_user in ('anon', 'authenticated') then
    raise exception 'is_system can only be changed by the service role'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_is_system on public.profiles;
create trigger profiles_guard_is_system
  before update of is_system on public.profiles
  for each row execute function public.profiles_guard_is_system();

-- ── 2. Blokada obserwacji ────────────────────────────────────────────────────
-- before insert, więc trigger user_follows_follow_current (after insert)
-- nigdy nie dostaje takiego wiersza. security definer, bo profiles ma RLS,
-- a decyzja musi zapaść niezależnie od tego, co widzi obserwujący.
create or replace function public.reject_follow_of_system_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles p where p.id = new.creator_id and p.is_system) then
    raise exception 'system profiles cannot be followed'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists user_follows_reject_system on public.user_follows;
create trigger user_follows_reject_system
  before insert on public.user_follows
  for each row execute function public.reject_follow_of_system_profile();

-- ── 3. get_public_profile zwraca is_system ───────────────────────────────────
-- Zmiana listy kolumn wyniku wymaga drop: create or replace nie zmienia typu
-- zwrotu. Reszta jak w 20260903_user_follows.
drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_user_id uuid)
returns table (
  id              uuid,
  display_name    text,
  avatar_color    text,
  bio             text,
  home_name       text,
  creator_kind    text,
  link_url        text,
  events_count    integer,
  followers_count integer,
  is_following    boolean,
  is_system       boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.name_shown,
    p.avatar_color,
    p.bio,
    p.home_name,
    p.creator_kind,
    p.link_url,
    (select count(*)::integer from events e
      where e.creator_id = p.id and not e.is_private),
    (select count(*)::integer from user_follows uf
      where uf.creator_id = p.id),
    exists (select 1 from user_follows uf
      where uf.creator_id = p.id and uf.follower_id = auth.uid()),
    p.is_system
  from profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- ── 4. Oflagowanie kont i sprzątanie ─────────────────────────────────────────
-- Produkcja: meuwe team. Na stagingu ten update nie trafia w żaden wiersz -
-- tam po migracji puść ręcznie:
--   update public.profiles set is_system = true
--    where id = 'f4a8ba97-4e27-41f1-8746-ad0bb506f375';
--   delete from public.user_follows
--    where creator_id in (select id from public.profiles where is_system);
update public.profiles
   set is_system = true
 where id = 'b864b6bf-4282-4644-ab8f-b17b661b7841';

-- Dotychczasowi obserwujący kont systemowych: wiersz znika, licznik na karcie
-- spada do zera. Wpisów w event_follows zrobionych wtedy przez trigger nie
-- ruszamy - nie da się ich odróżnić od ręcznych obserwacji wydarzeń.
delete from public.user_follows
 where creator_id in (select id from public.profiles where is_system);
