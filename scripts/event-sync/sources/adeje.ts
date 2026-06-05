/**
 * Source: Ayuntamiento de Adeje — municipal agenda. No API key; server-rendered HTML.
 *
 * The `/agenda` LIST view renders every current event on one page (its `?pag=`
 * param is cosmetic). Each `.VistaAgendaListaItem` carries a circular date widget
 * (`.fechacirculodia` / `.fechacirculomes` — day can be a range "4-8", month is a
 * Spanish abbreviation, sometimes with a year "jun 2026"), title, description,
 * optional venue (usually blank) and image. Items are repeated across view styles,
 * so we dedupe by event id (`/evento/{id}`).
 */
import * as cheerio from 'cheerio';
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const BASE = 'https://www.adeje.es';
const LISTING_URL = `${BASE}/agenda?ViewStyle=LIST`;

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

export function clean(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};

export function parseMonth(name: string): number | null {
  return MONTHS[clean(name).toLowerCase().replace(/\.$/, '')] ?? null;
}

/** Build 'YYYY-MM-DD'; infer year (future events) unless one is given. */
export function buildDate(day: number, month: number, ref: Date, explicitYear?: number): string | null {
  if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) return null;
  let year = explicitYear ?? ref.getFullYear();
  if (explicitYear === undefined) {
    const refMonth = ref.getMonth() + 1;
    if (month < refMonth || (month === refMonth && day < ref.getDate())) year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Combine the circle widget's day text ("4-8" → 4) and month text ("jun 2026"). */
export function parseFecha(diaText: string, mesText: string, ref: Date): string | null {
  const dayMatch = clean(diaText).match(/\d{1,2}/);          // start day of a range
  const monthMatch = clean(mesText).toLowerCase().match(/[a-záéíóú]+/);
  const yearMatch = clean(mesText).match(/\b(20\d{2})\b/);
  if (!dayMatch || !monthMatch) return null;
  const month = parseMonth(monthMatch[0]);
  if (!month) return null;
  return buildDate(parseInt(dayMatch[0], 10), month, ref, yearMatch ? parseInt(yearMatch[1], 10) : undefined);
}

function idFrom(href: string | undefined): string | null {
  return href?.match(/\/evento\/(\d+)/)?.[1] ?? null;
}

export interface AdejeEntry {
  id: string;
  title: string;
  date: string;
  venueName: string;
  description: string;
  imageUrl?: string;
}

/** Parse the agenda listing into deduped entries. */
export function extractEvents(html: string, ref: Date = new Date()): AdejeEntry[] {
  const $ = cheerio.load(html);
  const entries: AdejeEntry[] = [];
  const seen = new Set<string>();

  $('.VistaAgendaListaItem').each((_, el) => {
    const $c = $(el);
    const id = idFrom($c.find('a[href*="/evento/"]').first().attr('href'));
    if (!id || seen.has(id)) return;

    const date = parseFecha(
      $c.find('.fechacirculodia').first().text(),
      $c.find('.fechacirculomes').first().text(),
      ref,
    );
    const title = clean($c.find('.VistaAgendaListaDatosTitulo').first().text());
    if (!id || !title || !date) return;

    seen.add(id);
    const src = $c.find('.VistaAgendaListaImagen img').first().attr('src');
    entries.push({
      id,
      title,
      date,
      venueName:   clean($c.find('.VistaAgendaListaDatosLugar').first().text()),
      description: clean($c.find('.VistaAgendaListaDatosDescripcion').first().text()),
      imageUrl:    src ? (src.startsWith('http') ? src : `${BASE}/${src.replace(/^\//, '')}`) : undefined,
    });
  });

  return entries;
}

// ─── Source implementation ────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

export class AdejeSource implements Source {
  readonly id = 'adeje';
  readonly name = 'Ayuntamiento de Adeje';

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
        description: e.description,
        date:        e.date,
        startHour:   null,
        endHour:     null,
        venueName:   e.venueName,
        city:        'Adeje',
        country:     'ES',
        categories:  [],
        sourceUrl:   `${BASE}/evento/${e.id}`,
        imageUrl:    e.imageUrl,
      });
    }

    console.log(`  [${this.name}] ${all.length} parsed, ${events.length} in window`);
    return events;
  }
}
