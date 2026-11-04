import { describe, it, expect } from 'vitest';
import { merchantKey as backendKey } from '../src/merchant.js';
import { merchantKey as webKey } from '../web/src/merchants/merchantKey.ts';

// The web app and the ingestion service must build the same dictionary key for every merchant name,
// or a category chosen in the web would never be found when a new purchase arrives.
const CASES = [
  ['Spotify P47A11CB7B', 'spotify'],
  ['RECARGAS EJEMPLO', 'recargas-ejemplo'],
  ['Café Martínez', 'cafe-martinez'],
  ['CAFÉ  MARTÍNEZ', 'cafe-martinez'],
  ['  Kiosco   24 Horas ', 'kiosco-horas'],
  ['MERCADO*PAGO-ejemplo', 'mercado-pago-ejemplo'],
  ['Farmacia & Perfumería', 'farmacia-perfumeria'],
  ['Ñandú Ñoño', 'nandu-nono'],
  ['12345 678', ''],
  ['', ''],
  ['   ', ''],
  ['***', ''],
  ['Super 3B Norte', 'super-norte'],
];

describe('merchantKey: backend (src/merchant.js)', () => {
  it.each(CASES)('%j -> %j', (name, key) => {
    expect(backendKey(name)).toBe(key);
  });

  it('cuts the key at 100 characters', () => {
    expect(backendKey('a'.repeat(150))).toHaveLength(100);
  });

  it('treats a missing name as empty text', () => {
    expect(backendKey(undefined)).toBe('');
    expect(backendKey(null)).toBe('');
  });
});

describe('merchantKey: web and backend twins', () => {
  it.each(CASES)('give the same key for %j', (name) => {
    expect(backendKey(name)).toBe(webKey(name));
  });

  it('give the same key for long text', () => {
    const long = 'palabra '.repeat(40);
    expect(backendKey(long)).toBe(webKey(long));
  });
});
