# meuwe-marketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the meuwe-marketing project — folder structure, app knowledge base, and full Tenerife GTM campaign documents at two budget levels.

**Architecture:** Standalone directory at `/Users/wiktormarc/meuwe-marketing/` with structured subfolders. All files are plain text (Markdown) to be copied into Google Drive. No code, no build system. App knowledge in `knowledge/app-brief.md` is the single source of truth handed to any external party.

**Tech Stack:** Markdown files, no dependencies.

---

## File Map

| File | Purpose |
|------|---------|
| `knowledge/app-brief.md` | Master product document for agencies, printers, copywriters |
| `campaigns/tenerife-launch/audiences.md` | Three target personas with Tenerife-specific detail |
| `campaigns/tenerife-launch/channels.md` | Channel analysis: reach, cost, fit per audience |
| `campaigns/tenerife-launch/gtm-plan.md` | Strategy, timeline, KPIs |
| `campaigns/tenerife-launch/budget-lean.md` | 5 000 EUR plan — highest-ROI channels only |
| `campaigns/tenerife-launch/budget-full.md` | 50 000 EUR plan — full channel mix |

---

### Task 1: Create folder structure

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/` (all subdirectories)

- [ ] **Step 1: Create directories**

```bash
mkdir -p /Users/wiktormarc/meuwe-marketing/knowledge
mkdir -p /Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch
mkdir -p /Users/wiktormarc/meuwe-marketing/copy/en
mkdir -p /Users/wiktormarc/meuwe-marketing/copy/es
mkdir -p /Users/wiktormarc/meuwe-marketing/copy/pl
mkdir -p /Users/wiktormarc/meuwe-marketing/briefs
mkdir -p /Users/wiktormarc/meuwe-marketing/assets
```

- [ ] **Step 2: Init git repo**

```bash
cd /Users/wiktormarc/meuwe-marketing && git init && echo "# meuwe-marketing" > README.md && git add README.md && git commit -m "init: meuwe-marketing project"
```

---

### Task 2: Write app-brief.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/knowledge/app-brief.md`

- [ ] **Step 1: Write the document**

Content of `/Users/wiktormarc/meuwe-marketing/knowledge/app-brief.md`:

```markdown
# meuwe — App Brief

*Last updated: 2026-06-13. Update whenever a product-value change ships in meuwe-web.*

---

## What is meuwe?

**EN:** meuwe is a hyperlocal event map. Open the app and instantly see what's happening nearby — picnics, concerts, sports, markets, meetups. No account, no algorithm, no ads.

**ES:** meuwe es un mapa hiperlocal de eventos. Abre la app y descubre al instante qué pasa cerca de ti — picnics, conciertos, deportes, mercados, quedadas. Sin cuenta, sin algoritmo, sin anuncios.

**PL:** meuwe to hiperlokalana mapa wydarzeń. Otwórz aplikację i natychmiast zobacz co się dzieje w pobliżu — pikniki, koncerty, sport, targi, spotkania. Bez konta, bez algorytmu, bez reklam.

---

## The Problem We Solve

People don't know what's happening 500 metres from where they are.

- Facebook Events need an account and the algorithm buries them
- WhatsApp groups are closed — you're either in or out
- Flyers on poles nobody reads
- Tourist doesn't know about the beach concert happening tonight
- Student doesn't know 30 other students are meeting at the same plaza

---

## How It Works — 3 Steps

1. **Open the map** — pins nearby show what's going on. No login required.
2. **Find something** — filter by category (music, sport, food, culture, party…) or browse all
3. **Join or create** — sign in with Google to add your own event or follow others for push notifications

Event creation takes under 10 seconds. Title is the only required field.

---

## Who Is It For?

### Tourists
Want to know what's happening tonight. Don't have local contacts. Don't speak the language well enough to find events on local Facebook groups. Need something that works the moment they land.

### Students
Organize spontaneous meetups. Attend events other students post. Discover what's happening on campus and in the city. Share their own parties with a link — invite-only, no algorithm.

### Local Organizers & Businesses
Bar with a live gig tonight. Market with farm produce. Community meetup. Garage sale. They want people to show up without paying for Instagram Ads or setting up a Facebook Event.

---

## Why meuwe vs Alternatives?

| | meuwe | Facebook Events | WhatsApp | Instagram |
|---|---|---|---|---|
| No account to browse | ✓ | ✗ | ✗ | ✗ |
| Hyperlocal map view | ✓ | ✗ | ✗ | ✗ |
| Event in 10 seconds | ✓ | ✗ | ✗ | ✗ |
| No algorithm | ✓ | ✗ | ✓ | ✗ |
| Private invite events | ✓ | partial | ✓ | ✗ |
| Works for tourists | ✓ | ✗ | ✗ | ✗ |

---

## Key Facts for Marketing Materials

- **No account required** to browse the map
- **10 seconds** to create an event (title only required)
- **4 languages:** Polish, English, German, Spanish
- **Platforms:** Web (any browser) + iOS + Android
- **Private events:** invite-only, not visible on public map — shared via link
- **Push notifications:** follow an event and get notified when something happens
- **No ads, no algorithm** — chronological, location-based
- **Free** — no paid plans, no freemium limits

---

## Tone of Voice

- Light, direct, local — not corporate
- First person plural ("we") or imperative ("open", "discover", "create")
- No buzzwords: not "platform", not "ecosystem", not "community-driven"
- Short sentences. One idea per sentence.
- OK to be playful. Not OK to be sarcastic.

---

## Available Assets

Located in `meuwe-web/public/`:
- `og-image.png` — 1200×630 social sharing image (meuwe logo + map pins on cream background)
- `favicon.svg` — logo mark
- `screenshots/map-en.png`, `map-es.png` — map screen in EN and ES
- `screenshots/event-en.png`, `event-es.png` — event detail screen
- `screenshots/new-en.png`, `new-es.png` — event creation screen

**Brand colours:**
- Orange: `#FF7A45` (primary CTA, logo "meuwe" orange letters)
- Green: `#4CAF50` (logo "meuwe" green letters)
- Cream background: `#FFF5EE`
- Dark text: `#1A1A1A`
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add knowledge/app-brief.md && git commit -m "docs: add app-brief master knowledge document"
```

---

### Task 3: Write audiences.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/audiences.md`

- [ ] **Step 1: Write the document**

Content of `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/audiences.md`:

```markdown
# Tenerife — Target Audiences

---

## Audience 1: Tourists

**Size:** ~6 million visitors/year to Tenerife. Peak season Nov–Apr (Northern Europeans escaping winter).

**Where they are:**
- Tenerife Sur — Playa de las Américas, Los Cristianos, Costa Adeje (highest density)
- Tenerife Norte — Puerto de la Cruz, Santa Cruz (cultural tourists)
- Airports TFS (Sur) and TFN (Norte)

**Languages:** English (primary), German, Polish, Dutch, Scandinavian

**Behaviour:**
- Arrive not knowing anyone locally
- Search "things to do in Tenerife tonight" on Google/TikTok
- Open to spontaneous plans — beach party, sunset hike, market
- High phone usage — scan QR codes, download apps at airports
- First 48 hours = highest openness to new apps (exploring mode)

**Message:** *"See what's happening near you. Right now."*
**Channel fit:** Airport, hotel zone outdoor, TikTok geo-targeted

---

## Audience 2: Students

**Size:** ~25 000 students at Universidad de La Laguna (ULL) + several hundred Erasmus students/year.

**Where they are:**
- La Laguna (university campus and city centre)
- Santa Cruz (student nightlife)
- San Cristóbal de La Laguna — university bars, plazas

**Languages:** Spanish (primary), English (Erasmus)

**Behaviour:**
- Organize everything via WhatsApp groups and Instagram DMs
- High event-creation potential — birthday parties, study groups, beach days, protests
- Erasmus students actively looking for events and other students
- Trust peer recommendations over ads
- Cost-sensitive — free apps win

**Message:** *"Crea tu evento en 10 segundos. Invita a quien quieras."*
**Channel fit:** Campus activation (flyering, QR stickers), local Instagram/TikTok, Erasmus welcome events

---

## Audience 3: Local Organizers & Businesses

**Size:** Thousands of bars, restaurants, markets, community groups, sports clubs across Tenerife.

**Where they are:** Distributed — Santa Cruz, La Laguna, Las Américas, Puerto de la Cruz, Los Cristianos

**Languages:** Spanish (primary)

**Behaviour:**
- Currently use Instagram + Facebook Events + WhatsApp broadcast lists
- Frustrated by Instagram algorithm reducing organic reach
- Small venues can't afford paid ads consistently
- Trust word-of-mouth and local networks
- Decision maker = bar owner, market organizer, club secretary

**Message:** *"Tu evento en el mapa. Gratis. Sin algoritmo."*
**Channel fit:** Direct outreach (visit in person), local business WhatsApp groups, local press
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add campaigns/tenerife-launch/audiences.md && git commit -m "docs: add Tenerife audience personas"
```

---

### Task 4: Write channels.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/channels.md`

- [ ] **Step 1: Write the document**

Content of `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/channels.md`:

```markdown
# Tenerife — Channel Analysis

For each channel: audience fit, estimated cost, what to buy, how to measure.

---

## Channel 1: Airport Outdoor (OOH)

**Audience fit:** Tourists ★★★★★

**Why:** Tourists arrive at TFS (Tenerife Sur) not knowing anything local. First 10 minutes on the island — highest receptivity. QR code on a banner = instant app download.

**What to buy:**
- Lightbox panels in baggage claim and arrivals hall (TFS priority, TFN secondary)
- Format: 120×180 cm or 200×300 cm backlit
- Duration: minimum 4 weeks for brand recognition

**Estimated cost:**
- TFS arrivals hall panel: ~800–1 500 EUR/month
- TFN panel: ~500–900 EUR/month
- Print production: ~300–500 EUR per creative

**Creative requirements:**
- One clear message in English + QR code to meuwe.eu
- High contrast — people moving fast with luggage
- No small text. Logo + tagline + QR.

**Measurement:** QR code UTM link → track installs from airport source in analytics.

---

## Channel 2: Hotel Zone Outdoor (OOH)

**Audience fit:** Tourists ★★★★☆

**Why:** Tourists walk the same promenade strips daily (Las Américas, Los Cristianos). Repeated exposure builds recall.

**What to buy:**
- Bus shelter panels on Av. Rafael Puig Lluvina (Las Américas strip)
- A-frame boards negotiated with hotel concierges or beachfront bars
- Flyers at hotel reception desks (requires hotel partnership)

**Estimated cost:**
- Bus shelter panel: ~400–700 EUR/month
- Printed flyers (A6, 2 000 units): ~150–200 EUR

**Measurement:** Separate QR UTM per zone (hotel-strip vs airport).

---

## Channel 3: Campus Activation (Guerrilla)

**Audience fit:** Students ★★★★★

**Why:** High-density, captive audience. Erasmus students especially open to new apps. Personal interaction converts better than ads.

**What to buy:**
- QR stickers on campus noticeboards, bathrooms, cafeteria (check regulations)
- Street team 1–2 people for Erasmus welcome week (September/October)
- Table at Erasmus welcome fair if available

**Estimated cost:**
- QR sticker print (500 units, A7): ~50–80 EUR
- Street team day rate (local student ambassador): ~80–120 EUR/day
- Erasmus welcome fair table (if paid): ~100–300 EUR

**Measurement:** Campus-specific UTM QR. Count installs in first week of semester.

---

## Channel 4: Meta Ads (Instagram + Facebook)

**Audience fit:** Tourists ★★★★☆ / Students ★★★☆☆ / Organizers ★★★☆☆

**Why:** Geo-targeting to Tenerife + interest targeting (travel, events, nightlife). Cost-efficient at small scale.

**What to buy:**
- Instagram Stories + Reels ads
- Geo: Tenerife island (or specific municipalities)
- Targeting: tourists (travel interest + language EN/DE/PL), students (18–26, ES language)
- Creative: short video (15s) showing the map with pins appearing

**Estimated cost:**
- CPM in Canary Islands: ~3–6 EUR
- CPI (cost per install): expect 1.50–4 EUR depending on creative
- Minimum effective budget: 500 EUR/month

**Measurement:** Meta pixel + App Events. Track installs, map opens, first event created.

---

## Channel 5: TikTok Ads

**Audience fit:** Students ★★★★★ / Tourists ★★★☆☆

**Why:** Highest reach with 18–28 demographic. TikTok geo-targeting to Tenerife works well. Organic content can also go viral.

**What to buy:**
- In-Feed Video Ads (9–15 seconds)
- Geo: Tenerife
- Targeting: 18–30, interests: travel, nightlife, events

**Estimated cost:**
- Minimum campaign: 500 EUR
- CPM: ~2–5 EUR in Spain
- Consider organic-first: create account @meuweapp and post genuine event discovery videos

**Measurement:** TikTok Pixel + install tracking.

---

## Channel 6: Local Influencers

**Audience fit:** Tourists ★★★★☆ / Students ★★★★☆

**Why:** Tenerife has a strong English-speaking expat and travel creator community. Authentic review converts better than ads.

**What to buy:**
- 2–3 micro-influencers (5k–30k followers) based in Tenerife
- Content: genuine "I use this to find events" story or reel
- Avoid: influencers who only post ads — audience trust is key

**Estimated cost:**
- Micro-influencer post: 150–500 EUR each
- Barter possible (offer early access, featured events)

**Measurement:** Unique promo link per influencer. Track installs per creator.

---

## Channel 7: Direct Outreach to Organizers

**Audience fit:** Local Organizers ★★★★★

**Why:** One organizer posting events = multiple users coming to discover them. B2B2C flywheel.

**What to do:**
- Visit 20–30 bars, markets, and venues in person
- Show the app on your phone — live demo
- Leave a printed brief (1 page) with QR code

**Estimated cost:**
- Printed 1-pagers (100 units): ~50–80 EUR
- Time: 2–3 full days in the field

**Measurement:** Track how many organizer accounts create their first event.

---

## Channel Ranking by ROI

| Channel | Audience | Cost | Speed | ROI |
|---------|----------|------|-------|-----|
| Campus activation | Students | Low | Fast | ★★★★★ |
| Direct organizer outreach | Organizers | Low | Medium | ★★★★★ |
| Airport OOH | Tourists | High | Fast | ★★★★☆ |
| Meta Ads | Mixed | Medium | Fast | ★★★★☆ |
| TikTok Ads | Students/Tourists | Medium | Fast | ★★★☆☆ |
| Hotel zone OOH | Tourists | Medium | Medium | ★★★☆☆ |
| Local influencers | Mixed | Low-Med | Medium | ★★★☆☆ |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add campaigns/tenerife-launch/channels.md && git commit -m "docs: add Tenerife channel analysis"
```

---

### Task 5: Write budget-lean.md (5 000 EUR)

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/budget-lean.md`

- [ ] **Step 1: Write the document**

Content of `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/budget-lean.md`:

```markdown
# Tenerife Launch — Lean Budget (5 000 EUR)

**Philosophy:** Maximum downloads per euro. Skip brand awareness. Go direct-to-user with the highest-ROI channels: airport QR, campus activation, organizer outreach. No agency, no middlemen.

**Timeline:** 6 weeks

---

## Budget Allocation

| Line | Channel | Cost | Expected result |
|------|---------|------|----------------|
| Airport TFS — 1 panel, 4 weeks | OOH | 1 200 EUR | ~200–400 tourist installs |
| Print production (airport banner) | Production | 400 EUR | — |
| Campus activation — stickers + 3 days street team | Guerrilla | 400 EUR | ~150–300 student installs |
| Meta Ads — 6 weeks, EN+ES | Digital | 1 500 EUR | ~375–1 000 installs |
| Direct organizer outreach — printed 1-pagers | Direct | 150 EUR | 20–30 active organizers |
| Contingency | — | 350 EUR | — |
| **TOTAL** | | **4 000 EUR** | **~750–1 700 total installs** |

*Buffer: 1 000 EUR held for what works — double down on the top-performing channel in week 4.*

---

## Week-by-Week Plan

**Week 1–2: Setup + Airport**
- Install airport banner at TFS arrivals (book 2 weeks in advance)
- Launch Meta Ads campaign EN (tourists) + ES (students, La Laguna geo)
- Produce printed 1-pagers for organizers

**Week 3–4: Campus + Organizers**
- Erasmus welcome week OR campus sticker drop at ULL
- 2 full days visiting bars/markets in Las Américas and La Laguna
- Review Meta Ads — pause underperforming ad sets

**Week 5–6: Optimize + Double Down**
- Shift remaining budget (1 000 EUR) to best-performing channel from analytics
- Collect first testimonials from organizers — use as social proof
- Document learnings for full-budget plan

---

## What This Does NOT Include

- TikTok Ads (requires video production budget)
- Influencer partnerships (not enough budget for meaningful reach)
- Hotel zone outdoor (lower ROI per euro vs airport)
- PR / local press (pursue free editorial — pitch story to Tenerife local media)

---

## Success Metrics (6 weeks)

| Metric | Target |
|--------|--------|
| Total installs | 750+ |
| Active organizers (posted ≥1 event) | 20+ |
| Events created in Tenerife | 50+ |
| Map opens (DAU in Tenerife) | 100+ |
| Cost per install | < 5 EUR |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add campaigns/tenerife-launch/budget-lean.md && git commit -m "docs: add lean budget plan (5 000 EUR)"
```

---

### Task 6: Write budget-full.md (50 000 EUR)

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/budget-full.md`

- [ ] **Step 1: Write the document**

Content of `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/budget-full.md`:

```markdown
# Tenerife Launch — Full Budget (50 000 EUR)

**Philosophy:** Build brand recognition across all three audiences simultaneously. Tourists see meuwe at the airport. Students see it on campus and TikTok. Organizers get a personal visit. Sustained 3-month push to reach critical mass — enough events on the map that new users see pins immediately when they open it.

**Timeline:** 12 weeks (3 months)

---

## Budget Allocation

| Line | Channel | Cost | Expected result |
|------|---------|------|----------------|
| Airport TFS — 2 panels, 12 weeks | OOH | 9 000 EUR | ~1 500–3 000 tourist installs |
| Airport TFN — 1 panel, 8 weeks | OOH | 3 500 EUR | ~400–800 tourist installs |
| Hotel zone outdoor (Las Américas + Los Cristianos) | OOH | 4 000 EUR | Brand recall, ~500 installs |
| Print production (all OOH creatives) | Production | 1 500 EUR | — |
| Meta Ads — 12 weeks, EN+ES+DE+PL | Digital | 8 000 EUR | ~2 000–5 000 installs |
| TikTok Ads — 8 weeks | Digital | 4 000 EUR | ~1 000–3 000 installs |
| TikTok organic content creation (10 videos) | Content | 2 500 EUR | ~50k–200k organic views |
| Campus activation — 5 days + Erasmus fair | Guerrilla | 1 500 EUR | ~500–800 student installs |
| Local micro-influencers (×5) | Influencer | 2 000 EUR | ~500–1 500 installs |
| Direct organizer outreach (full island) | Direct | 500 EUR | 80–120 active organizers |
| Local press & PR (El Día, Diario de Avisos) | PR | 1 500 EUR | Brand credibility |
| Launch event (public meuwe event in Santa Cruz) | Event | 2 000 EUR | Press + social content |
| Agency coordination / campaign management | Ops | 3 000 EUR | — |
| Contingency + optimization reserve | — | 7 000 EUR | Double down on winners |
| **TOTAL** | | **50 000 EUR** | **~6 000–14 000 total installs** |

---

## Phase Plan

### Phase 1 — Ignition (Weeks 1–4)
- Book and install all OOH (airports + hotel zone)
- Launch Meta Ads + TikTok Ads
- Begin organizer outreach in Las Américas and La Laguna
- Publish first 3 TikTok organic videos

**Goal:** 1 000 installs. Enough events on map that opening the app feels alive.

### Phase 2 — Acceleration (Weeks 5–8)
- Campus activation at ULL (Erasmus welcome if Sep/Oct timing)
- Influencer posts go live (coordinate for same 2-week window = social proof clustering)
- Launch event in Santa Cruz — public meuwe event, invite press, document with video
- Optimize ad spend: cut bottom 30% of ad sets, reinvest in top performers

**Goal:** 3 000 total installs. First organic word-of-mouth signals appear.

### Phase 3 — Sustain + Harvest (Weeks 9–12)
- Keep top-performing OOH and digital running
- Collect organizer testimonials for next campaign
- Produce case study: "How meuwe launched in Tenerife"
- Plan next market (Gran Canaria? Ibiza? Mallorca?)

**Goal:** 6 000+ installs. Positive unit economics visible. Community self-sustaining.

---

## Launch Event Detail

A public meuwe event posted on meuwe.eu itself — a free community gathering in Parque García Sanabria (Santa Cruz) or Parque Las Américas. 

Purpose: demonstrate the product works, generate social content, invite local press.

Budget: 2 000 EUR (light food + drinks, printed banners, photographer)

Invite: local bloggers, Erasmus association, Tenerife influencers, city culture department.

---

## Success Metrics (12 weeks)

| Metric | Target |
|--------|--------|
| Total installs | 6 000+ |
| Active organizers (posted ≥1 event) | 100+ |
| Events created in Tenerife | 500+ |
| Tenerife DAU | 500+ |
| Cost per install | < 8 EUR |
| Organic (word-of-mouth) installs % | > 20% by week 12 |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add campaigns/tenerife-launch/budget-full.md && git commit -m "docs: add full budget plan (50 000 EUR)"
```

---

### Task 7: Write gtm-plan.md

**Files:**
- Create: `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/gtm-plan.md`

- [ ] **Step 1: Write the document**

Content of `/Users/wiktormarc/meuwe-marketing/campaigns/tenerife-launch/gtm-plan.md`:

```markdown
# Tenerife — GTM Plan

---

## Strategic Goal

Reach critical mass in Tenerife: enough active events on the map that any user who opens meuwe sees pins nearby. Below critical mass the app feels empty. Above it, the network effect kicks in — more events attract more users who create more events.

**Critical mass threshold (estimated):** 50 active events live at any given time in the main zones.

---

## Market Choice Rationale — Why Tenerife First?

- High tourist density (6M/year) + concentrated geography = easier to reach critical mass than mainland city
- Diverse audiences: tourists (EN/DE/PL), students (ES), locals — tests all three segments simultaneously
- Year-round activity — no dead season
- Strong event culture: fiestas, beach parties, markets, surf competitions, expat meetups
- meuwe has Spanish, English, Polish, German — all relevant languages already live

---

## Positioning Per Audience

| Audience | Core message | Tone |
|----------|-------------|------|
| Tourists | "See what's happening near you. Right now." | Urgent, simple |
| Students | "Crea tu evento en 10 segundos." | Playful, peer |
| Organizers | "Tu evento en el mapa. Gratis. Sin algoritmo." | Practical, direct |

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| Map feels empty at launch | Seed 20–30 events manually before any paid campaign starts |
| Organizers don't adopt | Personal visit + live demo beats any ad |
| Tourist installs don't retain | Push notification opt-in at first use — follow an event = retention hook |
| Budget runs out before critical mass | Lean plan first, validate, then scale |

---

## Recommended Sequence

1. **Seed phase (before any marketing):** Create 20–30 real events in Tenerife manually. Concerts, markets, beach meetups — real ones. The map must not look empty on day 1.
2. **Organizer outreach first:** Get 15–20 local businesses posting events before tourist-facing campaigns launch. Supply before demand.
3. **Launch tourist-facing campaigns:** Airport + digital. Tourists arrive, open app, see events. Value is immediate.
4. **Student activation:** Campus is time-sensitive (semester start). Plan around ULL academic calendar.

---

## North Star Metric

**Weekly Active Events in Tenerife** — number of events with at least one interaction (view, follow, message) in a 7-day window. Everything else (installs, DAU, organizer accounts) is a leading indicator for this.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wiktormarc/meuwe-marketing && git add campaigns/tenerife-launch/gtm-plan.md && git commit -m "docs: add Tenerife GTM plan"
```

---

### Task 8: Save memory + update MEMORY.md

- [ ] **Step 1:** Save memory about meuwe-marketing project to `/Users/wiktormarc/.claude/projects/-Users-wiktormarc-meuwe-web/memory/project_meuwe_marketing.md`

Content:
```markdown
---
name: project-meuwe-marketing
description: "meuwe-marketing project — location, structure, purpose"
metadata:
  type: project
---

Osobny projekt marketingowy w `/Users/wiktormarc/meuwe-marketing/`.

**Cel:** Dokumenty marketingowe do Google Drive (meuweapp@gmail.com) — plany kampanii, copy, briefy.

**Języki:** EN (master), ES, PL

**Kluczowy plik:** `knowledge/app-brief.md` — master brief o aplikacji, dawany każdej zewnętrznej osobie.

**Kampania:** `campaigns/tenerife-launch/` — pełny GTM Teneryfa z planami budżetowymi 5k i 50k EUR.

**Komunikacja z meuwe-web:** Ręczna — aktualizuj `app-brief.md` kiedy meuwe-web dodaje funkcję zmieniającą wartość produktu.

**Why:** Projekt niekoderski — generujemy tu dokumenty marketingowe razem z Claude, exportujemy do Google Drive.

**How to apply:** Przy pracy nad materiałami marketingowymi sprawdź `knowledge/app-brief.md` jako źródło prawdy o produkcie.
```

- [ ] **Step 2:** Add entry to `MEMORY.md`

Add line: `- [meuwe-marketing project](project_meuwe_marketing.md) — osobny projekt `/meuwe-marketing/`, dokumenty GTM Teneryfa, brief produktowy`

- [ ] **Step 3:** Commit meuwe-marketing final state

```bash
cd /Users/wiktormarc/meuwe-marketing && git status
```
