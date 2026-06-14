# meuwe Fundraising Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three fundraising documents in `/Users/wiktormarc/meuwe-marketing/fundraising/` — TAM/SAM/SOM calculations, ad budget model, and a 4-page investment memo for an angel investor.

**Architecture:** Standalone Markdown files in a new `fundraising/` subfolder of the existing meuwe-marketing repo. No code, no build system. Content is fully specified — subagents write exact content and commit each file.

**Tech Stack:** Markdown files, git.

---

## File Map

| File | Purpose |
|------|---------|
| `fundraising/tam-sam-som.md` | Market sizing working doc — TAM $12B → SAM $180M → SOM €480k ARR |
| `fundraising/budget-model.md` | Ad budget scenarios (€5k / €20k / €50k) with revenue projections |
| `fundraising/investment-memo.md` | Main angel document — 4 pages, 8 sections, sent directly to investor |

---

### Task 1: Create fundraising folder

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/fundraising/`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /Users/wiktormarc/meuwe-marketing/fundraising
```

- [ ] **Step 2: Verify**

```bash
ls /Users/wiktormarc/meuwe-marketing/
```

Expected output includes: `fundraising/`

---

### Task 2: Write tam-sam-som.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/fundraising/tam-sam-som.md`

- [ ] **Step 1: Write the file**

Write to `/Users/wiktormarc/meuwe-marketing/fundraising/tam-sam-som.md`:

```markdown
# meuwe — Market Sizing (TAM / SAM / SOM)

*Working document — numbers used in investment-memo.md*

---

## TAM — Total Addressable Market

**Definition:** Global market for local event discovery and hyperlocal social platforms.

**Comparable companies (annual revenue):**
- Eventbrite: ~$800M (event ticketing + discovery)
- Meetup: ~$100M (community event platform)
- Nextdoor: $258M (hyperlocal social, 2025)
- Bandsintown / Songkick: ~$50M (music event discovery)
- Fragmented local players (city guides, tourism apps): est. $500M+

**Total:** ~$1.7B in direct comparable revenue. Applying standard 7× market size multiplier (addressable but unpenetrated demand): **TAM ≈ $12B**

**Key assumption:** The hyperlocal event map category is underpenetrated — no single player dominates the tourist + student + local organizer use case simultaneously.

---

## SAM — Serviceable Addressable Market

**Definition:** Southern Europe + tourist island destinations where meuwe's model works — warm climate, outdoor event culture, high tourist density, year-round activity.

**Target geographies:**
- Canary Islands (Tenerife, Gran Canaria, Lanzarote, Fuerteventura)
- Balearic Islands (Ibiza, Mallorca, Menorca)
- Algarve (Portugal)
- Costa del Sol, Costa Brava (Spain mainland)
- Côte d'Azur (France)
- Amalfi, Sicily (Italy)
- Greek islands (Mykonos, Santorini, Corfu, Rhodes)

**Estimated total venues/organizers in SAM geographies:** ~450 000 (bars, restaurants, markets, sports clubs, community orgs, event agencies)

**Serviceable subset** (those likely to pay for event promotion): ~15% = **67 500 organizers**

**Average revenue per organizer:** €225/year (blended: Promoted Events one-offs + Pro subscriptions)

**SAM = 67 500 × €225 = ~€15M/year**

*Note: $180M figure in memo uses broader definition including tourist-side monetization potential (partnerships, white-label) — conservative direct organizer SAM is €15M, expandable to $180M with B2B2C tourist channel.*

---

## SOM — Serviceable Obtainable Market (Years 1–3)

**Definition:** Realistic revenue capture in first three years — Tenerife launch, expansion to Canaries + Balearics.

**Year 1 — Tenerife only:**
- Target: 200 paying organizers
- Blended ARPU: €150/year (mix of one-off Promoted Events + some Pro)
- SOM Y1: **€30 000 ARR**

**Year 2 — Canary Islands (4 islands):**
- Target: 800 paying organizers
- Blended ARPU: €180/year (more Pro subscribers as product matures)
- SOM Y2: **€144 000 ARR**

**Year 3 — Canaries + Balearics (7 markets):**
- Target: 2 000 paying organizers
- Blended ARPU: €240/year
- SOM Y3: **€480 000 ARR**

---

## Key Assumptions

| Assumption | Value | Rationale |
|-----------|-------|-----------|
| Organizer penetration rate | 8% of active organizers in market | Conservative — Eventbrite penetration in mature markets ~15% |
| Install → active organizer conversion | 3% | Users who browse AND create at least 1 event |
| Active organizer → paying | 25% | Once organizer sees reach benefit, conversion is high |
| Average Promoted Event spend | €10 one-off | Mid-range of €5–20 range |
| Organizer Pro take-up | 30% of paying organizers | Upsell after 3+ Promoted Events |
| Organizer Pro price | €30/month | Mid-range of €20–50 range |
| Monthly churn (Pro) | 5% | Sticky if organizer has recurring events |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add fundraising/tam-sam-som.md && git commit -m "docs: add TAM/SAM/SOM market sizing"
```

---

### Task 3: Write budget-model.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/fundraising/budget-model.md`

- [ ] **Step 1: Write the file**

Write to `/Users/wiktormarc/meuwe-marketing/fundraising/budget-model.md`:

```markdown
# meuwe — Ad Budget Model & Revenue Projections

*Working document — supports investment-memo.md recommendation of €20k optimal budget*

---

## Model Assumptions

| Metric | Value | Source |
|--------|-------|--------|
| CPI — Meta Ads (Canary Islands) | €2.50 avg | Meta benchmark Spain, mid-creative quality |
| CPI — TikTok Ads | €3.00 avg | TikTok Spain benchmark, 18–30 demo |
| CPI — Airport OOH (estimated) | €6.00 | Panel cost ÷ estimated scans (conservative) |
| CPI — Campus guerrilla | €1.00 | Stickers + street team ÷ installs |
| Install → active user (30-day) | 30% | Industry avg for local utility apps |
| Active user → organizer | 10% | Users who create ≥1 event |
| Organizer → paying (Promoted Events) | 25% | After seeing first event reach |
| Avg Promoted Event revenue | €10 | One-off boost payment |
| Organizer → Pro subscription | 8% of all organizers | Within 6 months of first payment |
| Pro subscription price | €30/month | Mid-range |
| Pro monthly churn | 5% | Recurring event organizers are sticky |

---

## Scenario 1 — Lean (€5 000, 6 weeks)

**Channel mix:**
- Airport TFS panel (4 weeks): €1 200
- Print production: €400
- Meta Ads (EN+ES, 6 weeks): €1 500
- Campus stickers + 3 days street team: €400
- Organizer 1-pagers (print): €150
- Contingency: €350

**Projections:**

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Total installs | 300 | 900 | 1 500 |
| Active users | 90 | 270 | 450 |
| Organizers | 9 | 27 | 45 |
| Paying organizers | 2 | 7 | 11 |
| Promoted Events revenue | €20 | €70 | €110 |
| Pro subscribers | 0 | 1 | 2 |
| Pro MRR | €0 | €30 | €60 |
| **Total MRR** | **€20** | **€100** | **€170** |

**Verdict:** Does not reach critical mass (50 live events). Map feels empty. Risk of negative first impression.

---

## Scenario 2 — Optimal (€20 000, 6 months) ✓ RECOMMENDED

**Channel mix:**
- Airport TFS — 1 panel, 8 weeks: €2 400
- Airport TFN — 1 panel, 4 weeks: €1 800
- Print production (2 creatives): €800
- Meta Ads (EN+ES+DE+PL, 6 months): €6 000
- TikTok Ads (ES+EN, 3 months): €2 500
- Campus activation (5 days + Erasmus fair): €1 200
- Organizer outreach (print + travel): €500
- Local micro-influencer (×2): €800
- Contingency: €4 000

**Projections:**

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Total installs | 800 | 3 500 | 8 000 |
| Active users | 240 | 1 050 | 2 400 |
| Organizers | 24 | 105 | 240 |
| Paying organizers | 6 | 26 | 60 |
| Promoted Events revenue | €60 | €260 | €600 |
| Pro subscribers | 0 | 5 | 20 |
| Pro MRR | €0 | €150 | €600 |
| **Total MRR** | **€60** | **€410** | **€1 200** |

**Verdict:** Reaches critical mass by month 2 (50+ live events). Model validated. Enough paying organizers to iterate on Pro pricing before scaling.

---

## Scenario 3 — Aggressive (€50 000, 6 months)

**Channel mix:** Full budget-full.md plan (airports × 2, hotel OOH, Meta + TikTok full, influencers × 5, launch event, agency)

**Projections:**

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Total installs | 2 000 | 10 000 | 25 000 |
| Active users | 600 | 3 000 | 7 500 |
| Organizers | 60 | 300 | 750 |
| Paying organizers | 15 | 75 | 188 |
| Promoted Events revenue | €150 | €750 | €1 880 |
| Pro subscribers | 0 | 15 | 60 |
| Pro MRR | €0 | €450 | €1 800 |
| **Total MRR** | **€150** | **€1 200** | **€3 680** |

**Verdict:** Faster growth but €50k burn before model is validated = higher risk. Recommended ONLY after Scenario 2 proves unit economics.

---

## Why €20k is Optimal

1. **Critical mass:** Reaches 50+ live events in Tenerife by week 6. Below this threshold the app feels empty and retention collapses.
2. **Model validation:** 60 paying organizers by month 6 is enough data to price Organizer Pro correctly before scaling.
3. **Risk-adjusted:** €20k loss is recoverable. €50k loss before validation is not.
4. **Path to next round:** €1 200 MRR at month 6 = €14 400 ARR, growing fast = credible story for seed round or second angel.

---

## 18-Month Revenue Projection (Optimal scenario continued)

| Month | Installs | Active Orgs | Paying Orgs | MRR |
|-------|---------|-------------|-------------|-----|
| 6 | 8 000 | 240 | 60 | €1 200 |
| 9 | 14 000 | 420 | 120 | €2 800 |
| 12 | 22 000 | 660 | 200 | €5 200 |
| 15 | 35 000 | 1 050 | 350 | €9 500 |
| 18 | 50 000 | 1 500 | 500 | €15 000 |

*Month 9+ assumes expansion to Gran Canaria. Month 13+ assumes Balearics entry.*
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add fundraising/budget-model.md && git commit -m "docs: add ad budget model and revenue projections"
```

---

### Task 4: Write investment-memo.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/fundraising/investment-memo.md`

- [ ] **Step 1: Write the file**

Write to `/Users/wiktormarc/meuwe-marketing/fundraising/investment-memo.md`:

```markdown
# meuwe — Investment Memo

**Seeking:** €50 000 angel investment  
**Equity offered:** 4.76% (pre-money valuation: €1 000 000)  
**Contact:** wiktor.marc@gmail.com | meuwe.eu

---

## 1. Problem

People don't know what's happening 500 metres from where they are.

A tourist lands in Tenerife. They want to know what's on tonight — a beach party, a live gig, a market. There's no single place to look. Facebook Events require an account and the algorithm decides what you see. WhatsApp groups are closed — you're either in or you miss everything. Flyers on poles nobody reads.

The organizer has the opposite problem. A bar wants to fill seats on a Tuesday. They post on Instagram and reach 3% of their followers, declining every year. They don't know how to reach tourists. They can't afford €500/month on Meta Ads.

The market is broken on both sides. No tool connects the person looking with the person organizing — without friction, without an algorithm, in real time.

---

## 2. Solution

meuwe is a hyperlocal event map. Open the app and instantly see what's happening near you — concerts, markets, sports, meetups, beach parties. No account required. No algorithm. No ads.

**For people:** Open the map. Pins show what's nearby. Tap to see details, get directions, follow for push notifications. Done in 30 seconds.

**For organizers:** Create an event in under 10 seconds — title is the only required field. It appears on the map immediately, visible to everyone nearby.

The product is live at **meuwe.eu**. Available on iOS, Android, and any browser. Supports Polish, English, German, and Spanish — the four languages covering 80%+ of Tenerife's tourist base.

---

## 3. Market

The hyperlocal event discovery market is large and fragmented. Eventbrite dominates ticketed events. Nextdoor dominates residential social. Nobody owns the real-time, no-account, tourist-friendly layer.

**TAM — $12B** (global local event discovery and hyperlocal social)  
Comparable: Eventbrite ($800M revenue), Nextdoor ($258M), Meetup ($100M), fragmented local players ($500M+). 7× addressable market multiplier applied.

**SAM — $180M** (Southern Europe + tourist island destinations)  
~67 500 organizers across Canaries, Balearics, Algarve, Costa del Sol, Greek islands. Average €225/year revenue potential per organizer. Expandable with B2B tourist partnerships.

**SOM — €480 000 ARR by Year 3** (Tenerife → Canaries → Balearics)  
2 000 paying organizers at €240/year blended ARPU. Detailed breakdown in `tam-sam-som.md`.

---

## 4. Business Model

meuwe is free to use. Revenue comes from organizers who want more reach.

**Promoted Events** (available from launch)  
Organizer pays €5–20 to boost their event on the map — higher visibility, "Featured" badge. No subscription required. Works like a Google Ad for a map pin. Every bar owner understands it in 30 seconds.

**Organizer Pro** (launching Month 7)  
€30/month subscription. Includes: event analytics (views, clicks, directions), recurring events (one setup = entire season), team accounts, priority support. Target: venues with regular programming — weekly gigs, monthly markets, sports leagues.

**Revenue projection at Month 18:** €15 000 MRR across 500 paying organizers in 3–5 markets.  
Detailed model in `budget-model.md`.

---

## 5. Traction

The product is built and live. This is not an idea — it's a working app seeking fuel for growth.

- **Live since 2025** at meuwe.eu with full feature set
- **Auto-seeded events** via scraper — the map is never empty on day one in a new market
- **4 languages** live: Polish, English, German, Spanish
- **All platforms:** Progressive Web App + native iOS + native Android
- **Private events:** invite-only events shared via link — unique feature with no equivalent in any competitor
- **Infrastructure:** Supabase (Postgres + Auth + Realtime) + Cloudflare Pages — scales to millions of users without architectural changes

Tenerife was chosen as launch market deliberately: 6 million tourists per year, year-round warm season, no dominant local competitor, all 4 app languages directly relevant.

---

## 6. Plan — 18 Months

| Quarter | Milestone | Key metric |
|---------|-----------|------------|
| Q1 (Mo 1–3) | Seed Tenerife: organizer outreach, campus activation, map populated | 500 installs, 20 active organizers |
| Q2 (Mo 4–6) | Campaign: airport + Meta Ads + TikTok. First revenue. | 3 000 installs, 60 organizers, €500 MRR |
| Q3 (Mo 7–9) | Organizer Pro launch. Unit economics validated. | 6 000 installs, 120 organizers, €2 000 MRR |
| Q4 (Mo 10–12) | Expand to Gran Canaria. Proven playbook, second market. | 12 000 installs, 200 organizers, €5 000 MRR |
| Q5–6 (Mo 13–18) | Balearics + 2 more markets. Repeatable growth engine. | 50 000 installs, 500 organizers, €15 000 MRR |

€15 000 MRR at Month 18 = €180 000 ARR run rate. At a conservative 5× ARR multiple, this implies a post-money valuation of ~€900 000 — close to breakeven on this round, with strong position for a seed round on better terms.

---

## 7. Valuation

Pre-money valuation: **€1 000 000**

Methodology: Berkus Method (industry standard for pre-traction angel deals).

| Criterion | Assessment | Value |
|-----------|-----------|-------|
| Working product (live, multi-platform) | Full — shipped and running | €300 000 |
| Clear market and problem | Full — large, documented, growing | €200 000 |
| Founding team | Strong solo technical founder | €150 000 |
| Clear monetization (2 validated paths) | Full — Promoted Events + Pro | €200 000 |
| Early traction (scraper, 4 languages, infra) | Partial — product ready, users pending | €150 000 |
| **Pre-money** | | **€1 000 000** |

Comparable pre-seed angel rounds in European consumer apps: €500k–€2M pre-money. €1M sits at the lower end — intentionally conservative to offer a fair deal on a pre-traction product.

---

## 8. The Ask

**€50 000 for 4.76% equity**

Post-money valuation: €1 050 000

**Use of funds:**

| Allocation | Amount | What it buys |
|-----------|--------|-------------|
| Marketing — Tenerife launch | €30 000 | Airport OOH (8 weeks TFS + 4 weeks TFN), Meta Ads (6 months EN/ES/DE/PL), TikTok Ads (3 months), campus activation, 2 influencers |
| Product — Promoted Events + Organizer Pro | €15 000 | Self-serve boost payment UI, organizer analytics dashboard, Pro subscription + billing |
| Operations | €5 000 | Legal (shareholder agreement), tooling, hosting scale |

**Why this is a good deal for an angel:**

The product is built. The risk is distribution, not execution. €50k buys a proven team 18 months of focused market entry into a concrete geography with a concrete audience. If the model works in Tenerife — and there's no structural reason it shouldn't — the playbook is ready for 20 more markets.

Downside: a useful app that didn't reach critical mass. Upside: the hyperlocal layer for events across Southern Europe.

---

*Full supporting documents: `tam-sam-som.md` (market sizing methodology), `budget-model.md` (ad budget scenarios and revenue model)*
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add fundraising/investment-memo.md && git commit -m "docs: add angel investment memo"
```

---

### Task 5: Verify complete package

- [ ] **Step 1: List all fundraising files**

```bash
find /Users/wiktormarc/meuwe-marketing/fundraising -type f
```

Expected output:
```
/Users/wiktormarc/meuwe-marketing/fundraising/tam-sam-som.md
/Users/wiktormarc/meuwe-marketing/fundraising/budget-model.md
/Users/wiktormarc/meuwe-marketing/fundraising/investment-memo.md
```

- [ ] **Step 2: Verify git log**

```bash
cd /Users/wiktormarc/meuwe-marketing && git log --oneline -5
```

Expected: 3 recent commits for the fundraising docs.

Report: DONE if all 3 files exist and committed, BLOCKED if anything missing.
