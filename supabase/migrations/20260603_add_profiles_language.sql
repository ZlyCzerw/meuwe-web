alter table public.profiles
  add column if not exists language text;

-- Default language is English; existing users with no stored language get 'en'.
-- (Each user's real UI language is written by the client on next app open.)
update public.profiles set language = 'en' where language is null;
