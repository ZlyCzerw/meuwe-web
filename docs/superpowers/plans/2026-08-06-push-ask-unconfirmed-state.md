# Push-ask modal: nie pytaj na podstawie niepotwierdzonego odczytu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PushAskModal ma się nie pokazywać użytkownikowi, którego konto ma już `push_enabled = true` i którego urządzenie dostarcza powiadomienia - a w szczególności nie ma zapadać decyzji na podstawie odczytu zrobionego kilka sekund po starcie, gdy profil albo token FCM jeszcze nie dojechały.

**Architecture:** Stan urządzenia zyskuje trzecie pole `confirmed`, które odróżnia „sprawdziliśmy i nie ma rejestracji" od „nie udało się sprawdzić". Cała decyzja o otwarciu karty przenosi się z ciała efektu w `App.tsx` do czystej funkcji `shouldOpenPushAsk` w `lib/pushAsk.ts`, którą da się przetestować, i która odmawia pytania, dopóki intencja użytkownika i stan urządzenia nie są znane. Osobno: nieudana rejestracja przestaje być zapisywana jako odmowa użytkownika.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Supabase JS, Capacitor + `@capacitor-firebase/messaging`.

---

## Diagnoza (skąd ten plan)

Modal otwiera sonda w [App.tsx:326-345](../../../src/App.tsx#L326) - `setInterval` co 10 s. Żeby karta wyskoczyła, w jednym ticku muszą zajść naraz:

1. `session` istnieje,
2. `isScreenClear()` - goła mapa, żadnej warstwy na wierzchu,
3. `isPushAskDue` - `askCount < 3`, brak odmowy w ostatnich 14 dniach, i zaszedł trigger. Triggerem jest m.in. `sessions >= 2`, a licznik rośnie przy każdym zimnym starcie i nigdy się nie zeruje, więc **dla każdego powracającego użytkownika ten warunek jest spełniony na stałe**,
4. `canAskForPush` - stan z `resolvePushState` jest inny niż `'on'` (i inny niż `blocked`/`unsupported`).

Czyli dla powracającego użytkownika jedyną realną bramką jest punkt 4. A stan wychodzi inny niż `'on'` również wtedy, gdy po prostu **jeszcze nie wiadomo**:

- `!!profile?.push_enabled` - `profile` jest `null`, dopóki `getProfile` nie wróci z sieci. `resolvePushState` sprawdza `if (!intent) return 'off'` **przed** jakimkolwiek spojrzeniem na urządzenie, więc w pełni zarejestrowane urządzenie raportuje `'off'`, gdy profil jeszcze leci.
- `device.registered` - w [push.ts:129-149](../../../src/lib/push.ts#L129) `false` oznacza dwie różne rzeczy. Na Androidzie `FirebaseMessaging.getToken()` zwraca `null`, gdy SDK jeszcze się inicjalizuje albo nie ma sieci; `isTokenStored` zwraca `false` także wtedy, gdy zapytanie do Supabase padło. Zimny start to dokładnie ten moment.

Komentarz nad `getDevicePushState` mówi to wprost: „When it cannot be confirmed (no session, failed query) it stays false: the UI then offers a repair instead of claiming delivery it cannot vouch for." To rozsądne dla panelu profilu, który użytkownik otworzył sam i może spojrzeć jeszcze raz. Dla karty, która sama wchodzi na ekran i zużywa jedno z trzech pytań w historii konta, to jest błąd.

**Root cause:** bezpieczne wartości domyślne zaprojektowane dla biernego wyświetlacza są konsumowane przez sondę tak, jakby były potwierdzonymi faktami - i to w momencie startu aplikacji, kiedy najrzadziej są prawdziwe.

Zgodne z obserwacją: panel profilu na tym samym urządzeniu pokazuje „Powiadomienia włączone", bo do czasu jego otwarcia i profil, i token są już na miejscu.

---

## File Structure

| Plik | Odpowiedzialność | Zmiana |
|---|---|---|
| `src/lib/pushState.ts` | typy stanu push, `resolvePushState` | dodaje pole `confirmed` do `DevicePushState` |
| `src/lib/push.ts` | co potrafi TO urządzenie | ustawia `confirmed`, rozróżnia błąd odczytu od braku rejestracji |
| `src/lib/pushAsk.ts` | kiedy wolno zapytać | nowa czysta funkcja `shouldOpenPushAsk` |
| `src/lib/pushAsk.test.ts` | testy reguły | nowe przypadki dla nieznanej intencji i niepotwierdzonego urządzenia |
| `src/App.tsx` | sonda | woła `shouldOpenPushAsk`, poprawione zależności efektu, obsługa `onFailed` |
| `src/components/PushAskModal.tsx` | karta | trzecie wyjście: nieudana rejestracja to nie odmowa |
| `src/components/PushAskModal.test.tsx` | testy karty | nowy przypadek + uzupełnienie propsów |
| `src/screens/ProfilePanel.push.test.tsx` | testy panelu | uzupełnienie mocków o `confirmed` |

---

## Task 1: `DevicePushState` odróżnia brak rejestracji od braku odpowiedzi

**Files:**
- Modify: `src/lib/pushState.ts:19-23`
- Modify: `src/lib/push.ts:129-198`, `src/lib/push.ts:207-241`, `src/lib/push.ts:256-307`
- Modify: `src/screens/ProfilePanel.push.test.tsx:59-123`

- [ ] **Step 1: Rozszerz typ**

W `src/lib/pushState.ts` zamień interfejs `DevicePushState` na:

```ts
export interface DevicePushState {
  permission: PushPermission
  /** A subscription (web) or FCM token (native) exists AND is stored for this user. */
  registered: boolean
  /**
   * Whether `registered` is an answer we actually got, rather than the safe
   * default used when the question could not be put — FCM has produced no token
   * yet, the lookup failed, the device was asked while the network was still
   * coming up. A cold start is exactly that moment.
   *
   * A screen the user opened can treat "could not check" as "not registered"
   * and offer a repair; that costs nothing. Anything that interrupts the user
   * must not — see shouldOpenPushAsk in pushAsk.ts.
   */
  confirmed: boolean
}
```

- [ ] **Step 2: Uruchom typecheck, żeby zobaczyć wszystkie miejsca do poprawy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit
```

Oczekiwane: błędy `Property 'confirmed' is missing` w `src/lib/push.ts` i w `src/screens/ProfilePanel.push.test.tsx`. Ta lista jest zakresem kolejnych kroków - przejdź ją całą, nie zgaduj. `src/components/PushAskModal.test.tsx` i `src/components/InterestsOnboardingModal.test.tsx` się nie wysypią: ich mocki mają własny typ strukturalny, nie `DevicePushState`.

- [ ] **Step 3: Niech odczyty z bazy umieją powiedzieć „nie wiem"**

W `src/lib/push.ts` zamień obie funkcje sprawdzające na wersje zwracające `null` przy błędzie:

```ts
/** `null` when the lookup itself failed — not the same as "no row". */
async function isTokenStored(userId: string, token: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('push_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('fcm_token', token)
    .maybeSingle()
  if (error) {
    console.error('[push] push_devices lookup failed:', error)
    return null
  }
  return !!data
}

/** `null` when the lookup itself failed — not the same as "no row". */
async function isEndpointStored(userId: string, endpoint: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) {
    console.error('[push] push_subscriptions lookup failed:', error)
    return null
  }
  return !!data
}
```

- [ ] **Step 4: To samo dla odczytu subskrypcji w przeglądarce**

W `src/lib/push.ts` zamień `getWebSubscription` na wersję rozróżniającą „nie ma subskrypcji" od „nie dało się sprawdzić":

```ts
/**
 * `ok: false` means the question could not be put at all — no service worker
 * registration yet (it is registered in parallel at boot), or the call threw.
 * `ok: true, sub: null` is a real answer: this browser holds no subscription.
 */
type SubscriptionLookup = { ok: true; sub: PushSubscription | null } | { ok: false }

async function getWebSubscription(): Promise<SubscriptionLookup> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return { ok: false }
    return { ok: true, sub: await reg.pushManager.getSubscription() }
  } catch (err) {
    console.error('[push] getSubscription failed:', err)
    return { ok: false }
  }
}
```

- [ ] **Step 5: Ustaw `confirmed` w `getDevicePushState`**

W `src/lib/push.ts` zamień całe ciało `getDevicePushState` na:

```ts
export async function getDevicePushState(userId: string | null): Promise<DevicePushState> {
  if (isNativePlatform()) {
    const perm = await FirebaseMessaging.checkPermissions()
    const permission = mapNativePermission(perm.receive)
    if (permission !== 'granted' || !userId) return { permission, registered: false, confirmed: true }
    const token = await getNativeToken()
    // No token is not the same as no registration: FCM returns nothing while it
    // is still initialising or offline, which is the state a cold start is in.
    if (!token) return { permission, registered: false, confirmed: false }
    const stored = await isTokenStored(userId, token)
    return { permission, registered: stored === true, confirmed: stored !== null }
  }

  if (!thisBrowserCanPush()) return { permission: 'unsupported', registered: false, confirmed: true }
  const permission: PushPermission =
    Notification.permission === 'granted' ? 'granted'
    : Notification.permission === 'denied' ? 'denied'
    : 'prompt'
  if (permission !== 'granted' || !userId) return { permission, registered: false, confirmed: true }

  const lookup = await getWebSubscription()
  if (!lookup.ok) return { permission, registered: false, confirmed: false }
  if (!lookup.sub) return { permission, registered: false, confirmed: true }
  const stored = await isEndpointStored(userId, lookup.sub.endpoint)
  return { permission, registered: stored === true, confirmed: stored !== null }
}
```

- [ ] **Step 6: Uzupełnij pozostałe miejsca zwracające `DevicePushState`**

W `src/lib/push.ts`, w `enablePushOnThisDevice` - te wyniki są odpowiedzią na akcję, którą właśnie wykonaliśmy, więc są potwierdzone:

```ts
export async function enablePushOnThisDevice(userId: string): Promise<DevicePushState> {
  if (isNativePlatform()) {
    const perm = await FirebaseMessaging.requestPermissions()
    const permission = mapNativePermission(perm.receive)
    if (permission !== 'granted') return { permission, registered: false, confirmed: true }
    return { permission, registered: await registerNativeToken(), confirmed: true }
  }

  if (!thisBrowserCanPush()) return { permission: 'unsupported', registered: false, confirmed: true }
  const result = await Notification.requestPermission()
  if (result !== 'granted') {
    // 'denied' is final; 'default' means the prompt was dismissed and can return.
    return { permission: result === 'denied' ? 'denied' : 'prompt', registered: false, confirmed: true }
  }
  return { permission: 'granted', registered: await subscribeWeb(userId), confirmed: true }
}
```

oraz w `ensurePushRegistered`:

```ts
export async function ensurePushRegistered(userId: string): Promise<DevicePushState> {
  const state = await getDevicePushState(userId)
  if (state.permission !== 'granted' || state.registered) return state

  const registered = isNativePlatform()
    ? await registerNativeToken()
    : await subscribeWeb(userId)
  return { permission: 'granted', registered, confirmed: true }
}
```

- [ ] **Step 7: Dostosuj pozostałych konsumentów `getWebSubscription`**

W `src/lib/push.ts`, w `subscribeWeb` zamień odczyt subskrypcji:

```ts
  const lookup = await getWebSubscription()
  let sub = lookup.ok ? lookup.sub : null
  if (!sub) {
```

i w `disablePushOnThisDevice`:

```ts
  const lookup = await getWebSubscription()
  const sub = lookup.ok ? lookup.sub : null
  if (!sub) return
```

- [ ] **Step 8: Uzupełnij mocki w testach panelu**

W `src/screens/ProfilePanel.push.test.tsx` dopisz `confirmed: true` do każdego `getDevicePushState.mockResolvedValue({...})` i `enablePushOnThisDevice.mockResolvedValue({...})` - listę daje `tsc` ze Stepu 2. Wszystkie te odczyty udają udane sprawdzenie, więc wszędzie `true`. Przykład:

```ts
    getDevicePushState.mockResolvedValue({ permission: 'granted', registered: true, confirmed: true })
```

- [ ] **Step 9: Typecheck i testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: `tsc` bez wyjścia, 39 plików / 351 testów PASS. (Wykluczenie `.claude` jest konieczne, bo worktree zadań w tle leży wewnątrz repo i vitest go skanuje.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/pushState.ts src/lib/push.ts src/screens/ProfilePanel.push.test.tsx
git commit -m "Let the device say 'I could not check' instead of 'no'"
```

---

## Task 2: Sonda pyta dopiero, gdy zna odpowiedź

**Files:**
- Modify: `src/lib/pushAsk.ts` (dopisanie funkcji na końcu pliku)
- Modify: `src/lib/pushAsk.test.ts` (nowy `describe` na końcu pliku)
- Modify: `src/App.tsx:326-345`

- [ ] **Step 1: Napisz padający test**

Na końcu `src/lib/pushAsk.test.ts` dopisz. Do importu z `./pushAsk` (linia 3) dołóż `shouldOpenPushAsk`:

```ts
describe('shouldOpenPushAsk', () => {
  const triggered = () => recordFollow(emptyPushAskState())
  const ctx = (over: Partial<Parameters<typeof shouldOpenPushAsk>[1]>) => ({
    intentKnown: true, pushState: 'off' as const, deviceConfirmed: true, canOfferFallback: false, ...over,
  })

  // The profile arrives over the network, and until it does "do you want
  // notifications" reads as "no" — which is how someone who said yes months ago
  // was asked again seconds after launch.
  it('stays quiet while the profile has not loaded', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ intentKnown: false }), NOW)).toBe(false)
  })

  // A cold start where FCM has not produced a token yet looks exactly like a
  // device that was never registered. The poll comes round again in ten seconds.
  it('stays quiet while the device reading is unconfirmed', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'needsRegistration', deviceConfirmed: false }), NOW)).toBe(false)
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'needsPermission', deviceConfirmed: false }), NOW)).toBe(false)
  })

  // With no intent recorded the ask is about the intent, and what the device
  // can do does not change that question.
  it('still asks someone who never opted in, even if the device could not be checked', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'off', deviceConfirmed: false }), NOW)).toBe(true)
  })

  it('asks on a confirmed reading, exactly as canAskForPush would', () => {
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'off' }), NOW)).toBe(true)
    expect(shouldOpenPushAsk(triggered(), ctx({ pushState: 'on' }), NOW)).toBe(false)
  })
})
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/lib/pushAsk.test.ts
```

Oczekiwane: FAIL, `shouldOpenPushAsk is not a function` / błąd importu.

- [ ] **Step 3: Dopisz funkcję**

Na końcu `src/lib/pushAsk.ts`:

```ts
/**
 * The whole decision the polling caller has to make, in one place a test can
 * reach.
 *
 * `canAskForPush` answers "is this device worth asking". This adds the two
 * questions that come first, because the poll runs seconds after launch, when
 * neither answer may have arrived yet:
 *
 *   intentKnown     — the profile has loaded. Without it, resolvePushState sees
 *                     no intent and returns 'off' before it even looks at the
 *                     device, so a fully registered phone reads as "never asked".
 *   deviceConfirmed — the device answered. No FCM token yet, or a lookup that
 *                     failed offline, is indistinguishable from "not registered".
 *
 * Neither is a reason to interrupt anyone, and neither is worth spending one of
 * the three asks this account will ever get: the poll comes round again in ten
 * seconds, and by then the answer is usually real.
 */
export function shouldOpenPushAsk(
  state: PushAskState,
  ctx: {
    intentKnown: boolean
    pushState: PushUiState
    deviceConfirmed: boolean
    canOfferFallback: boolean
  },
  now: number,
): boolean {
  if (!ctx.intentKnown) return false
  // 'off' is a statement about the account, not about this handset, so an
  // unreadable device does not stand in the way of asking.
  if (ctx.pushState !== 'off' && !ctx.deviceConfirmed) return false
  return canAskForPush(state, { pushState: ctx.pushState, canOfferFallback: ctx.canOfferFallback }, now)
}
```

- [ ] **Step 4: Uruchom testy i potwierdź, że przechodzą**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/lib/pushAsk.test.ts
```

Oczekiwane: PASS.

- [ ] **Step 5: Podłącz sondę**

W `src/App.tsx` zamień ciało efektu (linie 326-345) na:

```tsx
  useEffect(() => {
    if (!session) return
    let cancelled = false
    const uid = session.user.id
    const tick = async () => {
      if (cancelled || !screenIsClear()) return
      if (!pushAsk.isPushAskDue(pushAsk.readPushAskState(), Date.now())) return
      const device = await getDevicePushState(uid)
      if (cancelled) return
      const state = resolvePushState(!!profile?.push_enabled, device)
      // No calendar to fall back on here, so a device that cannot be repaired
      // in-app is left alone rather than shown a button that does nothing.
      if (!pushAsk.shouldOpenPushAsk(pushAsk.readPushAskState(), {
        intentKnown: profile !== null,
        pushState: state,
        deviceConfirmed: device.confirmed,
        canOfferFallback: false,
      }, Date.now())) return
      updatePushAsk(s => pushAsk.markAsked(s, Date.now()))
      setPushAskOpen(true)
    }
    const id = setInterval(tick, 10_000)
    return () => { cancelled = true; clearInterval(id) }
    // Depends on the whole profile, not just the flag: "not loaded yet" is a
    // distinct input now, and the tick has to see it change.
  }, [session, profile])
```

- [ ] **Step 6: Typecheck, lint i pełne testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit && npx eslint src/App.tsx src/lib/pushAsk.ts && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: `tsc` bez wyjścia, eslint bez nowych błędów, wszystkie testy PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pushAsk.ts src/lib/pushAsk.test.ts src/App.tsx
git commit -m "Do not ask about notifications before the answer is in"
```

---

## Task 3: Nieudana rejestracja to nie odmowa użytkownika

Dziś w `PushAskModal.handleEnable`, gdy system dał zgodę, ale rejestracja tokenu nie wyszła (offline, błąd RPC), wołany jest `onDecline` - a ten zapisuje `markDeclined`, czyli **14 dni ciszy**. Awaria techniczna zostaje zapisana jako decyzja użytkownika.

**Files:**
- Modify: `src/components/PushAskModal.tsx:16-47`
- Modify: `src/components/PushAskModal.test.tsx`
- Modify: `src/App.tsx:1040-1057`

- [ ] **Step 1: Napisz padający test**

W `src/components/PushAskModal.test.tsx` dopisz przypadek (i dodaj `onFailed={() => {}}` do wszystkich sześciu istniejących wywołań `render(<PushAskModal ... />)`, bo props jest wymagany):

```tsx
  // Permission granted but no delivery address is our failure, not the user's
  // answer. Recording it as a refusal would buy 14 days of silence on a network
  // blip.
  it('does not count a failed registration as a refusal', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'granted', registered: false })
    const onDecline = vi.fn()
    const onFailed = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={onDecline} onFailed={onFailed} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(onFailed).toHaveBeenCalled())
    expect(onDecline).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/components/PushAskModal.test.tsx
```

Oczekiwane: FAIL - `onFailed` nie został wywołany (zamiast niego poszedł `onDecline`).

- [ ] **Step 3: Dodaj trzecie wyjście z karty**

W `src/components/PushAskModal.tsx` zamień sygnaturę i `handleEnable`:

```tsx
export default function PushAskModal({
  userId,
  onEnabled,
  onDecline,
  onFailed,
}: {
  userId: string
  onEnabled: () => void
  /** Pressed "not now", or the system prompt was refused — both start the cooldown. */
  onDecline: () => void
  /** The system said yes but no delivery address came of it. Not an answer, so no cooldown. */
  onFailed: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleEnable() {
    setBusy(true)
    db.trackClick('push_ask_enable')
    const device = await enablePushOnThisDevice(userId)
    // The wish is recorded even when the device refuses, so the profile panel
    // shows the mismatch and offers the repair instead of hiding it — but only
    // where a repair exists. 'unsupported' has none, and an account marked as
    // wanting notifications it can never receive is a lie the profile would
    // then have to keep telling.
    if (device.permission !== 'unsupported') {
      await db.updateProfile({ id: userId, push_enabled: true })
    }
    setBusy(false)
    if (device.permission === 'granted' && device.registered) {
      onEnabled()
      return
    }
    // A granted permission that produced no delivery address is a failure on
    // our side. Filing it as a refusal would spend the cooldown on a network
    // blip and leave the user wondering why nothing ever arrives.
    if (device.permission === 'granted') {
      onFailed()
      return
    }
    onDecline()
  }
```

- [ ] **Step 4: Uruchom testy i potwierdź, że przechodzą**

```bash
cd /Users/wiktormarc/meuwe-web && npx vitest run src/components/PushAskModal.test.tsx
```

Oczekiwane: PASS (7 testów).

- [ ] **Step 5: Podłącz w App**

W `src/App.tsx` dopisz props do `<PushAskModal>`:

```tsx
          onFailed={() => {
            setPushAskOpen(false)
            reloadProfile()
            showToast(t('profile.pushRepairFailed'))
          }}
```

Klucz `profile.pushRepairFailed` już istnieje we wszystkich pięciu tłumaczeniach - nic nie trzeba dodawać.

- [ ] **Step 6: Typecheck i pełne testy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

Oczekiwane: `tsc` bez wyjścia, wszystkie testy PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PushAskModal.tsx src/components/PushAskModal.test.tsx src/App.tsx
git commit -m "Stop filing a failed registration as the user saying no"
```

---

## Task 4: DECYZJA - co robić, gdy potwierdzone jest, że to urządzenie nie dostarcza

Po Taskach 1-2 karta nadal wyskoczy, jeśli odczyt jest **potwierdzony** i mówi `needsPermission` / `needsRegistration` - czyli konto ma `push_enabled = true`, ale ten telefon naprawdę nie ma zgody systemowej albo tokenu. Dziś dostaje wtedy treść pierwszego pytania („Damy znać, gdy coś zacznie się obok"), a przycisk zapisuje `push_enabled: true`, które już tam jest.

To osobna decyzja produktowa. **Nie wykonuj tego zadania bez potwierdzenia wyboru.**

> **Rozstrzygnięte 2026-08-06: wybrany wariant B.** Karta zostaje, ale w stanie innym niż `'off'` mówi słowami panelu profilu. Wariant A zostaje niżej jako zapis tego, co odrzuciliśmy i dlaczego - koszt (nikt nie poprosi o zgodę systemową na świeżej instalacji Androida 13+) przeważył.

### Wariant A (rekomendowany): cisza, naprawa zostaje w panelu profilu

Panel ma na to własne słowa - „Włączone, ale nie na tym urządzeniu" plus przycisk naprawy - i użytkownik trafia tam sam.

W `src/lib/pushAsk.ts`, w `shouldOpenPushAsk`, zamień linię z `deviceConfirmed` na:

```ts
  // Someone who already said yes is not asked again. When this device cannot
  // deliver, the profile panel says exactly that, in words that fit, and offers
  // the repair on a screen the user opened on purpose.
  if (ctx.pushState !== 'off') return false
```

Test do dopisania w `src/lib/pushAsk.test.ts`:

```ts
  it('never asks again once the account has said yes', () => {
    for (const pushState of ['needsPermission', 'needsRegistration'] as const) {
      expect(shouldOpenPushAsk(triggered(), ctx({ pushState, deviceConfirmed: true }), NOW)).toBe(false)
    }
  })
```

**Koszt:** ktoś, kto włączył powiadomienia w przeglądarce, a potem zainstalował apkę na Androidzie 13+, nigdy nie zobaczy prośby o zgodę systemową w apce. Będzie myślał, że ma push, i nie dostanie nic na telefon, dopóki sam nie wejdzie w panel profilu.

### Wariant B: pytaj, ale słowami o naprawie

Zostawiasz `shouldOpenPushAsk` jak w Tasku 2 i zamiast tego dajesz karcie drugą treść. W `src/components/PushAskModal.tsx` dodaj props `mode: 'ask' | 'repair'` i wybierz teksty:

```tsx
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, marginBottom: 10 }}>
          {t(mode === 'repair' ? 'profile.pushNotHereTitle' : 'pushAsk.title')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5, marginBottom: 22 }}>
          {t(mode === 'repair' ? 'profile.pushNotHereBody' : 'pushAsk.body')}
        </div>
```

W `src/App.tsx` przekaż `mode={pushAskMode}`, gdzie `pushAskMode` zapamiętujesz przy otwieraniu karty: `setPushAskMode(state === 'off' ? 'ask' : 'repair')`. Wszystkie cztery klucze (`profile.pushNotHereTitle`, `profile.pushNotHereBody`, `pushAsk.title`, `pushAsk.body`) już istnieją w pięciu językach.

**Koszt:** karta nadal potrafi wejść nieproszona, tylko mówi teraz prawdę. Zużywa jedno z trzech pytań.

---

## Weryfikacja końcowa

- [ ] **Testy i typy**

```bash
cd /Users/wiktormarc/meuwe-web && npx tsc --noEmit && npx eslint src && npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

- [ ] **Sprawdzenie na urządzeniu (ręczne, po deployu na staging)**

Tego nie da się odtworzyć w przeglądarce bez zalogowania, więc potwierdzenie jest na telefonie:

1. Wyczyść stan pytania: w apce wyczyść dane aplikacji, albo z konsoli usuń klucz `meuwe_push_ask` z localStorage. Bez tego `askCount` i cooldown i tak zablokują kartę, więc test nic nie udowodni.
2. Odetnij sieć (tryb samolotowy) i uruchom apkę. Zostań na gołej mapie 30 s. Modal **nie** powinien się pojawić - wcześniej pojawiał się właśnie tutaj, bo `getToken()` nie miał jak odpowiedzieć, a `false` znaczyło „niezarejestrowany".
3. Włącz sieć, zostań na mapie kolejne 30 s. Modal nadal się nie pokazuje, bo stan to `'on'`.
4. Otwórz panel profilu i potwierdź, że wiersz powiadomień mówi „Powiadomienia włączone" - to potwierdza, że cisza w krokach 2-3 wzięła się z poprawnej diagnozy, a nie z tego, że karta w ogóle przestała działać.
5. Kontrola negatywna: na koncie testowym z `push_enabled = false` (przełącz w panelu) modal ma się nadal pojawić po ~10 s na gołej mapie.

- [ ] **Nie pushuj bez zgody.** Praca na gałęzi `staging`, `git push` dopiero po akceptacji.
