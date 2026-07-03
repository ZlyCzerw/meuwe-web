// ─── Category mapping ─────────────────────────────────────────────────────────
// Add entries here as new sources introduce new category strings.
// Municipality fallback coordinates live in regions/<region>.ts (cityCoords).

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
