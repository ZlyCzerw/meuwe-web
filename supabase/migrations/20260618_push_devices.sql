-- Native push targets (FCM). Separate from web push_subscriptions.
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_id_idx on public.push_devices(user_id);

alter table public.push_devices enable row level security;

create policy "own devices select" on public.push_devices
  for select to authenticated using (auth.uid() = user_id);
create policy "own devices insert" on public.push_devices
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own devices update" on public.push_devices
  for update to authenticated using (auth.uid() = user_id);
create policy "own devices delete" on public.push_devices
  for delete to authenticated using (auth.uid() = user_id);
