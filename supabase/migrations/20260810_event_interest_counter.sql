-- Ostatnia liczba obserwujących, o której powiadomiono twórcę wydarzenia.
--
-- Bez tego dwa równoczesne dołączenia policzyłyby tę samą wartość i wysłały
-- dwa powiadomienia o tym samym progu. Podnoszenie MUSI iść warunkowo
-- (where interest_notified_count < :nowy), żeby wyścig rozstrzygała baza,
-- a nie kolejność wywołań funkcji edge.
--
-- Licznik nigdy nie schodzi w dół: odejście obserwującego jest ciche, więc
-- ponowne wejście na ten sam próg nie wysyła drugiego powiadomienia.
--
-- URUCHAMIANE RĘCZNIE w SQL Editorze, jak reszta migracji w tym projekcie
-- (historia migracji na PROD jest pusta, `supabase db push` jest niebezpieczny).

alter table public.events
  add column if not exists interest_notified_count integer not null default 0;
