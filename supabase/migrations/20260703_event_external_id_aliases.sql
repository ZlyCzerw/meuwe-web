-- Cross-source dedup: external_ids of duplicate scraped events, pointing at
-- the external_id of the event that was kept. Seed files skip any event whose
-- external_id appears here, so duplicates can't resurface on later runs.
create table if not exists public.event_external_id_aliases (
  alias_external_id text primary key,
  canonical_external_id text not null,
  created_at timestamptz not null default now()
);

alter table public.event_external_id_aliases enable row level security;
-- No policies on purpose: the table is only read/written from the Supabase
-- SQL editor (service role bypasses RLS); the app never touches it.
