-- Pełna lista osób, które wezmą udział w wydarzeniu — dla modala otwieranego
-- z paska awatarów w karcie wydarzenia.
--
-- get_event_follower_colors zostaje, jak jest: pasek potrzebuje tylko kilku
-- kolorów i nazw. Modal musi jeszcze otworzyć profil osoby, więc tu wychodzi
-- id — profile i tak są publiczne (get_public_profile), a RLS na event_follows
-- dalej pokazuje klientowi wyłącznie własne wiersze.
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).

create or replace function public.get_event_attendees(p_event_id uuid)
returns table (user_id uuid, display_name text, avatar_color text)
language sql
security definer
set search_path = public
stable
as $$
  select ef.user_id, p.name_shown, p.avatar_color
  from event_follows ef
  join profiles p on p.id = ef.user_id
  where ef.event_id = p_event_id
  order by ef.created_at, ef.user_id;
$$;

revoke all on function public.get_event_attendees(uuid) from public;
grant execute on function public.get_event_attendees(uuid) to anon, authenticated;
