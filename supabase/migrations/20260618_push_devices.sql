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

-- Upsert a device token for the current user. SECURITY DEFINER so a token that
-- previously belonged to another user (e.g. account switch on a shared device)
-- is reassigned to the caller instead of being blocked by the per-row UPDATE policy.
create or replace function public.register_push_device(p_fcm_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'invalid platform: %', p_platform;
  end if;
  insert into public.push_devices (user_id, fcm_token, platform, updated_at)
  values (auth.uid(), p_fcm_token, p_platform, now())
  on conflict (fcm_token)
  do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text) from public, anon;
grant execute on function public.register_push_device(text, text) to authenticated;
