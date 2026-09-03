# Karta użytkownika i obserwowanie twórców - plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tap w organizatora w karcie wydarzenia otwiera modal z publicznym profilem i przyciskiem „+ Obserwuj”; obserwowanie twórcy automatycznie obserwuje jego bieżące i przyszłe publiczne wydarzenia i dokłada obserwującego do odbiorców push o nowym wydarzeniu.

**Architecture:** Nowa tabela `user_follows` (RLS: tylko własne wiersze). Dwa triggery SECURITY DEFINER w bazie robią auto-obserwację (po follow → bieżące wydarzenia, po nowym wydarzeniu → obserwujący twórcy), więc klient i funkcje edge nic o tej regule nie wiedzą. RPC `get_public_profile` zwraca profil z licznikami w jednym strzale. Karta to modal `UserCard` renderowany w `App.tsx` jako warstwa historii (gest wstecz zamyka kartę, nie wydarzenie). Wiersz organizatora wyjęty z `EventSheet` do małego `OrganizerRow` w `src/screens/event/`, jak czat i zdjęcia.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + RLS + triggery + RPC), Deno edge functions, vitest + testing-library, i18next (pl/en/es/de/sl).

**Spec:** `docs/superpowers/specs/2026-09-03-user-card-follow-design.md`

## Global Constraints

- Każdy tekst UI przez `t('…')` we **wszystkich pięciu** językach: `pl`, `en`, `es`, `de`, `sl`. `src/locales/parity.test.ts` pilnuje kompletu.
- Nowe elementy graficzne wyłącznie z istniejącego języka meuwe: tokeny `C`/`F`/`INK`/`SHADOW_BUTTON` z `src/lib/tokens.ts`, pigułki `borderRadius: 999`, obrysy `INK`, animacje `bubble-up`/`fadeIn`/`breathe-sm` z `src/index.css`. Zero nowych kolorów, fontów, bibliotek.
- Wydarzenia prywatne (`events.is_private`) nigdy nie są auto-obserwowane - wiersz w `event_follows` jest uprawnieniem do zobaczenia wydarzenia.
- Build sprawdzać przez `npx tsc -b` (nie `--noEmit`).
- Commity bez `Co-Authored-By`; komunikaty po polsku, w stylu repozytorium (krótkie, opisowe, bez prefiksów `feat:`). Do commitu dodawać **tylko pliki z zadania** - w drzewie leżą zmodyfikowane PNG-i ze store-assets, które nie należą do tej pracy.
- Migracja jest uruchamiana **ręcznie** w Supabase Dashboard → SQL Editor, najpierw staging. Nikt w tym planie nie uruchamia jej z kodu.
- Kolejność wdrożenia: migracja → klient → funkcja `push-new-event`; na PROD dopiero po sprawdzeniu na staging.
- Gałąź: `user_card` (ze `staging`).

---

## Mapa plików

| Plik | Odpowiedzialność |
|---|---|
| `supabase/migrations/20260903_user_follows.sql` | tabela `user_follows`, RLS, dwa triggery auto-obserwacji, RPC `get_public_profile`, `archive_and_anonymize_user` z nowym `delete` |
| `src/lib/types.ts` | typ `PublicProfile` |
| `src/lib/supabase.ts` | `getPublicProfile`, `followUser`, `unfollowUser`, `trackClick('follow_user' \| 'unfollow_user')` |
| `src/locales/{pl,en,es,de,sl}.ts` (+ `parity.test.ts`) | blok `userCard` |
| `src/lib/overlays.ts` (+ test) | flaga `userCardOpen` |
| `src/components/UserCard.tsx` (+ test) | modal karty użytkownika: ładowanie, dane, follow/unfollow |
| `src/screens/event/OrganizerRow.tsx` (+ test) | wiersz „Dodane przez X” jako przycisk; tekst gdy konto usunięte |
| `src/screens/EventSheet.tsx` | używa `OrganizerRow`, prop `onOpenUser` |
| `src/App.tsx` | stan `userCardId`, warstwa `userCard` w `popstate`, render `UserCard`, `onOpenUser` do trzech `EventSheet` |
| `supabase/functions/_shared/audience.ts` (+ test) | `followerIds` dochodzą też do publicznych wydarzeń |
| `supabase/functions/push-new-event/index.ts` | pobiera `event_follows` wydarzenia i przekazuje jako `followerIds` |
| `docs/legal/privacy-policy.md`, `docs/legal/compliance-requirements.md` | wiersz „Obserwowani twórcy” / `user_follows` |

---

### Task 1: Migracja `user_follows`

**Files:**
- Create: `supabase/migrations/20260903_user_follows.sql`

**Interfaces:**
- Produces: tabela `public.user_follows(follower_id, creator_id, created_at)`; RPC `get_public_profile(p_user_id uuid)` zwracająca kolumny `id, display_name, avatar_color, bio, home_name, creator_kind, link_url, events_count, followers_count, is_following`.

- [ ] **Step 1: Napisz migrację**

```sql
-- Obserwowanie twórców: kto obserwuje użytkownika, obserwuje automatycznie
-- jego publiczne wydarzenia - bieżące od razu, każde nowe w chwili dodania.
-- Spec: docs/superpowers/specs/2026-09-03-user-card-follow-design.md
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).
-- Idempotentna: można puścić drugi raz bez szkody.

-- ── 1. Tabela ────────────────────────────────────────────────────────────────
create table if not exists public.user_follows (
  follower_id uuid not null references auth.users on delete cascade,
  creator_id  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint user_follows_not_self check (follower_id <> creator_id)
);

-- Fan-out przy nowym wydarzeniu i licznik obserwujących idą po creator_id.
create index if not exists user_follows_creator_idx on public.user_follows (creator_id);

alter table public.user_follows enable row level security;

drop policy if exists "user_follows_own" on public.user_follows;
create policy "user_follows_own" on public.user_follows
  for all to authenticated
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

revoke all on public.user_follows from anon;
grant select, insert, delete on public.user_follows to authenticated;

-- ── 2. Nowy obserwujący → bieżące publiczne wydarzenia twórcy ────────────────
-- security definer: event_follows ma RLS "tylko własne wiersze", a events chowa
-- prywatne - trigger ma wstawiać w imieniu obserwującego, ale widzieć tylko
-- publiczne wydarzenia, więc filtr is_private jest tu jawny.
--
-- end_time >= now() celowo bez okresu łaski "extended": kto zaobserwował
-- twórcę po formalnym końcu imprezy, nie potrzebuje powiadomienia o niej.
create or replace function public.follow_creator_current_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into event_follows (user_id, event_id)
  select new.follower_id, e.id
  from events e
  where e.creator_id = new.creator_id
    and not e.is_private
    and e.status <> 'ended'
    and e.end_time >= now()
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists user_follows_follow_current on public.user_follows;
create trigger user_follows_follow_current
  after insert on public.user_follows
  for each row execute function public.follow_creator_current_events();

-- ── 3. Nowe publiczne wydarzenie → obserwujący twórcy ────────────────────────
-- Także przy odsłonięciu wydarzenia prywatnego (update is_private → false):
-- obserwujący dochodzą wtedy tak, jakby wydarzenie powstało w tej chwili.
-- W drugą stronę nic nie kasujemy - twórca sam decyduje, kogo zostawić.
--
-- Działa w tej samej transakcji co insert, więc webhook push-new-event widzi
-- już obserwujących w event_follows.
create or replace function public.follow_new_event_for_creator_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_private or new.creator_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and not old.is_private then
    return new;
  end if;
  insert into event_follows (user_id, event_id)
  select uf.follower_id, new.id
  from user_follows uf
  where uf.creator_id = new.creator_id
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists events_follow_for_creator_followers on public.events;
create trigger events_follow_for_creator_followers
  after insert or update of is_private on public.events
  for each row execute function public.follow_new_event_for_creator_followers();

-- ── 4. Profil publiczny z licznikami ─────────────────────────────────────────
-- security definer, bo liczniki liczone "od dołu" byłyby fałszywe: RLS na
-- event_follows i user_follows pokazuje tylko własne wiersze, a events chowa
-- prywatne. Funkcja oddaje wyłącznie kolumny i tak publiczne plus dwie liczby.
-- display_name = name_shown: ten sam alias, co PROFILE_PUBLIC w kliencie.
create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id              uuid,
  display_name    text,
  avatar_color    text,
  bio             text,
  home_name       text,
  creator_kind    text,
  link_url        text,
  events_count    integer,
  followers_count integer,
  is_following    boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.name_shown,
    p.avatar_color,
    p.bio,
    p.home_name,
    p.creator_kind,
    p.link_url,
    (select count(*)::integer from events e
      where e.creator_id = p.id and not e.is_private),
    (select count(*)::integer from user_follows uf
      where uf.creator_id = p.id),
    exists (select 1 from user_follows uf
      where uf.creator_id = p.id and uf.follower_id = auth.uid())
  from profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- ── 5. Usuwanie konta ────────────────────────────────────────────────────────
-- Kaskada z auth.users zrobiłaby to sama, ale archive_and_anonymize_user
-- (20260728) wymienia każdą tabelę z osobna - nowa nie może być wyjątkiem.
-- Treść jak w 20260728 plus jeden delete; sygnatura bez zmian.
create or replace function public.archive_and_anonymize_user(
  p_user         uuid,
  p_email        text,
  p_provider     text,
  p_provider_uid text,
  p_signed_up_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    raise exception 'p_user is required';
  end if;

  if exists (select 1 from deleted_accounts where user_id = p_user) then
    return;
  end if;

  insert into deleted_accounts (user_id, email, provider, provider_uid, signed_up_at)
  values (p_user, p_email, p_provider, p_provider_uid, p_signed_up_at);

  insert into deleted_account_content (user_id, kind, content_id, event_id, title, body, created_at)
  select p_user, 'event', e.id, e.id, e.title,
         concat_ws(E'\n', e.description, e.place_name), e.created_at
  from events e
  where e.creator_id = p_user;

  insert into deleted_account_content (user_id, kind, content_id, event_id, title, body, created_at)
  select p_user, 'message', m.id, m.event_id, null, m.text, m.created_at
  from event_messages m
  where m.author_id = p_user;

  update event_messages
     set author_id = null, author_name = null
   where author_id = p_user;

  delete from user_tags          where user_id = p_user;
  delete from event_follows      where user_id = p_user;
  delete from user_follows       where follower_id = p_user or creator_id = p_user;
  delete from notification_mutes where user_id = p_user;
  delete from event_reads        where user_id = p_user;
  delete from push_devices       where user_id = p_user;
  delete from push_subscriptions where user_id = p_user;

  delete from profiles where id = p_user;
end $$;

revoke all on function public.archive_and_anonymize_user(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.archive_and_anonymize_user(uuid, text, text, text, timestamptz)
  to service_role;
```

- [ ] **Step 2: Sprawdź składnię lokalnie (bez bazy)**

Run: `psql --version >/dev/null 2>&1 && echo ok || echo "brak psql - pomiń"` a następnie, jeśli `psql` jest dostępny i istnieje lokalna baza, `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260903_user_follows.sql` z `rollback` na końcu. Bez lokalnej bazy: przeczytaj plik jeszcze raz pod kątem niedomkniętych `$$` i średników - to jedyna kontrola przed staging.

- [ ] **Step 3: Uruchom na staging i zweryfikuj w SQL Editorze**

Kolejno, jako właściciel (SQL Editor działa jako `postgres`, więc `auth.uid()` jest `null` - `is_following` zawsze `false`, to spodziewane):

```sql
-- profil istniejącego użytkownika z licznikami
select * from get_public_profile('<uuid twórcy z kilkoma wydarzeniami>');

-- follow dopisuje bieżące publiczne wydarzenia
insert into user_follows (follower_id, creator_id) values ('<uuid A>', '<uuid twórcy>');
select count(*) from event_follows ef join events e on e.id = ef.event_id
 where ef.user_id = '<uuid A>' and e.creator_id = '<uuid twórcy>';

-- nowe publiczne wydarzenie twórcy trafia do A; prywatne nie
insert into events (creator_id, title, lat, lng, start_time, end_time, category, status, is_private)
values ('<uuid twórcy>', 'test follow', 28.4, -16.5, now() + interval '1 day', now() + interval '1 day 2 hours', 'party', 'upcoming', false)
returning id;
select * from event_follows where event_id = '<zwrócone id>';   -- wiersz dla A

-- sprzątanie
delete from events where title = 'test follow';
delete from user_follows where follower_id = '<uuid A>';
```

Jeśli `insert into events` wymaga innych kolumn NOT NULL, dopasuj do schematu - test jest o triggerze, nie o kształcie wydarzenia.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260903_user_follows.sql
git commit -m "Migracja: user_follows, auto-obserwowanie wydarzeń twórcy, RPC get_public_profile"
```

---

### Task 2: Typ `PublicProfile` i metody `db`

**Files:**
- Modify: `src/lib/types.ts:39-45` (po interfejsie `Profile`, przed komentarzem do `ProfilePrivate`)
- Modify: `src/lib/supabase.ts:2` (import), `src/lib/supabase.ts:436` (po `unfollowEvent`), `src/lib/supabase.ts:546-552` (`trackClick`)

**Interfaces:**
- Produces: `PublicProfile` w `types.ts`; `db.getPublicProfile(id: string): Promise<PublicProfile | null>`, `db.followUser(id: string): Promise<{ error: unknown } | void>`, `db.unfollowUser(id: string): Promise<{ error: unknown } | void>`, `db.trackClick('follow_user' | 'unfollow_user')`.

- [ ] **Step 1: Dodaj typ**

W `src/lib/types.ts` po zamknięciu `interface Profile` (linia 44, przed komentarzem `/** Dane, które widzi tylko właściciel`):

```ts
/**
 * Cudzy profil na karcie użytkownika - wynik RPC get_public_profile.
 * display_name to profiles.name_shown pod tym samym aliasem, co PROFILE_PUBLIC
 * w supabase.ts, żeby każdy ekran czytał jedno pole.
 */
export interface PublicProfile {
  id: string
  display_name: string | null
  avatar_color: string | null
  bio: string | null
  home_name: string | null
  creator_kind: CreatorKind | null
  link_url: string | null
  /** Publiczne wydarzenia twórcy, łącznie z zakończonymi - to jego dorobek. */
  events_count: number
  followers_count: number
  /** Czy zalogowany użytkownik obserwuje ten profil; dla gościa zawsze false. */
  is_following: boolean
}
```

- [ ] **Step 2: Dodaj metody w `db`**

Import w `src/lib/supabase.ts` linia 2:

```ts
import type { EventWithMeta, EventWithMsgCount, Message, Profile, ProfilePrivate, PublicProfile } from './types'
```

Po `unfollowEvent` (po linii 436, przed `getEventFollowers`):

```ts
  // Karta użytkownika: profil, liczniki i "czy obserwuję" w jednym strzale.
  // RPC jest security definer, bo liczniki z RLS "tylko własne wiersze" byłyby
  // fałszywe. Brak wiersza (profil usunięty) = null, jak getProfile.
  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId }).maybeSingle()
    if (error) { console.error('[getPublicProfile]', error); return null }
    return (data as PublicProfile | null) ?? null
  },
  // Obserwowanie twórcy. Auto-obserwacja jego wydarzeń dzieje się w bazie
  // (trigger na user_follows), klient nie wie o tej regule.
  async followUser(creatorId: string) {
    const sess = await this.getSession(); if (!sess) return
    return supabase.from('user_follows').insert({ follower_id: sess.user.id, creator_id: creatorId })
  },
  async unfollowUser(creatorId: string) {
    const sess = await this.getSession(); if (!sess) return
    return supabase.from('user_follows').delete().eq('follower_id', sess.user.id).eq('creator_id', creatorId)
  },
```

W `trackClick` rozszerz unię (linia ~551):

```ts
    | 'invite_friends' | 'delete_account' | 'nickname_save' | 'profile_save'
    | 'follow_user' | 'unfollow_user'
```

- [ ] **Step 3: Sprawdź typy**

Run: `npx tsc -b`
Expected: bez błędów.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/supabase.ts
git commit -m "Klient: getPublicProfile, followUser, unfollowUser"
```

---

### Task 3: Teksty `userCard.*` w pięciu językach

**Files:**
- Modify: `src/locales/parity.test.ts:36` (nowa stała + `describe`)
- Modify: `src/locales/pl.ts:306`, `src/locales/en.ts:308`, `src/locales/es.ts:308`, `src/locales/de.ts:308`, `src/locales/sl.ts:308` (po linii `follow: {…}`)

**Interfaces:**
- Produces: klucze `userCard.follow`, `userCard.following`, `userCard.followingHint`, `userCard.thisIsYou`, `userCard.eventsCount` (plural `_one/_few/_many/_other`), `userCard.followersCount` (plural), `userCard.loadFailed`, `userCard.followFailed`, `userCard.openProfile`.

- [ ] **Step 1: Napisz test parytetu**

W `src/locales/parity.test.ts` po `LANDING_COOKIES_KEYS` (linia ~36) dodaj:

```ts
const USER_CARD_KEYS = [
  'follow', 'following', 'followingHint', 'thisIsYou',
  'eventsCount_one', 'eventsCount_few', 'eventsCount_many', 'eventsCount_other',
  'followersCount_one', 'followersCount_few', 'followersCount_many', 'followersCount_other',
  'loadFailed', 'followFailed', 'openProfile',
] as const
```

Na końcu pliku:

```ts
describe('user card', () => {
  // Karta cudzego profilu to pierwszy ekran, na którym ktoś ocenia obcą osobę -
  // surowy klucz zamiast "Obserwuj" podważa i kartę, i tę osobę.
  it.each(Object.entries(LOCALES))('%s carries every userCard key', (_name, dict) => {
    const userCard = (dict as { userCard?: Record<string, unknown> }).userCard ?? {}
    for (const key of USER_CARD_KEYS) {
      expect(typeof userCard[key]).toBe('string')
      expect(userCard[key]).not.toBe('')
    }
  })
})
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: FAIL, pięć przypadków `user card` - `expected 'undefined' to be 'string'`.

- [ ] **Step 3: Dodaj bloki w locale'ach**

Każdy blok wstaw **bezpośrednio po** linii `follow: {…},` w danym pliku.

`src/locales/pl.ts`:

```ts
  userCard: {
    follow: '+ Obserwuj',
    following: 'Obserwujesz ✓',
    followingHint: 'Obserwujesz też wszystkie wydarzenia tej osoby',
    thisIsYou: 'To Ty',
    eventsCount_one: '{{count}} wydarzenie',
    eventsCount_few: '{{count}} wydarzenia',
    eventsCount_many: '{{count}} wydarzeń',
    eventsCount_other: '{{count}} wydarzeń',
    followersCount_one: '{{count}} obserwujący',
    followersCount_few: '{{count}} obserwujących',
    followersCount_many: '{{count}} obserwujących',
    followersCount_other: '{{count}} obserwujących',
    loadFailed: 'Nie udało się wczytać profilu',
    followFailed: 'Nie udało się zapisać. Spróbuj ponownie',
    openProfile: 'Otwórz profil: {{name}}',
  },
```

`src/locales/en.ts`:

```ts
  userCard: {
    follow: '+ Follow',
    following: 'Following ✓',
    followingHint: 'You also follow every event this person posts',
    thisIsYou: 'This is you',
    eventsCount_one: '{{count}} event',
    eventsCount_few: '{{count}} events',
    eventsCount_many: '{{count}} events',
    eventsCount_other: '{{count}} events',
    followersCount_one: '{{count}} follower',
    followersCount_few: '{{count}} followers',
    followersCount_many: '{{count}} followers',
    followersCount_other: '{{count}} followers',
    loadFailed: 'Could not load this profile',
    followFailed: 'Could not save. Try again',
    openProfile: 'Open profile: {{name}}',
  },
```

`src/locales/es.ts`:

```ts
  userCard: {
    follow: '+ Seguir',
    following: 'Siguiendo ✓',
    followingHint: 'También sigues todos los eventos de esta persona',
    thisIsYou: 'Eres tú',
    eventsCount_one: '{{count}} evento',
    eventsCount_few: '{{count}} eventos',
    eventsCount_many: '{{count}} eventos',
    eventsCount_other: '{{count}} eventos',
    followersCount_one: '{{count}} seguidor',
    followersCount_few: '{{count}} seguidores',
    followersCount_many: '{{count}} seguidores',
    followersCount_other: '{{count}} seguidores',
    loadFailed: 'No se pudo cargar el perfil',
    followFailed: 'No se pudo guardar. Inténtalo de nuevo',
    openProfile: 'Abrir perfil: {{name}}',
  },
```

`src/locales/de.ts`:

```ts
  userCard: {
    follow: '+ Folgen',
    following: 'Du folgst ✓',
    followingHint: 'Du folgst auch allen Veranstaltungen dieser Person',
    thisIsYou: 'Das bist du',
    eventsCount_one: '{{count}} Veranstaltung',
    eventsCount_few: '{{count}} Veranstaltungen',
    eventsCount_many: '{{count}} Veranstaltungen',
    eventsCount_other: '{{count}} Veranstaltungen',
    followersCount_one: '{{count}} Follower',
    followersCount_few: '{{count}} Follower',
    followersCount_many: '{{count}} Follower',
    followersCount_other: '{{count}} Follower',
    loadFailed: 'Profil konnte nicht geladen werden',
    followFailed: 'Speichern fehlgeschlagen. Versuch es noch einmal',
    openProfile: 'Profil öffnen: {{name}}',
  },
```

`src/locales/sl.ts`:

```ts
  userCard: {
    follow: '+ Spremljaj',
    following: 'Spremljaš ✓',
    followingHint: 'Spremljaš tudi vse dogodke te osebe',
    thisIsYou: 'To si ti',
    eventsCount_one: '{{count}} dogodek',
    eventsCount_few: '{{count}} dogodki',
    eventsCount_many: '{{count}} dogodkov',
    eventsCount_other: '{{count}} dogodkov',
    followersCount_one: '{{count}} sledilec',
    followersCount_few: '{{count}} sledilci',
    followersCount_many: '{{count}} sledilcev',
    followersCount_other: '{{count}} sledilcev',
    loadFailed: 'Profila ni bilo mogoče naložiti',
    followFailed: 'Shranjevanje ni uspelo. Poskusi znova',
    openProfile: 'Odpri profil: {{name}}',
  },
```

Uwaga do słoweńskiego: i18next dla `sl` używa kategorii `one/two/few/other`; klucze `_few`/`_many` zostają dla parytetu z resztą plików (tak samo robi `messageCount_*`), a `2 dogodka` wpadnie w `_other` - akceptowalne, identycznie zachowuje się dziś licznik wiadomości.

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/locales/parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/locales/pl.ts src/locales/en.ts src/locales/es.ts src/locales/de.ts src/locales/sl.ts src/locales/parity.test.ts
git commit -m "Teksty karty użytkownika w pięciu językach"
```

---

### Task 4: Flaga `userCardOpen` w `OverlayFlags`

**Files:**
- Modify: `src/lib/overlays.ts:15-33` (interfejs), `src/lib/overlays.ts:37-55` (`isScreenClear`)
- Test: `src/lib/overlays.test.ts:4-22` (obiekt `clear`), `src/lib/overlays.test.ts:38`

**Interfaces:**
- Produces: `OverlayFlags.userCardOpen: boolean` (wymagane). Task 7 musi je ustawić w `App.tsx`, inaczej `tsc` padnie - to zamierzone.

- [ ] **Step 1: Rozszerz test**

W `src/lib/overlays.test.ts` do obiektu `clear` po `attendanceAskOpen: false,` dodaj:

```ts
  userCardOpen: false,
```

W teście `is not clear while any single layer is open` zmień `expect(layers.length).toBe(16)` na `expect(layers.length).toBe(17)`.

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/lib/overlays.test.ts`
Expected: FAIL - błąd typu (nadmiarowe pole `userCardOpen`) albo `expected 17 to be 16`.

- [ ] **Step 3: Dodaj flagę**

W `src/lib/overlays.ts` w interfejsie po `attendanceAskOpen: boolean`:

```ts
  /** Karta cudzego profilu, otwierana z wiersza organizatora w karcie wydarzenia. */
  userCardOpen: boolean
```

W `isScreenClear` po `&& !f.attendanceAskOpen`:

```ts
    && !f.userCardOpen
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/lib/overlays.test.ts`
Expected: PASS. (`npx tsc -b` padnie teraz na `App.tsx` - brak pola w `overlayRef.current`; naprawia to Task 7. Nie łataj tego tutaj.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/overlays.ts src/lib/overlays.test.ts
git commit -m "OverlayFlags: karta użytkownika liczy się jako otwarta warstwa"
```

---

### Task 5: Komponent `UserCard`

**Files:**
- Create: `src/components/UserCard.tsx`
- Test: `src/components/UserCard.test.tsx`

**Interfaces:**
- Consumes: `db.getPublicProfile`, `db.followUser`, `db.unfollowUser`, `db.trackClick` (Task 2); klucze `userCard.*`, `myData.creatorKind_*`, `common.close` (Task 3); `Avatar`, `OrganicBlob`, `authorInitial`, `cleanLink`.
- Produces: `export default function UserCard(props: { userId: string; session: Session | null; onAuthNeeded: () => void; onClose: () => void })`.

- [ ] **Step 1: Napisz testy**

`src/components/UserCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import UserCard from './UserCard'
import type { PublicProfile } from '../lib/types'
import '../lib/i18n'
import i18n from 'i18next'

const getPublicProfile = vi.fn<() => Promise<PublicProfile | null>>()
const followUser = vi.fn()
const unfollowUser = vi.fn()
const trackClick = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    getPublicProfile: () => getPublicProfile(),
    followUser: (...a: unknown[]) => followUser(...a),
    unfollowUser: (...a: unknown[]) => unfollowUser(...a),
    trackClick: (...a: unknown[]) => trackClick(...a),
  },
  supabase: {},
}))

const session = { user: { id: 'me' } } as unknown as Session

function profile(over: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: 'u2', display_name: 'Kasia', avatar_color: '#4FC3F7',
    bio: 'Organizuję potańcówki', home_name: 'Puerto de la Cruz',
    creator_kind: 'organizer', link_url: 'https://example.org/kasia',
    events_count: 12, followers_count: 8, is_following: false,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
  followUser.mockResolvedValue({ error: null })
  unfollowUser.mockResolvedValue({ error: null })
})

describe('UserCard', () => {
  it('shows name, bio, pills, counters and link', async () => {
    getPublicProfile.mockResolvedValue(profile())
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Kasia')).toBeInTheDocument()
    expect(screen.getByText('Organizuję potańcówki')).toBeInTheDocument()
    expect(screen.getByText('An organiser')).toBeInTheDocument()
    expect(screen.getByText('Puerto de la Cruz')).toBeInTheDocument()
    expect(screen.getByText(/12 events/)).toBeInTheDocument()
    expect(screen.getByText(/8 followers/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'example.org/kasia' })).toHaveAttribute('href', 'https://example.org/kasia')
  })

  // Puste pole to brak pigułki, nie pigułka z pustym środkiem.
  it('hides empty fields', async () => {
    getPublicProfile.mockResolvedValue(profile({ bio: null, home_name: null, creator_kind: null, link_url: null }))
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    await screen.findByText('Kasia')
    expect(screen.queryByText('An organiser')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('follows optimistically: label and counter change before the request resolves', async () => {
    getPublicProfile.mockResolvedValue(profile())
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Follow' }))
    expect(screen.getByRole('button', { name: 'Following ✓' })).toBeInTheDocument()
    expect(screen.getByText(/9 followers/)).toBeInTheDocument()
    expect(followUser).toHaveBeenCalledWith('u2')
    expect(trackClick).toHaveBeenCalledWith('follow_user')
  })

  it('unfollows on the second tap', async () => {
    getPublicProfile.mockResolvedValue(profile({ is_following: true }))
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Following ✓' }))
    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u2'))
    expect(screen.getByRole('button', { name: '+ Follow' })).toBeInTheDocument()
    expect(screen.getByText(/7 followers/)).toBeInTheDocument()
    expect(trackClick).toHaveBeenCalledWith('unfollow_user')
  })

  // Nieudany zapis nie może zostawić "Obserwujesz ✓" na ekranie.
  it('reverts and says so when the request fails', async () => {
    getPublicProfile.mockResolvedValue(profile())
    followUser.mockResolvedValue({ error: { message: 'boom' } })
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Follow' }))
    expect(await screen.findByText('Could not save. Try again')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Follow' })).toBeInTheDocument()
    expect(screen.getByText(/8 followers/)).toBeInTheDocument()
  })

  it('sends a guest to sign in instead of following', async () => {
    getPublicProfile.mockResolvedValue(profile())
    const onAuthNeeded = vi.fn()
    render(<UserCard userId="u2" session={null} onAuthNeeded={onAuthNeeded} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Follow' }))
    expect(onAuthNeeded).toHaveBeenCalledTimes(1)
    expect(followUser).not.toHaveBeenCalled()
  })

  it('shows no follow button on your own profile', async () => {
    getPublicProfile.mockResolvedValue(profile({ id: 'me' }))
    render(<UserCard userId="me" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('This is you')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Follow' })).not.toBeInTheDocument()
  })

  it('reports a missing profile', async () => {
    getPublicProfile.mockResolvedValue(null)
    render(<UserCard userId="gone" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Could not load this profile')).toBeInTheDocument()
  })

  it('closes on the × button and on the backdrop', async () => {
    getPublicProfile.mockResolvedValue(profile())
    const onClose = vi.fn()
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={onClose} />)
    await screen.findByText('Kasia')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByTestId('user-card-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

Jeśli `common.close` po angielsku brzmi inaczej niż `Close`, sprawdź `src/locales/en.ts` linia 2 i dopasuj nazwę w teście - nie zmieniaj tłumaczenia.

- [ ] **Step 2: Uruchom testy, mają paść**

Run: `npx vitest run src/components/UserCard.test.tsx`
Expected: FAIL - `Cannot find module './UserCard'`.

- [ ] **Step 3: Napisz komponent**

`src/components/UserCard.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import { C, INK, F, SHADOW_BUTTON } from '../lib/tokens'
import { db } from '../lib/supabase'
import { authorInitial } from '../lib/authorLabel'
import { cleanLink } from '../lib/inAppBrowser'
import Avatar from './Avatar'
import OrganicBlob from './OrganicBlob'
import type { PublicProfile } from '../lib/types'

// Karta cudzego profilu, otwierana z wiersza "Dodane przez" w karcie wydarzenia.
//
// Obserwowanie jest optymistyczne: etykieta i licznik zmieniają się od razu,
// a nieudany zapis cofa oba i mówi o tym pod przyciskiem - "Obserwujesz ✓"
// na ekranie musi znaczyć, że wiersz jest w bazie. Auto-obserwacja wydarzeń
// twórcy dzieje się w bazie (trigger), karta tylko o niej mówi.

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; profile: PublicProfile }

/** Host bez schematu i "www." - tyle, ile mieści się w jednej linii karty. */
function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

export default function UserCard({
  userId,
  session,
  onAuthNeeded,
  onClose,
}: {
  userId: string
  session: Session | null
  onAuthNeeded: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [following, setFollowing] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setLoad({ state: 'loading' })
    db.getPublicProfile(userId).then(p => {
      if (!alive) return
      if (!p) { setLoad({ state: 'failed' }); return }
      setFollowing(p.is_following)
      setFollowers(p.followers_count)
      setLoad({ state: 'ready', profile: p })
    })
    return () => { alive = false }
  }, [userId])

  const isMe = !!session && session.user.id === userId
  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }

  async function toggleFollow() {
    if (!session) { onAuthNeeded(); return }
    if (busy) return
    const next = !following
    setBusy(true)
    setFailed(false)
    setFollowing(next)
    setFollowers(n => n + (next ? 1 : -1))
    db.trackClick(next ? 'follow_user' : 'unfollow_user')
    const res = next ? await db.followUser(userId) : await db.unfollowUser(userId)
    setBusy(false)
    if (res && res.error) {
      setFollowing(!next)
      setFollowers(n => n - (next ? 1 : -1))
      setFailed(true)
    }
  }

  const profile = load.state === 'ready' ? load.profile : null
  const color = profile?.avatar_color || C.sky
  const link = profile?.link_url ? cleanLink(profile.link_url) : null

  return (
    <div
      data-testid="user-card-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 320,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
          padding: '32px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Koło z menu bocznego: ten sam gest, ta sama przezroczystość. */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 180, height: 180,
          borderRadius: '50%', background: C.primarySoft, opacity: 0.5, pointerEvents: 'none',
        }} />
        {/* Drugi akcent w kolorze osoby, żeby karta nie była dla każdego taka sama. */}
        <div style={{ position: 'absolute', bottom: -18, left: -18, opacity: 0.35, pointerEvents: 'none' }}>
          <OrganicBlob size={72} color={color} idx={1} />
        </div>

        <button
          onClick={onClose}
          aria-label={t('common.close')}
          style={{
            position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%',
            background: '#fff', border: `2px solid ${INK}22`, color: C.ink,
            fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ×
        </button>

        {load.state === 'loading' && (
          <div style={{ position: 'relative', animation: 'breathe-sm 1.6s ease-in-out infinite' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 14px', background: C.cream, border: `2.5px solid ${INK}22` }} />
            <div style={{ width: 140, height: 18, borderRadius: 999, margin: '0 auto 10px', background: C.cream }} />
            <div style={{ width: 200, height: 12, borderRadius: 999, margin: '0 auto', background: C.cream }} />
          </div>
        )}

        {load.state === 'failed' && (
          <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: C.inkSoft, padding: '16px 0' }}>
            {t('userCard.loadFailed')}
          </div>
        )}

        {profile && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Avatar size={72} color={color} initials={authorInitial(profile.id, profile.display_name, deletedLabels)} />
            </div>

            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
              {profile.display_name?.trim() || '?'}
            </div>

            {(profile.creator_kind || profile.home_name) && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {profile.creator_kind && (
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: C.cream, border: `2px solid ${INK}22`, fontSize: 12, fontWeight: 800, color: C.ink }}>
                    {t(`myData.creatorKind_${profile.creator_kind}`)}
                  </span>
                )}
                {profile.home_name && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: C.cream, border: `2px solid ${INK}22`, fontSize: 12, fontWeight: 800, color: C.ink }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {profile.home_name}
                  </span>
                )}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: C.inkSoft }}>
              {t('userCard.eventsCount', { count: profile.events_count })} · {t('userCard.followersCount', { count: followers })}
            </div>

            {profile.bio && (
              <div style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {profile.bio}
              </div>
            )}

            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 10, fontSize: 14, fontWeight: 800, color: C.primary, textDecoration: 'none', overflowWrap: 'anywhere' }}
              >
                {linkLabel(link)}
              </a>
            )}

            {isMe ? (
              <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: C.inkSoft }}>{t('userCard.thisIsYou')}</div>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  style={{
                    marginTop: 20, width: '100%', padding: '14px', borderRadius: 999,
                    background: following ? '#fff' : C.primary,
                    color: following ? C.ink : '#fff',
                    fontSize: 16, fontWeight: 800,
                    border: `2.5px solid ${INK}`, boxShadow: SHADOW_BUTTON,
                    cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  {following ? t('userCard.following') : t('userCard.follow')}
                </button>
                {failed && (
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: C.primaryPress, lineHeight: 1.5 }}>
                    {t('userCard.followFailed')}
                  </div>
                )}
                {following && !failed && (
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5 }}>
                    {t('userCard.followingHint')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Uruchom testy, mają przejść**

Run: `npx vitest run src/components/UserCard.test.tsx`
Expected: PASS, 9 testów. Typowe potknięcia: `getByText(/12 events/)` nie znajdzie tekstu, jeśli licznik i separator siedzą w jednym węźle tekstowym razem z „8 followers” - wtedy oba `getByText` używają regexów, które i tak pasują do fragmentu; jeśli nadal nie, rozbij liczniki na dwa `<span>`.

- [ ] **Step 5: Sprawdź typy i lint**

Run: `npx tsc -b && npx eslint src/components/UserCard.tsx src/components/UserCard.test.tsx`
Expected: `tsc` może wciąż zgłaszać brak `userCardOpen` w `App.tsx` (Task 4) - to jedyny dopuszczalny błąd; eslint bez błędów.

- [ ] **Step 6: Commit**

```bash
git add src/components/UserCard.tsx src/components/UserCard.test.tsx
git commit -m "Karta użytkownika: profil publiczny, liczniki, obserwowanie"
```

---

### Task 6: `OrganizerRow` i przycisk w `EventSheet`

**Files:**
- Create: `src/screens/event/OrganizerRow.tsx`
- Test: `src/screens/event/OrganizerRow.test.tsx`
- Modify: `src/screens/EventSheet.tsx:11` (import), `src/screens/EventSheet.tsx:120-150` (props), `src/screens/EventSheet.tsx:655-665` (wiersz organizatora)

**Interfaces:**
- Produces: `OrganizerRow({ creatorId, name, color, isModerator, onOpen })`; nowy prop `EventSheet.onOpenUser?: (userId: string) => void`.

- [ ] **Step 1: Napisz test**

`src/screens/event/OrganizerRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OrganizerRow from './OrganizerRow'
import '../../lib/i18n'
import i18n from 'i18next'

describe('OrganizerRow', () => {
  it('opens the creator profile from the name and from the avatar', () => {
    i18n.changeLanguage('en')
    const onOpen = vi.fn()
    render(<OrganizerRow creatorId="u2" name="Kasia" color="#4FC3F7" isModerator={false} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open profile: Kasia' }))
    fireEvent.click(screen.getByText('K'))
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenCalledWith('u2')
  })

  // Konto usunięte: nie ma profilu do otwarcia, więc nie ma czego udawać.
  it('is plain text when the account is gone', () => {
    i18n.changeLanguage('en')
    render(<OrganizerRow creatorId={null} name={null} color={null} isModerator={false} onOpen={() => {}} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Deleted account')).toBeInTheDocument()
  })

  it('marks the moderator', () => {
    i18n.changeLanguage('en')
    render(<OrganizerRow creatorId="me" name="Ja" color={null} isModerator onOpen={() => {}} />)
    expect(screen.getByText('Moderator')).toBeInTheDocument()
  })
})
```

Etykiety „Deleted account” i „Moderator” sprawdź w `src/locales/en.ts` (`account.deletedUser`, `event.moderator`) i dopasuj test do faktycznych tekstów - nie zmieniaj tłumaczeń.

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run src/screens/event/OrganizerRow.test.tsx`
Expected: FAIL - `Cannot find module './OrganizerRow'`.

- [ ] **Step 3: Napisz komponent**

`src/screens/event/OrganizerRow.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import Avatar from '../../components/Avatar'
import { C } from '../../lib/tokens'
import { authorLabel, authorInitial } from '../../lib/authorLabel'

// Wiersz "Dodane przez X" pod opisem wydarzenia.
//
// Avatar jest już przyciskiem, więc drugi przycisk obejmuje tylko tekst -
// zagnieżdżony <button> w <button> jest nieprawidłowym HTML-em i czytniki
// ekranu gubią wtedy jeden z nich. Oba prowadzą w to samo miejsce.
//
// creator_id = null znaczy "konto usunięte, wydarzenie zostało": nie ma
// profilu do otwarcia, więc wiersz zostaje zwykłym tekstem.

export default function OrganizerRow({
  creatorId,
  name,
  color,
  isModerator,
  onOpen,
}: {
  creatorId: string | null | undefined
  name: string | null | undefined
  color: string | null | undefined
  isModerator: boolean
  onOpen: (userId: string) => void
}) {
  const { t } = useTranslation()
  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }
  const label = authorLabel(creatorId, name, deletedLabels)
  const open = creatorId ? () => onOpen(creatorId) : undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Avatar size={28} initials={authorInitial(creatorId, name, deletedLabels)} color={color || C.sky} onClick={open} />
      <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>
        {t('event.organizer')}{' '}
        {open ? (
          <button
            onClick={open}
            aria-label={t('userCard.openProfile', { name: label })}
            style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', fontWeight: 800, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${C.ink}44`, textUnderlineOffset: 3 }}
          >
            {label}
          </button>
        ) : (
          <strong style={{ color: C.ink }}>{label}</strong>
        )}
      </span>
      {isModerator && (
        <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 999, background: C.primarySoft, color: C.primaryPress, fontSize: 11, fontWeight: 800 }}>{t('event.moderator')}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run src/screens/event/OrganizerRow.test.tsx`
Expected: PASS, 3 testy.

- [ ] **Step 5: Podepnij do `EventSheet`**

W `src/screens/EventSheet.tsx`:

Import obok `PhotoLightbox` (linia ~13):

```ts
import OrganizerRow from './event/OrganizerRow'
```

Props (po `chainCanGo` w destrukturyzacji i w typie, linia ~133 i ~150):

```ts
  onOpenUser,
```

```ts
  /** Tap w organizatora; brak = wiersz zostaje zwykłym tekstem. */
  onOpenUser?: (userId: string) => void
```

Zastąp cały blok `{/* Creator — compact inline */}` (linie ~655-665, od `<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>` do zamykającego `</div>`) jednym wywołaniem:

```tsx
              <OrganizerRow
                creatorId={event.creator_id}
                name={event.profiles?.display_name}
                color={event.profiles?.avatar_color}
                isModerator={session?.user.id === event.creator_id}
                onOpen={id => onOpenUser?.(id)}
              />
```

Po tej zmianie `authorLabel`/`authorInitial` mogą być w `EventSheet` nieużywane - sprawdź `grep -n "authorLabel\|authorInitial" src/screens/EventSheet.tsx`; jeśli zostało tylko w imporcie, usuń import, inaczej eslint zgłosi `no-unused-vars`. `deletedLabels` (linia 262) jest używane także w czacie - zostaje.

- [ ] **Step 6: Sprawdź typy i lint**

Run: `npx tsc -b && npx eslint src/screens/EventSheet.tsx src/screens/event/OrganizerRow.tsx src/screens/event/OrganizerRow.test.tsx`
Expected: jedyny dopuszczalny błąd `tsc` to brak `userCardOpen` w `App.tsx` (Task 7); eslint czysty.

- [ ] **Step 7: Commit**

```bash
git add src/screens/event/OrganizerRow.tsx src/screens/event/OrganizerRow.test.tsx src/screens/EventSheet.tsx
git commit -m "Wiersz organizatora w karcie wydarzenia jest przyciskiem"
```

---

### Task 7: Warstwa `userCard` w `App.tsx`

**Files:**
- Modify: `src/App.tsx:52` (import), `:105` (stan), `:246-256` i `:282-298` (`navLayersRef`), `:264-280` (`overlayRef`), `:300-319` (`popstate`), `:328-331` (reset przy zamknięciu karty), `:1187-1235` (trzy `EventSheet`), `:1372-1385` (render modala)

**Interfaces:**
- Consumes: `UserCard` (Task 5), `EventSheet.onOpenUser` (Task 6), `OverlayFlags.userCardOpen` (Task 4).

- [ ] **Step 1: Import i stan**

Po `import AttendanceAskModal from './components/AttendanceAskModal'` (linia 52):

```ts
import UserCard from './components/UserCard'
```

Po `const [authModal, setAuthModal] = useState<'event' | 'chat' | null>(null)` (linia 105):

```ts
  // Karta cudzego profilu - warstwa historii jak czat: otwarcie robi pushState,
  // gest wstecz zamyka ją, a nie kartę wydarzenia pod nią.
  const [userCardId, setUserCardId] = useState<string | null>(null)
```

- [ ] **Step 2: Lustro warstw**

W `navLayersRef = useRef({ … })` (linia 246) dodaj po `authModal,`:

```ts
    userCardId,
```

W `useEffect` aktualizującym `navLayersRef.current` (linia ~283) dodaj po `authModal,`:

```ts
      userCardId,
```

i dopisz `userCardId` do listy zależności tego efektu (linia 298):

```ts
  }, [screen, myEventSelected, followedEventSelected, authModal, userCardId, eventChatOpen, selEvent, createOpen, accountOpen, myDataOpen, profileOpen])
```

W `overlayRef.current = { … }` (linia ~264) po `attendanceAskOpen,`:

```ts
    userCardOpen: !!userCardId,
```

- [ ] **Step 3: Gest wstecz**

W `onPopState` (linia ~302) po gałęzi `if (s.authModal) { … }` a przed `if (s.eventChatOpen)`:

```ts
      // Karta użytkownika leży nad wydarzeniem i czatem; logowanie nad nią.
      if (s.userCardId) { setUserCardId(null); return }
```

- [ ] **Step 4: Reset przy zamknięciu karty wydarzenia**

W efekcie z komentarzem „Zamknięcie karty w dowolny sposób kończy też rozmowę” (linia ~328) rozszerz ciało:

```ts
    if (!selEvent && !myEventSelected && !followedEventSelected) { setEventChatOpen(false); setUserCardId(null) }
```

- [ ] **Step 5: Podaj `onOpenUser` do trzech `EventSheet`**

Obok `eventChatProps` (linia ~1110) zdefiniuj jeden handler:

```ts
  const openUserCard = (id: string) => {
    setUserCardId(id)
    window.history.pushState({ layer: 'userCard' }, '')
  }
```

W każdym z trzech `<EventSheet …>` (linie ~1187, ~1204, ~1221) dodaj prop:

```tsx
          onOpenUser={openUserCard}
```

- [ ] **Step 6: Render modala**

Po bloku `{attendanceAskOpen && attendanceCandidate && session && ( <AttendanceAskModal … /> )}` (linia ~1385):

```tsx
      {userCardId && (
        <UserCard
          userId={userCardId}
          session={session}
          onAuthNeeded={() => { setAuthModal('event'); window.history.pushState({ layer: 'auth' }, '') }}
          onClose={() => window.history.back()}
        />
      )}
```

- [ ] **Step 7: Sprawdź typy, testy, lint**

Run: `npx tsc -b && npx vitest run && npm run lint`
Expected: wszystko zielone - to pierwszy moment od Task 4, w którym `tsc` ma prawo być czysty.

- [ ] **Step 8: Sprawdź w przeglądarce (dev server)**

Uruchom podgląd deweloperski (`.claude/launch.json` / `npm run dev`), otwórz wydarzenie z żyjącym twórcą i sprawdź:
1. tap w nazwę i w avatar organizatora otwiera kartę;
2. gest wstecz (przycisk wstecz przeglądarki) zamyka kartę, wydarzenie zostaje;
3. jako gość „+ Obserwuj” otwiera logowanie nad kartą; wstecz wraca do karty;
4. zalogowany: follow → etykieta i licznik; odśwież stronę → karta pamięta stan z bazy;
5. „Obserwowane” w menu pokazuje bieżące wydarzenia tego twórcy;
6. klik w mapę przy otwartej karcie zamyka i kartę, i wydarzenie, bez osieroconego wpisu w historii (kolejne wstecz nie otwiera niczego dziwnego).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "Karta użytkownika otwierana z organizatora, zamykana gestem wstecz"
```

---

### Task 8: Obserwujący twórcy w `push-new-event`

**Files:**
- Modify: `supabase/functions/_shared/audience.ts:36-64`
- Test: `supabase/functions/_shared/audience.test.ts` (po bloku `public events`, przed `private events`)
- Modify: `supabase/functions/push-new-event/index.ts:92-108`

**Interfaces:**
- Consumes: trigger z Task 1 (obserwujący twórcy siedzą już w `event_follows` nowego wydarzenia).
- Produces: `selectEventAudience` dla `isPrivate: false` zwraca `geo/tagi ∪ followerIds` bez twórcy przy `excludeCreator`.

- [ ] **Step 1: Napisz testy**

W `supabase/functions/_shared/audience.test.ts` po `describe('selectEventAudience — public events', …)` dodaj:

```ts
describe('selectEventAudience — public events with creator followers', () => {
  // Obserwowanie twórcy to jawne "chcę wiedzieć o wszystkim od tej osoby" -
  // promień i tagi nie mają tu głosu.
  it('adds followers regardless of distance and interests', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: ['music'],
      followerIds: ['far-sport-fan'],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['far-sport-fan', 'near-music'])
  })

  it('does not duplicate a follower who is also nearby', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: [],
      followerIds: ['near-music'],
      profiles: [NEARBY_MUSIC, NEARBY_SPORT],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['near-music', 'near-sport'])
  })

  // Twórca obserwuje własne wydarzenie od chwili utworzenia, więc zawsze jest
  // w followerIds - i nadal nie ma dostać powiadomienia o sobie.
  it('still drops the creator when they are among the followers', () => {
    const ids = selectEventAudience({
      isPrivate: false,
      tags: [],
      creatorId: 'creator',
      excludeCreator: true,
      followerIds: ['creator', 'far-music'],
      profiles: [NEARBY_SPORT],
      ...EVENT,
    })
    expect([...ids].sort()).toEqual(['far-music', 'near-sport'])
  })
})
```

- [ ] **Step 2: Uruchom testy, mają paść**

Run: `npx vitest run supabase/functions/_shared/audience.test.ts`
Expected: FAIL - trzy nowe testy (followerIds ignorowane dla publicznych).

- [ ] **Step 3: Zmień `selectEventAudience`**

W `supabase/functions/_shared/audience.ts` zastąp końcówkę funkcji (od `return profiles.filter(` do końca) tym:

```ts
  const geo = profiles.filter((p) => {
    if (tags.length > 0) {
      const interests = p.interests ?? []
      if (!interests.some((i) => tags.includes(i))) return false
    }
    const radius = Math.min(p.radius_km ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    return haversineKm(p.last_lat, p.last_lng, lat, lng) <= radius
  }).map((p) => p.id)

  // Obserwujący twórcy (w event_follows od chwili utworzenia, przez trigger
  // w bazie) dochodzą niezależnie od promienia i tagów - to ich wybór.
  const ids = new Set([...geo, ...followerIds])
  if (excludeCreator && creatorId) ids.delete(creatorId)
  return [...ids]
}
```

Zaktualizuj komentarz przy `followerIds` w typie opcji:

```ts
  /** Followers of this event — reached regardless of distance and interests. */
  followerIds?: string[]
```

i nagłówek pliku (linie 1-6): dopisz zdanie „Public events additionally reach the event's followers - at insert time those are the creator's followers, added by a database trigger.”

- [ ] **Step 4: Uruchom testy, mają przejść**

Run: `npx vitest run supabase/functions/_shared/audience.test.ts`
Expected: PASS - stare testy publiczne (`toEqual(['near-music'])` itd.) nadal przechodzą, bo bez `followerIds` zbiór jest równy dawnej liście w tej samej kolejności.

- [ ] **Step 5: Podaj obserwujących w `push-new-event`**

W `supabase/functions/push-new-event/index.ts` przed `const audienceIds = selectEventAudience({` (linia ~97) dodaj:

```ts
  // Obserwujący twórcy są już w event_follows: trigger w bazie dopisał ich w
  // tej samej transakcji, co insert wydarzenia. Twórca też tu jest - wypada
  // niżej przez excludeCreator.
  const { data: followRows, error: followErr } = await admin
    .from('event_follows').select('user_id').eq('event_id', eventId)
  if (followErr) console.error('[push-new-event] follows error:', followErr)
  const followerIds: string[] = (followRows ?? []).map((r: { user_id: string }) => r.user_id)
  console.log(`[push-new-event] event followers at insert: ${followerIds.length}`)
```

i do wywołania `selectEventAudience({ … })` dodaj po `creatorId,`:

```ts
    followerIds,
```

- [ ] **Step 6: Sprawdź typy funkcji Deno (jeśli `deno` jest dostępne)**

Run: `deno check supabase/functions/push-new-event/index.ts`
Expected: bez błędów. Bez `deno` lokalnie: przeczytaj diff jeszcze raz; typy zweryfikuje deploy na staging.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/audience.ts supabase/functions/_shared/audience.test.ts supabase/functions/push-new-event/index.ts
git commit -m "Push o nowym wydarzeniu dociera też do obserwujących twórcy"
```

- [ ] **Step 8: Deploy na staging i test end-to-end**

Run: `supabase functions deploy push-new-event --project-ref ujzmivdgibnnncmoqoyb` (ref stagingu jak w `scripts/deploy-staging.sh`; **nie** uruchamiaj całego skryptu - robi `supabase db push`, a migracje w tym projekcie idą ręcznie przez SQL Editor).
Sprawdź: konto A obserwuje twórcę B, ma push włączony i pozycję daleko od miejsca wydarzenia; B dodaje publiczne wydarzenie → A dostaje „nowe wydarzenie”. B dodaje prywatne → A nic nie dostaje i nie widzi go w „Obserwowane”.

---

### Task 9: Dokumenty prawne

**Files:**
- Modify: `docs/legal/privacy-policy.md:21`, `:64`, `:107`, `:150` (po wierszu o subskrypcji push w każdym języku)
- Modify: `docs/legal/compliance-requirements.md:30` (po wierszu `Wyciszenia powiadomień`)

- [ ] **Step 1: Polityka prywatności**

Po linii 21 (`| Subskrypcja push (endpoint urządzenia) | … |`):

```
| Obserwowani twórcy (lista kont, które obserwujesz) | Automatyczne obserwowanie ich wydarzeń i powiadomienia o nich | Zgoda |
```

Po linii 64 (`| Push subscription (device endpoint) | … |`):

```
| Followed creators (the accounts you follow) | Automatically following their events and notifying you about them | Consent |
```

Po linii 107 (`| Push-Abonnement (Geräte-Endpoint) | … |`):

```
| Gefolgte Veranstalter (Konten, denen du folgst) | Automatisches Folgen ihrer Veranstaltungen und Benachrichtigungen dazu | Einwilligung |
```

Po linii 150 (`| Suscripción push (endpoint del dispositivo) | … |`):

```
| Creadores seguidos (cuentas que sigues) | Seguimiento automático de sus eventos y notificaciones sobre ellos | Consentimiento |
```

Numery linii przesuwają się o jeden po każdym wstawieniu - wstawiaj od dołu (ES, DE, EN, PL) albo szukaj po treści wiersza push.

- [ ] **Step 2: Wymagania zgodności**

W `docs/legal/compliance-requirements.md` po wierszu `| Wyciszenia powiadomień | Użytkownik ustawia | notification_mutes | Preferencje push |`:

```
| Obserwowani twórcy (`user_follows`) | Użytkownik klika „Obserwuj” | `user_follows` (RLS: tylko własne wiersze) | Auto-obserwowanie wydarzeń twórcy, push o nowych. Kasowane w `archive_and_anonymize_user` |
```

- [ ] **Step 3: Commit**

```bash
git add docs/legal/privacy-policy.md docs/legal/compliance-requirements.md
git commit -m "Polityka prywatności: obserwowani twórcy"
```

---

### Task 10: Weryfikacja końcowa i wdrożenie

**Files:** brak nowych.

- [ ] **Step 1: Pełna weryfikacja**

Run: `npx tsc -b && npm test && npm run lint`
Expected: wszystko zielone. Jeśli `npm test` zgłasza coś poza plikami z tego planu, to regresja - napraw przed dalszymi krokami.

- [ ] **Step 2: Lista kontrolna staging (klient)**

Po deployu klienta na staging (`scripts/deploy-staging.sh`) przejdź punkty z Task 7 Step 8 na telefonie (Android: przycisk wstecz systemowy zamyka kartę, nie aplikację) i dodatkowo: karta profilu z pustymi polami (tylko avatar, nazwa, liczniki, przycisk); własny profil („To Ty”); profil usunięty (konto skasowane → wiersz organizatora nie jest przyciskiem).

- [ ] **Step 3: PROD**

Kolejność: migracja `20260903_user_follows.sql` w SQL Editorze PROD → deploy `push-new-event` na PROD → klient. Odwrotnie klient dostanie 404 z `get_public_profile` i karta pokaże `loadFailed`.

- [ ] **Step 4: Zakończenie gałęzi**

Użyj skillu `superpowers:finishing-a-development-branch` - merge `user_card` do `staging` po zatwierdzeniu przez właściciela.
