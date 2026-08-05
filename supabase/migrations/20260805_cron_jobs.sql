-- Harmonogram powiadomień w samym Supabase (pg_cron + pg_net).
--
-- To jest PIERWSZY działający harmonogram w projekcie: stara instrukcja
-- opisywała zadanie na cron-job.org, ale nigdy nie zostało założone, więc
-- push-event-start do 2026-08-05 nie był wywoływany wcale.
--
-- Dlaczego pg_cron, nie zewnętrzny cron: brak zależności od obcego konta,
-- sekrety nie opuszczają projektu (Vault), a definicja zadań leży w repo jak
-- każda migracja zamiast w klikanym ręcznie panelu.
--
-- URUCHAMIANE RĘCZNIE w SQL Editorze (historia migracji na PROD jest pusta,
-- `supabase db push` jest niebezpieczny). Ten sam plik działa na staging
-- i na PROD, bo adres projektu czyta z Vault - nic w nim nie trzeba edytować.
--
-- ── Zanim uruchomisz ─────────────────────────────────────────────────────────
--
-- 1. Dodaj trzy sekrety w Vault (Dashboard → Project Settings → Vault),
--    osobno na każdym środowisku:
--      project_url  → https://ujzmivdgibnnncmoqoyb.supabase.co   (staging)
--                     https://bcfhsbnbvsuxsiwmeway.supabase.co   (PROD)
--      anon_key     → anon public key środowiska (Settings → API)
--      cron_secret  → ten sam CRON_SECRET, który mają funkcje edge
--    Wartości sekretów celowo NIE ma w tym pliku - plik leży w repo.
--
-- 2. Rozszerzenia pg_cron i pg_net włącza sekcja niżej; jeśli wolisz,
--    włącz je w Dashboard → Database → Extensions - wyjdzie na to samo.
--
-- ── Po uruchomieniu ──────────────────────────────────────────────────────────
--
-- Sprawdź, że zadania strzelają:
--   select jobname, schedule, active from cron.job;
--   select jobname, status, return_message, start_time
--     from cron.job_run_details
--     join cron.job using (jobid)
--     order by start_time desc limit 20;
-- oraz w logach funkcji (Dashboard → Edge Functions).
--
-- `succeeded` w job_run_details znaczy tylko "pg_cron wysłał żądanie";
-- odpowiedź funkcji sprawdza się w net._http_response:
--   select status_code, content::text, created
--     from net._http_response order by created desc limit 5;
-- 200 = działa; 401 = cron_secret w Vault różni się od CRON_SECRET funkcji.
--
-- Wycofanie:
--   select cron.unschedule('push-event-start');
--   select cron.unschedule('push-weekly-digest');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Głośna odmowa zamiast zadań, które po cichu słałyby żądania donikąd.
do $$
declare
  missing text;
begin
  select string_agg(req.name, ', ') into missing
  from (values ('project_url'), ('anon_key'), ('cron_secret')) as req(name)
  where not exists (select 1 from vault.decrypted_secrets s where s.name = req.name);
  if missing is not null then
    raise exception 'Brak sekretów w Vault: %. Dodaj je i uruchom ponownie.', missing;
  end if;
end $$;

-- cron.schedule o istniejącej nazwie nadpisuje zadanie, więc plik można
-- uruchamiać wielokrotnie. Sekrety są czytane z Vault przy KAŻDYM odpaleniu
-- zadania - rotacja klucza nie wymaga przeplanowania.
--
-- Harmonogramy są w UTC, ale to bez znaczenia: co 5 minut to co 5 minut,
-- a push-weekly-digest sam liczy, u kogo jest piątek 17:00 lokalnie -
-- dlatego chodzi co godzinę.
--
-- timeout 60 s: domyślne 5 s pg_net ucina połączenie w trakcie dłuższej
-- wysyłki. Obie funkcje są odporne na urwanie w połowie (event-start
-- stempluje start_notified_at per wydarzenie, digest last_digest_at per
-- partię), ale nie ma powodu urywać ich bez potrzeby.

select cron.schedule(
  'push-event-start',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/push-event-start',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

select cron.schedule(
  'push-weekly-digest',
  '0 * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/push-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
