export const C = {
  primary: '#FF7A45', primaryPress: '#E85A2A', primarySoft: '#FFD4C0',
  sky: '#4FC3F7', grass: '#7DD87A', sunshine: '#FFD54F',
  berry: '#FF8FA3', cream: '#FFF6EC', cloud: '#FFFFFF',
  ink: '#2D2B2A', inkSoft: '#8A8580',
} as const

export const INK = '#2D2B2A'

export const F = {
  display: '"Hanken Grotesk","Nunito",ui-rounded,system-ui,sans-serif',
  body: '"Nunito",ui-rounded,system-ui,sans-serif',
} as const

export const BLOBS = [
  'M50 8 C71 8 92 22 92 47 C92 73 76 92 50 92 C25 92 8 75 8 50 C8 26 28 8 50 8 Z',
  'M52 6 C76 9 94 28 92 53 C90 79 71 94 47 92 C22 90 6 70 9 46 C12 22 30 4 52 6 Z',
  'M48 9 C72 6 91 26 93 50 C95 76 75 93 49 92 C24 91 5 71 8 46 C11 23 27 12 48 9 Z',
] as const

export type Category =
  | 'party' | 'outdoor' | 'family' | 'culture' | 'sport' | 'food'
  | 'music' | 'art' | 'film' | 'gaming' | 'tech' | 'nature'
  | 'travel' | 'yoga' | 'dance' | 'comedy' | 'kids' | 'pets'
  | 'volunteering' | 'workshop' | 'alert'

export const ALL_CATEGORIES: Category[] = [
  'party', 'outdoor', 'family', 'culture', 'sport', 'food',
  'music', 'art', 'film', 'gaming', 'tech', 'nature',
  'travel', 'yoga', 'dance', 'comedy', 'kids', 'pets',
  'volunteering', 'workshop', 'alert',
]

// SAFETY: icon() returns a static, hardcoded SVG string — not user input.
// dangerouslySetInnerHTML in MapScreen.tsx is safe because these values
// are compile-time constants defined in this file only.
// Inline SVG helper — monochrome, stroke-only, hand-drawn feel
function icon(paths: string): string {
  return `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.125em">${paths}</svg>`
}

export const TAG_META: Record<Category, { color: string; glyph: string }> = {
  // gift box with ribbon
  party: { color: '#FF8FA3', glyph: icon('<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>') },
  // mountain peaks
  outdoor: { color: '#7DD87A', glyph: icon('<path d="M2 20L9 6l5 8 3-5 5 11H2z"/>') },
  // house with door
  family: { color: '#FFD54F', glyph: icon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>') },
  // theater drama masks
  culture: { color: '#4FC3F7', glyph: icon('<circle cx="7" cy="9" r="4"/><path d="M7 12c0 2 1.5 3 4 4"/><path d="M4 8c.5 1 1.5 1.5 3 1.5"/><circle cx="17" cy="9" r="4"/><path d="M17 12c0 2-1.5 3-4 4"/><path d="M14 8c.5-1 1.5-1.5 3-1.5"/>') },
  // bullseye target
  sport: { color: '#FF7A45', glyph: icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>') },
  // fork and knife
  food: { color: '#F9B45E', glyph: icon('<line x1="8" y1="2" x2="8" y2="22"/><path d="M5 2v6a3 3 0 0 0 6 0V2"/><line x1="18" y1="2" x2="18" y2="22"/>') },
  // music note double
  music: { color: '#C084FC', glyph: icon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>') },
  // pen/paintbrush stroke
  art: { color: '#FB923C', glyph: icon('<path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/><path d="M15 5l4 4"/>') },
  // film strip
  film: { color: '#818CF8', glyph: icon('<rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>') },
  // gamepad with d-pad and buttons
  gaming: { color: '#34D399', glyph: icon('<path d="M5 8h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15.5" cy="11.5" r="0.5" fill="currentColor"/><circle cx="18.5" cy="13.5" r="0.5" fill="currentColor"/>') },
  // lightning bolt
  tech: { color: '#60A5FA', glyph: icon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>') },
  // leaf with stem
  nature: { color: '#4ADE80', glyph: icon('<path d="M2 22l10-10"/><path d="M22 2s-7 2-12 8-5 12-5 12 6-1 10-6 7-14 7-14z"/>') },
  // paper plane / send
  travel: { color: '#F472B6', glyph: icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>') },
  // sun with rays (calm/wellness)
  yoga: { color: '#A78BFA', glyph: icon('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>') },
  // dancing figure with arms up
  dance: { color: '#F87171', glyph: icon('<circle cx="12" cy="4" r="2"/><path d="M12 6l-3 6 3 2 3-2-3-6z"/><path d="M9 12l-3 5M15 12l3 5"/><path d="M8 21l4-4 4 4"/><path d="M9 8l-3-2M15 8l3-2"/>') },
  // smiley face
  comedy: { color: '#FBBF24', glyph: icon('<circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2.5 4 2.5 4-2.5 4-2.5"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>') },
  // 5-pointed star
  kids: { color: '#86EFAC', glyph: icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>') },
  // paw print
  pets: { color: '#FCA5A5', glyph: icon('<circle cx="7.5" cy="6.5" r="2"/><circle cx="16.5" cy="6.5" r="2"/><circle cx="4.5" cy="13" r="1.5"/><circle cx="19.5" cy="13" r="1.5"/><path d="M12 22c-3.5 0-8-2.5-8-7 0-2.5 2-4 8-4s8 1.5 8 4c0 4.5-4.5 7-8 7z"/>') },
  // heart
  volunteering: { color: '#6EE7B7', glyph: icon('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>') },
  // wrench / tool
  workshop: { color: '#93C5FD', glyph: icon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>') },
  // warning triangle with exclamation
  alert: { color: '#FBBF24', glyph: icon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>') },
}
