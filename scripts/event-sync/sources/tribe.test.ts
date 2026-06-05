import { describe, it, expect, vi, afterEach } from 'vitest';
import { stripHtml, tribeToRawEvent, fetchWithRetry, type TribeApiEvent } from './tribe.ts';

describe('fetchWithRetry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries a thrown network error and then returns the response', async () => {
    const ok = { ok: true, status: 200 } as Response;
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://x', {});
    expect(res).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry an HTTP error status (returns it as-is)', async () => {
    const notFound = { ok: false, status: 404 } as Response;
    const fetchMock = vi.fn().mockResolvedValue(notFound);
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://x', {});
    expect(res).toBe(notFound);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up and rethrows after exhausting retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('https://x', {})).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(3);   // initial + 2 retries
  });
});

describe('stripHtml', () => {
  it('removes tags and decodes entities (named + numeric)', () => {
    expect(stripHtml('<p>Banda &amp; coro</p>')).toBe('Banda & coro');
    expect(stripHtml('Jazz &#038; Blues')).toBe('Jazz & Blues');
    expect(stripHtml('  multi   space\n line ')).toBe('multi space line');
  });
});

const SAMPLE: TribeApiEvent = {
  id: 4821,
  title: 'Concierto de la Banda Municipal &#038; coro',
  description: '<p>Gran concierto en la plaza.</p>',
  url: 'https://elsauzal.es/event/concierto-banda/',
  start_date: '2026-06-13 20:30:00',
  end_date: '2026-06-13 22:00:00',
  all_day: false,
  image: { url: 'https://elsauzal.es/wp-content/uploads/concierto.jpg' },
  venue: { venue: 'Plaza del Cristo', city: 'El Sauzal', country: 'España', geo_lat: '28.47', geo_lng: '-16.42' },
  categories: [{ name: 'Música' }, { name: 'Cultura' }],
};

describe('tribeToRawEvent', () => {
  it('maps a full Tribe event into a RawEvent', () => {
    const r = tribeToRawEvent(SAMPLE, 'elsauzal')!;
    expect(r.externalId).toBe('tribe:elsauzal:4821');
    expect(r.title).toBe('Concierto de la Banda Municipal & coro');
    expect(r.description).toBe('Gran concierto en la plaza.');
    expect(r.date).toBe('2026-06-13');
    expect(r.startHour).toBe('20:30');
    expect(r.endHour).toBe('22:00');
    expect(r.venueName).toBe('Plaza del Cristo');
    expect(r.city).toBe('El Sauzal');
    expect(r.country).toBe('ES');
    expect(r.categories).toEqual(['Música', 'Cultura']);
    expect(r.sourceUrl).toBe('https://elsauzal.es/event/concierto-banda/');
    expect(r.imageUrl).toBe('https://elsauzal.es/wp-content/uploads/concierto.jpg');
  });

  it('returns null when start_date is missing', () => {
    expect(tribeToRawEvent({ ...SAMPLE, start_date: '' }, 'elsauzal')).toBeNull();
  });

  it('nulls the hours for all-day events', () => {
    const r = tribeToRawEvent({ ...SAMPLE, all_day: true }, 'elsauzal')!;
    expect(r.startHour).toBeNull();
    expect(r.endHour).toBeNull();
  });

  it('handles an empty venue array and a missing image', () => {
    const r = tribeToRawEvent({ ...SAMPLE, venue: [], image: false }, 'elsauzal')!;
    expect(r.venueName).toBe('');
    expect(r.city).toBe('');
    expect(r.imageUrl).toBeUndefined();
  });

  it('uses the municipality fallback city when the event has no venue', () => {
    const r = tribeToRawEvent({ ...SAMPLE, venue: [] }, 'candelaria', 'Candelaria')!;
    expect(r.city).toBe('Candelaria');   // → geocodes to the right town, not island centre
    expect(r.venueName).toBe('');
  });
});
