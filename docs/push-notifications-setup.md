# Push Notifications — Instrukcja wdrożenia

## 1. Generuj klucze VAPID (jednorazowo)

```bash
npx web-push generate-vapid-keys
```

Skopiuj output:
```
Public Key: Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 2. Supabase — SQL migration

Otwórz: **Supabase Dashboard → SQL Editor**

Wklej i uruchom zawartość pliku:
```
supabase/migrations/20260527_push_notifications.sql
```

## 3. Supabase — Sekrety Edge Functions

Otwórz: **Supabase Dashboard → Settings → Edge Functions → Secrets**

Dodaj:
| Nazwa | Wartość |
|-------|---------|
| `VAPID_PUBLIC_KEY` | klucz publiczny z kroku 1 |
| `VAPID_PRIVATE_KEY` | klucz prywatny z kroku 1 |
| `VAPID_SUBJECT` | `mailto:wiktor.marc@gmail.com` |
| `CRON_SECRET` | dowolny losowy string, np. `openssl rand -hex 32` |

## 4. Supabase — Deploy Edge Functions

```bash
# Zainstaluj Supabase CLI jeśli nie masz
npm install -g supabase

# Zaloguj się
supabase login

# Deploy wszystkich funkcji
supabase functions deploy push-new-event --project-ref bcfhsbnbvsuxsiwmeway
supabase functions deploy push-event-start --project-ref bcfhsbnbvsuxsiwmeway
supabase functions deploy push-new-message --project-ref bcfhsbnbvsuxsiwmeway
```

## 5. Supabase — DB Webhooks (2 szt.)

Otwórz: **Supabase Dashboard → Database → Webhooks → Create new hook**

### Webhook 1: Nowe eventy
- Name: `on_new_event`
- Table: `events`
- Events: ☑ INSERT
- Webhook URL: `https://bcfhsbnbvsuxsiwmeway.supabase.co/functions/v1/push-new-event`
- HTTP Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <service_role_key>`

### Webhook 2: Nowe wiadomości
- Name: `on_new_message`
- Table: `event_messages`
- Events: ☑ INSERT
- Webhook URL: `https://bcfhsbnbvsuxsiwmeway.supabase.co/functions/v1/push-new-message`
- HTTP Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <service_role_key>`

> `service_role_key` znajdziesz w: **Settings → API → service_role**

## 6. cron-job.org — "Event starts" (bezpłatny)

1. Zarejestruj się na https://cron-job.org
2. Stwórz nowe zadanie:
   - **URL:** `https://bcfhsbnbvsuxsiwmeway.supabase.co/functions/v1/push-event-start`
   - **Metoda:** POST
   - **Nagłówki:**
     ```
     Authorization: Bearer <anon_key>
     Content-Type: application/json
     x-cron-secret: <CRON_SECRET z kroku 3>
     ```
   - **Interwał:** co 5 minut
   - **Body:** `{}`

> `anon_key` znajdziesz w: **Settings → API → anon public**

## 7. Frontend — zmienna środowiskowa

Stwórz plik `.env` (na podstawie `.env.example`):
```bash
VITE_VAPID_PUBLIC_KEY=<klucz_publiczny_z_kroku_1>
```

Dla deploymentu (Vercel/Netlify) dodaj tę zmienną w ustawieniach projektu.

## 8. Test

1. Otwórz aplikację → zaloguj się
2. Otwórz **profil** → włącz powiadomienia → przeglądarka zapyta o zgodę
3. Stwórz event z tagami pasującymi do zainteresowań konta testowego
4. Sprawdź czy push dotarło (na drugim urządzeniu lub po zamknięciu apki)

## Troubleshooting

**Powiadomienia nie przychodzą:**
- Sprawdź logi Edge Functions: **Supabase Dashboard → Edge Functions → Logs**
- Sprawdź czy `last_lat/last_lng` są zapisane w profilu usera
- Sprawdź czy interesy pokrywają się z tagami eventu
- Na iOS: apka musi być dodana do ekranu głównego (Add to Home Screen)

**iOS Safari:**
- Web Push działa od iOS 16.4+
- Wymagane dodanie do Home Screen
- Przed zapytaniem o pozwolenie warto pokazać hint "Dodaj do ekranu głównego"
