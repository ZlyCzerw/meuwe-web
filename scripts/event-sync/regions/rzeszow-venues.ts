import type { VenueEntry } from '../types.ts'

/**
 * Hand-curated venues for the Rzeszów region. Matching: geocoder normalizes
 * the scraped venue string (lowercase, diacritics stripped) and checks
 * equality or substring against these aliases — order matters, first match
 * wins, so keep more specific entries above generic ones (e.g. 'skwer
 * kultury' before 'rynek').
 *
 * Coordinates verified against Nominatim/OSM 2026-07-03 and 2026-07-07 via
 * scripts/event-sync/verify-venues.ts, except G2A Arena (absent from OSM —
 * placed manually at the CWK site by Rzeszów-Jasionka airport).
 * Grow this list from the "no-venue-match" block in each run summary.
 */
export const RZESZOW_VENUES: VenueEntry[] = [
  { name: 'Hala Podpromie (RSCW)', city: 'Rzeszów', lat: 50.02932, lng: 22.00121,
    aliases: ['podpromie', 'regionalne centrum widowiskowo sportowe'] },
  { name: 'Baseny otwarte ROSIR', city: 'Rzeszów', lat: 50.03913, lng: 21.99323,
    aliases: ['baseny otwarte rosir', 'baseny otwarte', 'rosir ul ks jalowego'] },
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
  { name: 'Plac Ofiar Getta', city: 'Rzeszów', lat: 50.03858, lng: 22.00636,
    aliases: ['plac ofiar getta'] },
  { name: 'Park Jedności Polonii z Macierzą', city: 'Rzeszów', lat: 50.03841, lng: 21.99569,
    aliases: ['park jednosci polonii z macierza'] },
  { name: 'Klub Pod Palmą', city: 'Rzeszów', lat: 50.01653, lng: 22.00481,
    aliases: ['klub pod palma', 'pod palma'] },
  { name: 'Grand Club', city: 'Rzeszów', lat: 50.03745, lng: 22.00274,
    aliases: ['grand club'] },
  { name: 'LUKR club', city: 'Rzeszów', lat: 50.02796, lng: 22.01393,
    aliases: ['lukr club', 'lukr'] },
  { name: 'Underground', city: 'Rzeszów', lat: 50.03795, lng: 22.00331,
    aliases: ['underground rzeszow'] },
  { name: 'Cybermachina', city: 'Rzeszów', lat: 50.03814, lng: 22.00382,
    aliases: ['cybermachina', 'cybermachina rzeszow'] },
  { name: 'The Jameson Pub', city: 'Rzeszów', lat: 50.03824, lng: 21.99950,
    aliases: ['the jameson pub', 'jameson pub', 'jameson'] },
  { name: 'Bue Bue', city: 'Rzeszów', lat: 50.03715, lng: 22.00484,
    aliases: ['bue bue'] },
  { name: 'Lord Jack', city: 'Rzeszów', lat: 50.03719, lng: 22.00434,
    aliases: ['lord jack'] },
  { name: 'Rynek w Rzeszowie', city: 'Rzeszów', lat: 50.03749, lng: 22.00496,
    aliases: ['rynek'] },
  { name: 'Zamek Lubomirskich w Rzeszowie', city: 'Rzeszów', lat: 50.03247, lng: 22.00063,
    aliases: ['zamek lubomirskich', 'zamku lubomirskich', 'zamek lubmirskich'] },
  { name: 'Ogród Miejski im. Solidarności', city: 'Rzeszów', lat: 50.03130, lng: 21.99300,
    aliases: ['ogrod miejski', 'ogrodzie miejskim'] },
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
  // RDK filie & outdoor venues (from the Rzeszowski Dom Kultury Tribe feed).
  { name: 'RDK filia Słocina', city: 'Rzeszów', lat: 50.02784, lng: 22.04823,
    aliases: ['filia slocina'] },
  { name: 'RDK filia Załęże', city: 'Rzeszów', lat: 50.05394, lng: 22.04047,
    aliases: ['filia zaleze'] },
  { name: 'Rzeszowskie Bulwary', city: 'Rzeszów', lat: 50.01937, lng: 21.99599,
    aliases: ['rzeszowskie bulwary', 'bulwary'] },
  { name: 'Park przy ul. Wieniawskiego', city: 'Rzeszów', lat: 50.01390, lng: 22.04729,
    aliases: ['wieniawskiego'] },
  { name: 'Teren rekreacyjny przy ul. Zbyszewskiego', city: 'Rzeszów', lat: 50.04771, lng: 21.97427,
    aliases: ['zbyszewskiego'] },
  { name: 'Teren rekreacyjny przy ul. Myśliwskiej', city: 'Rzeszów', lat: 50.07951, lng: 21.97758,
    aliases: ['mysliwsk'] },
  { name: 'Teren rekreacyjny przy ul. Kardynała Wojtyły', city: 'Rzeszów', lat: 49.99196, lng: 22.01039,
    aliases: ['wojtyly'] },
  { name: 'Teren przy OSP Pogwizdów Nowy', city: 'Rzeszów', lat: 50.08362, lng: 21.97484,
    aliases: ['pogwizdow'] },
]
