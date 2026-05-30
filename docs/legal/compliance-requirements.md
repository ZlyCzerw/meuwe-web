# meuwe — Wymogi prawne i compliance

**Status aplikacji:** darmowa, niekomercyjna, dostępna publicznie  
**Języki:** PL, EN, DE, ES  
**Użytkownicy:** osoby pełnoletnie (wymagane), logowanie przez Google OAuth  
**Hosting:** Cloudflare Pages (frontend), Supabase (backend/baza danych), Supabase Edge Functions (Deno)  
**Data przeglądu:** 2026-05-29

---

## 1. Dane osobowe zbierane przez aplikację

| Dane | Skąd pochodzi | Gdzie przechowywane | Cel |
|------|--------------|---------------------|-----|
| Email, Google ID | Google OAuth | Supabase `auth.users` | Identyfikacja użytkownika |
| Imię/pseudonim (`display_name`) | Użytkownik podaje | `profiles` | Wyświetlanie w UI |
| Kolor avatara | Generowany losowo | `profiles` | UI |
| GPS — bieżąca pozycja | `navigator.geolocation` | RAM (nie zapisywana trwale) | Centrowanie mapy, filtr eventów |
| GPS — ostatnia znana pozycja | `navigator.geolocation` | `localStorage` + `profiles.last_lat/last_lng` | Fallback pozycji, powiadomienia push "w okolicy" |
| `last_seen_at` | Automatycznie | `profiles` | Filtr aktywnych użytkowników dla push |
| Zainteresowania (`interests`) | Użytkownik podaje opcjonalnie | `profiles` | Filtr tematyczny powiadomień |
| Promień powiadomień (`radius_km`) | Użytkownik ustawia | `profiles` | Filtr geograficzny push |
| Subskrypcje push (`endpoint`, `p256dh`, `auth_key`) | Web Push API | `push_subscriptions` | Wysyłanie powiadomień |
| Treść eventów (tytuł, opis, zdjęcia, lokalizacja) | Użytkownik tworzy | `events`, Supabase Storage | Funkcja główna |
| Wiadomości na czacie eventów | Użytkownik pisze | `event_messages` | Funkcja czatu |
| Wyciszenia powiadomień | Użytkownik ustawia | `notification_mutes` | Preferencje push |

---

## 2. Ramy prawne

### 2.1 RODO / GDPR (priorytet — obowiązkowe)

Aplikacja przetwarza dane osobowe mieszkańców UE → **RODO stosuje się w całości**, nawet jeśli projekt jest niekomercyjny.

**Wymagania:**

- [ ] **Polityka prywatności** — obowiązkowa, dostępna przed logowaniem lub w stopce aplikacji. Musi zawierać: jakie dane, po co, jak długo, kto ma dostęp, jak usunąć.
- [ ] **Podstawa prawna przetwarzania** — dla niekomercyjnej apki najlepsza jest **zgoda użytkownika** (art. 6 ust. 1 lit. a RODO). Checkbox przy rejestracji lub ekran "akceptuję" przed pierwszym logowaniem.
- [ ] **Prawo do usunięcia konta** (art. 17) — użytkownik musi móc usunąć swoje dane. Wymagany przycisk "Usuń konto" w ustawieniach profilu. Musi kasować: `auth.users`, `profiles`, `events`, `event_messages`, `push_subscriptions`.
- [ ] **Prawo dostępu do danych** (art. 15) — użytkownik może zapytać co jest przechowywane. Wystarczy kontakt email + odpowiedź w 30 dni.
- [ ] **Minimalizacja danych** — nie zbierać więcej niż potrzeba. GPS w `profiles` przechowywany permanentnie → rozważyć TTL lub usuwanie po X dniach nieaktywności.
- [ ] **Informacja o lokalizacji** — użytkownik musi wiedzieć że GPS jest wysyłany na serwer (do `profiles.last_lat/last_lng`). Musi to być jasno opisane w polityce prywatności.
- [ ] **Retencja danych** — określ jak długo dane są przechowywane. Rekomendacja: `last_lat/last_lng/last_seen_at` — czyścić po 90 dniach nieaktywności; `push_subscriptions` — czyścić po wygaśnięciu lub 180 dniach.
- [ ] **Zgoda na push notifications** — przeglądarka pyta o zgodę systemowo. Wystarczy. Nie trzeba dodatkowego checkboxa, ale trzeba opisać to w polityce.
- [ ] **Przekazywanie danych poza EOG** — Supabase (AWS us-east-1 lub eu-central-1). Sprawdź region projektu. Jeśli US → konieczne SCC (Standard Contractual Clauses) lub wybierz region EU w Supabase.
- [ ] **Administrator danych** — wskaż kto jest ADO (imię i nazwisko lub firma + email kontaktowy).

### 2.2 Regulamin (Terms of Service)

Nieobowiązkowy prawnie, ale **konieczny praktycznie** — chroni ciebie przed:
- roszczeniami za treści tworzone przez użytkowników (eventy, wiadomości)
- nadużyciami (spam, fałszywe eventy, nękanie)
- odpowiedzialnością za niedostępność usługi

**Wymagania regulaminu:**
- [ ] Opis usługi i jej ograniczeń
- [ ] Wymagany wiek (min. 16 lat — próg RODO dla zgody)
- [ ] Zasady tworzenia treści (zakaz spamu, treści nielegalnych, fałszywych eventów)
- [ ] Zastrzeżenie braku gwarancji (usługa "as is", darmowa)
- [ ] Prawo do zawieszenia/usunięcia konta za naruszenia
- [ ] Prawo własności intelektualnej treści (użytkownik zachowuje prawa, udziela licencji na wyświetlanie)
- [ ] Wyłączenie odpowiedzialności za treści użytkowników
- [ ] Prawo do zmiany/zamknięcia usługi

### 2.3 Ustawa o świadczeniu usług drogą elektroniczną (Polska)

Jeśli kierujesz aplikację do polskich użytkowników:
- [ ] **Regulamin w języku polskim** — wymagany
- [ ] **Dane identyfikujące usługodawcę** — imię, nazwisko lub nazwa firmy + email kontaktowy
- [ ] **Informacja o plikach cookies/localStorage** — localStorage nie wymaga zgody cookie, ale wymaga wzmianki w polityce prywatności

### 2.4 Wiek użytkowników (RODO art. 8)

- [ ] Minimalny wiek 16 lat (RODO) — zadeklaruj w regulaminie
- [ ] Nie ma obowiązku weryfikacji wieku przy OAuth Google, ale regulamin musi to zawierać
- [ ] Brak treści kierowanych do dzieci → nie stosuje się COPPA (USA)

### 2.5 Mapy i dane zewnętrzne

- [ ] **OpenStreetMap/Carto** — wymagane podanie źródła na mapie (attribution). Sprawdź czy jest widoczne w UI.
- [ ] **Nominatim (geocoding)** — dozwolony do niekomercyjnego użytku. Ograniczenie: max 1 req/s. Masz debounce 350ms — OK. Przy skalowaniu → rozważ własną instancję Nominatim lub Photon.
- [ ] **Google Maps (directions link)** — link do `maps.google.com` nie wymaga klucza API ani zgody. OK.

### 2.6 Web Push / VAPID

- [ ] Zgoda systemowa przeglądarki — wystarczy
- [ ] Użytkownik może wycofać zgodę w systemie (przeglądarka) lub przez toggle w profilu aplikacji — **toggle jest zaimplementowany** ✅
- [ ] Wyciszenia per event są zaimplementowane ✅

---

## 3. Priorytety działań

### Krytyczne (przed publicznym launch)
1. **Polityka prywatności** — napisać i umieścić w aplikacji (link na ekranie logowania i w profilu)
2. **Regulamin** — napisać i umieścić w aplikacji
3. **Przycisk "Usuń konto"** — zaimplementować w ProfilePanel (kaskadowe usunięcie danych)
4. **Potwierdzenie zgody** — checkbox lub ekran "akceptuję regulamin i politykę prywatności" przy pierwszym logowaniu
5. **Dane administratora** — umieścić w polityce prywatności (email kontaktowy)

### Ważne (w ciągu 30 dni)
6. **Region Supabase** — sprawdzić czy projekt jest na EU. Jeśli US → zmienić lub dodać SCC.
7. **TTL dla danych lokalizacji** — cron job czyszczący `last_lat/last_lng` po 90 dniach nieaktywności
8. **Attribution mapy** — upewnić się że OpenStreetMap/Carto attribution jest widoczne

### Opcjonalne (dobra praktyka)
9. **Data Retention Policy** — dokument opisujący okresy przechowywania
10. **Eksport danych** — "pobierz moje dane" (art. 20 RODO — prawo przenoszalności)

---

## 4. Kontakt / ADO

Uzupełnij przed publikacją polityki:

```
Administrator danych osobowych:
Wiktor Marc
Email: meuwe@gmail.com
```
