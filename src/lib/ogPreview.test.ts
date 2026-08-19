import { describe, it, expect } from 'vitest'
import { formatEventDays, excerpt, OG_DESCRIPTION_CHARS, buildOgPreview, OG_PLACE_CHARS, type OgEvent } from './ogPreview'

// Boguchwała, lng ~21.94 → round(21.94/15) = +1h. A 14:00Z start is 15:00
// local by that estimate, comfortably inside 19 August either way.
const LNG_PL = 21.94
const NOW = new Date('2026-08-19T10:00:00Z')

describe('formatEventDays', () => {
  it('renders a single day as DD.MM', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', '2026-08-19T21:59:00Z', LNG_PL, NOW))
      .toBe('19.08')
  })

  it('renders a two-day event as DD–DD.MM when the month matches', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', '2026-08-20T10:00:00Z', LNG_PL, NOW))
      .toBe('19–20.08')
  })

  it('spells out both sides when the month changes', () => {
    expect(formatEventDays('2026-08-30T14:00:00Z', '2026-09-01T10:00:00Z', LNG_PL, NOW))
      .toBe('30.08–01.09')
  })

  it('appends the year when the event is not in the current year', () => {
    expect(formatEventDays('2027-08-19T14:00:00Z', '2027-08-19T21:00:00Z', LNG_PL, NOW))
      .toBe('19.08.2027')
  })

  it('spells out both years when the event crosses new year', () => {
    expect(formatEventDays('2026-12-31T20:00:00Z', '2027-01-01T03:00:00Z', LNG_PL, NOW))
      .toBe('31.12.2026–01.01.2027')
  })

  it('appends the year to a multi-day range not in the current year', () => {
    expect(formatEventDays('2027-08-19T14:00:00Z', '2027-08-20T10:00:00Z', LNG_PL, NOW))
      .toBe('19–20.08.2027')
  })

  it('uses the longitude offset, not UTC, to pick the day', () => {
    // 23:30Z on the 18th is 01:30 on the 19th in a +2h zone (lng 30).
    expect(formatEventDays('2026-08-18T23:30:00Z', '2026-08-19T02:00:00Z', 30, NOW))
      .toBe('19.08')
  })

  it('uses a negative longitude offset to pick the earlier local day', () => {
    // Tenerife, lng ≈ -16.6 → round(-16.6/15) = -1h. 00:30Z on the 19th is
    // still 23:30 on the 18th one hour to the west.
    expect(formatEventDays('2026-08-19T00:30:00Z', '2026-08-19T00:45:00Z', -16.6, NOW))
      .toBe('18.08')
  })

  it('falls back to UTC (no offset) when lng is not finite', () => {
    // At the same instant, the LNG_PL case above uses a +1h offset that
    // would push this into the 20th. A NaN longitude must not do that.
    expect(formatEventDays('2026-08-19T23:30:00Z', '2026-08-19T23:45:00Z', NaN, NOW))
      .toBe('19.08')
  })

  it('applies no offset for a longitude of exactly zero', () => {
    expect(formatEventDays('2026-08-19T23:30:00Z', '2026-08-19T23:45:00Z', 0, NOW))
      .toBe('19.08')
  })

  it('collapses to the start day when end is before start in the same month', () => {
    expect(formatEventDays('2026-08-20T10:00:00Z', '2026-08-19T10:00:00Z', LNG_PL, NOW))
      .toBe('20.08')
  })

  it('collapses to the start day when end is before start across a year boundary', () => {
    expect(formatEventDays('2027-01-01T03:00:00Z', '2026-12-31T20:00:00Z', LNG_PL, NOW))
      .toBe('01.01.2027')
  })

  it('collapses to the start day when end is unparseable but start is valid', () => {
    expect(formatEventDays('2026-08-19T14:00:00Z', 'not-a-date', LNG_PL, NOW))
      .toBe('19.08')
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatEventDays('not-a-date', 'not-a-date', LNG_PL, NOW)).toBe('')
  })
})

describe('excerpt', () => {
  it('collapses newlines and runs of spaces into single spaces', () => {
    expect(excerpt('Wydarzenie bezpłatne.\n\nKreatywna   Środa')).toBe('Wydarzenie bezpłatne. Kreatywna Środa')
  })

  it('returns an empty string for null', () => {
    expect(excerpt(null)).toBe('')
  })

  it('leaves text at or under the limit untouched', () => {
    const text = 'a'.repeat(OG_DESCRIPTION_CHARS)
    expect(excerpt(text)).toBe(text)
  })

  it('cuts on a word boundary and marks the cut', () => {
    const text = `${'ab '.repeat(120)}end`
    const out = excerpt(text, 20)
    expect(out).toBe('ab ab ab ab ab ab…')
    expect(out.length).toBeLessThanOrEqual(21)
  })

  it('cuts hard when backing off to a space would eat most of the excerpt', () => {
    // One long unbroken token: the only space sits at index 2, far below the
    // 60% floor, so a word-boundary cut would leave almost nothing.
    expect(excerpt(`ab ${'x'.repeat(100)}`, 20)).toBe('ab xxxxxxxxxxxxxxxxx…')
  })

  it('does not extend past the limit to finish a URL', () => {
    // Unlike truncateDescription in text.ts, which deliberately does.
    const out = excerpt(`start https://example.com/${'a'.repeat(200)}`, 30)
    expect(out.length).toBeLessThanOrEqual(31)
  })

  it('does not split a surrogate pair when cutting hard', () => {
    // The hard-cut branch: 'ab ' + 16 x's puts the limit right on the emoji's
    // leading surrogate, which a plain slice(0, limit) would sever.
    const out = excerpt(`ab ${'x'.repeat(16)}🎉${'y'.repeat(50)}`, 20)
    expect(out).toBe('ab xxxxxxxxxxxxxxxx…')
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
  })

  it('collapses a real scraped description as the app will encounter it', () => {
    const text = 'Wydarzenie bezpłatne.\n\nKreatywna Środa z MCK - LETNIA DYSKOTEKA DLA DZIECI Wakacje trwają, więc czas na kolejną Kreatywną Środę z MCK! Tym razem zapraszamy wszystkie dzieci na Letnią Dyskotekę – będzie muzyka, taniec, mnóstwo ruchu i świetnej zabawy\n\nLink do wydarzenia: https://kultura.boguchwala.pl/3-miejskie-centrum-kultury-w-boguchwale/15-aktualnosci/1423-kreatywna-sroda-dyskoteka-dla-dzieci.html'
    expect(excerpt(text)).toBe('Wydarzenie bezpłatne. Kreatywna Środa z MCK - LETNIA DYSKOTEKA DLA DZIECI Wakacje trwają, więc czas na kolejną Kreatywną Środę z MCK! Tym razem zapraszamy wszystkie dzieci na Letnią Dyskotekę –…')
  })
})

const BASE: OgEvent = {
  title: 'Kreatywna Środa-DYSKOTEKA DLA DZIECI',
  description: 'Wydarzenie bezpłatne.\n\nKreatywna Środa z MCK.',
  place_name: 'MCK Boguchwala, Boguchwala',
  lng: 21.94,
  start_time: '2026-08-19T14:00:00Z',
  end_time: '2026-08-19T21:59:00Z',
  photos: ['https://example.com/a.jpg'],
}
const URL_ = 'https://meuwe.eu/?event=380a9df3-d10a-4e17-b307-427bb9828a0c'
const NOW_ = new Date('2026-08-19T10:00:00Z')

describe('buildOgPreview', () => {
  it('uses the event title and the first photo', () => {
    const og = buildOgPreview(BASE, URL_, NOW_)
    expect(og.title).toBe('Kreatywna Środa-DYSKOTEKA DLA DZIECI')
    expect(og.image).toBe('https://example.com/a.jpg')
    expect(og.url).toBe(URL_)
  })

  it('joins place, day and description', () => {
    expect(buildOgPreview(BASE, URL_, NOW_).description)
      .toBe('MCK Boguchwala, Boguchwala · 19.08 — Wydarzenie bezpłatne. Kreatywna Środa z MCK.')
  })

  it('drops the place when the event has none', () => {
    expect(buildOgPreview({ ...BASE, place_name: null }, URL_, NOW_).description)
      .toBe('19.08 — Wydarzenie bezpłatne. Kreatywna Środa z MCK.')
  })

  it('drops the dash when the event has no description', () => {
    expect(buildOgPreview({ ...BASE, description: null }, URL_, NOW_).description)
      .toBe('MCK Boguchwala, Boguchwala · 19.08')
  })

  it('reports no image when photos is null, so the static banner survives', () => {
    expect(buildOgPreview({ ...BASE, photos: null }, URL_, NOW_).image).toBeNull()
  })

  it('reports no image when photos is empty', () => {
    expect(buildOgPreview({ ...BASE, photos: [] }, URL_, NOW_).image).toBeNull()
  })

  it('skips photo entries that are not absolute http(s) URLs', () => {
    expect(buildOgPreview({ ...BASE, photos: ['javascript:alert(1)', 'https://ok.example/b.jpg'] }, URL_, NOW_).image)
      .toBe('https://ok.example/b.jpg')
  })

  it('accepts a real production photo URL with encoded spaces and unicode', () => {
    const photo = 'https://kultura.boguchwala.pl/static/img/k01/MCK%20zdj%C4%99cia%20Edyta/min/Dyskoteka.jpg'
    expect(buildOgPreview({ ...BASE, photos: [photo] }, URL_, NOW_).image).toBe(photo)
  })

  it('skips a scheme-only entry in favour of a later real photo', () => {
    expect(buildOgPreview({ ...BASE, photos: ['https://', 'https://ok.example/b.jpg'] }, URL_, NOW_).image)
      .toBe('https://ok.example/b.jpg')
  })

  it('reports no image when the only entry is scheme-only', () => {
    expect(buildOgPreview({ ...BASE, photos: ['https://'] }, URL_, NOW_).image).toBeNull()
  })

  it('accepts a plain http photo, since scraped municipal sites are often http-only', () => {
    expect(buildOgPreview({ ...BASE, photos: ['http://example.com/a.jpg'] }, URL_, NOW_).image)
      .toBe('http://example.com/a.jpg')
  })

  it('reports the https photo as imageSecure too', () => {
    expect(buildOgPreview(BASE, URL_, NOW_).imageSecure).toBe('https://example.com/a.jpg')
  })

  it('reports no imageSecure for a plain http photo, since it would be mixed content', () => {
    expect(buildOgPreview({ ...BASE, photos: ['http://example.com/a.jpg'] }, URL_, NOW_).imageSecure)
      .toBeNull()
  })

  it('falls back to the site name when the title is blank', () => {
    expect(buildOgPreview({ ...BASE, title: '   ' }, URL_, NOW_).title).toBe('meuwe')
  })

  it('collapses newlines in the title, same as the description', () => {
    expect(buildOgPreview({ ...BASE, title: 'Line one\nLine two' }, URL_, NOW_).title)
      .toBe('Line one Line two')
  })

  it('caps an oversized place name so it cannot blow the description past the OG bound', () => {
    const place_name = 'M '.repeat(200).trim() // 399 chars, far past any reasonable head
    const og = buildOgPreview({ ...BASE, place_name }, URL_, NOW_)
    // Loose enough not to pin the exact composition, tight enough that an
    // unbounded place_name (which alone would add 399 chars) fails it.
    expect(og.description.length).toBeLessThanOrEqual(OG_PLACE_CHARS + OG_DESCRIPTION_CHARS)
    expect(og.description.startsWith('M M M')).toBe(true)
  })

  it('yields an empty description when dates, place and description are all missing, as a deliberate choice', () => {
    expect(buildOgPreview({ ...BASE, start_time: 'not-a-date', end_time: 'not-a-date', place_name: null, description: null }, URL_, NOW_).description)
      .toBe('')
  })
})
