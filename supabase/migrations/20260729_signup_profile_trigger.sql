-- The profile-on-signup trigger, which existed only on PROD.
--
-- Why this file exists: `handle_new_user()` is referenced by an older migration
-- (20260530_security_advisor_fixes.sql revokes EXECUTE on it) but NOTHING in
-- this repo ever created it, and nothing created the trigger that calls it. Both
-- were made by hand in the PROD dashboard, so staging never got them.
--
-- The symptom: on staging no profile row is created at signup. The first client
-- write that upserts into profiles (language, push_enabled) then creates a bare
-- row with no display_name, and every event shows "Dodane przez ?" with a "?"
-- avatar.
--
-- Run manually in Supabase Dashboard → SQL Editor.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_color)
  values (
    new.id,
    -- Providers differ: Google sends full_name, some send name, Apple sends
    -- nothing at all on a repeat authorisation. The email prefix is the last
    -- resort so a new account is not born nameless.
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), '')
    ),
    '#FF7A45'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Signup must not fail because of a profile row, but the failure has to be
  -- findable. The previous version returned silently, which is how a missing
  -- trigger stayed invisible for weeks.
  raise warning '[handle_new_user] profile insert failed for %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end $$;

revoke execute on function public.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill the rows that were created nameless while the trigger was missing.
update public.profiles p
   set display_name = coalesce(
         u.raw_user_meta_data->>'full_name',
         u.raw_user_meta_data->>'name',
         nullif(split_part(coalesce(u.email, ''), '@', 1), '')
       )
  from auth.users u
 where u.id = p.id
   and (p.display_name is null or btrim(p.display_name) = '');
