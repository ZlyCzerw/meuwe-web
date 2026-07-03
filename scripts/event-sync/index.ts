import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGIONS } from './regions/index.ts';
import { geocode } from './geocoder.ts';
import { mapCategory } from './mapper.ts';
import { generateSql } from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { localToUtc } from './timezone.ts';
import type { MeuweEvent, RawEvent, RegionConfig } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'seeds');
const LOOKAHEAD_DAYS = 21;

function resolveRegion(): RegionConfig {
  const arg = process.argv.find(a => a.startsWith('--region='));
  const id = arg?.split('=')[1];
  if (!id || !REGIONS[id]) {
    console.error(`Usage: npm run event-sync -- --region=<${Object.keys(REGIONS).join('|')}>`);
    process.exit(1);
  }
  return REGIONS[id];
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

async function toMeuweEvent(
  raw: RawEvent,
  region: RegionConfig,
): Promise<{ event: MeuweEvent; usedFallbackCoords: boolean }> {
  const startHour = raw.startHour ?? '19:00';
  const startUtc = localToUtc(raw.date, startHour, region.timezone);

  let endUtc: Date;
  if (raw.endHour) {
    endUtc = localToUtc(raw.date, raw.endHour, region.timezone);
    // Handle midnight crossover (e.g. start 23:00, end 01:00)
    if (endUtc <= startUtc) endUtc = addHours(endUtc, 24);
  } else {
    endUtc = addHours(startUtc, 2);
  }

  const coords = await geocode(raw.venueName, raw.city, region);
  const usedFallbackCoords =
    coords.lat === region.center.lat && coords.lng === region.center.lng;
  const { category, tags } = mapCategory(raw.categories);
  const placeName = [raw.venueName, raw.city].filter(Boolean).join(', ');

  return {
    event: {
      externalId: raw.externalId,
      title: raw.title,
      description: raw.description,
      lat: coords.lat,
      lng: coords.lng,
      placeName,
      category,
      startTime: startUtc,
      endTime: endUtc,
      tags,
      photos: raw.imageUrl ? [raw.imageUrl] : [],
    },
    usedFallbackCoords,
  };
}

async function main() {
  const region   = resolveRegion();
  const now      = new Date();
  const dateFrom = new Date(now);
  const dateTo   = new Date(now);
  dateTo.setDate(dateTo.getDate() + LOOKAHEAD_DAYS);

  const runDate  = now.toISOString().slice(0, 10);
  const dateFromStr = dateFrom.toISOString().slice(0, 10);
  const dateToStr   = dateTo.toISOString().slice(0, 10);

  console.log(`\nevent-sync — ${runDate} — region: ${region.id}`);
  console.log(`Range: ${dateFromStr} → ${dateToStr}`);
  console.log(`Sources: ${region.sources.map(s => s.name).join(', ')}\n`);

  // 1. Run every source, collect raw events
  const allRaw: RawEvent[] = [];

  for (const source of region.sources) {
    console.log(`\n▶ ${source.name}`);
    try {
      const raw = await source.scrape({ dateFrom, dateTo });
      console.log(`  → ${raw.length} events collected`);
      allRaw.push(...raw);
    } catch (err) {
      console.error(`  ✗ ${source.name} failed: ${(err as Error).message}`);
      // Continue with other sources
    }
  }

  console.log(`\nTotal raw events: ${allRaw.length}`);

  if (!allRaw.length) {
    console.log('Nothing to write. Exiting.');
    return;
  }

  // 2. Normalize → geocode → map. Missing fields get defaults (event is kept);
  //    only an unparseable date or blank title drops an event.
  console.log('\nNormalizing + geocoding...');
  const meuweEvents: MeuweEvent[] = [];
  const fallbackCounts: Record<string, number> = {};
  let dropped = 0;

  const bump = (key: string) => {
    fallbackCounts[key] = (fallbackCounts[key] ?? 0) + 1;
  };

  for (const raw of allRaw) {
    const { event: normalized, warnings } = normalizeEvent(raw);

    if (!normalized) {
      dropped++;
      console.warn(`  ⚠ Dropped ${raw.externalId}: ${warnings.join(', ')}`);
      continue;
    }

    // Count soft fallbacks only for events we actually keep.
    warnings.forEach(bump);
    const { event, usedFallbackCoords } = await toMeuweEvent(normalized, region);
    if (usedFallbackCoords) bump('region-center-coords');
    meuweEvents.push(event);
  }

  console.log('\n── Run summary ──');
  console.log(`Collected: ${allRaw.length}`);
  console.log(`Kept:      ${meuweEvents.length} (${dropped} dropped)`);
  const wc = Object.entries(fallbackCounts);
  if (wc.length) {
    console.log('Fallbacks: ' + wc.map(([k, v]) => `${v}× ${k}`).join(', '));
  }

  // 3. Generate SQL file
  const sql = generateSql(meuweEvents, {
    dateFrom: dateFromStr,
    dateTo:   dateToStr,
    generatedAt: runDate,
  });

  const filename = `events_${region.id}_${runDate.replace(/-/g, '')}.sql`;
  const filepath = path.join(SEEDS_DIR, filename);
  fs.writeFileSync(filepath, sql, 'utf8');

  console.log(`\n✅ Written to supabase/seeds/${filename}`);
  console.log(`   ${meuweEvents.length} events — paste into Supabase Dashboard → SQL Editor → Run\n`);
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
