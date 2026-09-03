-- Licznik wyświetleń karty wydarzenia: kto otwierał (zalogowani) i ile razy,
-- goście zbiorczo w jednym wierszu (viewer_id = null). Liczbę widzi wyłącznie
-- twórca wydarzenia; do rozmiaru pinezki dolicza się 1 interakcja na 5 otwarć.
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).
-- Idempotentna: można puścić drugi raz bez szkody.

-- ── 1. Tabela ────────────────────────────────────────────────────────────────
-- nulls not distinct: wszyscy goście danego wydarzenia to jeden wiersz, więc
-- upsert w record_event_view trafia w niego tak samo jak w wiersz użytkownika.
-- Usunięte konto zabiera swoje wiersze (cascade) - set null zderzyłby się
-- z wierszem gości na tym samym ograniczeniu.
create table if not exists public.event_views (
  event_id        uuid not null references public.events (id) on delete cascade,
  viewer_id       uuid references auth.users (id) on delete cascade,
  view_count      integer not null default 1,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at  timestamptz not null default now(),
  constraint event_views_event_viewer_key unique nulls not distinct (event_id, viewer_id)
);

alter table public.event_views enable row level security;

-- Czyta tylko twórca wydarzenia. Nikt nie pisze wprost - wyłącznie przez RPC.
drop policy if exists "event_views_creator_read" on public.event_views;
create policy "event_views_creator_read" on public.event_views
  for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_views.event_id and e.creator_id = auth.uid()
  ));

revoke all on public.event_views from anon, authenticated;
grant select on public.event_views to authenticated;

-- ── 2. Zapis otwarcia karty ──────────────────────────────────────────────────
-- security definer: goście i cudze konta nie mają prawa pisać do tabeli.
-- Własne otwarcia twórcy nie liczą się - ogląda swoją kartę przy każdej edycji.
create or replace function public.record_event_view(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
begin
  select creator_id into v_creator from events where id = p_event_id;
  if not found then
    return;
  end if;
  if auth.uid() is not null and auth.uid() = v_creator then
    return;
  end if;
  insert into event_views (event_id, viewer_id)
  values (p_event_id, auth.uid())
  on conflict (event_id, viewer_id) do update
    set view_count = event_views.view_count + 1,
        last_viewed_at = now();
end $$;

grant execute on function public.record_event_view(uuid) to anon, authenticated;

-- ── 3. Statystyki dla twórcy ─────────────────────────────────────────────────
-- security invoker: RLS z punktu 1 zwraca wiersze tylko twórcy, więc cudze
-- wydarzenia po prostu nie pojawiają się w wyniku. views = suma otwarć razem
-- z gośćmi, viewers = liczba zalogowanych osób (wiersz gości ma viewer_id null,
-- więc count(viewer_id) go pomija).
create or replace function public.get_event_view_stats(event_ids uuid[])
returns table (event_id uuid, views bigint, viewers bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select v.event_id,
         sum(v.view_count)::bigint  as views,
         count(v.viewer_id)::bigint as viewers
  from event_views v
  where v.event_id = any(event_ids)
  group by v.event_id;
$$;

revoke all on function public.get_event_view_stats(uuid[]) from public, anon;
grant execute on function public.get_event_view_stats(uuid[]) to authenticated;

-- ── 4. Wyświetlenia w rozmiarze pinezki ──────────────────────────────────────
-- Do wiadomości i obserwujących dochodzi 1 interakcja na 5 otwarć karty.
-- Przejście na security definer: RLS chowa event_views (i event_follows) przed
-- nie-twórcami, a pinezka ma wyglądać tak samo dla każdego. Skutek uboczny:
-- goście od teraz też widzą pinezki skalowane obserwującymi, nie tylko czatem.
create or replace function public.get_event_interactions(event_ids uuid[])
returns table (event_id uuid, interaction_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    e,
    coalesce(msg.cnt, 0) + coalesce(fol.cnt, 0) + coalesce(vw.cnt, 0) / 5 as interaction_count
  from unnest(event_ids) as e
  left join (
    select event_id, count(*) as cnt
    from event_messages
    where event_id = any(event_ids)
    group by event_id
  ) msg on msg.event_id = e
  left join (
    select event_id, count(*) as cnt
    from event_follows
    where event_id = any(event_ids)
    group by event_id
  ) fol on fol.event_id = e
  left join (
    select event_id, sum(view_count)::bigint as cnt
    from event_views
    where event_id = any(event_ids)
    group by event_id
  ) vw on vw.event_id = e;
$$;

grant execute on function public.get_event_interactions(uuid[]) to anon, authenticated;
