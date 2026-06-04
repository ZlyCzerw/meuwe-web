/**
 * Source: ecoentradas.com — Canary Islands cultural ticketing (theatre, concerts,
 * ballet, festivals). No API key; scrapes public server-rendered HTML.
 *
 * Two stages:
 *   1. Listing `/`        → one <li> per show; we keep only island === 'Tenerife',
 *                           reading the show id, title and cover image.
 *   2. Detail `/elegirsesion/{id}` → a `.table-sesion` row per session, each with
 *                           date (Spanish month name, no year), time and venue, plus
 *                           a full `.description-eco` synopsis and per-session price.
 *
 * We emit one RawEvent per session inside the requested date window. Paid sessions
 * get an "EVENTO DE PAGO" notice prepended to the description (in the event's own
 * language — ecoentradas content is Spanish).
 */
import * as cheerio from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const BASE = 'https://www.ecoentradas.com';
const PAGE_DELAY_MS = 600;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; meuwe-event-sync/1.0; +https://meuwe.eu)',
      'Accept-Language': 'es,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Collapse whitespace (incl. &nbsp;) and trim. cheerio already decodes entities. */
export function clean(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

export const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/**
 * Build 'YYYY-MM-DD' from a day number and a Spanish month name. The page omits
 * the year; events are always in the future, so if the month/day has already
 * passed this year we roll over to next year.
 */
export function parseSpanishDate(day: string, monthName: string, ref: Date = new Date()): string | null {
  const d = parseInt(clean(day), 10);
  const m = SPANISH_MONTHS[clean(monthName).toLowerCase()];
  if (!d || !m || d < 1 || d > 31) return null;

  let year = ref.getFullYear();
  const refMonth = ref.getMonth() + 1;
  if (m < refMonth || (m === refMonth && d < ref.getDate())) year += 1;

  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** First number in a price string ('40€', 'Desde 35,50 €') → number, or null. */
export function parsePrice(text: string): number | null {
  const m = clean(text).match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

/** Notice prepended (in the event's language) to a paid event's description. */
export const PAID_LABEL_ES = 'EVENTO DE PAGO';

export function withPaidPrefix(description: string, isPaid: boolean, label = PAID_LABEL_ES): string {
  if (!isPaid) return description;
  return description ? `${label}\n\n${description}` : label;
}

// ─── Listing parsing ──────────────────────────────────────────────────────────

export interface EcoListingItem {
  id: string;
  title: string;
  island: string;
  imageUrl?: string;
}

/** Parse the homepage grid into one item per show (across all islands). */
export function parseListing(html: string, baseUrl = BASE): EcoListingItem[] {
  const $ = cheerio.load(html);
  const items: EcoListingItem[] = [];
  const seen = new Set<string>();

  $('ul#grid > li, ul.list-events > li').each((_, li) => {
    const $li = $(li);

    const href = $li.find('a[href*="/elegirsesion/"]').first().attr('href') ?? '';
    const id = href.match(/\/elegirsesion\/(\d+)/)?.[1];
    if (!id || seen.has(id)) return;

    const title = clean($li.find('h4').first().text());
    if (!title) return;

    // Island name is the bare text of the <h5> that wraps the `.island` icon —
    // strip its child elements (the icon div and the venue <span>) to isolate it.
    const $h5 = $li.find('.island').closest('h5');
    const island = clean($h5.clone().children().remove().end().text());

    let imageUrl: string | undefined;
    const src = $li.find('.event-photo').first().attr('src');
    if (src) {
      imageUrl = src.startsWith('http')
        ? src
        : `${baseUrl.replace(/\/$/, '')}/${src.replace(/^\//, '')}`;
    }

    seen.add(id);
    items.push({ id, title, island, imageUrl });
  });

  return items;
}

// ─── Detail parsing ───────────────────────────────────────────────────────────

export interface EcoSession {
  date: string;            // 'YYYY-MM-DD'
  startHour: string | null;
  venueName: string;
  price: number | null;
}

export interface EcoDetail {
  description: string;
  sessions: EcoSession[];
}

/** Parse a `/elegirsesion/{id}` page into its synopsis and list of sessions. */
export function parseDetail(html: string, ref: Date = new Date()): EcoDetail {
  const $ = cheerio.load(html);

  // Synopsis lives in `.description-eco` as multiple <p>; join them with blank
  // lines (cheerio's .text() would otherwise run paragraphs together).
  const $desc = $('.description-eco');
  const paras = $desc.find('p').map((_, p) => clean($(p).text())).get().filter(Boolean);
  const description = paras.length ? paras.join('\n\n') : clean($desc.text());

  const sessions: EcoSession[] = [];
  $('table.table-sesion tbody tr').each((_, tr) => {
    const $tr = $(tr);

    const date = parseSpanishDate($tr.find('.day').first().text(), $tr.find('.month').first().text(), ref);
    if (!date) return;

    // `.dates` text looks like '20:30 | Teatro Leal' (icons render empty).
    const datesText = clean($tr.find('.dates').first().text());
    const startHour = datesText.match(/(\d{1,2}:\d{2})/)?.[1] ?? null;
    const parts = datesText.split('|');
    const venueName = parts.length > 1
      ? clean(parts.slice(1).join('|'))
      : clean(datesText.replace(/\d{1,2}:\d{2}/, ''));

    const price = parsePrice($tr.find('.price-sesion').first().text());

    sessions.push({ date, startHour, venueName, price });
  });

  return { description, sessions };
}

// ─── Source implementation ────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

export class EcoEntradasSource implements Source {
  readonly id = 'eco';
  readonly name = 'ecoentradas.com';

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const fromISO = iso(options.dateFrom);
    const toISO = iso(options.dateTo);

    const all = parseListing(await fetchHtml(`${BASE}/`));
    const tenerife = all.filter(i => i.island.toLowerCase() === 'tenerife');
    console.log(`  [${this.name}] ${all.length} listed, ${tenerife.length} in Tenerife`);

    const events: RawEvent[] = [];

    for (const item of tenerife) {
      try {
        await sleep(PAGE_DELAY_MS);
        const detail = parseDetail(await fetchHtml(`${BASE}/elegirsesion/${item.id}`));

        for (const s of detail.sessions) {
          if (s.date < fromISO || s.date > toISO) continue;
          const isPaid = (s.price ?? 0) > 0;
          events.push({
            externalId:  `${this.id}:${item.id}:${s.date}`,
            title:       item.title,
            description: withPaidPrefix(detail.description, isPaid),
            date:        s.date,
            startHour:   s.startHour,
            endHour:     null,
            venueName:   s.venueName,
            city:        'Tenerife',           // municipality unknown; anchors geocoding to the island
            country:     'ES',
            categories:  [],
            sourceUrl:   `${BASE}/elegirsesion/${item.id}`,
            imageUrl:    item.imageUrl,
          });
        }
      } catch (err) {
        console.warn(`  [${this.name}] ${item.id} failed: ${(err as Error).message}`);
      }
    }

    return events;
  }
}
