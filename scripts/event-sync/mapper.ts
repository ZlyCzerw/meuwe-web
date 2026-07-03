// ─── Category mapping ─────────────────────────────────────────────────────────
// Add entries here as new sources introduce new category strings.
// Municipality fallback coordinates live in regions/<region>.ts (cityCoords).

const CATEGORY_RULES: Array<{ match: RegExp; category: string; tags: string[] }> = [
  // ── schema.org Event subtypes (from JSON-LD sources; checked first, exact) ──
  { match: /\bMusicEvent\b/,       category: 'music',   tags: ['music'] },
  { match: /\b(?:Theater|Comedy|Dance|Screening|Literary)Event\b/, category: 'culture', tags: ['art'] },
  { match: /\b(?:Exhibition|VisualArts)Event\b/, category: 'art', tags: ['art'] },
  { match: /\bSportsEvent\b/,      category: 'outdoor', tags: ['outdoor', 'sport'] },
  { match: /\bChildrensEvent\b/,   category: 'family',  tags: ['family'] },
  { match: /\bFoodEvent\b/,        category: 'food',    tags: ['food'] },
  // ── Polish (checked first — PL sources rarely provide category strings,
  //    so the event title participates in matching, see mapCategory) ──
  { match: /koncert|muzyk|piosenk|zespół|zespol|symfoni|filharmoni|orkiestr|disco polo|hip[- ]?hop|festiwal muzyczny/i, category: 'music', tags: ['music'] },
  { match: /spektakl|teatral|kabaret|stand[- ]?up|operetk|balet/i, category: 'culture', tags: ['art'] },
  { match: /wystaw|wernisaż|wernisaz|galeri|malarstw|rzeźb|rzezb/i, category: 'art', tags: ['art'] },
  { match: /dzieci|rodzin|bajk|przedszkol|maluch/i, category: 'family', tags: ['family'] },
  { match: /\bbieg\b|maraton|rajd|turniej|mecz|żużel|zuzel|speedway|siatkówk|siatkowk|koszykówk|koszykowk|piłk|pilk/i, category: 'outdoor', tags: ['outdoor', 'sport'] },
  { match: /jarmark|festyn|piknik|dożynki|dozynki|odpust/i, category: 'culture', tags: ['culture'] },
  { match: /degustac|kulinarn|food ?truck|gastro/i, category: 'food', tags: ['food'] },
  { match: /\bkino\b|\bfilm\b|seans/i, category: 'culture', tags: ['art'] },
  { match: /warsztat|wykład|wyklad|spotkanie autorskie|książk|ksiazk/i, category: 'art', tags: ['art'] },
  // ── Spanish/English (v1 rules, unchanged) ──
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

export function mapCategory(rawCategories: string[], title = ''): { category: string; tags: string[] } {
  const combined = [...rawCategories, title].join(' ');
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(combined)) {
      return { category: rule.category, tags: rule.tags };
    }
  }
  return { category: 'culture', tags: ['culture'] };
}
