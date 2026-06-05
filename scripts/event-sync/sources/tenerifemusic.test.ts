import { describe, it, expect } from 'vitest';
import {
  slugify,
  extractItemListEvents,
  schemaEventToRaw,
  type SchemaEvent,
} from './tenerifemusic.ts';

describe('slugify', () => {
  it('strips diacritics and punctuation', () => {
    expect(slugify('Sergio Dalma: ¡Vía Dalma!')).toBe('sergio-dalma-via-dalma');
    expect(slugify('  Rod Stewart & Tina Turner  ')).toBe('rod-stewart-tina-turner');
  });
});

const ITEMLIST_HTML = `
<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"x"}</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"ItemList","itemListElement":[
  {"@type":"Event","name":"Marta Klimasara","startDate":"2026-06-06T20:00:00.000Z",
   "location":{"@type":"Place","name":"Auditorio de Tenerife","address":{"addressLocality":"Santa Cruz de Tenerife","addressCountry":"ES"}},
   "url":"https://x/e1","image":["https://x/1.jpg"]},
  {"@type":"Event","name":"Rod Stewart Tribute","startDate":"2026-06-06T00:00:00.000Z",
   "location":{"@type":"Place","name":"Auditorio Infanta Leonor","address":{"addressLocality":"Los Cristianos"}}}
]}
</script>
</head></html>`;

describe('extractItemListEvents', () => {
  it('pulls only Event nodes from the ItemList blob', () => {
    const evs = extractItemListEvents(ITEMLIST_HTML);
    expect(evs).toHaveLength(2);
    expect(evs[0].name).toBe('Marta Klimasara');
  });

  it('returns empty when there is no ItemList', () => {
    expect(extractItemListEvents('<html></html>')).toEqual([]);
  });
});

describe('schemaEventToRaw', () => {
  it('maps a full schema.org Event into a RawEvent', () => {
    const ev = extractItemListEvents(ITEMLIST_HTML)[0];
    const r = schemaEventToRaw(ev, 'tenerifemusic')!;
    expect(r.externalId).toBe('tenerifemusic:2026-06-06:marta-klimasara');
    expect(r.title).toBe('Marta Klimasara');
    expect(r.date).toBe('2026-06-06');
    expect(r.startHour).toBe('20:00');               // local event time, kept as-is
    expect(r.venueName).toBe('Auditorio de Tenerife');
    expect(r.city).toBe('Santa Cruz de Tenerife');
    expect(r.country).toBe('ES');
    expect(r.categories).toEqual(['música']);
    expect(r.imageUrl).toBe('https://x/1.jpg');
  });

  it('nulls the hour for a midnight (date-only) start and defaults country', () => {
    const ev = extractItemListEvents(ITEMLIST_HTML)[1];
    const r = schemaEventToRaw(ev, 'tenerifemusic')!;
    expect(r.startHour).toBeNull();
    expect(r.city).toBe('Los Cristianos');
    expect(r.country).toBe('ES');                    // addressCountry missing → default
    expect(r.imageUrl).toBeUndefined();
  });

  it('returns null when name or date is missing', () => {
    expect(schemaEventToRaw({ '@type': 'Event', startDate: '2026-06-06' } as SchemaEvent, 'x')).toBeNull();
    expect(schemaEventToRaw({ '@type': 'Event', name: 'No date' } as SchemaEvent, 'x')).toBeNull();
  });
});
