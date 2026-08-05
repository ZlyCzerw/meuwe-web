# Przełączanie konta Google - test ręczny

Dotyczy zmiany, która przywraca wybór konta przy ponownym logowaniu.
Automat sprawdza tylko, że wołamy właściwe rzeczy w właściwej kolejności
(`src/lib/nativeAuth.test.ts`, `src/lib/authPrompt.test.ts`) - czy system faktycznie
pokazuje listę kont, da się zobaczyć wyłącznie na urządzeniu.

**Wymaga nowego builda natywnego.** Zmiana jest w TypeScript, ale stary APK/IPA nadal
ma starą paczkę JS.

## Przygotowanie

Dwa konta Google na jednym telefonie - dalej **A** i **B**. Warto, żeby A miało
włączone powiadomienia i obserwowało jakieś wydarzenie.

## Android / iOS

| # | Krok | Oczekiwane |
|---|---|---|
| 1 | Świeża instalacja, zaloguj się jako A | Lista kont **może** się nie pojawić - to normalne przy pierwszym logowaniu |
| 2 | Profil → Wyloguj | Wraca ekran powitalny |
| 3 | Zaloguj przez Google | **Musi** pojawić się wybór konta |
| 4 | Wybierz B | Aplikacja wchodzi na konto B - sprawdź nazwę w kółku w lewym górnym rogu |
| 5 | Profil → włącz powiadomienia na koncie B | Stan "Powiadomienia włączone" |
| 6 | Z drugiego urządzenia napisz w czacie wydarzenia obserwowanego przez **A** | Telefon **nie powinien** dostać tego powiadomienia |

Krok 6 to najważniejszy scenariusz, bo to on odróżnia "przełączyliśmy konto" od
"przełączyliśmy tylko ekran". `register_push_device` wyprowadza właściciela tokenu
z aktywnej sesji, więc po zalogowaniu B token powinien przepiąć się na B.

**Znany brak, świadomie poza zakresem tej zmiany:** między krokiem 2 a 5 telefon
nadal ma wiersz w `push_devices` przypisany do A. Jeśli w tym okienku ktoś napisze
do A, powiadomienie dojdzie na to urządzenie mimo wylogowania. Wyrejestrowanie
tokenu przy wylogowaniu to osobny task.

## Scenariusz aktualizacji (ten, który łatwo przeoczyć)

Osoby, które wylogowały się na **starej** wersji, mają już zabrudzony stan natywny -
samo `signOutNative` przy kolejnym wylogowaniu im nie pomoże, bo one już są wylogowane.

| # | Krok | Oczekiwane |
|---|---|---|
| 1 | Zainstaluj **starą** wersję, zaloguj A, wyloguj | - |
| 2 | Zainstaluj nową wersję **bez czyszczenia danych** | - |
| 3 | Zaloguj przez Google | **Musi** pojawić się wybór konta |

Za to odpowiada `FirebaseAuthentication.signOut()` wołane *przed* `signInWithGoogle`
w `signInGoogleNative`. Bez tego kroku 3 pokaże od razu konto A.

## Web

| # | Krok | Oczekiwane |
|---|---|---|
| 1 | Zaloguj się jako A na meuwe.eu | - |
| 2 | Wyloguj się | - |
| 3 | Zaloguj przez Google | **Musi** pojawić się wybór konta (`prompt=select_account`) |
| 4 | Wyloguj, zamknij kartę, wejdź ponownie i zaloguj | Wybór konta **nie** powinien się pojawić - znacznik jest jednorazowy i zużyło go logowanie z kroku 3 |

Krok 4 jest celowy: prośba o wybór konta należy do logowania po wylogowaniu, a nie do
każdego kolejnego. Znacznik siedzi w `localStorage` pod `meuwe_signed_out`.

## Apple

Bez zmian - Apple nie ma w tym przepływie przełączania kont. `signOutNative` i tak
obejmuje wszystkie providery, więc nic nie trzeba robić osobno.
