# meuwe-marketing — Design Spec

**Date:** 2026-06-13  
**Scope:** Marketing project structure, app knowledge base, Tenerife GTM campaign  
**Working style:** Owner + Claude, terminal → export to Google Drive (meuweapp@gmail.com)  
**Languages:** English (master), Spanish, Polish

---

## 1. Project Structure

Separate directory `/Users/wiktormarc/meuwe-marketing/` — sibling to `meuwe-web/`.

```
meuwe-marketing/
├── knowledge/
│   └── app-brief.md
├── campaigns/
│   └── tenerife-launch/
│       ├── gtm-plan.md
│       ├── budget-full.md      (50 000 EUR)
│       ├── budget-lean.md      (5 000 EUR)
│       ├── channels.md
│       └── audiences.md
├── copy/
│   ├── en/
│   ├── es/
│   └── pl/
├── briefs/
└── assets/
```

---

## 2. app-brief.md — Master Knowledge Document

Single source of truth about the product for any external party (agency, printer, copywriter).

**Sections:**
1. What is meuwe — one sentence, three languages (EN/ES/PL)
2. Problem we solve — events scattered across WhatsApp groups and paper posters
3. How it works — three steps: open map → see what's nearby → go or create your own event
4. For whom — three segments:
   - **Tourists** — want to know what's happening tonight in Las Americas
   - **Students** — organize spontaneous meetups, look for parties and beach events
   - **Local organizers** — want to reach people without paying for Instagram Ads
5. Why meuwe vs Facebook Events / WhatsApp — competitive positioning
6. Key facts — no account required, no ads, works instantly, 4 languages, iOS + Android + web
7. Tone of voice — light, local, no corporate language
8. Available assets — screenshots, logo, og-image, brand colors

---

## 3. Tenerife GTM Campaign

### Target audiences
- **Tourists** — primarily English-speaking, visiting Tenerife Sur (Las Americas, Los Cristianos) and Norte (Puerto de la Cruz)
- **Students** — local university students (Universidad de La Laguna) and Erasmus exchange students
- **Local organizers** — businesses, event promoters, community groups

### Channels (to be detailed in channels.md)
- Airport outdoor — Tenerife Sur (TFS) and Norte (TFN)
- Street activation — guerrilla marketing in tourist and student zones
- Digital — Meta Ads, TikTok targeting Tenerife geozone
- Local influencers — Tenerife-based content creators

### Budget variants
**Full (50 000 EUR):** Airport ads + digital + street team + influencers + printed materials  
**Lean (5 000 EUR):** Maximum ROI focus — 2-3 highest-impact channels only

Each channel entry includes: what we buy, estimated cost, how we measure results.

---

## 4. Cross-Project Communication

**Rule:** When a new feature ships in meuwe-web that changes the product's value proposition, update `knowledge/app-brief.md` manually.

**Trigger:** Not every technical change — only changes that affect what we say to users (new feature, removed friction, new platform support, new language).

**No automation** — marketing doesn't need every code change, only product-value changes.

---

## 5. Output Format

All documents generated as plain text (Markdown). Owner copies content to Google Docs at meuweapp@gmail.com for sharing with agencies, printers, and collaborators.
