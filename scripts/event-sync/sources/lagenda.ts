/**
 * Source: lagenda.org — Tenerife event guide
 * No API key required; scrapes public HTML pages.
 */
import * as cheerio from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const BASE = 'https://lagenda.org';
const PAGE_DELAY_MS = 700;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; meuwe-event-sync/1.0; +https://meuwe.app)',
      'Accept-Language': 'es,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** 'especial-...-41994' → '41994' */
function numericId(slug: string): string | null {
  return slug.match(/(\d+)$/)?.[1] ?? null;
}

/** 'Sáb, 30/05/26' or '30/05/2026' → 'YYYY-MM-DD' */
export function parseLagendaDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return null;
  const day   = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year  = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${day}`;
}

/** '19:00' or '19:00 h' or '- 19:00: texto' → 'HH:MM' */
function parseHour(text: string): string | null {
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// ─── Listing page ─────────────────────────────────────────────────────────────
// Actual structure (verified via curl):
//   <div class="small-post content_out col-md-6 ...">
//     <div class="post-c-wrap">
//       <h4 class="title"><a href="/programacion/[slug]">Title</a></h4>
//       <div class="meta">
//         <div class="post-category"><a href="/categoria/...">cat</a></div>
//         <div class="post-date"><span class="date-display-single">Sáb, 30/05/26</span></div>
//         <div class="post-category"><a href="/lugares/...">City</a></div>
//       </div>
//     </div>
//   </div>

interface ListingSummary {
  slug: string;
  title: string;
  date: string;   // 'YYYY-MM-DD' — the specific occurrence date from the listing card
  city: string;
}

async function fetchListing(dateIni: string, dateFin: string): Promise<ListingSummary[]> {
  const url = `${BASE}/programacion?fecha_ini=${encodeURIComponent(dateIni)}&fecha_fin=${encodeURIComponent(dateFin)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const results: ListingSummary[] = [];
  const seen = new Set<string>();

  $('div.small-post, div.content_out').each((_, card) => {
    const $card = $(card);

    // Title + slug from h4.title > a
    const titleLink = $card.find('h4.title a').first();
    const href = titleLink.attr('href') ?? '';
    const slug = href.replace('/programacion/', '');
    if (!slug || !numericId(slug)) return;
    if (seen.has(slug)) return; // same event appears once per date — keep first
    seen.add(slug);

    const title = titleLink.text().trim();
    if (!title) return;

    // Date from span.date-display-single inside post-date
    const rawDate = $card.find('div.post-date span.date-display-single').first().text().trim();
    const date = parseLagendaDate(rawDate);
    if (!date) return;

    // City from the /lugares/ link
    const city = $card.find('a[href^="/lugares/"]').first().text().trim();

    results.push({ slug, title, date, city });
  });

  return results;
}

// ─── Detail page ──────────────────────────────────────────────────────────────
// Actual structure:
//   <h1 itemprop="name" class="product_title ..."><span>Title</span></h1>
//   <a href="/lugares/...">City</a>
//   <div class="post-category"><a href="/categoria/...">cat</a></div>
//   <div class="group-datos"><p>Description paragraphs...</p></div>
//   Time extracted from first '- HH:MM:' or 'HH:MM:' pattern in description

interface DetailResult {
  title: string;
  description: string;
  startHour: string | null;
  endHour: string | null;
  venueName: string;
  city: string;
  categories: string[];
}

async function fetchDetail(slug: string): Promise<DetailResult> {
  await sleep(PAGE_DELAY_MS);
  const url = `${BASE}/programacion/${slug}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Title
  const title =
    $('h1[itemprop="name"] span').first().text().trim() ||
    $('h1.product_title span').first().text().trim() ||
    $('h1').first().text().trim();

  // City
  const city = $('a[href^="/lugares/"]').first().text().trim();

  // Categories
  const categories: string[] = [];
  $('div.post-category a[href^="/categoria/"]').each((_, el) => {
    const cat = $(el).text().trim();
    if (cat && !categories.includes(cat)) categories.push(cat);
  });

  // Description: first 3 paragraphs from div.group-datos
  const descParts: string[] = [];
  $('div.group-datos p').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 20 && descParts.length < 3) descParts.push(text);
  });
  // Fallback: any <p> with real content if group-datos empty
  if (!descParts.length) {
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 40 && descParts.length < 2) descParts.push(text);
    });
  }
  const description = descParts.join(' ').slice(0, 1200).trim();

  // Start/end time: scan description text for first '- HH:MM' or 'HH:MM h' pattern
  let startHour: string | null = null;
  let endHour: string | null = null;
  let venueName = city;

  $('div.group-datos p').each((_, el) => {
    if (startHour) return; // already found
    const text = $(el).text();
    // Look for '- 19:00: VenueName' or '19:00: VenueName'
    const m = text.match(/[-–]?\s*(\d{1,2}:\d{2})\s*(?:h|:)?\s*([^-\n]{0,60})/);
    if (m) {
      startHour = parseHour(m[1]);
      const venue = m[2].replace(/^\s*(en |el |la |los |las )/i, '').trim();
      if (venue.length > 3 && venue.length < 80) venueName = venue;
    }
  });

  return { title, description, startHour, endHour, venueName, city, categories };
}

// ─── Source implementation ────────────────────────────────────────────────────

export class LagendaSource implements Source {
  readonly id = 'lagenda';
  readonly name = 'lagenda.org';

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

    const dateIni = fmt(options.dateFrom);
    const dateFin = fmt(options.dateTo);

    console.log(`  [${this.name}] listing ${dateIni} → ${dateFin}`);
    const summaries = await fetchListing(dateIni, dateFin);
    console.log(`  [${this.name}] ${summaries.length} unique events on listing`);

    const events: RawEvent[] = [];

    for (let i = 0; i < summaries.length; i++) {
      const s = summaries[i];
      const id = numericId(s.slug)!;
      process.stdout.write(`    [${i+1}/${summaries.length}] ${s.title.slice(0,52).padEnd(52)} `);

      try {
        const d = await fetchDetail(s.slug);
        events.push({
          externalId:  `${this.id}:${id}`,
          title:       d.title.length > 3 ? d.title : s.title,
          description: d.description || `${s.title}. ${s.city}.`,
          date:        s.date,
          startHour:   d.startHour,
          endHour:     d.endHour,
          venueName:   d.venueName || s.city,
          city:        d.city || s.city,
          country:     'ES',
          categories:  d.categories,
          sourceUrl:   `${BASE}/programacion/${s.slug}`,
        });
        console.log('✓');
      } catch (err) {
        console.log(`✗ ${(err as Error).message}`);
      }
    }

    return events;
  }
}
