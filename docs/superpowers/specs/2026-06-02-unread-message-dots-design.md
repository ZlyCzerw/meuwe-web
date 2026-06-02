# Kropki powiadomień o nowych wiadomościach (in-app)

**Data:** 2026-06-02
**Status:** zatwierdzony design
**Zakres:** in-app wskaźnik (kropka) nieprzeczytanych wiadomości w obserwowanych/własnych eventach

## Kontekst

W obserwowanym lub stworzonym przez siebie evencie ktoś może napisać na czacie.
Chcemy pokazać w aplikacji **kropkę** (kolor Sunshine `#FFD54F`, z ciemnym
obrysem) sygnalizującą nieprzeczytane wiadomości — wzorem oryginalnego designu
(kropka przy ikonce menu/avatara).

Istniejąca infrastruktura (ważna dla spójności):
- **`event_follows`** — „jedyne źródło prawdy" dla powiadomień o wiadomościach
  (tak filtruje edge function `push-new-message`: odbiorcy = obserwujący − autor).
- **Twórca auto-obserwuje** swój event (`createEvent` wstawia wiersz do
  `event_follows`), więc „moje wydarzenia" ⊆ „obserwowane".
- Edge function `push-new-message` jest wyzwalana webhookiem na INSERT do
  `event_messages`; respektuje `notification_mutes` i wymaga `push_enabled`.
- Realtime: `subscribeMessages(eventId)` istnieje tylko dla otwartego eventu;
  `subscribeEvents` subskrybuje wszystkie zmiany w `events`.
- Status `ended` liczony w `eventStatus.ts` (`status==='ended'` lub
  `now > end_time + 1h`).

## Cele / reguły (uzgodnione)

1. Kropka pojawia się, gdy **ktoś inny** (nie ja) napisze w evencie który
   obserwuję lub stworzyłem.
2. **Real-time** — kropka pojawia się natychmiast (globalna subskrypcja, gdy
   apka otwarta).
3. **Liczba wiadomości nie zmienia liczby kropek** — kropka jest binarna per event.
4. **Otwarcie karty eventu** (dowolny stan: half/full) kasuje kropkę (oznacza
   event jako przeczytany).
5. **Otwarty event nie zbiera kropki** — gdy patrzysz na kartę/czat, nowe
   wiadomości tego eventu nie zapalają kropki.
6. Propagacja na 3 poziomach: ikonka menu → pozycja w menu
   („Moje wydarzenia" / „Obserwowane") → konkretny event na liście.
   Logika odczytu/kasowania: event → ekran → ikonka menu.
7. **Zakończenie eventu** automatycznie usuwa jego kropki.
8. **Mutes (`notification_mutes`) są ignorowane** dla kropki — wyciszenie ucisza
   tylko push; w apce kropka nadal się pokazuje.
9. Kropka **niezależna od `push_enabled`** — działa nawet bez zgody na push.
10. Goście (bez sesji) — brak kropek.

## Non-goals

- Brak zmian w edge functions / webhooku push.
- Brak licznika liczby wiadomości (kropka binarna).
- Brak powiadomień o czymkolwiek innym niż wiadomości czatu.

## Architektura

Źródłem prawdy o „nieprzeczytane" jest porównanie najnowszej cudzej wiadomości
z zapisanym per-user znacznikiem „ostatnio przeczytane" (`event_reads`).
Zbiór obserwowanych eventów (`event_follows`) definiuje, które eventy w ogóle
biorą udział — dokładnie jak push. Podział „moje" vs „obserwowane" przy
wyświetlaniu robimy po `creator_id` (`is_owner`).

```
INSERT event_messages ──(realtime, globalnie)──► useUnreadEvents (klient)
                                                   │  filtr: author≠ja,
                                                   │  event∈obserwowane,
                                                   │  event≠otwarty
                                                   ▼
                                            unread: Map<eventId,{isOwner}>
   otwarcie karty ──► markRead(id) ──► event_reads.last_read_at=now() + usuń z mapy
   start/visibility/ekran ──► getUnreadEventIds() (RPC) ──► reconcile mapy
```

### 1. Model danych (migracja SQL, uruchamiana ręcznie w Supabase)

```sql
CREATE TABLE IF NOT EXISTS event_reads (
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  event_id     uuid REFERENCES events     ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
ALTER TABLE event_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user can manage own reads"
  ON event_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_event_reads_user ON event_reads (user_id);
```

### 2. RPC `get_unread_event_ids()` (SECURITY DEFINER)

Zwraca aktywne, obserwowane eventy z nieprzeczytaną cudzą wiadomością:

```sql
CREATE OR REPLACE FUNCTION get_unread_event_ids()
RETURNS TABLE(event_id uuid, is_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT e.id, (e.creator_id = auth.uid()) AS is_owner
  FROM event_follows f
  JOIN events e ON e.id = f.event_id
  WHERE f.user_id = auth.uid()
    AND e.status <> 'ended'
    AND e.end_time + interval '1 hour' > now()
    AND EXISTS (
      SELECT 1 FROM event_messages m
      WHERE m.event_id = e.id
        AND m.author_id <> auth.uid()
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM event_reads r
           WHERE r.user_id = auth.uid() AND r.event_id = e.id),
          'epoch'::timestamptz)
    );
$$;
GRANT EXECUTE ON FUNCTION get_unread_event_ids() TO authenticated;
```

Uwaga: warunek „ended" to serwerowe przybliżenie (bufor +1h bez rozszerzania
przez wiadomości) — wystarczające do czyszczenia powiadomień.

### 3. Warstwa danych (`src/lib/supabase.ts`)

- `markEventRead(eventId: string)` — `upsert` `event_reads(user_id, event_id, last_read_at=now())`.
- `getUnreadEventIds(): Promise<{eventId: string; isOwner: boolean}[]>` — woła RPC.
- `subscribeAllMessages(cb: (m: Message) => void)` — kanał realtime na
  `INSERT` do `event_messages` (bez filtra event_id), filtr po stronie klienta.
  Wzorzec jak `subscribeEvents`.

### 4. Czysty reduktor (testowalny) — `src/lib/unread.ts`

```ts
export interface UnreadState { [eventId: string]: { isOwner: boolean } }
export interface MessageCtx {
  me: string
  followedIds: Set<string>
  ownedIds: Set<string>
  openEventId: string | null
}
// Dodaje kropkę, jeśli wiadomość kwalifikuje się; w przeciwnym razie zwraca stan bez zmian.
export function applyIncomingMessage(
  state: UnreadState,
  msg: { event_id: string; author_id: string | null },
  ctx: MessageCtx,
): UnreadState
```

Reguła: dodaj `msg.event_id`, gdy `author_id !== me` **i** `event_id ∈ followedIds`
**i** `event_id !== openEventId`; `isOwner = ownedIds.has(event_id)`. Inaczej bez zmian.

### 5. Hook `src/hooks/useUnreadEvents.ts` (poziom App)

Stan: `unread: UnreadState`. Zależności: `session`, aktualnie otwarty `openEventId`.

- **Init / reconcile**: `getUnreadEventIds()` → zbuduje `unread`. Pobiera też
  `followedIds` i `ownedIds` (lekkie zapytania id-only) do klasyfikacji live.
- **Realtime**: `subscribeAllMessages` → `applyIncomingMessage(...)`.
- **markRead(id)**: usuń z `unread` + `db.markEventRead(id)`.
- **Reconcile** (ponowne `getUnreadEventIds`): na `visibilitychange`→widoczna
  oraz przy wejściu na ekran „Moje"/„Obserwowane" (zrzuca zakończone i koryguje
  stan po okresie w tle).
- **API**: `hasAny`, `hasOwned` (jakikolwiek `isOwner`), `hasFollowed`
  (jakikolwiek `!isOwner`), `isUnread(id)`, `markRead(id)`.

Otwarty event: App przekazuje `openEventId`; hook nie dodaje kropki dla niego,
a otwarcie karty woła `markRead` (i ponownie przy zamknięciu, by objąć
wiadomości obejrzane w trakcie).

### 6. UI — kropka `#FFD54F`

Mały komponent `NotificationDot` (okrąg, tło `#FFD54F`, cienki obrys w kolorze
INK, `aria-label={t('notifications.unread')}`). Renderowany:
- **Ikona menu** (Avatar w `MapScreen`, wyzwalacz `onOpenProfile`) → gdy `hasAny`.
- **`ProfilePanel`**: pozycja „Moje wydarzenia" → `hasOwned`; „Obserwowane" → `hasFollowed`.
- **`MyEventsScreen` / `FollowedEventsScreen`**: element listy → `isUnread(event.id)`.
- **Otwarcie dowolnej karty eventu** (`EventSheet`) → `markRead(event.id)`.

App przekazuje potrzebne flagi/propsy do `MapScreen`, `ProfilePanel` i ekranów
list; `useUnreadEvents` żyje w `App`.

## Przypadki brzegowe

- Brak sesji → hook nieaktywny, brak kropek.
- Własne wiadomości pomijane (RPC: `author_id <> me`; reduktor: `author_id !== me`).
- Zakończone eventy: wykluczone w RPC; zrzucane przy reconcile.
- Liczba wiadomości bez wpływu (kropka binarna).
- Wyciszenia ignorowane (brak odwołań do `notification_mutes`).
- `push_enabled` bez znaczenia dla kropki.

## i18n

Brak widocznego tekstu. Dodać jedynie klucz `notifications.unread` (aria-label
kropki) do wszystkich locale: pl, en, es, de.

## Testy

- `src/lib/unread.test.ts` (vitest) dla `applyIncomingMessage`: dodaje przy
  cudzej wiadomości w obserwowanym evencie; pomija własną; pomija nieobserwowany;
  pomija aktualnie otwarty; ustawia `isOwner` wg `ownedIds`.
- RPC i migracja — uruchamiane ręcznie w Supabase (zgodnie z wzorcem repo),
  bez testów automatycznych.

## Skala / ryzyka

- Globalna subskrypcja słucha wszystkich INSERT-ów `event_messages` i filtruje
  po stronie klienta (jak `subscribeEvents` dla `events`) — OK na obecną skalę,
  do rewizji przy dużym ruchu (np. przeniesienie filtra do logiki serwerowej).
- Realtime musi mieć włączone uprawnienia odczytu (RLS) `event_messages` dla
  authenticated — do potwierdzenia przy implementacji (istniejące
  `subscribeMessages`/`getMessages` sugerują, że odczyt jest dozwolony).
