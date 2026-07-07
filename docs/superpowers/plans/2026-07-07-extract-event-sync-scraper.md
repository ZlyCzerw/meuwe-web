# Extract event-sync scraper into its own repo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `scripts/event-sync/` scraper (~5.6k LOC, zero code coupling) out of `meuwe-web` into a standalone `meuwe-event-sync` repo, and strip it from `meuwe-web`.

**Architecture:** Two phases. **Phase 1** creates `meuwe-event-sync` (scraper under `src/`, own `package.json`/`tsconfig`/`vitest`/GitHub Actions), redacts a Mapbox token from two fixtures, and verifies the existing ~40 tests pass standalone. **Phase 2**, on branch `chore/extract-event-sync` in `meuwe-web`, deletes the scraper files, its deps (`cheerio`, `tsx`), scripts, workflow, and historical generated seeds, then verifies the app build/test/lint stay green (they will — no code coupling either direction).

**Tech Stack:** Node 20, `tsx`, `cheerio`, `vitest` (env `node`), TypeScript, GitHub Actions.

**Safety net:** this is a move/refactor — the existing scraper tests are the guard. No new test code; each phase is "make the existing tests pass in their new home / after removal."

**Disk locations:**
- Source of scraper files: `/Users/wiktormarc/meuwe-web-hotfix` (worktree on `chore/extract-event-sync`, which contains `scripts/event-sync/`).
- New repo working dir: `/Users/wiktormarc/meuwe-event-sync`.

---

## File Structure

**New repo `meuwe-event-sync`:**
- `src/` — all scraper code moved verbatim from `scripts/event-sync/` (relative imports use `.ts` extensions, so they survive the move unchanged): `index.ts` (CLI entry), `extract.ts`, `normalize.ts`, `geocoder.ts`, `dedupe.ts`, `mapper.ts`, `sql.ts`, `timezone.ts`, `types.ts`, `verify-venues.ts` (+ their `.test.ts`), `sources/**`, `regions/**`, `__fixtures__/**`.
- `seeds/` — output dir for generated SQL (was `supabase/seeds/` in the app repo).
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`.
- `.github/workflows/sync.yml` — cron + manual scrape, commits `seeds/*.sql`.

**`meuwe-web` deletions (Phase 2):** `scripts/event-sync/`, `tsconfig.scraper.json`, `.github/workflows/lagenda-sync.yml`, generated `supabase/seeds/events_*.sql` + `lagenda_*.sql`; `package.json` loses scripts `event-sync`/`typecheck:scraper` and deps `cheerio`/`tsx`. `vitest.config.ts` unchanged (scraper tests vanish with the dir).

---

## Phase 1 — Create `meuwe-event-sync`

### Task 1: Scaffold the new repo with config files

**Files:**
- Create: `/Users/wiktormarc/meuwe-event-sync/{package.json,tsconfig.json,vitest.config.ts,.gitignore,.env.example,README.md}`

- [ ] **Step 1: Create the directory and init git**

```bash
mkdir -p /Users/wiktormarc/meuwe-event-sync
cd /Users/wiktormarc/meuwe-event-sync
git init
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "meuwe-event-sync",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "sync": "tsx src/index.ts",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.12.3",
    "tsx": "^4.19.2",
    "typescript": "~6.0.2",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`** (ported from `tsconfig.scraper.json`, `include` → `src`)

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`** (node env — scraper needs no jsdom)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
.env
seeds/*.sql
```

(Generated SQL is committed by CI explicitly with `git add -f` in the workflow; local runs stay ignored. If you prefer to track seeds normally, drop the `seeds/*.sql` line — see Task 4 note.)

- [ ] **Step 6: Write `.env.example`**

```
# UUID of the meuwe system team that owns scraped events (INSERTs reference it).
MEUWE_TEAM_UUID=
```

- [ ] **Step 7: Write `README.md` skeleton**

```markdown
# meuwe-event-sync

Event scraper for meuwe. Scrapes configured regions, normalizes/geocodes/dedupes,
and **emits SQL** for the meuwe Supabase `events` table. It does NOT write to the
database — a human pastes the generated SQL into Supabase Dashboard → SQL Editor
(the review gate).

## Run

    npm install
    MEUWE_TEAM_UUID=<uuid> npm run sync -- --region=<rzeszow|tenerife>

Output: `seeds/events_<region>_<date>.sql`.

## Test

    npm test        # ~40 vitest tests against __fixtures__
    npm run typecheck

## Data contract (events table)

The generated INSERTs target the meuwe `events` schema. The authoritative column
list lives in `src/sql.ts` (`generateSql`). **If the app's `events` schema changes,
update `src/sql.ts` here.** Columns currently written: <FILL from src/sql.ts>.
```

- [ ] **Step 8: Commit the scaffold**

```bash
cd /Users/wiktormarc/meuwe-event-sync
git add .
git commit -m "chore: scaffold meuwe-event-sync repo config"
```

### Task 2: Move the scraper source into `src/`, redact the token, fix paths

**Files:**
- Create: `/Users/wiktormarc/meuwe-event-sync/src/**` (copied from `scripts/event-sync/**`)
- Modify: `src/index.ts` (`SEEDS_DIR`)
- Modify: `src/__fixtures__/erzeszow_calendar.html`, `src/__fixtures__/erzeszow_event_detail.html` (redact token)

- [ ] **Step 1: Copy the whole scraper tree into `src/`**

```bash
cd /Users/wiktormarc/meuwe-event-sync
mkdir -p src
cp -R /Users/wiktormarc/meuwe-web-hotfix/scripts/event-sync/. src/
ls src/ src/sources src/regions src/__fixtures__ | head
```

Expected: `src/index.ts`, `src/sources/*.ts`, `src/regions/*.ts`, `src/__fixtures__/*` present. (Relative imports like `./regions/index.ts` are unchanged and still resolve.)

- [ ] **Step 2: Redact the Mapbox token in the two fixtures**

```bash
cd /Users/wiktormarc/meuwe-event-sync
sed -i '' -E 's/access_token=pk\.[A-Za-z0-9._-]+/access_token=pk.REDACTED/g' \
  src/__fixtures__/erzeszow_calendar.html \
  src/__fixtures__/erzeszow_event_detail.html
grep -rc 'access_token=pk\.REDACTED' src/__fixtures__/erzeszow_calendar.html src/__fixtures__/erzeszow_event_detail.html
```

Expected: each file reports `1` (token replaced). Verify no live token remains:

```bash
grep -rhoE 'access_token=pk\.[A-Za-z0-9]{6,}' src/__fixtures__ || echo "no live token — good"
```

Expected: `no live token — good`.

- [ ] **Step 3: Point `SEEDS_DIR` at the local `seeds/` dir**

In `src/index.ts`, change the line:

```ts
const SEEDS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'seeds');
```

to:

```ts
const SEEDS_DIR = path.resolve(__dirname, '..', 'seeds');
```

(`src/index.ts` → `..` is repo root → `seeds/`.)

- [ ] **Step 4: Create the seeds output dir**

```bash
mkdir -p /Users/wiktormarc/meuwe-event-sync/seeds
touch /Users/wiktormarc/meuwe-event-sync/seeds/.gitkeep
```

- [ ] **Step 5: Commit the move**

```bash
cd /Users/wiktormarc/meuwe-event-sync
git add -A
git commit -m "feat: import event-sync scraper into src/ (token redacted, SEEDS_DIR local)"
```

### Task 3: Install and verify the scraper works standalone

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/wiktormarc/meuwe-event-sync
npm install
```

Expected: installs `cheerio` + dev deps, creates `package-lock.json`, no peer errors.

- [ ] **Step 2: Run the test suite — the safety net**

```bash
npm test
```

Expected: all scraper tests pass (~40 test files green). If any fail on fixture paths, confirm the fixture moved under `src/__fixtures__/` with the same relative structure. The redacted token must NOT cause failures (it is page content, never asserted).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no type errors (ported tsconfig matches the original scraper tsconfig).

- [ ] **Step 4: Smoke-test SQL generation**

```bash
MEUWE_TEAM_UUID=00000000-0000-0000-0000-000000000000 npm run sync -- --region=rzeszow
ls -la seeds/
```

Expected: prints the run summary and writes `seeds/events_rzeszow_<date>.sql`. Open it: it should contain `INSERT INTO ... events ...`. (Network-dependent; if a source is unreachable it logs and continues — a non-empty SQL file or a clean "Nothing to write" is acceptable.)

- [ ] **Step 5: Fill the README data contract**

Read the target columns and paste them into `README.md` (replace `<FILL from src/sql.ts>`):

```bash
grep -nE "INSERT INTO|VALUES|columns|=>" src/sql.ts | head -20
```

List the `events` columns that `generateSql` writes. Commit:

```bash
git add README.md
git commit -m "docs: document events data contract in README"
```

### Task 4: Add the GitHub Actions sync workflow

**Files:**
- Create: `/Users/wiktormarc/meuwe-event-sync/.github/workflows/sync.yml`

- [ ] **Step 1: Write the workflow** (ports `lagenda-sync.yml`; runs both regions, commits `seeds/*.sql`)

```yaml
name: Event Sync

on:
  schedule:
    # Every 3 days at 06:00 UTC
    - cron: '0 6 */3 * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # commit generated SQL back to this repo
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
      - name: Scrape all regions
        run: |
          npm run sync -- --region=rzeszow
          npm run sync -- --region=tenerife
        env:
          MEUWE_TEAM_UUID: ${{ secrets.MEUWE_TEAM_UUID }}
      - name: Commit generated SQL
        run: |
          git config user.name "event-sync[bot]"
          git config user.email "bot@meuwe.app"
          git add -f seeds/*.sql
          if git diff --staged --quiet; then
            echo "No new events — nothing to commit."
          else
            git commit -m "sync: events $(date +%Y-%m-%d)"
            git push
          fi
```

> **NOTE (pre-existing discrepancy to confirm):** the old `lagenda-sync.yml` ran `index.ts` with **no** `--region` and committed `lagenda_*.sql`, while `index.ts` requires `--region=` and writes `events_<region>_*.sql`. This workflow fixes that by iterating the real regions and committing `seeds/*.sql`. Confirm with the user which regions and cadence are actually wanted before relying on the schedule.

- [ ] **Step 2: Commit the workflow**

```bash
cd /Users/wiktormarc/meuwe-event-sync
git add .github/workflows/sync.yml
git commit -m "ci: event-sync scrape workflow (cron + dispatch)"
```

### Task 5: Create the GitHub repo, push, set the secret

- [ ] **Step 1: Create the remote repo and push** (uses `gh`; confirm owner)

```bash
cd /Users/wiktormarc/meuwe-event-sync
gh repo create ZlyCzerw/meuwe-event-sync --private --source=. --remote=origin --push
```

Expected: repo created, `main` pushed. Push protection should NOT block (token redacted, no other secrets in history — the history is fresh).

- [ ] **Step 2: Set the `MEUWE_TEAM_UUID` secret** (get the value from the old repo's GitHub secret or the app team config)

```bash
gh secret set MEUWE_TEAM_UUID --repo ZlyCzerw/meuwe-event-sync
```

Expected: prompts for the value, stores it. (The scraper's default fallback in `src/sql.ts` exists, but CI should set the real UUID.)

- [ ] **Step 3: Trigger the workflow once to verify CI**

```bash
gh workflow run "Event Sync" --repo ZlyCzerw/meuwe-event-sync
gh run watch --repo ZlyCzerw/meuwe-event-sync
```

Expected: the run installs, typechecks, scrapes, and either commits new `seeds/*.sql` or reports "nothing to commit". Green run = Phase 1 done.

---

## Phase 2 — Strip the scraper from `meuwe-web`

Work on branch `chore/extract-event-sync` in `/Users/wiktormarc/meuwe-web-hotfix`.

### Task 6: Delete scraper files, config, workflow, and generated seeds

**Files:**
- Delete: `scripts/event-sync/`, `tsconfig.scraper.json`, `.github/workflows/lagenda-sync.yml`, `supabase/seeds/events_*.sql`, `supabase/seeds/lagenda_*.sql`

- [ ] **Step 1: Confirm no non-scraper seeds are about to be lost**

```bash
cd /Users/wiktormarc/meuwe-web-hotfix
ls supabase/seeds/
```

Delete only the generated scraper output (`events_*.sql`, `lagenda_*.sql`). If any other `.sql` exists (hand-written app seed), leave it. Then:

```bash
git rm -r scripts/event-sync
git rm tsconfig.scraper.json
git rm .github/workflows/lagenda-sync.yml
git rm supabase/seeds/events_*.sql 2>/dev/null || echo "no events_*.sql"
git rm supabase/seeds/lagenda_*.sql 2>/dev/null || echo "no lagenda_*.sql"
```

- [ ] **Step 2: Verify nothing in `src/` referenced the scraper (should already be clean)**

```bash
grep -rn "event-sync\|scripts/event-sync\|from 'cheerio'\|from \"cheerio\"" src && echo "FOUND — investigate" || echo "clean — no references"
```

Expected: `clean — no references`.

### Task 7: Remove scraper scripts and deps from `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove the two scraper npm scripts**

Delete these lines from `"scripts"`:

```json
    "typecheck:scraper": "tsc -p tsconfig.scraper.json",
    "event-sync": "tsx scripts/event-sync/index.ts",
```

- [ ] **Step 2: Uninstall the scraper-only deps** (verified unused in `src/`)

```bash
cd /Users/wiktormarc/meuwe-web-hotfix
npm uninstall cheerio tsx
```

Expected: `cheerio` and `tsx` removed from `package.json` + `package-lock.json`. (`jsdom` and `@supabase/supabase-js` stay — used by the app.)

- [ ] **Step 3: Sanity-check the diff**

```bash
git diff package.json
```

Expected: only the two scripts and the two deps removed; nothing else.

### Task 8: Verify the app is green and open the PR

- [ ] **Step 1: Install and run the full app gate**

```bash
cd /Users/wiktormarc/meuwe-web-hotfix
npm install
npm run build
npm test
npm run lint
```

Expected: all green. Build (`tsc -b && vite build`) succeeds; `vitest run` passes (the ~40 scraper tests are gone, app tests remain); lint clean. No reference to the deleted `tsconfig.scraper.json` remains (it was only referenced by the removed `typecheck:scraper` script).

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove event-sync scraper (moved to meuwe-event-sync repo)

Scraper extracted to its own repo (meuwe-event-sync). Deletes scripts/event-sync,
tsconfig.scraper.json, the sync workflow, generated seeds, the event-sync/
typecheck:scraper npm scripts, and the scraper-only deps cheerio + tsx. No app
code depended on it (verified). jsdom + supabase-js retained for the app."
```

- [ ] **Step 3: Push and open the PR against `staging`**

```bash
git push -u origin chore/extract-event-sync
gh pr create --repo ZlyCzerw/meuwe-web --base staging --head chore/extract-event-sync \
  --title "Remove event-sync scraper (extracted to meuwe-event-sync)" \
  --body "Scraper moved to the standalone meuwe-event-sync repo. This PR only deletes it from meuwe-web (files, deps cheerio/tsx, scripts, workflow, generated seeds). No code coupling either direction; build/test/lint green."
```

Expected: PR opened against `staging`. Merge after review.

---

## Self-Review (plan vs spec)

- Spec §"osobne repo `meuwe-event-sync`, layout `src/`" → Tasks 1–2 (scaffold + move into `src/`). ✅
- Spec §"deps: tylko cheerio runtime; tsx/vitest/ts/@types dev; NIE jsdom/supabase-js" → Task 1 `package.json`; Task 7 removes only `cheerio`+`tsx` from app. ✅
- Spec §"SQL do własnego repo + ręczne wklejenie; sekret tylko MEUWE_TEAM_UUID" → Task 2 `SEEDS_DIR`, Task 4 workflow commits `seeds/*.sql`, Task 5 sets only `MEUWE_TEAM_UUID`; no DB key. ✅
- Spec §"świeży start + redakcja tokenu Mapbox w 2 fixtures" → Task 1 `git init` (fresh), Task 2 Step 2 redaction + verification. ✅
- Spec §"tsconfig ported, vitest env node" → Task 1 Steps 3–4. ✅
- Spec §"workflow przeniesiony, commit SQL lokalnie" → Task 4 (+ note on the pre-existing region/glob discrepancy). ✅
- Spec §"README z kontraktem danych" → Task 1 Step 7 skeleton + Task 3 Step 5 fill from `src/sql.ts`. ✅
- Spec §"meuwe-web: usuń pliki/tsconfig/workflow/scripts/deps; usuń historyczne seedy; jsdom+supabase-js zostają" → Tasks 6–7. ✅
- Spec §"weryfikacja: scraper tests standalone; app build/test/lint zielone" → Task 3 Step 2, Task 8 Step 1. ✅
- Spec §"GUI poza zakresem, layout src/ pod nie" → honored by `src/` layout; no GUI tasks. ✅
- Placeholder scan: the only `<FILL>` is the README contract, and it has an explicit fill step (Task 3 Step 5) with the command to source it — not a dangling TODO. ✅
- Path/name consistency: `SEEDS_DIR`, `meuwe-event-sync`, `src/`, `seeds/`, `MEUWE_TEAM_UUID`, `cheerio`/`tsx` used consistently across tasks. ✅
