import { describe, it, expect } from 'vitest';
import {
  clean,
  parseSpanishDate,
  parsePrice,
  withPaidPrefix,
  parseListing,
  parseDetail,
} from './ecoentradas.ts';

describe('clean', () => {
  it('collapses whitespace and non-breaking spaces', () => {
    expect(clean('  hola  mundo \n x ')).toBe('hola mundo x');
  });
});

describe('parseSpanishDate', () => {
  const ref = new Date('2026-06-04T00:00:00');

  it('builds an ISO date from a Spanish month name', () => {
    expect(parseSpanishDate('5', 'Junio', ref)).toBe('2026-06-05');
    expect(parseSpanishDate(' 9 ', 'Diciembre', ref)).toBe('2026-12-09');
  });

  it('rolls over to next year when the month has already passed', () => {
    expect(parseSpanishDate('10', 'Enero', ref)).toBe('2027-01-10');
  });

  it('returns null for an unknown month or bad day', () => {
    expect(parseSpanishDate('5', 'Smarch', ref)).toBeNull();
    expect(parseSpanishDate('0', 'Junio', ref)).toBeNull();
  });
});

describe('parsePrice', () => {
  it('extracts the numeric price', () => {
    expect(parsePrice('40€')).toBe(40);
    expect(parsePrice('Desde 35,50 €')).toBe(35.5);
    expect(parsePrice('Gratis')).toBeNull();
  });
});

describe('withPaidPrefix', () => {
  it('prepends the paid notice only when paid', () => {
    expect(withPaidPrefix('Synopsis', true)).toBe('EVENTO DE PAGO\n\nSynopsis');
    expect(withPaidPrefix('Synopsis', false)).toBe('Synopsis');
    expect(withPaidPrefix('', true)).toBe('EVENTO DE PAGO');
  });
});

const LISTING = `
<ul class="list-events grid effect-1" id="grid">
  <li>
    <div class="thumbnail">
      <div class="previous-container"><div class="previous hidden-xs"><h5>Theatre Properties</h5><h4>Tarz&aacute;n El Musical</h4></div></div>
      <div class="event-info">
        <h4 class="hidden-xs"><a href="https://www.ecoentradas.com/elegirsesion/3224">Tarz&aacute;n El Musical</a></h4>
        <h5><div class="island"><img src="/images/islands/ftv.png"></div> Fuerteventura <span> | <small><a href="ver-recinto/14">Palacio</a></small></span></h5>
      </div>
      <img class="event-photo" src="cartel/abc/def.jpg">
    </div>
  </li>
  <li>
    <div class="thumbnail">
      <div class="event-info">
        <h4 class="hidden-xs"><a href="https://www.ecoentradas.com/elegirsesion/3300">Concierto en La Laguna</a></h4>
        <h5><div class="island"><img src="/images/islands/tfe.png"></div> Tenerife <span> | <small><a href="ver-recinto/22">Teatro Leal</a></small></span></h5>
      </div>
      <img class="event-photo" src="https://cdn.x/img.jpg">
    </div>
  </li>
</ul>`;

describe('parseListing', () => {
  it('extracts one item per show across islands', () => {
    const items = parseListing(LISTING);
    expect(items).toHaveLength(2);

    const ftv = items[0];
    expect(ftv.id).toBe('3224');
    expect(ftv.title).toBe('Tarzán El Musical');
    expect(ftv.island).toBe('Fuerteventura');
    expect(ftv.imageUrl).toBe('https://www.ecoentradas.com/cartel/abc/def.jpg');

    const tfe = items[1];
    expect(tfe.id).toBe('3300');
    expect(tfe.island).toBe('Tenerife');
    expect(tfe.imageUrl).toBe('https://cdn.x/img.jpg');   // absolute src kept as-is
  });

  it('supports filtering to a single island', () => {
    const tenerife = parseListing(LISTING).filter(i => i.island.toLowerCase() === 'tenerife');
    expect(tenerife.map(i => i.id)).toEqual(['3300']);
  });
});

const DETAIL = `
<div class="description-eco"><p>En el Londres victoriano&nbsp;la familia Porter.</p><p>Segunda parte.</p></div>
<table class="table table-striped table-sesion"><tbody>
  <tr><td><span class="day">5</span><span class="month">Junio</span></td>
      <td><span class="dates"><i class="fa fa-clock-o"></i> 20:30 | <i class="fa fa-map-marker"></i> Teatro Leal</span></td>
      <td><span class="since">Desde</span><span class="price-sesion">40<small>€</small></span></td></tr>
  <tr><td><span class="day">6</span><span class="month">Junio</span></td>
      <td><span class="dates"><i class="fa fa-clock-o"></i> 18:00 | <i class="fa fa-map-marker"></i> Teatro Leal</span></td>
      <td><span class="since">Desde</span><span class="price-sesion">35€</span></td></tr>
</tbody></table>`;

describe('parseDetail', () => {
  const ref = new Date('2026-06-01T00:00:00');

  it('parses the synopsis and every session', () => {
    const d = parseDetail(DETAIL, ref);
    expect(d.description).toBe('En el Londres victoriano la familia Porter.\n\nSegunda parte.');
    expect(d.sessions).toHaveLength(2);

    expect(d.sessions[0]).toEqual({
      date: '2026-06-05',
      startHour: '20:30',
      venueName: 'Teatro Leal',
      price: 40,
    });
    expect(d.sessions[1]).toEqual({
      date: '2026-06-06',
      startHour: '18:00',
      venueName: 'Teatro Leal',
      price: 35,
    });
  });
});
