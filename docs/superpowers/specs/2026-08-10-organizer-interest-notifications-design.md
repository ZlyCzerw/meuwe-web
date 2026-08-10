# Powiadomienia dla organizatora o zainteresowaniu - projekt

**Status:** zatwierdzony w rozmowie 2026-08-10, czeka na plan wdrożenia.

## Po co

Organizator ma się dowiadywać, że ludzie chcą przyjść na jego wydarzenie: „X osób chce wziąć udział w Twoim wydarzeniu". Dziś nie ma żadnego powiadomienia wyzwalanego obserwowaniem - istniejące funkcje pokrywają nowe wydarzenie w pobliżu, start wydarzenia, edycję, wiadomość na czacie i tygodniowy digest.

Projekt jest **niezależny od wykrywania dotarcia**: opiera się na obserwowaniu, nie na lokalizacji, i nie dzieli z tamtym ani danych, ani ryzyka.

## Sygnał

Obserwowanie wydarzenia (`event_follows`) to deklaracja „wybieram się". Licznik to liczba obserwujących **z wyłączeniem twórcy**.

Twórca pozostaje obserwującym własnego wydarzenia - [createEvent](../../../src/lib/supabase.ts#L243) zapisuje ten wiersz celowo i inne funkcje na nim polegają (czat, powiadomienia o wiadomościach). Zmienia się tylko to, że nie liczy się do licznika chętnych. Bez tego każdy organizator dostałby „1 osoba chce wziąć udział" o sobie samym, sekundę po utworzeniu wydarzenia.

## Rytm

Powiadomienie leci przy pierwszych pięciu osobach z osobna, a potem tylko przy progach:

```
1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 70, 100, a powyżej 100 co 50
```

Czyli dalej 150, 200, 250 i tak dalej. Uzasadnienie: na początku każda osoba jest informacją, przy dużym wydarzeniu liczy się już tylko rząd wielkości, a organizator nie ma dostać trzydziestu powiadomień o trzydziestu osobach.

Reguła wychodzi do czystej funkcji, żeby dała się przetestować bez bazy i bez pusha:

```ts
export function interestMilestones(count: number): boolean
```

## Idempotencja

Na `events` dochodzi kolumna `interest_notified_count integer not null default 0` - ostatnia liczba, o której powiadomiono.

Powiadomienie wychodzi tylko wtedy, gdy nowy licznik przekracza próg wyższy niż zapisany, a zaraz po wysyłce kolumna dostaje nową wartość. To załatwia dwa równoczesne dołączenia: oba przeliczą licznik na tę samą wartość, ale tylko pierwsze zdąży podnieść `interest_notified_count`, a drugie zobaczy, że próg jest już obsłużony.

Aktualizacja kolumny musi iść warunkowo (`where interest_notified_count < :nowy`), żeby wyścig rozstrzygała baza, a nie kolejność wywołań funkcji.

## Dostarczanie

Webhook bazy na `INSERT` do `event_follows` wywołuje nową funkcję edge `push-event-interest` - ten sam wzorzec, co istniejący webhook dla `push-new-message`.

Funkcja:

1. odczytuje wydarzenie (twórca, tytuł, `interest_notified_count`),
2. jeśli wstawiony obserwujący to twórca - kończy bez wysyłki,
3. liczy obserwujących z wyłączeniem twórcy,
4. sprawdza próg; jeśli nie przekroczono - kończy,
5. przepuszcza twórcę przez `filterDeliverable`, czyli tę samą bramkę co reszta powiadomień: `push_enabled` i wyciszenia tego wydarzenia,
6. wysyła web push i FCM, tak jak pozostałe funkcje,
7. podnosi `interest_notified_count`.

Błąd któregokolwiek zapytania kończy się odpowiedzią 5xx i **bez** podnoszenia licznika, żeby awaria nie kasowała progu po cichu.

## Treść

`NotifType` w [notif-i18n.ts](../../../supabase/functions/_shared/notif-i18n.ts) zyskuje wariant `interest`.

Tytuł jest statyczny i mieści się w istniejącej strukturze `NOTIF_TEXT`:

| język | tytuł |
|---|---|
| pl | Ktoś wybiera się na Twoje wydarzenie |
| en | Someone is coming to your event |
| es | Alguien va a tu evento |
| de | Jemand kommt zu deinem Event |
| sl | Nekdo pride na tvoj dogodek |

Treść zawiera liczbę, więc nie zmieści się w tablicy statycznych napisów - `NOTIF_TEXT` z założenia trzyma wyłącznie teksty bez części zmiennych. Dochodzi osobna funkcja w tym samym module:

```ts
export function interestBody(count: number, lang: Lang): string
```

Polski wymaga trzech form liczby mnogiej: „1 osoba chce wziąć udział", „2 osoby chcą wziąć udział", „5 osób chce wziąć udział". Rosyjskiej kategorii „few" nie mają pozostałe języki, więc funkcja rozstrzyga to per język, a nie jedną regułą.

Nazwa wydarzenia nie wchodzi do treści - idzie w `body` istniejącego mechanizmu jako część payloadu, tak jak przy pozostałych typach, i kliknięcie otwiera wydarzenie.

## Czego ten projekt nie robi

Nie liczy dotarć ani nie dotyka lokalizacji. Nie powiadamia o odejściu obserwującego - spadek licznika jest cichy i nie obniża `interest_notified_count`, więc ponowne wejście na ten sam próg nie wyśle drugiego powiadomienia. Nie pokazuje organizatorowi listy osób.

## Testy

`interestMilestones` i `interestBody` pokrywamy testami jednostkowymi - to jedyne miejsca z decyzją i z odmianą. Dla progów sprawdzamy całą drabinkę oraz to, że wartości pomiędzy progami nie wyzwalają niczego, i że powyżej 100 działa krok 50.

Ścieżkę end-to-end sprawdzamy na stagingu: konto A tworzy wydarzenie, konta B i C je obserwują, konto A dostaje dwa powiadomienia (przy 1 i przy 2), a po dołączeniu czwartej i piątej osoby nie dostaje nic aż do dziesiątej.

## Ryzyka

Webhook jest konfiguracją w panelu Supabase, poza migracjami i poza kontrolą wersji - tak samo jak istniejący webhook dla nowych wydarzeń. Trzeba go założyć ręcznie na stagingu i na produkcji, i zapisać w [docs/push-notifications-setup.md](../../push-notifications-setup.md), bo inaczej funkcja nigdy nie zostanie wywołana i nikt tego nie zauważy.
