-- Obserwowanie twórców: kto obserwuje użytkownika, obserwuje automatycznie
-- jego publiczne wydarzenia - bieżące od razu, każde nowe w chwili dodania.
-- Spec: docs/superpowers/specs/2026-09-03-user-card-follow-design.md
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).
-- Idempotentna: można puścić drugi raz bez szkody.

-- ── 1. Tabela ────────────────────────────────────────────────────────────────
create table if not exists public.user_follows (
  follower_id uuid not null references auth.users on delete cascade,
  creator_id  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint user_follows_not_self check (follower_id <> creator_id)
);

-- Fan-out przy nowym wydarzeniu i licznik obserwujących idą po creator_id.
create index if not exists user_follows_creator_idx on public.user_follows (creator_id);

alter table public.user_follows enable row level security;

drop policy if exists "user_follows_own" on public.user_follows;
create policy "user_follows_own" on public.user_follows
  for all to authenticated
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

revoke all on public.user_follows from anon;
grant select, insert, delete on public.user_follows to authenticated;

-- ── 2. Nowy obserwujący → bieżące publiczne wydarzenia twórcy ────────────────
-- security definer: event_follows ma RLS "tylko własne wiersze", a events chowa
-- prywatne - trigger ma wstawiać w imieniu obserwującego, ale widzieć tylko
-- publiczne wydarzenia, więc filtr is_private jest tu jawny.
--
-- end_time >= now() celowo bez okresu łaski "extended": kto zaobserwował
-- twórcę po formalnym końcu imprezy, nie potrzebuje powiadomienia o niej.
create or replace function public.follow_creator_current_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into event_follows (user_id, event_id)
  select new.follower_id, e.id
  from events e
  where e.creator_id = new.creator_id
    and not e.is_private
    and e.status <> 'ended'
    and e.end_time >= now()
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists user_follows_follow_current on public.user_follows;
create trigger user_follows_follow_current
  after insert on public.user_follows
  for each row execute function public.follow_creator_current_events();

-- ── 3. Nowe publiczne wydarzenie → obserwujący twórcy ────────────────────────
-- Także przy odsłonięciu wydarzenia prywatnego (update is_private → false):
-- obserwujący dochodzą wtedy tak, jakby wydarzenia powstało w tej chwili.
-- W drugą stronę nic nie kasujemy - twórca sam decyduje, kogo zostawić.
--
-- Działa w tej samej transakcji co insert, więc webhook push-new-event widzi
-- już obserwujących w event_follows.
create or replace function public.follow_new_event_for_creator_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_private or new.creator_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and not old.is_private then
    return new;
  end if;
  insert into event_follows (user_id, event_id)
  select uf.follower_id, new.id
  from user_follows uf
  where uf.creator_id = new.creator_id
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists events_follow_for_creator_followers on public.events;
create trigger events_follow_for_creator_followers
  after insert or update of is_private on public.events
  for each row execute function public.follow_new_event_for_creator_followers();

-- ── 4. Profil publiczny z licznikami ─────────────────────────────────────────
-- security definer, bo liczniki liczone "od dołu" byłyby fałszywe: RLS na
-- event_follows i user_follows pokazuje tylko własne wiersze, a events chowa
-- prywatne. Funkcja oddaje wyłącznie kolumny i tak publiczne plus dwie liczby.
-- display_name = name_shown: ten sam alias, co PROFILE_PUBLIC w kliencie.
create or replace function public.get_public_profile(p_user_id uuid)
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
  is_following    boolean
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
      where uf.creator_id = p.id and uf.follower_id = auth.uid())
  from profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- ── 5. Usuwanie konta ────────────────────────────────────────────────────────
-- Kaskada z auth.users zrobiłaby to sama, ale archive_and_anonymize_user
-- (20260728) wymienia każdą tabelę z osobna - nowa nie może być wyjątkiem.
-- Treść jak w 20260728 plus jeden delete; sygnatura bez zmian.
create or replace function public.archive_and_anonymize_user(
  p_user         uuid,
  p_email        text,
  p_provider     text,
  p_provider_uid text,
  p_signed_up_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    raise exception 'p_user is required';
  end if;

  if exists (select 1 from deleted_accounts where user_id = p_user) then
    return;
  end if;

  insert into deleted_accounts (user_id, email, provider, provider_uid, signed_up_at)
  values (p_user, p_email, p_provider, p_provider_uid, p_signed_up_at);

  insert into deleted_account_content (user_id, kind, content_id, event_id, title, body, created_at)
  select p_user, 'event', e.id, e.id, e.title,
         concat_ws(E'\n', e.description, e.place_name), e.created_at
  from events e
  where e.creator_id = p_user;

  insert into deleted_account_content (user_id, kind, content_id, event_id, title, body, created_at)
  select p_user, 'message', m.id, m.event_id, null, m.text, m.created_at
  from event_messages m
  where m.author_id = p_user;

  update event_messages
     set author_id = null, author_name = null
   where author_id = p_user;

  delete from user_tags          where user_id = p_user;
  delete from event_follows      where user_id = p_user;
  delete from user_follows       where follower_id = p_user or creator_id = p_user;
  delete from notification_mutes where user_id = p_user;
  delete from event_reads        where user_id = p_user;
  delete from push_devices       where user_id = p_user;
  delete from push_subscriptions where user_id = p_user;

  delete from profiles where id = p_user;
end $$;

revoke all on function public.archive_and_anonymize_user(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.archive_and_anonymize_user(uuid, text, text, text, timestamptz)
  to service_role;
