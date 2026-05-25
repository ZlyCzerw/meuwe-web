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
  | 'volunteering' | 'workshop'

export const ALL_CATEGORIES: Category[] = [
  'party', 'outdoor', 'family', 'culture', 'sport', 'food',
  'music', 'art', 'film', 'gaming', 'tech', 'nature',
  'travel', 'yoga', 'dance', 'comedy', 'kids', 'pets',
  'volunteering', 'workshop',
]

export const TAG_META: Record<Category, { color: string; glyph: string }> = {
  party:        { color: '#FF8FA3', glyph: '✦' },
  outdoor:      { color: '#7DD87A', glyph: '◐' },
  family:       { color: '#FFD54F', glyph: '✿' },
  culture:      { color: '#4FC3F7', glyph: '♪' },
  sport:        { color: '#FF7A45', glyph: '◯' },
  food:         { color: '#F9B45E', glyph: '✸' },
  music:        { color: '#C084FC', glyph: '♬' },
  art:          { color: '#FB923C', glyph: '◈' },
  film:         { color: '#818CF8', glyph: '▶' },
  gaming:       { color: '#34D399', glyph: '⬡' },
  tech:         { color: '#60A5FA', glyph: '⟐' },
  nature:       { color: '#4ADE80', glyph: '✾' },
  travel:       { color: '#F472B6', glyph: '◆' },
  yoga:         { color: '#A78BFA', glyph: '☯' },
  dance:        { color: '#F87171', glyph: '✺' },
  comedy:       { color: '#FBBF24', glyph: '☺' },
  kids:         { color: '#86EFAC', glyph: '✶' },
  pets:         { color: '#FCA5A5', glyph: '♥' },
  volunteering: { color: '#6EE7B7', glyph: '❋' },
  workshop:     { color: '#93C5FD', glyph: '◎' },
}
