-- Nazwa użytkownika wybierana ręcznie.
--
-- `display_name` zostaje nietknięte: to nazwa od dostawcy logowania, zapisana
-- przez handle_new_user przy rejestracji. Nowa kolumna `nickname` jest wyłącznie
-- w rękach użytkownika, a `name_shown` łączy jedno z drugim, żeby ekrany nie
-- musiały nigdzie powtarzać tej reguły — i żeby nie dało się przeoczyć żadnego
-- miejsca, które czyta nazwę.
--
-- Po co to w ogóle: Apple przysyła imię tylko przy pierwszej autoryzacji, więc
-- kto skasuje konto i zaloguje się ponownie, wraca jako przedrostek adresu z
-- prywatnego przekaźnika (np. "k7f3x9mn2p") i nie ma jak tego zmienić.
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).

alter table public.profiles add column if not exists nickname text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_nickname_len'
  ) then
    alter table public.profiles
      add constraint profiles_nickname_len
      check (nickname is null or char_length(btrim(nickname)) between 2 and 30);
  end if;
end $$;

-- Kolumna generowana: baza liczy nazwę do pokazania, klient tylko ją czyta.
-- coalesce/nullif/btrim są immutable, więc Postgres przyjmuje je w STORED.
alter table public.profiles
  add column if not exists name_shown text
  generated always as (coalesce(nullif(btrim(nickname), ''), display_name)) stored;

-- Migracja 20260702_profiles_hide_location zastąpiła tabelaryczny GRANT SELECT
-- grantem kolumnowym i sama ostrzega, że kolumny dodane później są domyślnie
-- niewidoczne. Bez tego wiersza `name_shown` zniknąłby ze wszystkich odczytów.
grant select (nickname, name_shown) on public.profiles to anon, authenticated;

-- UPDATE na poziomie tabeli ma już rola authenticated (20260707), a polityka
-- profiles_update zawęża zapis do własnego wiersza — nic więcej nie trzeba.
-- name_shown jest generowana, więc jest z definicji tylko do odczytu.

-- Awatary obserwujących pod wydarzeniem idą przez SECURITY DEFINER RPC, które
-- czyta profiles bezpośrednio — bez tej podmiany pokazywałoby starą nazwę.
-- Nazwa zwracanej kolumny zostaje, więc klient się nie zmienia.
create or replace function get_event_follower_colors(p_event_id uuid)
returns table (avatar_color text, display_name text)
language sql
security definer
set search_path = public
as $$
  select p.avatar_color, p.name_shown
  from event_follows ef
  left join profiles p on p.id = ef.user_id
  where ef.event_id = p_event_id
  limit 10;
$$;
