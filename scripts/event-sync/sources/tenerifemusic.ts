/**
 * Source: tenerife.music — island-wide music/concert agenda. No API key.
 *
 * The `/events` page embeds a single JSON-LD `ItemList` of schema.org `Event`s
 * (name, startDate, location with locality, url, image). We read that blob
 * directly — structured and far more robust than scraping the rendered cards.
 *
 * Times: startDate carries a 'Z' suffix but the time-of-day is the local Canary
 * event time (e.g. a 20:00 concert). '00:00' means the listing has no real time,
 * so we leave the hour null (the orchestrator applies its default).
 */
import type { Source, ScrapeOptions, RawEvent } from '../types.ts';

const URL = 'https://tenerife.music/events';

// ─── Minimal shape of the schema.org Event we consume ─────────────────────────

interface SchemaPlace {
  name?: string;
  address?: { addressLocality?: string; addressCountry?: string };
}

export interface SchemaEvent {
  '@type'?: string;
  name?: string;
  startDate?: string;          // ISO, e.g. '2026-06-04T20:00:00.000Z'
  location?: SchemaPlace | unknown;
  url?: string;
  image?: string | string[] | false;
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** 'Sergio Dalma: ¡Vía Dalma!' → 'sergio-dalma-via-dalma' */
export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Pull every schema.org Event out of an ItemList JSON-LD blob in the page HTML. */
export function extractItemListEvents(html: string): SchemaEvent[] {
  const events: SchemaEvent[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (node && typeof node === 'object' && (node as Record<string, unknown>)['@type'] === 'ItemList') {
        const list = (node as { itemListElement?: unknown }).itemListElement;
        if (Array.isArray(list)) {
          for (const it of list) {
            if (it && typeof it === 'object' && (it as SchemaEvent)['@type'] === 'Event') {
              events.push(it as SchemaEvent);
            }
          }
        }
      }
    }
  }
  return events;
}

/** Map one schema.org Event to a RawEvent. Null if it lacks a name or date. */
export function schemaEventToRaw(ev: SchemaEvent, sourceId: string): RawEvent | null {
  const title = (ev.name ?? '').trim();
  const start = (ev.startDate ?? '').trim();
  if (!title || start.length < 10) return null;

  const date = start.slice(0, 10);                  // 'YYYY-MM-DD'
  const timeOfDay = start.slice(11, 16);            // 'HH:MM' (local) or ''
  const startHour = (!timeOfDay || timeOfDay === '00:00') ? null : timeOfDay;

  const place = (ev.location && typeof ev.location === 'object' && !Array.isArray(ev.location))
    ? ev.location as SchemaPlace : null;
  const venueName = (place?.name ?? '').trim();
  const city = (place?.address?.addressLocality ?? '').trim();
  const country = (place?.address?.addressCountry ?? 'ES').trim() || 'ES';

  const imageUrl = Array.isArray(ev.image) ? ev.image[0] : (typeof ev.image === 'string' ? ev.image : undefined);

  return {
    externalId:  `${sourceId}:${date}:${slugify(title)}`,
    title,
    description: '',
    date,
    startHour,
    endHour:     null,
    venueName,
    city,
    country,
    categories:  ['música'],          // music-only site → maps to the music category
    sourceUrl:   ev.url,
    imageUrl,
  };
}

// ─── Source implementation ────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

export class TenerifeMusicSource implements Source {
  readonly id = 'tenerifemusic';
  readonly name = 'tenerife.music';

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const fromISO = iso(options.dateFrom);
    const toISO = iso(options.dateTo);

    const res = await fetch(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; meuwe-event-sync/1.0; +https://meuwe.eu)',
        'Accept-Language': 'es,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`);

    const schema = extractItemListEvents(await res.text());
    const events: RawEvent[] = [];
    for (const ev of schema) {
      const raw = schemaEventToRaw(ev, this.id);
      if (raw && raw.date >= fromISO && raw.date <= toISO) events.push(raw);
    }

    console.log(`  [${this.name}] ${schema.length} listed, ${events.length} in window`);
    return events;
  }
}
