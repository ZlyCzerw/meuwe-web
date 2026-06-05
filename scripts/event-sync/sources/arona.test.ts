import { describe, it, expect } from 'vitest';
import {
  parseMonth,
  buildDate,
  parseFechaText,
  extractEvents,
} from './arona.ts';

const ref = new Date('2026-06-01T00:00:00');

describe('parseMonth', () => {
  it('parses full and abbreviated Spanish months', () => {
    expect(parseMonth('JUN.')).toBe(6);
    expect(parseMonth('septiembre')).toBe(9);
    expect(parseMonth('SEPT.')).toBe(9);
    expect(parseMonth('xx')).toBeNull();
  });
});

describe('buildDate', () => {
  it('infers the year for future events and rolls over past months', () => {
    expect(buildDate(5, 6, ref)).toBe('2026-06-05');
    expect(buildDate(10, 1, ref)).toBe('2027-01-10');           // January already passed → next year
    expect(buildDate(5, 6, ref, 2026)).toBe('2026-06-05');      // explicit year wins
    expect(buildDate(0, 6, ref)).toBeNull();
  });
});

describe('parseFechaText', () => {
  it('takes the start date out of a free-text range', () => {
    expect(parseFechaText('Del 11 al 29 de junio', ref)).toBe('2026-06-11');
    expect(parseFechaText('Hasta el 30 de junio', ref)).toBe('2026-06-30');
    expect(parseFechaText('5 de junio de 2026', ref)).toBe('2026-06-05');
    expect(parseFechaText('sin fecha', ref)).toBeNull();
  });
});

const HTML = `
<div class="agenda-eventos">
  <div class="agenda-evento">
    <div class="agenda-evento-dia">05</div>
    <div class="agenda-evento-mes">JUN.</div>
    <div class="agenda-evento-img"><a href="https://www.arona.org/Agenda/ctl/Ver/mid/429?id=91043"><img src="/portals/0/agenda/thumbnail/91043_00000.jpg" /></a></div>
    <div class="agenda-evento-title"><a href="https://www.arona.org/Agenda/ctl/Ver/mid/429?id=91043">Concierto en Los Cristianos</a></div>
  </div>
  <div class="item"><div class="agenda-evento-destacado">
    <div class="agenda-evento-destacado-img"><a href="https://www.arona.org/Agenda/ctl/Grupo/mid/429?id=1842"><img src="/portals/0/agenda/thumbnail/G1842.jpg" /></a></div>
    <div class="agenda-evento-destacado-fecha">Del 11 al 29 de junio</div>
    <div class="agenda-evento-destacado-titulo">Muestra Bibliogr&aacute;fica Hermano Pedro</div>
    <a href="https://www.arona.org/Agenda/ctl/Grupo/mid/429?id=1842">M&aacute;s informaci&oacute;n</a>
  </div></div>
</div>`;

describe('extractEvents', () => {
  it('parses both the regular and featured card layouts', () => {
    const ev = extractEvents(HTML, ref);
    expect(ev).toHaveLength(2);

    expect(ev[0]).toEqual({
      id: '91043',
      title: 'Concierto en Los Cristianos',
      date: '2026-06-05',
      imageUrl: 'https://www.arona.org/portals/0/agenda/thumbnail/91043_00000.jpg',
      sourceUrl: 'https://www.arona.org/Agenda/ctl/Ver/mid/429?id=91043',
    });

    expect(ev[1]).toEqual({
      id: '1842',
      title: 'Muestra Bibliográfica Hermano Pedro',
      date: '2026-06-11',                                   // start of the range
      imageUrl: 'https://www.arona.org/portals/0/agenda/thumbnail/G1842.jpg',
      sourceUrl: 'https://www.arona.org/Agenda/ctl/Grupo/mid/429?id=1842',
    });
  });
});
