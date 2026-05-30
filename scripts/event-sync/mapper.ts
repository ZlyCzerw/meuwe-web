import type { Coords } from './types.ts';

// ─── Category mapping ─────────────────────────────────────────────────────────
// Add entries here as new sources introduce new category strings.

const CATEGORY_RULES: Array<{ match: RegExp; category: string; tags: string[] }> = [
  { match: /fiesta|popular|romería|romeria|baile de magos/i, category: 'culture',  tags: ['culture', 'dance'] },
  { match: /jazz|clásic|clasic|concierto|concert|música|musica|popular|parranda|folclore|gospel|coral/i, category: 'music', tags: ['music'] },
  { match: /gastronom|comida|food|restaur|degustac|mercado/i, category: 'food',    tags: ['food'] },
  { match: /deporte|sport|natur|senderis|trail|triatl|surf|paddle|kayak|buceo|vela/i, category: 'outdoor', tags: ['outdoor', 'sport'] },
  { match: /infant|niño|niña|familiar|family|circo/i,        category: 'family',  tags: ['family'] },
  { match: /arte|art|fotograf|exposic|exhibit|pintura|escultura/i, category: 'art', tags: ['art'] },
  { match: /teatro|danza|dance|escénic|escenica|humor|comedia|musical|circo/i, category: 'culture', tags: ['art'] },
  { match: /cine|cinema|film/i,                              category: 'culture',  tags: ['art'] },
  { match: /literatur|poesía|poesia|lectura|libro/i,         category: 'art',     tags: ['art'] },
  { match: /historia|etnograf|cultura|culture/i,             category: 'culture', tags: ['culture'] },
];

export function mapCategory(rawCategories: string[]): { category: string; tags: string[] } {
  const combined = rawCategories.join(' ');
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(combined)) {
      return { category: rule.category, tags: rule.tags };
    }
  }
  return { category: 'culture', tags: ['culture'] };
}

// ─── Fallback coordinates for known municipalities ────────────────────────────
// Keyed by lowercase municipality name. Used when Nominatim fails.

export const MUNICIPALITY_COORDS: Record<string, Coords> = {
  // Tenerife
  'santa cruz de tenerife':       { lat: 28.4636,  lng: -16.2518 },
  'santa cruz':                   { lat: 28.4636,  lng: -16.2518 },
  'san cristóbal de la laguna':   { lat: 28.4854,  lng: -16.3159 },
  'la laguna':                    { lat: 28.4854,  lng: -16.3159 },
  'puerto de la cruz':            { lat: 28.4165,  lng: -16.5506 },
  'arona':                        { lat: 28.0994,  lng: -16.6828 },
  'adeje':                        { lat: 28.1222,  lng: -16.7270 },
  'granadilla de abona':          { lat: 28.1219,  lng: -16.5798 },
  'granadilla':                   { lat: 28.1219,  lng: -16.5798 },
  'los realejos':                 { lat: 28.3913,  lng: -16.5891 },
  'la orotava':                   { lat: 28.3895,  lng: -16.5228 },
  'icod de los vinos':            { lat: 28.3695,  lng: -16.7213 },
  'garachico':                    { lat: 28.3728,  lng: -16.7611 },
  'güímar':                       { lat: 28.3096,  lng: -16.4129 },
  'candelaria':                   { lat: 28.3561,  lng: -16.3734 },
  'san miguel de abona':          { lat: 28.0335,  lng: -16.6315 },
  'el médano':                    { lat: 28.0454,  lng: -16.5341 },
  'los cristianos':               { lat: 28.0532,  lng: -16.7150 },
  'playa de las américas':        { lat: 28.0534,  lng: -16.7289 },
  'costa adeje':                  { lat: 28.0870,  lng: -16.7324 },
  'vilaflor':                     { lat: 28.1567,  lng: -16.6367 },
  'tegueste':                     { lat: 28.5110,  lng: -16.3283 },
  'el sauzal':                    { lat: 28.4726,  lng: -16.4274 },
  'la guancha':                   { lat: 28.3551,  lng: -16.6441 },
  'buenavista del norte':         { lat: 28.3785,  lng: -16.8647 },
  'los silos':                    { lat: 28.3763,  lng: -16.8208 },
  'tacoronte':                    { lat: 28.4728,  lng: -16.4090 },
  'la matanza':                   { lat: 28.4805,  lng: -16.4406 },
  'el rosario':                   { lat: 28.4555,  lng: -16.2973 },
  'arafo':                        { lat: 28.3361,  lng: -16.4180 },
  'arico':                        { lat: 28.1659,  lng: -16.4872 },
  'fasnia':                       { lat: 28.2264,  lng: -16.4404 },
  'punta del hidalgo':            { lat: 28.5706,  lng: -16.3213 },
  'tejina':                       { lat: 28.5270,  lng: -16.3383 },
  'santa úrsula':                 { lat: 28.4297,  lng: -16.4738 },
  'valle san lorenzo':            { lat: 28.0743,  lng: -16.6372 },
  'santiago del teide':           { lat: 28.2949,  lng: -16.8174 },
  'los gigantes':                 { lat: 28.2436,  lng: -16.8417 },
  // Other Canary Islands
  'las palmas de gran canaria':   { lat: 28.1235,  lng: -15.4363 },
  'las palmas':                   { lat: 28.1235,  lng: -15.4363 },
  'gran canaria':                 { lat: 28.1235,  lng: -15.4363 },
  'lanzarote':                    { lat: 29.0469,  lng: -13.5899 },
  'fuerteventura':                { lat: 28.3587,  lng: -14.0537 },
  'la palma':                     { lat: 28.6835,  lng: -17.7642 },
  'la gomera':                    { lat: 28.0916,  lng: -17.1150 },
  'el hierro':                    { lat: 27.7440,  lng: -18.0032 },
};

export function fallbackCoords(city: string): Coords | null {
  const key = city.toLowerCase().trim();
  if (MUNICIPALITY_COORDS[key]) return MUNICIPALITY_COORDS[key];
  for (const [k, v] of Object.entries(MUNICIPALITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}
