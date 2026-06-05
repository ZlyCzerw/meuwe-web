/**
 * Source: Casa de los Balcones — island-wide romerías & fiestas calendar.
 * No API key; scrapes one static HTML page.
 *
 * Each entry is a flat `<p>`: "DD/MM/YYYY <Title> – <Municipality>" (the dash is
 * an en-dash, &#8211;). Dates are concrete (not relative), and the municipality
 * after the dash doubles as the geocoding city — it matches the keys in
 * mapper.ts MUNICIPALITY_COORDS (Arona, Güímar, Los Realejos, …).
 *
 * The page is published per year; bump the URL each season.
 */
import * as cheerio from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const PAGE_URL = 'https://casa-balcones.com/calendario-de-romerias-en-tenerife-2026/';

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Collapse whitespace (incl. &nbsp;) and trim. cheerio already decodes entities. */
export function clean(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** 'DD','MM','YYYY' → 'YYYY-MM-DD', or null if out of range. */
export function toIso(dd: string, mm: string, yyyy: string): string | null {
  const d = parseInt(dd, 10), m = parseInt(mm, 10), y = parseInt(yyyy, 10);
  if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface RomeriaEntry {
  date: string;     // 'YYYY-MM-DD'
  title: string;
  city: string;
}

// 'DD/MM/YYYY <Title> <dash> <Municipality>' — dash is en/em/hyphen.
const LINE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+?)\s*[–—-]\s*([^–—-]+)$/;

/** Parse one calendar line into an entry, or null if it isn't one. */
export function parseRomeriaEntry(text: string): RomeriaEntry | null {
  const m = clean(text).match(LINE_RE);
  if (!m) return null;
  const date = toIso(m[1], m[2], m[3]);
  if (!date) return null;
  const title = m[4].trim();
  const city = m[5].trim();
  if (!title || !city) return null;
  return { date, title, city };
}

export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Pull every romería entry out of the calendar page HTML. */
export function extractEntries(html: string): RomeriaEntry[] {
  const $ = cheerio.load(html);
  const entries: RomeriaEntry[] = [];
  $('p').each((_, p) => {
    const entry = parseRomeriaEntry($(p).text());
    if (entry) entries.push(entry);
  });
  return entries;
}

// ─── Source implementation ────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

export class RomeriasSource implements Source {
  readonly id = 'romerias';
  readonly name = 'Casa de los Balcones (romerías)';

  private readonly url: string;

  constructor(url: string = PAGE_URL) {
    this.url = url;
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const fromISO = iso(options.dateFrom);
    const toISO = iso(options.dateTo);

    const res = await fetch(this.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; meuwe-event-sync/1.0; +https://meuwe.eu)',
        'Accept-Language': 'es,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${this.url}`);

    const all = extractEntries(await res.text());
    const events: RawEvent[] = [];
    const seen = new Set<string>();

    for (const e of all) {
      if (e.date < fromISO || e.date > toISO) continue;
      const externalId = `${this.id}:${e.date}:${slugify(e.title)}`;
      if (seen.has(externalId)) continue;     // same romería can appear twice on the page
      seen.add(externalId);
      events.push({
        externalId,
        title:       e.title,
        description: '',
        date:        e.date,
        startHour:   null,                     // romerías are all-day; pipeline applies its default
        endHour:     null,
        venueName:   '',
        city:        e.city,
        country:     'ES',
        categories:  ['romería'],              // maps to the culture category
        sourceUrl:   this.url,
      });
    }

    console.log(`  [${this.name}] ${all.length} parsed, ${events.length} in window`);
    return events;
  }
}
