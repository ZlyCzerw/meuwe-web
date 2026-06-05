/**
 * Source: Ayuntamiento de Arona — municipal agenda (DotNetNuke "Agenda" module).
 * No API key; server-rendered HTML.
 *
 * Two card layouts on the listing:
 *   - regular `.agenda-evento`            → `.agenda-evento-dia` + `.agenda-evento-mes`
 *   - featured `.agenda-evento-destacado` → free-text `.agenda-evento-destacado-fecha`
 *                                           (e.g. "Del 11 al 29 de junio")
 * The card date carries no year, so we infer it (future events). Pagination is an
 * ASP.NET __doPostBack (ViewState) — not replayable via a query param — so we read
 * page 1 only. It is date-sorted ascending from today, so for a near-term window it
 * already holds the relevant events; events further out live on later pages (TODO).
 */
import * as cheerio from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const BASE = 'https://www.arona.org';
const LISTING_URL = `${BASE}/Agenda`;

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

export function clean(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

// Full and abbreviated Spanish month names (the listing uses 'JUN.', 'SEPT.', …).
const MONTHS: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};

export function parseMonth(name: string): number | null {
  return MONTHS[clean(name).toLowerCase().replace(/\.$/, '')] ?? null;
}

/**
 * Build 'YYYY-MM-DD' from a day + Spanish month name. Year: use an explicit one if
 * given, else infer — events are future, so a month/day already past rolls to next year.
 */
export function buildDate(day: number, month: number, ref: Date, explicitYear?: number): string | null {
  if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) return null;
  let year = explicitYear ?? ref.getFullYear();
  if (explicitYear === undefined) {
    const refMonth = ref.getMonth() + 1;
    if (month < refMonth || (month === refMonth && day < ref.getDate())) year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse a free-text date like "Del 11 al 29 de junio" → the START date. */
export function parseFechaText(text: string, ref: Date): string | null {
  const t = clean(text);
  const monthMatch = t.toLowerCase().match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/);
  if (!monthMatch) return null;
  const month = parseMonth(monthMatch[1]);
  const dayMatch = t.match(/\d{1,2}/);            // first day number ("Del 11 …")
  const yearMatch = t.match(/\b(20\d{2})\b/);
  if (!month || !dayMatch) return null;
  return buildDate(parseInt(dayMatch[0], 10), month, ref, yearMatch ? parseInt(yearMatch[1], 10) : undefined);
}

function idFrom(href: string | undefined): string | null {
  return href?.match(/[?&]id=(\d+)/)?.[1] ?? null;
}

function absImg(src: string | undefined): string | undefined {
  if (!src) return undefined;
  return src.startsWith('http') ? src : `${BASE}/${src.replace(/^\//, '')}`;
}

export interface AronaEntry {
  id: string;
  title: string;
  date: string;
  imageUrl?: string;
  sourceUrl: string;
}

/** Parse the agenda listing (both card layouts) into entries. */
export function extractEvents(html: string, ref: Date = new Date()): AronaEntry[] {
  const $ = cheerio.load(html);
  const entries: AronaEntry[] = [];
  const seen = new Set<string>();

  const push = (id: string | null, title: string, date: string | null, href: string | undefined, img: string | undefined) => {
    if (!id || !title || !date || seen.has(id)) return;
    seen.add(id);
    entries.push({ id, title, date, imageUrl: absImg(img), sourceUrl: href?.startsWith('http') ? href : `${LISTING_URL}` });
  };

  // Regular cards
  $('.agenda-evento').each((_, el) => {
    const $c = $(el);
    const day = parseInt(clean($c.find('.agenda-evento-dia').first().text()), 10);
    const month = parseMonth($c.find('.agenda-evento-mes').first().text());
    const titleLink = $c.find('.agenda-evento-title a').first();
    const href = titleLink.attr('href') ?? $c.find('.agenda-evento-img a').first().attr('href');
    push(
      idFrom(href),
      clean(titleLink.text()),
      month ? buildDate(day, month, ref) : null,
      href,
      $c.find('.agenda-evento-img img').first().attr('src'),
    );
  });

  // Featured cards
  $('.agenda-evento-destacado').each((_, el) => {
    const $c = $(el);
    const href = $c.find('a[href*="id="]').first().attr('href');
    push(
      idFrom(href),
      clean($c.find('.agenda-evento-destacado-titulo').first().text()),
      parseFechaText($c.find('.agenda-evento-destacado-fecha').first().text(), ref),
      href,
      $c.find('.agenda-evento-destacado-img img').first().attr('src'),
    );
  });

  return entries;
}

// ─── Source implementation ────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

export class AronaSource implements Source {
  readonly id = 'arona';
  readonly name = 'Ayuntamiento de Arona';

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const fromISO = iso(options.dateFrom);
    const toISO = iso(options.dateTo);

    const res = await fetch(LISTING_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; meuwe-event-sync/1.0; +https://meuwe.eu)',
        'Accept-Language': 'es,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${LISTING_URL}`);

    const all = extractEvents(await res.text());
    const events: RawEvent[] = [];
    for (const e of all) {
      if (e.date < fromISO || e.date > toISO) continue;
      events.push({
        externalId:  `${this.id}:${e.id}`,
        title:       e.title,
        description: '',
        date:        e.date,
        startHour:   null,
        endHour:     null,
        venueName:   '',
        city:        'Arona',
        country:     'ES',
        categories:  [],
        sourceUrl:   e.sourceUrl,
        imageUrl:    e.imageUrl,
      });
    }

    console.log(`  [${this.name}] ${all.length} parsed, ${events.length} in window`);
    return events;
  }
}
