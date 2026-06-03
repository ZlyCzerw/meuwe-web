alter table public.profiles
  add column if not exists language text;

-- Preserve current behavior: existing users default to Polish.
update public.profiles set language = 'pl' where language is null;
