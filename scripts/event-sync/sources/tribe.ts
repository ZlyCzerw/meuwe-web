/**
 * Source: The Events Calendar (Tribe) REST API — one adapter for every WordPress
 * site running the plugin. No API key required.
 *
 * Endpoint per site: `${baseUrl}/wp-json/tribe/events/v1/events?start_date=&end_date=&page=&per_page=`
 * Returns clean JSON with real event start/end dates, venue (incl. geo) and image.
 *
 * Coverage grows by adding a site to TRIBE_SITES (config), not by writing code.
 * Tenerife municipalities confirmed serving an open Tribe REST endpoint (2026-06).
 */
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const PER_PAGE = 50;
const MAX_PAGES = 10;
const SITE_DELAY_MS = 400;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const FETCH_RETRIES = 2;
const FETCH_BACKOFF_MS = 600;

/**
 * fetch() that retries on a thrown network error (e.g. transient "fetch failed"
 * that intermittently drops a site like candelaria). HTTP error statuses are
 * returned as-is — only a rejected fetch is retried.
 */
export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_RETRIES) await sleep(FETCH_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastErr;
}

// ─── Registered Tribe sites ───────────────────────────────────────────────────
// `id` becomes part of the externalId, so keep it stable & unique.
// `city` is the municipality, used as a geocoding fallback — many municipal
// events carry no structured venue (the place sits in the description), so
// without this they'd land at the island centre. Keep `city` matching a key in
// regions/tenerife.ts cityCoords.
export interface TribeSite { id: string; url: string; city: string; country?: string }

export const TRIBE_SITES: TribeSite[] = [
  { id: 'elsauzal',           url: 'https://elsauzal.es',                  city: 'El Sauzal' },
  { id: 'candelaria',         url: 'https://www.candelaria.es',            city: 'Candelaria' },
  { id: 'santiago-del-teide', url: 'https://www.santiagodelteide.es',      city: 'Santiago del Teide' },
  { id: 'san-miguel-abona',   url: 'https://www.sanmigueldeabona.es',      city: 'San Miguel de Abona' },
  { id: 'granadilla-abona',   url: 'https://www.granadilladeabona.org',    city: 'Granadilla de Abona' },
  { id: 'la-guancha',         url: 'https://www.laguancha.es',             city: 'La Guancha' },
  { id: 'el-tanque',          url: 'https://www.eltanque.es',              city: 'El Tanque' },
  // Tribe REST present but blocked/erroring (revisit): tegueste.es & buenavistadelnorte.es
  // & elrosario (401), arico.org (403), fasnia (500). Cert-expired (Node fetch
  // rejects): lossilos.es, santaursula.es, vilaflor.es, granadilladeabona.es.
];

// ─── Minimal shape of a Tribe REST event (only fields we use) ─────────────────

interface TribeVenue {
  venue?: string;
  city?: string;
  country?: string;
  geo_lat?: string;
  geo_lng?: string;
}

export interface TribeApiEvent {
  id: number;
  title: string;
  description?: string;
  url: string;
  start_date: string;            // 'YYYY-MM-DD HH:MM:SS' local
  end_date?: string;
  all_day?: boolean;
  image?: { url: string } | false;
  venue?: TribeVenue | unknown[]; // [] when the event has no venue
  categories?: Array<{ name: string }>;
}

interface TribeResponse {
  events?: TribeApiEvent[];
  total_pages?: number;
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…');
}

/** Strip HTML tags, decode entities, collapse whitespace. */
export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Map one Tribe REST event to a RawEvent.
 * @param siteId       namespaces the externalId
 * @param fallbackCity municipality to use when the event has no structured venue/city
 */
export function tribeToRawEvent(ev: TribeApiEvent, siteId: string, fallbackCity = '', country = 'ES'): RawEvent | null {
  const start = (ev.start_date ?? '').trim();
  if (!start || start.length < 10) return null;

  const date = start.slice(0, 10);                       // 'YYYY-MM-DD'
  const allDay = ev.all_day === true;
  const startHour = allDay ? null : (start.slice(11, 16) || null);
  const endHour = allDay ? null : ((ev.end_date ?? '').slice(11, 16) || null);

  const venue = (ev.venue && !Array.isArray(ev.venue)) ? ev.venue as TribeVenue : null;
  const venueName = stripHtml(venue?.venue ?? '');
  const city = stripHtml(venue?.city ?? '') || fallbackCity;

  const categories = (ev.categories ?? []).map(c => c.name).filter(Boolean);
  const imageUrl = ev.image && typeof ev.image === 'object' ? ev.image.url : undefined;

  return {
    externalId:  `tribe:${siteId}:${ev.id}`,
    title:       stripHtml(ev.title ?? ''),
    description: stripHtml(ev.description ?? ''),
    date,
    startHour,
    endHour,
    venueName,
    city,
    country,
    categories,
    sourceUrl:   ev.url,
    imageUrl,
  };
}

// ─── Source implementation ────────────────────────────────────────────────────

export class TribeEventsSource implements Source {
  readonly id = 'tribe';
  readonly name = 'The Events Calendar';

  private readonly sites: TribeSite[];

  constructor(sites: TribeSite[] = TRIBE_SITES) {
    this.sites = sites;
  }

  siteIds(): string[] {
    return this.sites.map(s => s.id);
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const from = options.dateFrom.toISOString().slice(0, 10);
    const to   = options.dateTo.toISOString().slice(0, 10);

    const all: RawEvent[] = [];

    for (const site of this.sites) {
      try {
        const events = await this.scrapeSite(site, from, to);
        console.log(`  [${this.name}] ${site.id}: ${events.length}`);
        all.push(...events);
      } catch (err) {
        // One dead/blocked site must not break the rest.
        console.warn(`  [${this.name}] ${site.id} failed: ${(err as Error).message}`);
      }
      await sleep(SITE_DELAY_MS);
    }

    return all;
  }

  private async scrapeSite(site: TribeSite, from: string, to: string): Promise<RawEvent[]> {
    const events: RawEvent[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url =
        `${site.url}/wp-json/tribe/events/v1/events` +
        `?start_date=${from}&end_date=${to}&page=${page}&per_page=${PER_PAGE}`;

      const res = await fetchWithRetry(url, {
        headers: {
          'User-Agent': 'meuwe-event-sync/1.0 (+https://meuwe.eu)',
          'Accept': 'application/json',
          'Accept-Language': 'es,en;q=0.9',
        },
      });
      // Tribe returns 404 for "page past the end" — treat as a clean stop.
      if (res.status === 404) break;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${site.id} page ${page}`);

      const body = await res.json() as TribeResponse;
      const apiEvents = body.events ?? [];
      for (const ev of apiEvents) {
        const raw = tribeToRawEvent(ev, site.id, site.city, site.country ?? 'ES');
        if (raw) events.push(raw);
      }

      const totalPages = body.total_pages ?? 1;
      if (page >= totalPages || apiEvents.length === 0) break;
    }

    return events;
  }
}
