-- Account deletion (App Store guideline 5.1.1(v)).
--
-- Shape of the deal:
--   * the ACCOUNT goes: auth user, profile, follows, reads, mutes, push targets,
--     custom tags. Signing in again with the same Apple/Google account creates a
--     brand new, empty account — which is what App Review checks.
--   * the CONTENT stays: events and chat messages remain, with no author. The
--     client renders "deleted account" from its own translations.
--   * a retention record is kept out of reach of the app, so an abuse report
--     that arrives after the account is gone can still be acted on.
--
-- Because of that retention record this is pseudonymisation, not anonymisation:
-- GDPR art. 6(1)(f) (legitimate interest) with art. 17(3)(e) (legal claims) as
-- the ground for keeping it, and a fixed 24 month period after which it is
-- purged. The privacy policy has to say so.
--
-- Run manually in Supabase Dashboard → SQL Editor (staging first).

-- ── 1. Events must survive their creator ─────────────────────────────────────
-- events.creator_id was ON DELETE CASCADE to profiles, so deleting a profile
-- took the events with it. SET NULL keeps them on the map with no owner.
-- The constraint name is looked up rather than assumed.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.events'::regclass
    and contype = 'f'
    and conkey = array[(
      select attnum from pg_attribute
      where attrelid = 'public.events'::regclass and attname = 'creator_id'
    )]::smallint[];

  if fk_name is null then
    raise exception 'events.creator_id foreign key not found';
  end if;

  execute format('alter table public.events drop constraint %I', fk_name);
  execute format(
    'alter table public.events add constraint %I foreign key (creator_id)
       references public.profiles(id) on delete set null', fk_name);
end $$;

-- ── 2. Retention record ──────────────────────────────────────────────────────
-- Neither table is readable or writable by anon/authenticated: RLS is on and no
-- policy is ever created for them, and the grants are revoked on top of that.
-- Only service_role (the delete-account edge function) touches them.

create table if not exists public.deleted_accounts (
  user_id      uuid primary key,
  -- Sign in with Apple usually yields a @privaterelay.appleid.com address, which
  -- identifies nobody on its own — the provider + provider_uid pair is what Apple
  -- or Google need to answer a lawful request.
  email        text,
  provider     text,
  provider_uid text,
  signed_up_at timestamptz,
  deleted_at   timestamptz not null default now()
);

create table if not exists public.deleted_account_content (
  id         bigserial primary key,
  user_id    uuid not null references public.deleted_accounts(user_id) on delete cascade,
  kind       text not null check (kind in ('event', 'message')),
  content_id uuid not null,
  event_id   uuid,
  title      text,
  body       text,
  created_at timestamptz
);

create index if not exists deleted_account_content_user_idx
  on public.deleted_account_content (user_id);
create index if not exists deleted_accounts_deleted_at_idx
  on public.deleted_accounts (deleted_at);

alter table public.deleted_accounts        enable row level security;
alter table public.deleted_account_content enable row level security;

revoke all on public.deleted_accounts        from anon, authenticated;
revoke all on public.deleted_account_content from anon, authenticated;

-- ── 3. The deletion itself ───────────────────────────────────────────────────
-- One transaction: either the account is archived and stripped, or nothing
-- happened. Never a half-deleted account.
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

  -- Already archived: stop rather than overwrite the record with an empty one.
  -- A retry after a failed run cannot reach this, because the whole function is
  -- one transaction that rolled back.
  if exists (select 1 from deleted_accounts where user_id = p_user) then
    return;
  end if;

  insert into deleted_accounts (user_id, email, provider, provider_uid, signed_up_at)
  values (p_user, p_email, p_provider, p_provider_uid, p_signed_up_at);

  -- Snapshot before the link is cut, otherwise the retention record could never
  -- tell which message this account wrote.
  insert into deleted_account_content (user_id, kind, content_id, event_id, title, body, created_at)
  select p_user, 'event', e.id, e.id, e.title,
         concat_ws(E'\n', e.description, e.place_name), e.created_at
  from events e
  where e.creator_id = p_user;

  insert into deleted_account_content (user_id, kind, content_id, event_id, title, body, created_at)
  select p_user, 'message', m.id, m.event_id, null, m.text, m.created_at
  from event_messages m
  where m.author_id = p_user;

  -- author_name is denormalised, so clearing author_id alone would leave the
  -- name sitting in the table. author_color stays: it is a colour, not a person.
  update event_messages
     set author_id = null, author_name = null
   where author_id = p_user;

  delete from user_tags          where user_id = p_user;
  delete from event_follows      where user_id = p_user;
  delete from notification_mutes where user_id = p_user;
  delete from event_reads        where user_id = p_user;
  delete from push_devices       where user_id = p_user;
  delete from push_subscriptions where user_id = p_user;

  -- Last: events.creator_id drops to NULL through the constraint changed above.
  delete from profiles where id = p_user;
end $$;

revoke all on function public.archive_and_anonymize_user(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.archive_and_anonymize_user(uuid, text, text, text, timestamptz)
  to service_role;

-- ── 4. Retention limit ───────────────────────────────────────────────────────
-- 24 months, then the record goes. Schedule with pg_cron:
--   select cron.schedule('purge-deleted-accounts', '0 3 * * *',
--                        $$select public.purge_deleted_accounts()$$);
create or replace function public.purge_deleted_accounts(p_months int default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from deleted_accounts
   where deleted_at < now() - make_interval(months => p_months);
  get diagnostics removed = row_count;
  return removed; -- content rows follow by cascade
end $$;

revoke all on function public.purge_deleted_accounts(int) from public, anon, authenticated;
grant execute on function public.purge_deleted_accounts(int) to service_role;
