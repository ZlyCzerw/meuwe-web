-- Kiedy konto odpowiedziało na pytanie o zainteresowania.
--
-- Do tej pory ten fakt mieszkał wyłącznie w localStorage urządzenia
-- (`meuwe_onboarding_v1`, pole `interestsDone`), a to jest zła głowa do jego
-- pamiętania. Kto logował się na nowym telefonie, w innej przeglądarce albo po
-- reinstalacji, dostawał kartę z tagami po raz drugi — tak samo jak ten, komu
-- Safari skasowało localStorage po siedmiu dniach bez wizyty.
--
-- Druga, cichsza połowa tego samego błędu: flaga była wspólna dla urządzenia, a
-- nie dla konta. Drugie konto logujące się na tym samym telefonie nigdy nie
-- dostawało pytania, zostawało z `interests = null`, a wtedy selectEventAudience
-- (supabase/functions/_shared/audience.ts) wycina je z każdego geo fan-outu.
-- Taki użytkownik po prostu nigdy nic nie dostaje i nie ma jak tego zgłosić.
--
-- Dlaczego osobna kolumna, a nie `cardinality(interests) > 0`: wyczyszczenie
-- tagów w panelu profilu też jest odpowiedzią. Kto usunął wszystkie tagi,
-- powiedział czego chce — karta nie ma prawa wrócić i się z nim spierać.
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).

alter table public.profiles
  add column if not exists interests_onboarded_at timestamptz;

-- Kto ma tagi, ten już odpowiedział — inaczej nie miałby skąd ich wziąć.
-- Prawdziwej daty nie ma z czego odtworzyć, więc idzie `created_at`: onboarding
-- z definicji dzieje się w pierwszych minutach po rejestracji, więc jest bliżej
-- prawdy niż data uruchomienia tej migracji. Do decyzji "pytać czy nie" liczy
-- się wyłącznie null vs not null.
update public.profiles
   set interests_onboarded_at = created_at
 where interests_onboarded_at is null
   and coalesce(cardinality(interests), 0) > 0;

-- Migracja 20260702_profiles_hide_location zastąpiła tabelaryczny GRANT SELECT
-- grantem kolumnowym i sama ostrzega, że kolumny dodane później są domyślnie
-- niewidoczne (fail-closed). Bez tego wiersza getProfile wywala się na 42501 dla
-- wszystkich, bo czyta tę kolumnę wprost. Ten sam dopisek co przy `nickname`
-- (20260803_profile_nickname).
grant select (interests_onboarded_at) on public.profiles to anon, authenticated;

-- UPDATE na poziomie tabeli ma już rola authenticated (20260707), a polityka
-- profiles_update zawęża zapis do własnego wiersza — klient stempluje własną
-- odpowiedź i nic więcej nie trzeba nadawać.
