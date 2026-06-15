# Mobile Back Gesture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sprawić, żeby gest "wstecz" (swipe z lewej krawędzi na iOS, swipe z obu krawędzi na Androidzie 10+, przycisk wstecz przeglądarki) zamykał aktualną warstwę UI zamiast wychodzić z aplikacji.

**Architecture:** Przy każdym otwarciu warstwy UI pushujemy wpis do `window.history`. Listener `popstate` wykrywa gest/przycisk wstecz i zamyka najwyższą otwartą warstwę. Zamknięcie przez UI (× / swipe w dół) wywołuje `window.history.back()` aby historia była spójna. Na mapie (zero warstw) `popstate` nie robi nic — nie wychodzimy z apki.

**Tech Stack:** React 18, TypeScript, Web History API (`pushState` / `popstate`), bez dodatkowych bibliotek.

---

## Mapa warstw i kolejność zamykania (najwyższa wygrywa)

```
1. authModalOpen
2. selEvent | myEventSelected | followedEventSelected  (EventSheet)
3. createOpen
4. profileOpen
5. screen === 'myEvents' | 'followedEvents'
6. (mapa — blokuj, nic nie rób)
```

---

## Pliki do modyfikacji

- **Modify:** `src/App.tsx` — cała logika history; zmiana handlerów `onClose` / `onBack` we wszystkich warstwach
- **No new files** — logika jest prosta i scentralizowana w jednym miejscu

---

## Task 1: Hook `useAppHistory` — zarządzanie historią warstw

**Files:**
- Modify: `src/App.tsx`

### Kontekst

`App.tsx` zarządza stanem wszystkich warstw przez zmienne: `authModalOpen`, `selEvent`, `myEventSelected`, `followedEventSelected`, `createOpen`, `profileOpen`, `screen`.

Potrzebujemy:
1. Przy każdej zmianie stanu która **otwiera** warstwę → `window.history.pushState({ layer: string }, '')`
2. `popstate` listener → odczytuje aktualny stan (przez ref) i zamyka najwyższą warstwę przez `back()`
3. Zamknięcie przez UI → zamiast bezpośrednio ustawiać stan, wywołuje `window.history.back()` — to odpali `popstate`, który ustawi stan

Kluczowy problem: `popstate` jest async relative do stanu React. Rozwiązanie: trzymamy aktualny stan w `navLayersRef` (podobnie jak istniejący `navStateRef`) i odczytujemy z niego w listenerze.

- [ ] **Step 1: Dodaj `navLayersRef` — ref trzymający aktualny stan warstw**

W `src/App.tsx`, po linii `const navStateRef = useRef(...)` (linia 62), dodaj:

```tsx
const navLayersRef = useRef({
  authModalOpen,
  selEvent,
  myEventSelected,
  followedEventSelected,
  createOpen,
  profileOpen,
  screen,
})
```

- [ ] **Step 2: Synchronizuj `navLayersRef` z każdą zmianą stanu**

Zastąp istniejący `useEffect` synchronizujący `navStateRef` (linie 65-67):

```tsx
useEffect(() => {
  navStateRef.current = { screen, myEventSelected, followedEventSelected }
  navLayersRef.current = {
    authModalOpen,
    selEvent,
    myEventSelected,
    followedEventSelected,
    createOpen,
    profileOpen,
    screen,
  }
}, [screen, myEventSelected, followedEventSelected, authModalOpen, selEvent, createOpen, profileOpen])
```

- [ ] **Step 3: Dodaj `useEffect` z `popstate` listenerem**

Dodaj nowy `useEffect` po synchronizacji `navLayersRef` (przed `useEffect` dla `visibilitychange`):

```tsx
useEffect(() => {
  function onPopState() {
    const s = navLayersRef.current
    // Zamknij najwyższą otwartą warstwę
    if (s.authModalOpen) { setAuthModalOpen(false); return }
    if (s.selEvent || s.myEventSelected || s.followedEventSelected) {
      setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
      return
    }
    if (s.createOpen) { setCreateOpen(false); setCreatePos(null); setLocationPicked(false); setEditingEvent(null); return }
    if (s.profileOpen) { setProfileOpen(false); return }
    if (s.screen === 'myEvents') { setScreen('map'); return }
    if (s.screen === 'followedEvents') { setScreen('map'); return }
    // Na mapie — pushujemy z powrotem żeby nie wyjść z apki
    window.history.pushState({ layer: 'map' }, '')
  }
  window.addEventListener('popstate', onPopState)
  return () => window.removeEventListener('popstate', onPopState)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Zainicjalizuj wpis bazowy w historii przy starcie**

W `useEffect` który obsługuje initial routing (linia 172, `if (!ready || screen !== 'loading') return`), na końcu funkcji `goToMap()` po `setScreen('map')` dodaj:

```tsx
window.history.replaceState({ layer: 'map' }, '')
```

Znajdź funkcję `goToMap` (linia 220) i zmodyfikuj jej koniec:

```tsx
async function goToMap() {
  const pos = userPos || lastKnownPos
  const maxKm = profile?.radius_km ?? 30
  let zoom = 15
  if (pos) {
    const nearby = await db.getEvents(pos.lat, pos.lng, 15, 0)
    if (nearby.length === 0) {
      const wider = await db.getEvents(pos.lat, pos.lng, maxKm, 0)
      if (wider.length === 0) {
        zoom = kmToZoom(maxKm, pos.lat)
      } else {
        const nearest = wider.reduce((a, b) => a.distKm < b.distKm ? a : b)
        zoom = kmToZoom(Math.min(nearest.distKm * 2, maxKm), pos.lat)
      }
    }
  }
  setInitialMapZoom(zoom)
  setScreen('map')
  window.history.replaceState({ layer: 'map' }, '')
}
```

- [ ] **Step 5: Zbuduj i sprawdź TypeScript**

```bash
cd /Users/wiktormarc/meuwe-web && npm run build 2>&1 | grep -E "error|✓"
```

Expected: `✓ built in ...ms` bez błędów.

- [ ] **Step 6: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/App.tsx && git commit -m "feat(nav): add popstate listener and navLayersRef for back gesture support"
```

---

## Task 2: Push history przy otwieraniu każdej warstwy

**Files:**
- Modify: `src/App.tsx`

### Kontekst

Przy każdym otwarciu warstwy musimy wywołać `window.history.pushState({ layer: '...' }, '')`. Robimy to w miejscach gdzie aktualnie ustawiamy stan otwarcia.

- [ ] **Step 1: Push przy otwieraniu EventSheet z mapy**

Znajdź linię (linia ~322):
```tsx
onOpenEvent={ev => { if (!isOverlay) { setSelEvent(ev); setCreateOpen(false); setProfileOpen(false) } }}
```

Zmień na:
```tsx
onOpenEvent={ev => {
  if (!isOverlay) {
    setSelEvent(ev); setCreateOpen(false); setProfileOpen(false)
    window.history.pushState({ layer: 'event' }, '')
  }
}}
```

- [ ] **Step 2: Push przy otwieraniu EventSheet z MyEvents**

Znajdź (linia ~343):
```tsx
onOpenEvent={ev => {
  setMyEventSelected({ ...ev, distKm: 0, distStr: '' })
  flyToFnRef.current?.(ev.lat, ev.lng)
}}
```

Zmień na:
```tsx
onOpenEvent={ev => {
  setMyEventSelected({ ...ev, distKm: 0, distStr: '' })
  flyToFnRef.current?.(ev.lat, ev.lng)
  window.history.pushState({ layer: 'event' }, '')
}}
```

- [ ] **Step 3: Push przy otwieraniu EventSheet z FollowedEvents**

Znajdź (linia ~396):
```tsx
onOpenEvent={ev => {
  setFollowedEventSelected({ ...ev, distKm: 0, distStr: '' })
  flyToFnRef.current?.(ev.lat, ev.lng)
}}
```

Zmień na:
```tsx
onOpenEvent={ev => {
  setFollowedEventSelected({ ...ev, distKm: 0, distStr: '' })
  flyToFnRef.current?.(ev.lat, ev.lng)
  window.history.pushState({ layer: 'event' }, '')
}}
```

- [ ] **Step 4: Push przy otwieraniu CreateSheet**

Znajdź (linia ~321):
```tsx
onOpenCreate={() => { if (!isOverlay) { setSelEvent(null); setProfileOpen(false); setCreateOpen(true) } }}
```

Zmień na:
```tsx
onOpenCreate={() => {
  if (!isOverlay) {
    setSelEvent(null); setProfileOpen(false); setCreateOpen(true)
    window.history.pushState({ layer: 'create' }, '')
  }
}}
```

Znajdź też miejsce gdzie `setCreateOpen(true)` jest wywoływane po powrocie z location picker (linia ~332):
```tsx
setCreatePos(pos)
setLocationPicked(true)
setPickingLocation(false)
setCreateOpen(true)
```

To nie wymaga push — create był już otwarty przed location picker, historia jest nienaruszona.

- [ ] **Step 5: Push przy otwieraniu ProfilePanel**

Znajdź (linia ~319):
```tsx
onOpenProfile={() => { if (!isOverlay) { setProfileOpen(true); setSelEvent(null); setCreateOpen(false) } }}
```

Zmień na:
```tsx
onOpenProfile={() => {
  if (!isOverlay) {
    setProfileOpen(true); setSelEvent(null); setCreateOpen(false)
    window.history.pushState({ layer: 'profile' }, '')
  }
}}
```

- [ ] **Step 6: Push przy wejściu w MyEvents**

Znajdź (linia ~433):
```tsx
onOpenMyEvents={() => { setProfileOpen(false); setScreen('myEvents') }}
```

Zmień na:
```tsx
onOpenMyEvents={() => {
  setProfileOpen(false); setScreen('myEvents')
  window.history.pushState({ layer: 'myEvents' }, '')
}}
```

- [ ] **Step 7: Push przy wejściu w FollowedEvents**

Znajdź (linia ~434):
```tsx
onOpenFollowedEvents={() => { setProfileOpen(false); setScreen('followedEvents') }}
```

Zmień na:
```tsx
onOpenFollowedEvents={() => {
  setProfileOpen(false); setScreen('followedEvents')
  window.history.pushState({ layer: 'followedEvents' }, '')
}}
```

- [ ] **Step 8: Push przy otwieraniu authModal**

Znajdź wszystkie wywołania `setAuthModalOpen(true)` — są 3 miejsca (linie ~323, ~361, ~373). Każde zmień:

```tsx
// Przed:
onAuthNeeded={() => setAuthModalOpen(true)}
// Po:
onAuthNeeded={() => { setAuthModalOpen(true); window.history.pushState({ layer: 'auth' }, '') }}
```

Uwaga: jest też `setAuthModalOpen(true)` w przycisku Google w authModal (`onClick` na liniach ~469). To otwiera logowanie — **nie dodawaj push tutaj**.

- [ ] **Step 9: Push przy deep link evencie**

W `useEffect` obsługującym deep link (linia ~96):
```tsx
useEffect(() => {
  if (screen !== 'map' || !deepLinkEvent) return
  setSelEvent(deepLinkEvent)
  setDeepLinkEvent(null)
  // ...
```

Po `setSelEvent(deepLinkEvent)` dodaj:
```tsx
window.history.pushState({ layer: 'event' }, '')
```

- [ ] **Step 10: Zbuduj i sprawdź TypeScript**

```bash
cd /Users/wiktormarc/meuwe-web && npm run build 2>&1 | grep -E "error|✓"
```

Expected: `✓ built in ...ms`

- [ ] **Step 11: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/App.tsx && git commit -m "feat(nav): push history entry on every layer open"
```

---

## Task 3: Zamknięcie przez UI → `history.back()` zamiast bezpośredniego setState

**Files:**
- Modify: `src/App.tsx`

### Kontekst

Gdy user zamyka warstwę przez UI (× lub swipe w dół), musimy wywołać `window.history.back()` — to odpali `popstate`, który ustawi stan. Inaczej historia i UI rozjadą się (UI zamknięte, ale historia ma extra wpis).

Wyjątek: `handleSignOut` i `handleEdit` robią złożone przejścia — tam nadal bezpośrednio ustawiamy stan i czyścimy historię przez `replaceState`.

- [ ] **Step 1: Zamknięcie EventSheet z mapy przez ×**

Znajdź (linia ~380):
```tsx
onClose={() => setSelEvent(null)}
```

Zmień na:
```tsx
onClose={() => window.history.back()}
```

(dotyczy EventSheet `!isOverlay && selEvent`)

- [ ] **Step 2: Zamknięcie EventSheet z MyEvents przez ×**

Znajdź (linia ~356):
```tsx
onClose={() => setMyEventSelected(null)}
```

Zmień na:
```tsx
onClose={() => window.history.back()}
```

- [ ] **Step 3: Zamknięcie EventSheet z FollowedEvents przez ×**

Znajdź (linia ~368):
```tsx
onClose={() => setFollowedEventSelected(null)}
```

Zmień na:
```tsx
onClose={() => window.history.back()}
```

- [ ] **Step 4: Zamknięcie CreateSheet przez ×**

Znajdź (linia ~407):
```tsx
onClose={() => { setCreateOpen(false); setCreatePos(null); setLocationPicked(false); setEditingEvent(null) }}
```

Zmień na:
```tsx
onClose={() => window.history.back()}
```

Uwaga: `popstate` w Task 1 robi `setCreateOpen(false); setCreatePos(null); setLocationPicked(false); setEditingEvent(null)` — upewnij się że to jest kompletne (jest — krok 3 w Task 1 to zawiera).

- [ ] **Step 5: Zamknięcie ProfilePanel przez ×**

Znajdź (linia ~428):
```tsx
onClose={() => setProfileOpen(false)}
```

Zmień na:
```tsx
onClose={() => window.history.back()}
```

- [ ] **Step 6: Przycisk Wstecz w MyEventsScreen**

Znajdź (linia ~342):
```tsx
onBack={() => { setScreen('map'); setMyEventSelected(null) }}
```

Zmień na:
```tsx
onBack={() => window.history.back()}
```

- [ ] **Step 7: Przycisk Wstecz w FollowedEventsScreen**

Znajdź (linia ~395):
```tsx
onBack={() => { setScreen('map'); setFollowedEventSelected(null) }}
```

Zmień na:
```tsx
onBack={() => window.history.back()}
```

- [ ] **Step 8: Zamknięcie authModal przez ×**

Znajdź wszystkie `setAuthModalOpen(false)` wywoływane przez UI (kliknięcie w tło i przycisk Anuluj, linie ~441 i ~492):
```tsx
onClick={() => setAuthModalOpen(false)}
// i
onClick={() => setAuthModalOpen(false)}
```

Zmień oba na:
```tsx
onClick={() => window.history.back()}
```

Nie zmieniaj `setAuthModalOpen(false)` który jest wewnątrz handlera logowania Google (linia ~470) — tam zamykamy modal i od razu logujemy, nie chcemy manipulować historią.

- [ ] **Step 9: handleEdit — wyczyść historię i zresetuj do mapy**

`handleEdit` robi złożone przejście (zamknięcie wielu warstw + otwarcie create). Zamiast `back()`, po przejściu na mapę wyczyść historię:

Znajdź funkcję `handleEdit` (linia ~251):
```tsx
function handleEdit(ev: EventWithMeta) {
  setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
  setProfileOpen(false)
  setScreen('map')
  setEditingEvent(ev)
  setCreatePos({ lat: ev.lat, lng: ev.lng })
  setLocationPicked(true)
  setCreateOpen(true)
}
```

Zmień na:
```tsx
function handleEdit(ev: EventWithMeta) {
  setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
  setProfileOpen(false)
  setScreen('map')
  setEditingEvent(ev)
  setCreatePos({ lat: ev.lat, lng: ev.lng })
  setLocationPicked(true)
  setCreateOpen(true)
  window.history.replaceState({ layer: 'create' }, '')
}
```

- [ ] **Step 10: handleSignOut — wyczyść historię**

Znajdź `handleSignOut` (linia ~245):
```tsx
async function handleSignOut() {
  await db.signOut()
  try { localStorage.removeItem('meuwe_last_pos') } catch {}
  setScreen('welcome')
}
```

Zmień na:
```tsx
async function handleSignOut() {
  await db.signOut()
  try { localStorage.removeItem('meuwe_last_pos') } catch {}
  setScreen('welcome')
  window.history.replaceState({ layer: 'welcome' }, '')
}
```

- [ ] **Step 11: Zbuduj i sprawdź TypeScript**

```bash
cd /Users/wiktormarc/meuwe-web && npm run build 2>&1 | grep -E "error|✓"
```

Expected: `✓ built in ...ms`

- [ ] **Step 12: Commit**

```bash
cd /Users/wiktormarc/meuwe-web && git add src/App.tsx && git commit -m "feat(nav): close layers via history.back() to keep history in sync"
```

---

## Task 4: Obsługa swipe w dół na EventSheet i CreateSheet → `history.back()`

**Files:**
- Modify: `src/screens/EventSheet.tsx`
- Modify: `src/screens/CreateSheet.tsx`

### Kontekst

EventSheet i CreateSheet mają własną obsługę swipe w dół (touch events). Aktualnie bezpośrednio wywołują `onClose()`. Po zmianie w Task 3, `onClose` już woła `history.back()` — więc **nic tu nie trzeba zmieniać**. Swipe w dół wywoła `onClose` → `history.back()` → `popstate` → `setSelEvent(null)` / `setCreateOpen(false)`.

- [ ] **Step 1: Zweryfikuj że EventSheet wywołuje `onClose` przy swipe w dół**

```bash
grep -n "onClose\|touchEnd\|touchStart\|changedTouches" /Users/wiktormarc/meuwe-web/src/screens/EventSheet.tsx
```

Expected: linie z `touchStartY`, `touchEnd`, i `if (dy > 60) onClose()` lub podobne. Jeśli `onClose` jest wywoływane — nie trzeba nic zmieniać.

- [ ] **Step 2: Zweryfikuj analogicznie CreateSheet**

```bash
grep -n "onClose\|touchEnd\|touchStart\|changedTouches" /Users/wiktormarc/meuwe-web/src/screens/CreateSheet.tsx
```

Expected: CreateSheet nie ma swipe — `onClose` jest wywoływane tylko przez przycisk ×, który zmieniliśmy w Task 3.

- [ ] **Step 3: Commit (tylko jeśli były zmiany)**

Jeśli `grep` pokazał że EventSheet lub CreateSheet wywołuje coś innego niż `onClose()` przy swipe, napraw to żeby woła `onClose()`. Jeśli wszystko OK — pomiń commit.

---

## Task 5: Test manualny na staging

- [ ] **Step 1: Push do staging**

```bash
cd /Users/wiktormarc/meuwe-web && git push origin staging
```

- [ ] **Step 2: Scenariusze do przetestowania na telefonie**

Przetestuj każdy scenariusz gestem wstecz (swipe z lewej na iOS / z krawędzi na Android) ORAZ przyciskiem wstecz przeglądarki:

| # | Akcja | Gest wstecz powinien |
|---|-------|---------------------|
| 1 | Otwórz event z mapy | Zamknąć EventSheet, wrócić do mapy |
| 2 | Otwórz Moje Wydarzenia → otwórz event | Zamknąć EventSheet, wrócić do Moich Wydarzeń |
| 3 | Wstecz jeszcze raz (jesteś w Moje Wydarzenia) | Wrócić do mapy |
| 4 | Otwórz CreateSheet | Zamknąć CreateSheet |
| 5 | Otwórz Profil | Zamknąć Profil |
| 6 | Otwórz auth modal (kliknij "Dodaj" bez logowania) | Zamknąć modal |
| 7 | Na mapie (nic nie otwarte) — wstecz | Zostać na mapie, nie wyjść z apki |
| 8 | Wejdź przez deep link `?event=xxx` — wstecz | Zamknąć event, zostać na mapie |

- [ ] **Step 3: Sprawdź że swipe w dół na EventSheet nadal działa**

Otwórz event → swipe w dół → powinien zamknąć sheet i wrócić do mapy.
