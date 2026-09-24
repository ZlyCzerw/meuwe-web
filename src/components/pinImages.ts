import { ALL_CATEGORIES, BLOBS, INK, TAG_META, type Category } from '../lib/tokens'

// Pinezki jako gotowe obrazki. Blob, jego cień i glif to jeden SVG, budowany
// raz na wariant i trzymany pod stałym URL-em, więc marker na mapie ma jeden
// <img> zamiast kilkunastu elementów.
//
// Cień jest narysowany, nie nałożony filtrem. drop-shadow(0 Npx 0 c) bez
// rozmycia to ta sama sylwetka przesunięta o N px w kolorze c, a filtr kazał
// przeglądarce rysować każdą pinezkę osobno w każdej klatce ruchu mapy.

export type PinVariant =
  | { kind: 'public'; category: Category; blob: number }
  | { kind: 'private' }
  | { kind: 'badge' }

// Pudełko pinezki: 44 px na viewBox -3..103. Obrazek jest o 6 px wyższy, bo
// cień wychodzi 3 px pod sylwetkę, a <img> - inaczej niż inline SVG z
// overflow:visible - przycina wszystko poza swoim obszarem.
export const PIN_IMG_W = 44
export const PIN_IMG_H = 50
const UNIT = 106 / 44 // jednostek viewBoxa na piksel
const PIN_VB_H = (PIN_IMG_H * UNIT).toFixed(3)

// Odznaka klastra: 28 px na viewBox 0..100, +2 px na cień.
export const BADGE_IMG = 28
export const BADGE_IMG_H = 30
const BADGE_UNIT = 100 / BADGE_IMG

// '#2D2B2A22' i '#2D2B2A44' z dawnych filtrów, jako krycie.
const SHADOW_PUBLIC = (0x22 / 255).toFixed(4)
const SHADOW_PRIVATE = (0x44 / 255).toFixed(4)

const GLYPH_PX = 18

// Buźka pinezki prywatnej - ta sama co w dawnym privateHTML.
const PRIVATE_FACE = `<svg width="30" height="25" viewBox="0 0 26 22" fill="none">
  <ellipse cx="7.5" cy="7" rx="6" ry="5" fill="#2D2B2A"/>
  <ellipse cx="18.5" cy="7" rx="6" ry="5" fill="#2D2B2A"/>
  <rect x="11" y="3" width="4" height="8" fill="#2D2B2A"/>
  <ellipse cx="7.5" cy="7" rx="3" ry="2.5" fill="white"/>
  <ellipse cx="18.5" cy="7" rx="3" ry="2.5" fill="white"/>
  <path d="M8 18Q13 22 18 18" stroke="#2D2B2A" stroke-width="2" stroke-linecap="round"/>
</svg>`

function blobWithShadow(path: string, fill: string, shadowOpacity: string): string {
  const shape = `stroke="${INK}" stroke-width="5" stroke-linejoin="round"`
  const dy = (3 * UNIT).toFixed(3)
  return `<path d="${path}" fill="${INK}" ${shape} opacity="${shadowOpacity}" transform="translate(0 ${dy})"/>`
    + `<path d="${path}" fill="${fill}" ${shape}/>`
}

// Glif miał pudełko wielkości w px wyśrodkowane flexem na pudełku 44x44,
// którego środek to (50, 50) w viewBoxie. Tu to samo pudełko wstawiamy wprost.
// color: w obrazku nie ma strony, po której currentColor mógłby dziedziczyć.
function placedGlyph(glyph: string, wPx: number, hPx: number): string {
  const w = wPx * UNIT
  const h = hPx * UNIT
  const box = `<svg x="${(50 - w / 2).toFixed(3)}" y="${(50 - h / 2).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"`
  return `<g color="${INK}">${glyph.replace(/^<svg width="[^"]*" height="[^"]*"/, box)}</g>`
}

export function pinSvg(v: PinVariant): string {
  if (v.kind === 'badge') {
    const circle = `cx="50" cy="50" r="46.5" stroke="${INK}" stroke-width="7"`
    const dy = (2 * BADGE_UNIT).toFixed(3)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_IMG}" height="${BADGE_IMG_H}" viewBox="0 0 100 ${(BADGE_IMG_H * BADGE_UNIT).toFixed(3)}">`
      + `<circle ${circle} fill="${INK}" opacity="${SHADOW_PUBLIC}" transform="translate(0 ${dy})"/>`
      + `<circle ${circle} fill="#fff"/></svg>`
  }
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_IMG_W}" height="${PIN_IMG_H}" viewBox="-3 -3 106 ${PIN_VB_H}">`
  if (v.kind === 'private') {
    return open + blobWithShadow(BLOBS[0], '#fff', SHADOW_PRIVATE) + placedGlyph(PRIVATE_FACE, 30, 25) + '</svg>'
  }
  const meta = TAG_META[v.category] ?? TAG_META.party
  return open
    + blobWithShadow(BLOBS[v.blob % BLOBS.length], meta.color, SHADOW_PUBLIC)
    + placedGlyph(meta.glyph, GLYPH_PX, GLYPH_PX)
    + '</svg>'
}

function keyOf(v: PinVariant): string {
  return v.kind === 'public' ? `public|${v.category}|${v.blob % BLOBS.length}` : v.kind
}

const urls = new Map<string, string>()

/** Stały URL obrazka wariantu. blob: w przeglądarce, data: tam, gdzie go nie ma. */
export function pinImageUrl(v: PinVariant): string {
  const key = keyOf(v)
  let url = urls.get(key)
  if (!url) {
    const svg = pinSvg(v)
    url = typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    urls.set(key, url)
  }
  return url
}

export function allPinVariants(): PinVariant[] {
  const out: PinVariant[] = []
  for (const category of ALL_CATEGORIES) {
    for (let blob = 0; blob < BLOBS.length; blob++) out.push({ kind: 'public', category, blob })
  }
  out.push({ kind: 'private' }, { kind: 'badge' })
  return out
}

/**
 * Tworzy i dekoduje wszystkie warianty z góry. Bez tego pierwsza pinezka danej
 * kategorii mogłaby przez klatkę dekodowania stać pustym pudełkiem.
 */
export function warmPinImages(): void {
  for (const v of allPinVariants()) {
    const img = new Image()
    img.src = pinImageUrl(v)
    img.decode?.().catch(() => {})
  }
}
