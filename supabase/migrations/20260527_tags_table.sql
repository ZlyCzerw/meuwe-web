-- Global tags catalogue (populated on first use per tag)
create table if not exists public.tags (
  name text primary key
);

alter table public.tags enable row level security;

-- Everyone can read tags (needed for tag picker)
create policy "tags_select" on public.tags
  for select using (true);

-- Authenticated users can add tags
create policy "tags_insert" on public.tags
  for insert to authenticated with check (true);

-- Seed common tags that are already used as quick-picks in the UI
insert into public.tags (name) values
  ('sport'),('muzyka'),('jedzenie'),('kultura'),('impreza'),
  ('rower'),('rodzina'),('gry'),('nauka'),('networking')
on conflict (name) do nothing;
