-- Kto dotarł na wydarzenie.
--
-- Jeden wiersz na parę użytkownik-wydarzenie. `attended = false` jest pełną
-- odpowiedzią, nie brakiem danych: zapisuje "pytaliśmy, nie dotarł" i zamyka
-- temat, żeby modal nie zapytał drugi raz.
--
-- Deklaracja użytkownika ma pierwszeństwo nad automatem: wykrywanie wstawia
-- z ON CONFLICT DO NOTHING, a samodeklaracja nadpisuje istniejący wiersz.

create table if not exists public.event_attendance (
  user_id     uuid references auth.users on delete cascade not null,
  event_id    uuid references public.events on delete cascade not null,
  attended    boolean not null,
  source      text not null check (source in ('auto', 'self')),
  recorded_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_event_attendance_event on public.event_attendance (event_id);

alter table public.event_attendance enable row level security;

-- Wiersz obecności mówi, że dana osoba była w danym miejscu o danej porze.
-- Czyta go wyłącznie jej właściciel — organizator też nie. Wykrywanie
-- automatyczne działa jako SECURITY DEFINER, więc RLS go nie dotyczy.
create policy "own attendance select" on public.event_attendance
  for select using (auth.uid() = user_id);

create policy "own attendance insert" on public.event_attendance
  for insert with check (auth.uid() = user_id and source = 'self');

create policy "own attendance update" on public.event_attendance
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and source = 'self');
