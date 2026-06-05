import { describe, it, expect } from 'vitest';
import { parseMonth, buildDate, parseFecha, extractEvents } from './adeje.ts';

const ref = new Date('2026-06-01T00:00:00');

describe('parseMonth', () => {
  it('parses abbreviated and full Spanish months', () => {
    expect(parseMonth('jun')).toBe(6);
    expect(parseMonth('Diciembre')).toBe(12);
    expect(parseMonth('zzz')).toBeNull();
  });
});

describe('buildDate', () => {
  it('infers the year and honours an explicit one', () => {
    expect(buildDate(8, 6, ref)).toBe('2026-06-08');
    expect(buildDate(3, 2, ref)).toBe('2027-02-03');        // February passed → next year
    expect(buildDate(8, 7, ref, 2026)).toBe('2026-07-08');
  });
});

describe('parseFecha', () => {
  it('takes the start day of a range and the month (with optional year)', () => {
    expect(parseFecha('4-8', 'jun', ref)).toBe('2026-06-04');
    expect(parseFecha('8', 'jun 2026', ref)).toBe('2026-06-08');
    expect(parseFecha('9-13', 'jul', ref)).toBe('2026-07-09');
    expect(parseFecha('', 'jun', ref)).toBeNull();
  });
});

const HTML = `
<div class="VistaAgendaLista">
  <div class="VistaAgendaListaItem" id="VistaAgendaListaItem1">
    <div class="VistaAgendaListaFecha"><span class="fechacirculodia">4-8</span><br><span class="fechacirculomes">jun</span></div>
    <div class="VistaAgendaListaImagen"><a href="https://www.adeje.es/evento/25766"><img src="https://www.adeje.es/website/contenido/default/E25766.jpg"></a></div>
    <div class="VistaAgendaListaDatos">
      <div class="VistaAgendaListaDatosTitulo"><a href="https://www.adeje.es/evento/25766">CuarenTour Viaje Cultura Ribeira Sacra</a></div>
      <div class="VistaAgendaListaDatosLugar">&nbsp;</div>
      <div class="VistaAgendaListaDatosDescripcion"><p>Desde Participaci&oacute;n Ciudadana.</p></div>
    </div>
  </div>
  <!-- duplicate of the same event in another view style -->
  <div class="VistaAgendaListaItem" id="VistaAgendaListaItem1b">
    <div class="VistaAgendaListaFecha"><span class="fechacirculodia">4-8</span><br><span class="fechacirculomes">jun</span></div>
    <div class="VistaAgendaListaDatosTitulo"><a href="https://www.adeje.es/evento/25766">CuarenTour Viaje Cultura Ribeira Sacra</a></div>
  </div>
  <div class="VistaAgendaListaItem" id="VistaAgendaListaItem2">
    <div class="VistaAgendaListaFecha"><span class="fechacirculodia">9</span><br><span class="fechacirculomes">jul 2026</span></div>
    <div class="VistaAgendaListaDatosTitulo"><a href="https://www.adeje.es/evento/25800">Segunda Feria del Pollo</a></div>
    <div class="VistaAgendaListaDatosLugar">Plaza de España</div>
  </div>
</div>`;

describe('extractEvents', () => {
  it('parses cards and dedupes repeated items by event id', () => {
    const ev = extractEvents(HTML, ref);
    expect(ev).toHaveLength(2);

    expect(ev[0]).toEqual({
      id: '25766',
      title: 'CuarenTour Viaje Cultura Ribeira Sacra',
      date: '2026-06-04',
      venueName: '',                                         // &nbsp; → empty
      description: 'Desde Participación Ciudadana.',
      imageUrl: 'https://www.adeje.es/website/contenido/default/E25766.jpg',
    });

    expect(ev[1].id).toBe('25800');
    expect(ev[1].date).toBe('2026-07-09');                   // explicit year from "jul 2026"
    expect(ev[1].venueName).toBe('Plaza de España');
  });
});
