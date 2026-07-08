-- Location writes go through a SECURITY DEFINER RPC.
--
-- 20260702_profiles_hide_location revoked SELECT on last_lat/last_lng/last_seen_at
-- (column-level grant omits them) so other users can't read a user's location.
-- Side effect: the client's own `updateProfileLocation` upsert writes exactly those
-- hidden columns, and a direct PostgREST upsert of columns the caller can't SELECT
-- fails with 42501 "permission denied for table profiles" — at the merge/on-conflict
-- step, independent of the RETURNING clause (so narrowing `.select('id')` does NOT
-- help, unlike the non-location writes which touch readable columns).
--
-- Fix: expose a SECURITY DEFINER function that updates the caller's OWN row and returns
-- void. It runs as the function owner, bypassing column privileges and RLS, so the
-- client needs no direct privilege on the hidden columns — and location stays hidden.

create or replace function public.update_my_location(p_lat float8, p_lng float8)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.profiles (id, last_lat, last_lng, last_seen_at)
  values (auth.uid(), p_lat, p_lng, now())
  on conflict (id) do update
    set last_lat = excluded.last_lat,
        last_lng = excluded.last_lng,
        last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.update_my_location(float8, float8) from public, anon;
grant execute on function public.update_my_location(float8, float8) to authenticated;
