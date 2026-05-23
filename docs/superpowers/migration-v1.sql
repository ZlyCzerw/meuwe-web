-- meuwe-web v1 schema migration — run in Supabase SQL Editor.
-- profiles already matches (id, display_name, avatar_color, radius_km, interests, created_at) — untouched.
-- The existing handle_new_user trigger (inserts display_name) is compatible — untouched.
-- This recreates the event tables to the canonical v1 schema.

create extension if not exists "uuid-ossp";

drop table if exists public.event_messages cascade;
drop table if exists public.event_tags cascade;
drop table if exists public.events cascade;

create table public.events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  place_name text,
  category text default 'party',
  start_time timestamptz default now(),
  end_time timestamptz default (now() + interval '24 hours'),
  creator_id uuid references public.profiles(id) on delete cascade,
  status text default 'live',
  created_at timestamptz default now()
);

create table public.event_tags (
  event_id uuid references public.events(id) on delete cascade,
  tag text not null,
  primary key (event_id, tag)
);

create table public.event_messages (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  author_id uuid references public.profiles(id),
  author_name text,
  author_color text default '#4FC3F7',
  text text not null,
  created_at timestamptz default now()
);

alter table public.events enable row level security;
alter table public.event_tags enable row level security;
alter table public.event_messages enable row level security;

create policy "events_select" on public.events for select using (true);
create policy "events_insert" on public.events for insert with check (auth.uid()=creator_id);
create policy "events_update" on public.events for update using (auth.uid()=creator_id);
create policy "tags_select" on public.event_tags for select using (true);
create policy "tags_insert" on public.event_tags for insert with check (
  exists (select 1 from public.events where id=event_id and creator_id=auth.uid()));
create policy "messages_select" on public.event_messages for select using (true);
create policy "messages_insert" on public.event_messages for insert with check (auth.uid()=author_id);

-- enable realtime
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_messages;
