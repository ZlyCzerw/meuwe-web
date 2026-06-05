import { describe, it, expect } from 'vitest';
import {
  toIso,
  parseRomeriaEntry,
  slugify,
  extractEntries,
} from './romerias.ts';

describe('toIso', () => {
  it('builds an ISO date and rejects out-of-range values', () => {
    expect(toIso('16', '01', '2026')).toBe('2026-01-16');
    expect(toIso('5', '4', '2026')).toBe('2026-04-05');
    expect(toIso('00', '01', '2026')).toBeNull();
    expect(toIso('16', '13', '2026')).toBeNull();
  });
});

describe('parseRomeriaEntry', () => {
  it('parses "DD/MM/YYYY <Title> – <Municipality>"', () => {
    const e = parseRomeriaEntry('16/01/2026 Baile de Magos de Arona – Arona')!;
    expect(e).toEqual({ date: '2026-01-16', title: 'Baile de Magos de Arona', city: 'Arona' });
  });

  it('handles a plain hyphen and extra whitespace', () => {
    const e = parseRomeriaEntry('  18/01/2026   Romería de Tigaiga - Los Realejos ')!;
    expect(e).toEqual({ date: '2026-01-18', title: 'Romería de Tigaiga', city: 'Los Realejos' });
  });

  it('returns null for a non-entry line', () => {
    expect(parseRomeriaEntry('ENERO')).toBeNull();
    expect(parseRomeriaEntry('Este año habrá muchas romerías.')).toBeNull();
  });
});

describe('slugify', () => {
  it('strips diacritics and punctuation', () => {
    expect(slugify('Romería de Güímar')).toBe('romeria-de-guimar');
  });
});

const HTML = `
<div class="entry">
  <p>16/01/2026 Baile de Magos de Arona &#8211; Arona</p>
  <p>18/01/2026 Rom&#233;ria de Tigaiga &#8211; Los Realejos</p>
  <p>Este a&#241;o habr&#225; muchas romer&#237;as en la isla.</p>
  <p>ENERO</p>
</div>`;

describe('extractEntries', () => {
  it('extracts only the dated calendar lines', () => {
    const entries = extractEntries(HTML);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ date: '2026-01-16', title: 'Baile de Magos de Arona', city: 'Arona' });
    expect(entries[1]).toEqual({ date: '2026-01-18', title: 'Roméria de Tigaiga', city: 'Los Realejos' });
  });
});
