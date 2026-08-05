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

## 6. Harmonogram — Supabase Cron (pg_cron + pg_net)

Oba cykliczne wywołania (start wydarzeń co 5 minut, cotygodniowy digest co
godzinę) planuje sam Supabase. Definicja zadań:
`supabase/migrations/20260805_cron_jobs.sql` - uruchamiana ręcznie w SQL
Editorze, osobno na staging i na PROD.

Zanim uruchomisz, dodaj w Vault (Project Settings → Vault) trzy sekrety:
`project_url`, `anon_key`, `cron_secret` - wartości i szczegóły opisane w
komentarzu na górze tego pliku SQL. Tam też są zapytania kontrolne
(`cron.job`, `cron.job_run_details`) i wycofanie.

Digest wymaga też kolumny `profiles.last_digest_at` - migracja
`supabase/migrations/20260805_weekly_digest.sql`, również ręcznie.

Dlaczego digest chodzi co godzinę: funkcja sama sprawdza, u kogo właśnie jest
piątek 17:00 (strefa liczona z last_lat/lng - Warszawa i Wyspy Kanaryjskie
mają inne godziny). Wysyłkę do jednego użytkownika częściej niż raz na 6 dni
blokuje `last_digest_at`, więc podwójne odpalenie niczego nie zdubluje.

> Historycznie zadanie push-event-start chodziło na cron-job.org (POST z
> nagłówkami `Authorization: Bearer <anon_key>` + `x-cron-secret`, body `{}`).
> Po przejściu na pg_cron zadania na cron-job.org należy wyłączyć - dla
> event-start zaraz po pierwszym udanym przebiegu, żeby dwa crony nie zdążyły
> zdublować powiadomienia o starcie.

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
