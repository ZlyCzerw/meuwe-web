import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCES } from './sources/index.ts';
import { geocode } from './geocoder.ts';
import { mapCategory } from './mapper.ts';
import { generateSql } from './sql.ts';
import type { MeuweEvent, RawEvent } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'seeds');
const LOOKAHEAD_DAYS = 21;

// Canary Islands = UTC+1 in summer (WEST).
// Convert 'YYYY-MM-DD' + 'HH:MM' local → UTC Date.
function localToUtc(date: string, hour: string, utcOffsetHours = 1): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, min]   = hour.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - utcOffsetHours, min));
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

async function toMeuweEvent(raw: RawEvent): Promise<MeuweEvent> {
  const startHour = raw.startHour ?? '19:00';
  const startUtc  = localToUtc(raw.date, startHour);

  let endUtc: Date;
  if (raw.endHour) {
    endUtc = localToUtc(raw.date, raw.endHour);
    // Handle midnight crossover (e.g. start 23:00, end 01:00)
    if (endUtc <= startUtc) endUtc = addHours(endUtc, 24);
  } else {
    endUtc = addHours(startUtc, 2);
  }

  const coords   = await geocode(raw.venueName, raw.city, raw.country);
  const { category, tags } = mapCategory(raw.categories);
  const placeName = [raw.venueName, raw.city].filter(Boolean).join(', ');

  return {
    externalId:  raw.externalId,
    title:       raw.title,
    description: raw.description,
    lat:         coords.lat,
    lng:         coords.lng,
    placeName,
    category,
    startTime:   startUtc,
    endTime:     endUtc,
    tags,
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

  // 2. Geocode + map each event to meuwe schema
  console.log('\nGeocoding...');
  const meuweEvents: MeuweEvent[] = [];
  let skipped = 0;

  for (const raw of allRaw) {
    try {
      meuweEvents.push(await toMeuweEvent(raw));
    } catch (err) {
      console.warn(`  ⚠ Skipping ${raw.externalId}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log(`Mapped: ${meuweEvents.length} events (${skipped} skipped)`);

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
