import type { VenueEntry } from '../types.ts'

/**
 * Hand-curated venues for the Rzeszów region. Matching: geocoder normalizes
 * the scraped venue string (lowercase, diacritics stripped) and checks
 * equality or substring against these aliases — order matters, first match
 * wins, so keep more specific entries above generic ones (e.g. 'skwer
 * kultury' before 'rynek').
 *
 * Coordinates verified against Nominatim/OSM 2026-07-03 via
 * scripts/event-sync/verify-venues.ts, except G2A Arena (absent from OSM —
 * placed manually at the CWK site by Rzeszów-Jasionka airport).
 * Grow this list from the "no-venue-match" block in each run summary.
 */
export const RZESZOW_VENUES: VenueEntry[] = [
  { name: 'Hala Podpromie (RSCW)', city: 'Rzeszów', lat: 50.02932, lng: 22.00121,
    aliases: ['podpromie', 'regionalne centrum widowiskowo sportowe'] },
  { name: 'Millenium Hall', city: 'Rzeszów', lat: 50.02734, lng: 22.01338,
    aliases: ['millenium hall', 'millennium hall'] },
  { name: 'G2A Arena (CWK Jasionka)', city: 'Jasionka', lat: 50.10400, lng: 22.03300,
    aliases: ['g2a arena', 'centrum wystawienniczo kongresowe', 'cwk jasionka'] },
  { name: 'Filharmonia Podkarpacka', city: 'Rzeszów', lat: 50.03353, lng: 22.00419,
    aliases: ['filharmonia podkarpacka', 'filharmonia im artura malawskiego'] },
  { name: 'Teatr im. Wandy Siemaszkowej', city: 'Rzeszów', lat: 50.03893, lng: 21.99951,
    aliases: ['teatr im wandy siemaszkowej', 'teatr siemaszkowej'] },
  { name: 'Teatr Maska', city: 'Rzeszów', lat: 50.03769, lng: 22.00653,
    aliases: ['teatr maska'] },
  { name: 'Kino Zorza', city: 'Rzeszów', lat: 50.03493, lng: 22.00055,
    aliases: ['kino zorza'] },
  { name: 'Wojewódzki Dom Kultury w Rzeszowie', city: 'Rzeszów', lat: 50.03938, lng: 22.00376,
    aliases: ['wojewodzki dom kultury', 'wdk rzeszow'] },
  { name: 'Rzeszowskie Piwnice / Skwer Kultury', city: 'Rzeszów', lat: 50.03749, lng: 22.00496,
    aliases: ['rzeszowskie piwnice', 'skwer kultury'] },
  { name: 'Rynek w Rzeszowie', city: 'Rzeszów', lat: 50.03749, lng: 22.00496,
    aliases: ['rynek'] },
  { name: 'Stadion Stal Rzeszów', city: 'Rzeszów', lat: 50.02174, lng: 21.99696,
    aliases: ['stadion stal', 'stadion miejski stal rzeszow', 'stal rzeszow'] },
  { name: 'Muzeum-Zamek w Łańcucie', city: 'Łańcut', lat: 50.06847, lng: 22.23432,
    aliases: ['zamek w lancucie', 'muzeum zamek', 'zamek lancut'] },
  { name: 'MDK Łańcut', city: 'Łańcut', lat: 50.07030, lng: 22.23329,
    aliases: ['mdk lancut', 'miejski dom kultury w lancucie'] },
  { name: 'MGOK Tyczyn', city: 'Tyczyn', lat: 49.96291, lng: 22.03369,
    aliases: ['mgok tyczyn', 'mgok', 'osrodek kultury w tyczynie'] },
  { name: 'MCK Boguchwała', city: 'Boguchwała', lat: 49.98162, lng: 21.94088,
    aliases: ['mck boguchwala', 'centrum kultury w boguchwale'] },
]
