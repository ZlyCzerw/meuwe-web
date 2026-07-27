-- Per-user custom tag history.
--
-- Problem: the tag picker suggested EVERY custom tag ever used by ANYONE
-- (db.getTags read all of event_tags). A user should only be suggested the
-- custom tags they have personally used at least once.
--
-- Model: the global `tags` table (20260527_tags_table.sql) stays as the
-- deduplicated catalogue (one row per unique tag). `user_tags` records which
-- user has used which tag and, via RLS, is the per-user visibility gate.

create table if not exists public.user_tags (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  tag        text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);

alter table public.user_tags enable row level security;

-- A user can read ONLY their own tags — this is what hides other users' tags.
drop policy if exists "user_tags_select" on public.user_tags;
create policy "user_tags_select" on public.user_tags
  for select using (auth.uid() = user_id);

-- A user can add tags only for themselves.
drop policy if exists "user_tags_insert" on public.user_tags;
create policy "user_tags_insert" on public.user_tags
  for insert to authenticated with check (auth.uid() = user_id);

-- A user can remove their own tags.
drop policy if exists "user_tags_delete" on public.user_tags;
create policy "user_tags_delete" on public.user_tags
  for delete using (auth.uid() = user_id);

-- Backfill so existing users keep the custom tags they already used:
--   (a) tags on events they created,
insert into public.user_tags (user_id, tag)
  select e.creator_id, et.tag
  from public.event_tags et
  join public.events e on e.id = et.event_id
  where e.creator_id is not null
on conflict do nothing;

--   (b) tags in their profile interests.
insert into public.user_tags (user_id, tag)
  select p.id, t.tag
  from public.profiles p
  cross join lateral unnest(coalesce(p.interests, '{}'::text[])) as t(tag)
on conflict do nothing;

-- Keep the global dedup catalogue populated from what users have actually used.
insert into public.tags (name)
  select distinct tag from public.user_tags
on conflict (name) do nothing;
