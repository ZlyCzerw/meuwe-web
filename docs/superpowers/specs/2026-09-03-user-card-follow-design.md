# Karta użytkownika i obserwowanie twórców - projekt

**Status:** zatwierdzony w rozmowie 2026-09-03, czeka na plan wdrożenia.
**Poprzednik:** `2026-09-02-user-profile-design.md` (pola publiczne profilu, które ta karta pokazuje).

## Po co

W karcie wydarzenia widać „Dodane przez X”, ale X jest tylko napisem. Nie da się zobaczyć, kim jest ta osoba, ani zapisać się na to, co doda następnym razem. To zadanie dodaje dwie rzeczy:

1. **Karta użytkownika** - modal otwierany tapnięciem w organizatora: avatar, nazwa, publiczne pola profilu (bio, rodzaj konta, miejscowość, link), liczba wydarzeń i obserwujących.
2. **Obserwowanie twórcy** - przycisk „+ Obserwuj”. Kto obserwuje twórcę, obserwuje automatycznie wszystkie jego publiczne wydarzenia: bieżące od razu, a każde nowe w chwili dodania. Dzięki temu dostaje o nich powiadomienia (nowe wydarzenie, start, zmiany, wiadomości) tak samo, jakby zaobserwował każde z osobna.

Spec profilu z 2026-09-02 wprost zostawił obie te rzeczy jako „następny krok” i przygotował pod nie pola.

## Stan obecny

- `profiles` ma publiczne: `name_shown`, `avatar_color`, `bio`, `home_name`, `creator_kind`, `link_url`. Polityka SELECT `using (true)` z grantem kolumnowym - te kolumny są czytelne dla `anon` i `authenticated`.
- Obserwowanie wydarzeń: tabela `event_follows (user_id, event_id)`, RLS „tylko własne wiersze” na wszystkie operacje. Twórca obserwuje własne wydarzenie od razu (klient wstawia wiersz w `createEvent`).
- Funkcje push `push-event-start`, `push-event-updated`, `push-new-message` czytają `event_follows` - każdy wiersz w tej tabeli automatycznie dostaje te powiadomienia. `push-new-event` liczy odbiorców z promienia i tagów; `selectEventAudience` ma parametr `followerIds`, używany dziś tylko dla wydarzeń prywatnych.
- Wydarzenia prywatne (`is_private`) widzą przez RLS tylko twórca i obserwujący. Wiersz w `event_follows` jest więc równocześnie **uprawnieniem do zobaczenia** wydarzenia.
- Warstwy UI zamyka gest wstecz przez jeden handler `popstate` w `App.tsx`; kolejność gałęzi definiuje, co leży na czym. `OverlayFlags` w `lib/overlays.ts` ma pole na każdą warstwę, wszystkie wymagane - kompilator wymusza dopisanie nowej.
- Wiersz organizatora: [EventSheet.tsx:659](../../../src/screens/EventSheet.tsx#L659), zwykły `span`. Etykietę i inicjał liczy `authorLabel.ts` (rozróżnia konto usunięte od brakującej nazwy).
- Element graficzny menu bocznego: duże półprzezroczyste koło `C.primarySoft` z `opacity: 0.5` wystające poza róg ([ProfilePanel.tsx:182](../../../src/screens/ProfilePanel.tsx#L182)). Modale wzorcowe: `FollowNotifyModal` (tło `rgba(45,43,42,0.45)`, karta `borderRadius: 32`, animacja `bubble-up`).

## Decyzje podjęte w rozmowie

| Pytanie | Decyzja |
|---|---|
| Które wydarzenia dostaje obserwujący po kliknięciu „Obserwuj” | Bieżące (trwające i nadchodzące) publiczne od razu, każde nowe automatycznie. Zakończone i prywatne nigdy. |
| Co przy unfollow twórcy | Auto-obserwacje wydarzeń zostają. Nie odróżniamy „zaobserwowałem sam” od „doszło automatycznie” - użytkownik odobserwuje pojedyncze wydarzenia jak dziś. |
| Push o nowym wydarzeniu twórcy | Obserwujący dostaje zawsze, niezależnie od promienia i zainteresowań. |
| Liczniki na karcie | Oba: liczba wydarzeń i obserwujących. |
| Skąd otwiera się karta | Tylko z wiersza organizatora w `EventSheet`. Autorzy wiadomości w czacie - poza zakresem. |

## 1. Baza - migracja `20260903_user_follows.sql`

Uruchamiana ręcznie w Supabase Dashboard → SQL Editor, najpierw staging. Idempotentna.

### Tabela `user_follows`

| Kolumna | Typ |
|---|---|
| `follower_id` | `uuid references auth.users on delete cascade not null` |
| `creator_id` | `uuid references auth.users on delete cascade not null` |
| `created_at` | `timestamptz default now()` |

Klucz główny `(follower_id, creator_id)`, `check (follower_id <> creator_id)`, indeks po `creator_id` (fan-out przy nowym wydarzeniu, licznik obserwujących).

RLS włączone; jedna polityka `for all to authenticated using (auth.uid() = follower_id) with check (auth.uid() = follower_id)`, jak w `event_follows`. `anon` nic nie czyta. Klient wstawia i kasuje bezpośrednio przez PostgREST.

### Trigger: nowy obserwujący → bieżące wydarzenia twórcy

`after insert on user_follows`, funkcja `security definer` (wstawia do `event_follows` po `events` bez oglądania się na RLS):

```sql
insert into event_follows (user_id, event_id)
select new.follower_id, e.id
from events e
where e.creator_id = new.creator_id
  and not e.is_private
  and e.status <> 'ended'
  and e.end_time >= now()
on conflict do nothing;
```

`end_time >= now()` celowo bez okresu łaski „extended”: kto zaobserwował twórcę pięć minut po formalnym końcu imprezy, nie potrzebuje powiadomienia o niej.

### Trigger: nowe wydarzenie → obserwujący twórcy

`after insert or update of is_private on events`, wykonywany gdy `new.is_private = false` i `new.creator_id is not null`, `security definer`:

```sql
insert into event_follows (user_id, event_id)
select uf.follower_id, new.id
from user_follows uf
where uf.creator_id = new.creator_id
on conflict do nothing;
```

`update of is_private` obsługuje odsłonięcie wydarzenia prywatnego - obserwujący dochodzą wtedy tak samo, jakby wydarzenie powstało w tej chwili. W drugą stronę (upublicznione → prywatne) nic nie kasujemy: twórca sam decyduje, kogo zostawić.

Trigger działa w tej samej transakcji co insert, więc gdy webhook `push-new-event` dotrze do funkcji, obserwujący już siedzą w `event_follows` (patrz sekcja 2).

### RPC `get_public_profile(p_user_id uuid)`

`security definer`, `set search_path = public`, `grant execute to anon, authenticated`. Jeden wiersz albo nic (profil usunięty):

| Kolumna | Skąd |
|---|---|
| `id` | `profiles.id` |
| `display_name` | `profiles.name_shown` - ten sam alias, co `PROFILE_PUBLIC` w kliencie |
| `avatar_color`, `bio`, `home_name`, `creator_kind`, `link_url` | `profiles` |
| `events_count` | `count(*)` z `events where creator_id = p_user_id and not is_private` - łącznie z zakończonymi, bo to dorobek twórcy |
| `followers_count` | `count(*)` z `user_follows where creator_id = p_user_id` |
| `is_following` | `exists (... where follower_id = auth.uid() and creator_id = p_user_id)`; dla `anon` zawsze `false` |

Liczniki muszą iść przez `security definer`: RLS na `event_follows` i `user_follows` pokazuje tylko własne wiersze, a `events` chowa prywatne - oba liczniki liczone „od dołu” byłyby fałszywe. Funkcja zwraca wyłącznie kolumny, które i tak są publiczne, plus dwie liczby.

### Usuwanie konta

`archive_and_anonymize_user` (migracja 20260728) dostaje jawne `delete from user_follows where follower_id = p_user or creator_id = p_user` obok pozostałych tabel. Kaskada z `auth.users` zrobiłaby to sama, ale ta funkcja wymienia każdą tabelę z osobna - nowa nie może być wyjątkiem.

## 2. Powiadomienia - `push-new-event`

Po policzeniu odbiorców z promienia i tagów funkcja pobiera `event_follows.user_id` dla nowego wydarzenia (to obserwujący twórcy dopisani przez trigger, plus sam twórca) i przekazuje jako `followerIds`. `selectEventAudience` dla wydarzeń **publicznych** zwraca sumę: odbiorcy geo/tagi ∪ `followerIds`, nadal bez twórcy gdy `excludeCreator`. Gałąź prywatna bez zmian.

`filterDeliverable` dalej jest jedyną bramką (push włączony, urządzenie, wyciszenie) - obserwowanie twórcy nie omija żadnej z tych reguł.

`push-event-start` też pobiera `event_follows.user_id` dla wydarzenia i przekazuje jako `followerIds` - dla wydarzeń publicznych ta sama suma geo/tagi ∪ obserwujących, co wyżej. `push-event-updated` i `push-new-message` czytają `event_follows` wprost i nie wymagają zmian.

## 3. Klient

### Warstwa w `App.tsx`

- Stan `userCardId: string | null`. Otwarcie: `setUserCardId(id); window.history.pushState({ layer: 'userCard' }, '')`.
- `popstate`: nowa gałąź `if (s.userCardOpen) { setUserCardId(null); return }` **między** `authModal` a `eventChatOpen`. Logowanie (gość klika „Obserwuj”) otwiera się nad kartą użytkownika, karta nad wydarzeniem i nad czatem.
- `OverlayFlags` dostaje wymagane `userCardOpen: boolean`; `isScreenClear` uwzględnia je (karta blokuje promo i push-ask).
- Efekt, który zeruje czat przy zamknięciu karty wydarzenia w dowolny sposób (klik w mapę, otwarcie profilu), zeruje też `userCardId`.
- `<UserCard>` renderowany w `App.tsx` obok innych modali, gdy `userCardId` jest ustawione. `onAuthNeeded` robi to samo, co w `EventSheet`: `setAuthModal('event'); pushState({ layer: 'auth' })`.

### `EventSheet`

Wiersz „Dodane przez X” staje się przyciskiem (`background: none`, ten sam wygląd, `aria-label` z nazwą) wołającym nowy prop `onOpenUser?: (id: string) => void`. Gdy `creator_id` jest `null` (konto usunięte), zostaje zwykły tekst jak dziś. Trzy miejsca montowania `EventSheet` w `App.tsx` przekazują ten sam handler.

### `components/UserCard.tsx`

Props: `userId`, `session`, `onAuthNeeded`, `onClose`.

**Dane:** przy montowaniu `db.getPublicProfile(userId)`. Trzy stany: ładowanie (karta z avatarem-placeholderem i pulsującymi paskami `breathe-sm`), błąd/brak profilu (`userCard.loadFailed` i przycisk zamknięcia), dane.

**Układ, od góry:**
1. Tło jak w `FollowNotifyModal`; karta biała, `borderRadius: 32`, `maxWidth: 360`, `overflow: hidden`, `bubble-up`. W prawym górnym rogu koło `C.primarySoft`, `opacity: 0.5`, ~180 px, wystające poza kartę - cytat z menu bocznego. W lewym dolnym rogu mały `OrganicBlob` (`idx` 1, kolor avatara, `opacity` ~0.35) jako drugi akcent.
2. Przycisk „×” w prawym górnym rogu (`aria-label` `common.close`).
3. `Avatar` 72 px z inicjałem (`authorInitial`) w kolorze avatara, wycentrowany, częściowo na kole.
4. Nazwa: `F.display`, 22 px, 900. Poniżej w jednej linii pigułki: rodzaj konta (`myData.creatorKind_*`, tło `C.cream`, obrys `INK22`) i miejscowość z pinezką z `mapIcons`/inline SVG. Pusta wartość = pigułka znika.
5. Linia liczników `userCard.eventsCount` · `userCard.followersCount` (i18next `_one/_few/_many/_other`), `C.inkSoft`, 600.
6. Bio: 15 px, 600, `C.ink`, `whiteSpace: pre-wrap`.
7. Link: `cleanLink(link_url)` z `inAppBrowser.ts`, pokazany jako host bez schematu, `target="_blank" rel="noopener noreferrer"`, jak `linkify`.
8. Przycisk obserwowania (pełna szerokość, pigułka, `border 2.5px INK`, `SHADOW_BUTTON`):
   - nie obserwuję: `C.primary`, biały tekst, `userCard.follow` („+ Obserwuj”);
   - obserwuję: tło `#fff`, tekst `C.ink`, `userCard.following` („Obserwujesz ✓”), pod spodem `userCard.followingHint` („Obserwujesz też wszystkie wydarzenia tej osoby”) 13 px `C.inkSoft`;
   - własny profil (`session.user.id === userId`): przycisk znika, zamiast niego `userCard.thisIsYou`.
   Gość: klik → `onAuthNeeded()`.

**Zachowanie przycisku:** optymistyczne - stan i licznik obserwujących zmieniają się od razu, `db.followUser` / `db.unfollowUser` w tle; błąd cofa oba i pokazuje `userCard.followFailed` pod przyciskiem. Podwójny klik w trakcie żądania jest ignorowany (`busy`). `db.trackClick('follow_user' | 'unfollow_user')`.

**Zamykanie:** tap poza kartą i „×” wołają `onClose`, który w `App.tsx` robi `window.history.back()`.

### `lib/supabase.ts` i `lib/types.ts`

- `PublicProfile` w `types.ts`: kolumny RPC z sekcji 1.
- `db.getPublicProfile(id): Promise<PublicProfile | null>` - `rpc('get_public_profile')`, `maybeSingle`, błąd logowany i zwracany jako `null`.
- `db.followUser(id)` / `db.unfollowUser(id)` - insert/delete na `user_follows` z `follower_id = sesja`; bez sesji nic nie robią.
- `trackClick` rozszerzone o `'follow_user' | 'unfollow_user'`.

### Teksty

Klucze `userCard.*` w **pl/en/es/de/sl** (`locales/parity.test.ts` wymusza komplet): `follow`, `following`, `followingHint`, `thisIsYou`, `eventsCount_*`, `followersCount_*`, `loadFailed`, `followFailed`. Rodzaj konta reużywa `myData.creatorKind_*`, zamknięcie `common.close`.

### Dokumenty

- `docs/legal/privacy-policy.md` (PL/EN/DE/ES): wiersz „Obserwowani twórcy (lista kont, które obserwujesz)” - cel: automatyczne obserwowanie ich wydarzeń i powiadomienia - podstawa: zgoda.
- `docs/legal/compliance-requirements.md`: wiersz `user_follows` w tabeli sekcji 1 (skąd: użytkownik klika „Obserwuj”; gdzie: `user_follows`, RLS tylko własne; cel: auto-obserwowanie wydarzeń, push). Nota: wiersz kasowany w `archive_and_anonymize_user`.

## Kolejność wdrożenia

1. Migracja na **staging**. Sprawdzić w SQL Editorze: `get_public_profile` dla własnego id zwraca liczniki; insert do `user_follows` dopisuje bieżące wydarzenia twórcy do `event_follows`; nowe publiczne wydarzenie twórcy pojawia się w `event_follows` obserwującego; prywatne nie.
2. Klient na staging: karta z profilu z pełnymi polami i z pustym; gość; własny profil; follow/unfollow; gest wstecz zamyka kartę, nie wydarzenie; logowanie nad kartą; auto-obserwowane wydarzenie widoczne w „Obserwowane”.
3. Deploy `push-new-event` na staging, test: nowe wydarzenie twórcy → push do obserwującego spoza promienia.
4. Migracja i funkcja na PROD, potem klient.

Odwrotnie klient wywali się na brakującym RPC (`getPublicProfile` → 404 → karta pokazuje `loadFailed`).

## Testy

Vitest obok modułów, wzorem istniejących:

- `UserCard.test.tsx` (testing-library, `db` zamockowane): renderuje nazwę, bio, pigułki i liczniki; puste pola nie renderują pigułek; klik „Obserwuj” woła `followUser`, zmienia etykietę i licznik; drugi klik woła `unfollowUser`; gość → `onAuthNeeded`, `followUser` nie wołany; własny id → brak przycisku; `null` z RPC → `loadFailed`; odrzucony `followUser` cofa etykietę i pokazuje `followFailed`.
- `overlays.test.ts`: `userCardOpen: true` → `isScreenClear` zwraca `false`.
- `_shared/audience.test.ts` (Deno): publiczne wydarzenie z `followerIds` spoza promienia → są w wyniku; twórca w `followerIds` z `excludeCreator` → nie ma go; brak duplikatów, gdy obserwujący jest też w promieniu.
- `EventSheet`: test, że wiersz organizatora z `creator_id` jest przyciskiem wołającym `onOpenUser`, a z `creator_id = null` nie jest.

Na koniec `npx tsc -b`, `npm test`, `npm run lint`.

## Poza zakresem

- Tap na autora wiadomości w czacie.
- Lista obserwowanych twórców w menu, lista obserwujących.
- Kasowanie auto-obserwacji przy unfollow (wymagałoby kolumny `via_user_follow` w `event_follows`).
- Powiadomienie twórcy „ktoś Cię obserwuje”.
- Ranking twórców per widok mapy - `events_count` i `followers_count` z tego RPC są jego pierwszym składnikiem.
