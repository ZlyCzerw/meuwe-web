import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCES } from './sources/index.ts';
import { geocode, TENERIFE_CENTER } from './geocoder.ts';
import { mapCategory } from './mapper.ts';
import { generateSql } from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { localCanaryToUtc } from './timezone.ts';
import type { MeuweEvent, RawEvent } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'seeds');
const LOOKAHEAD_DAYS = 21;

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

async function toMeuweEvent(
  raw: RawEvent,
): Promise<{ event: MeuweEvent; usedFallbackCoords: boolean }> {
  const startHour = raw.startHour ?? '19:00';
  const startUtc = localCanaryToUtc(raw.date, startHour);

  let endUtc: Date;
  if (raw.endHour) {
    endUtc = localCanaryToUtc(raw.date, raw.endHour);
    // Handle midnight crossover (e.g. start 23:00, end 01:00)
    if (endUtc <= startUtc) endUtc = addHours(endUtc, 24);
  } else {
    endUtc = addHours(startUtc, 2);
  }

  const coords = await geocode(raw.venueName, raw.city, raw.country);
  const usedFallbackCoords =
    coords.lat === TENERIFE_CENTER.lat && coords.lng === TENERIFE_CENTER.lng;
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
  const now      = new Date();
  const dateFrom = new Date(now);
  const dateTo   = new Date(now);
  dateTo.setDate(dateTo.getDate() + LOOKAHEAD_DAYS);

  const runDate  = now.toISOString().slice(0, 10);
  const dateFromStr = dateFrom.toISOString().slice(0, 10);
  const dateToStr   = dateTo.toISOString().slice(0, 10);

  console.log(`\nevent-sync — ${runDate}`);
  console.log(`Range: ${dateFromStr} → ${dateToStr}`);
  console.log(`Sources: ${SOURCES.map(s => s.name).join(', ')}\n`);

  // 1. Run every source, collect raw events
  const allRaw: RawEvent[] = [];

  for (const source of SOURCES) {
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

  // 2. Normalize (fill defaults, never drop for missing data) → geocode → map
  console.log('\nNormalizing + geocoding...');
  const meuweEvents: MeuweEvent[] = [];
  const warningCounts: Record<string, number> = {};
  let dropped = 0;

  const bump = (key: string) => {
    warningCounts[key] = (warningCounts[key] ?? 0) + 1;
  };

  for (const raw of allRaw) {
    const { event: normalized, warnings } = normalizeEvent(raw);
    warnings.forEach(bump);

    if (!normalized) {
      dropped++;
      console.warn(`  ⚠ Dropped ${raw.externalId}: ${warnings.join(', ')}`);
      continue;
    }

    const { event, usedFallbackCoords } = await toMeuweEvent(normalized);
    if (usedFallbackCoords) bump('island-center-coords');
    meuweEvents.push(event);
  }

  console.log('\n── Run summary ──');
  console.log(`Collected: ${allRaw.length}`);
  console.log(`Kept:      ${meuweEvents.length} (${dropped} dropped)`);
  const wc = Object.entries(warningCounts);
  if (wc.length) {
    console.log('Fallbacks: ' + wc.map(([k, v]) => `${v}× ${k}`).join(', '));
  }

  // 3. Generate SQL file
  const sql = generateSql(meuweEvents, {
    dateFrom: dateFromStr,
    dateTo:   dateToStr,
    generatedAt: runDate,
  });

  const filename = `lagenda_${runDate.replace(/-/g, '')}.sql`;
  const filepath = path.join(SEEDS_DIR, filename);
  fs.writeFileSync(filepath, sql, 'utf8');

  console.log(`\n✅ Written to supabase/seeds/${filename}`);
  console.log(`   ${meuweEvents.length} events — paste into Supabase Dashboard → SQL Editor → Run\n`);
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
