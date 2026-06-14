# meuwe — Fundraising Package Design Spec

**Date:** 2026-06-14  
**Scope:** Angel investor pitch package — TAM/SAM/SOM, ad budget model, investment memo  
**Target:** Angel investor (single person, 10k–200k EUR range, intuitive decision)  
**Format:** Plain text Markdown → Google Drive (meuweapp@gmail.com)

---

## 1. File Structure

```
meuwe-marketing/
└── fundraising/
    ├── tam-sam-som.md        ← market sizing calculations (working doc)
    ├── budget-model.md       ← optimal ad budget + revenue projections
    └── investment-memo.md    ← main angel document (~4 pages)
```

---

## 2. tam-sam-som.md

**Purpose:** Working calculations behind the market sizing numbers used in the memo.

**Sections:**
- TAM methodology: global local event discovery market (Eventbrite + Meetup + Nextdoor + fragmentation × multiplier = ~$12B)
- SAM methodology: Southern Europe + tourist islands, hyperlocal segment (cities with >1M tourist visits/year, organizer-addressable market) = ~$180M
- SOM methodology: Tenerife + Canary Islands + Balearics, 2 000 paying organizers × €20/month average = ~€480k ARR by Year 3
- Key assumptions listed explicitly (organizer penetration rate, average ticket size, churn)

---

## 3. budget-model.md

**Purpose:** Justify the optimal marketing spend and show revenue projections per scenario.

**Three scenarios:**

| Scenario | Budget | Installs (6mo) | Active Orgs | MRR (6mo) |
|----------|--------|----------------|-------------|-----------|
| Lean | €5 000 | ~1 500 | 30 | €300 |
| **Optimal** | **€20 000** | **~8 000** | **150** | **€1 500** |
| Aggressive | €50 000 | ~25 000 | 400 | €4 000 |

**Key metrics per scenario:**
- CPI (cost per install): €1.50–4 via Meta, €2–5 via TikTok
- Install → active user conversion: 30%
- Active organizer → paying conversion: 8% (Promoted Events first, Pro later)
- Average revenue per paying organizer: €18/month blended (Promoted Events one-off + Pro subscription)

**Conclusion:** €20k is optimal — enough to reach critical mass in Tenerife (50+ live events at any time) without burning budget before model is validated.

---

## 4. investment-memo.md

**Purpose:** The only document sent to the angel. Readable in 10 minutes. Narrative, not bullet-heavy.

**Structure (4 pages):**

### 1. Problem (½ page)
- People don't know what's happening 500 metres from them
- Tourists arrive in Tenerife with no local knowledge — miss everything
- Organizers waste money on Instagram Ads with shrinking organic reach
- No tool exists that works without an account, in real-time, for all of them simultaneously

### 2. Solution (½ page)
- meuwe: hyperlocal event map, open the app and see what's happening nearby
- No account to browse, 10 seconds to create an event
- Live at meuwe.eu — iOS, Android, web, 4 languages (PL/EN/DE/ES)
- Auto-seeded with events via scraper

### 3. Market — TAM/SAM/SOM (½ page)
- TAM: ~$12B (global local event discovery)
- SAM: ~$180M (Southern Europe + tourist islands, hyperlocal segment)
- SOM: ~€480k ARR by Year 3 (Tenerife + Canaries + Balearics, 2 000 paying organizers)

### 4. Business Model (½ page)
- **Promoted Events:** organizer pays €5–20 to boost event visibility on map. Simple, transactional.
- **Organizer Pro:** €20–50/month subscription — analytics, recurring events, team accounts
- Year 1: Promoted Events only (no sales required)
- Year 2+: Organizer Pro as upsell

### 5. Traction (¼ page)
- Working product live since 2025
- Auto-scraped events populate the map from launch day
- 4 languages live, PWA + native iOS/Android
- Tenerife chosen as launch market: 6M tourists/year, year-round season, matches all 4 languages

### 6. 18-Month Plan (½ page)

| Quarter | Milestone |
|---------|-----------|
| Q1 (mo 1–3) | Seed Tenerife: 500 installs, 20 organizers, live events on map |
| Q2 (mo 4–6) | Campaign: 3 000 installs, 60 organizers, €500 MRR |
| Q3 (mo 7–9) | Organizer Pro launch: 6 000 installs, 120 organizers, €2 000 MRR |
| Q4 (mo 10–12) | 2nd market (Gran Canaria): 12 000 installs, 200 organizers, €5 000 MRR |
| Q5–6 (mo 13–18) | 3–5 markets: 50 000 installs, 500 organizers, €15 000 MRR |

### 7. Pre-Money Valuation (¼ page)
Berkus Method (standard for pre-traction angel):

| Criterion | Value |
|-----------|-------|
| Working product (live on meuwe.eu) | €300 000 |
| Clear market and problem | €200 000 |
| Founding team (tech + vision) | €150 000 |
| Clear monetization (2 paths) | €200 000 |
| Early traction (scraper, 4 languages, PWA) | €150 000 |
| **Pre-money valuation** | **€1 000 000** |

### 8. The Ask (¼ page)
- **€50 000 for 4.76% equity** (post-money: €1 050 000)
- Use of funds:
  - 60% marketing — Tenerife campaign (airport OOH + Meta Ads + campus) = €30 000
  - 30% product — Promoted Events feature + Organizer Pro dashboard = €15 000
  - 10% operations — legal, tooling, hosting scale = €5 000

---

## 5. Tone for Investment Memo

- Founder writing to a smart friend who has money
- No jargon ("ecosystem", "synergies", "platform play")
- Numbers in every claim — no vague "huge market" without a figure
- Honest about what's not done yet — angels respect candor
- English (primary), can generate ES/PL versions if needed
