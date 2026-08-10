-- Wykrywanie dotarcia na wydarzenie.
--
-- To jest próbkowanie, nie ciągły pomiar: profiles trzyma JEDNĄ, ostatnią
-- pozycję, więc kto wrócił do domu, ma w bazie dom. Zadanie pyta co 5 minut
-- "czy pozycja, którą trzymam teraz, wskazuje na to wydarzenie".
--
-- Dwie pary warunków robią różne rzeczy:
--   1. zakres przebiegu — które wydarzenia w ogóle oglądamy. Kwadrans po końcu
--      to ogon, żeby ostatnie minuty wydarzenia zdążyły zostać spróbkowane:
--      ostatnie próbkowanie przed końcem może wypaść 5 minut przed nim.
--   2. reguła zaliczania — czy trzymana pozycja POWSTAŁA w trakcie wydarzenia.
--      Przywiązanie do okna wydarzenia, a nie do "ostatnich N minut od teraz",
--      jest celowe: to drugie wiąże regułę z przypadkową chwilą uruchomienia
--      crona i gubi ludzi, którzy zamknęli aplikację między przebiegami.
--
-- last_seen_at NIE jest "ostatnią aktywnością" — update_my_location ustawia je
-- w jednym zapisie razem ze współrzędnymi, więc jest znacznikiem czasu tej
-- konkretnej pozycji. Dlatego to do niego przywiązany jest warunek czasowy.
--
-- URUCHAMIANE RĘCZNIE w SQL Editorze, jak reszta migracji w tym projekcie
-- (historia migracji na PROD jest pusta, `supabase db push` jest niebezpieczny).
-- Wymaga tabeli z 20260810_event_attendance.sql i rozszerzenia pg_cron, które
-- włącza 20260805_cron_jobs.sql.
--
-- Wycofanie:
--   select cron.unschedule('detect-event-arrivals');
--   drop function if exists public.detect_event_arrivals();

create or replace function public.detect_event_arrivals()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_attendance (user_id, event_id, attended, source)
  select f.user_id, e.id, true, 'auto'
    from public.events e
    join public.event_follows f on f.event_id = e.id
    join public.profiles p on p.id = f.user_id
   where e.start_time - interval '30 minutes' <= now()
     and e.end_time   >= now() - interval '15 minutes'
     and p.last_lat is not null
     and p.last_lng is not null
     and p.last_seen_at >= e.start_time - interval '30 minutes'
     and p.last_seen_at <= e.end_time
     and 2 * 6371000 * asin(sqrt(
           power(sin(radians(e.lat - p.last_lat) / 2), 2)
           + cos(radians(p.last_lat)) * cos(radians(e.lat))
             * power(sin(radians(e.lng - p.last_lng) / 2), 2)
         )) <= 150
  on conflict (user_id, event_id) do nothing;
$$;

revoke all on function public.detect_event_arrivals() from public, anon, authenticated;

select cron.schedule(
  'detect-event-arrivals',
  '*/5 * * * *',
  $job$ select public.detect_event_arrivals(); $job$
);
