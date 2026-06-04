/**
 * Source registry — add new event sources here.
 *
 * To add a new source:
 *   1. Create scripts/event-sync/sources/mysource.ts implementing the Source interface
 *   2. Import it below and add an instance to SOURCES
 *
 * Each source must:
 *   - implement Source (id, name, scrape)
 *   - prefix externalId with its own id: `${this.id}:${nativeId}`
 *   - return dates in 'YYYY-MM-DD' and hours in 'HH:MM' local time
 *   - include country ISO code in RawEvent.country
 */

import type { Source } from '../types.ts';
import { LagendaSource } from './lagenda.ts';
import { TribeEventsSource } from './tribe.ts';

// ─── Registered sources (all will run on every sync) ─────────────────────────

export const SOURCES: Source[] = [
  new LagendaSource(),
  // The Events Calendar (Tribe) REST API across municipal WordPress sites.
  // No API key; add more towns in TRIBE_SITES (tribe.ts).
  new TribeEventsSource(),

  // Examples of future sources:
  // new EventbriteSource({ location: 'Tenerife' }),
  // new FacebookEventsSource({ pages: ['tenerife.events'] }),
  // new VisitTenerifeSource(),
];
