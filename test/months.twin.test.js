import { describe, it, expect } from 'vitest';
import * as backend from '../src/months.js';
import * as web from '../web/src/data/months.ts';

const INSTANTS = [
  ['2026-11-01T02:59:59Z', '2026-10'],
  ['2026-11-01T03:00:00Z', '2026-11'],
  ['2027-01-01T02:00:00Z', '2026-12'],
];

const EXISTING = ['2026-09', '2026-11', '2026-07'];
const INHERIT = [
  [EXISTING, '2026-12', '2026-11'],
  [EXISTING, '2026-10', '2026-09'],
  [EXISTING, '2026-07', null],
  [[], '2026-01', null],
];

const IMPLEMENTATIONS = [
  ['backend (src/months.js)', backend],
  ['web (web/src/data/months.ts)', web],
];

describe.each(IMPLEMENTATIONS)('months: %s', (_name, impl) => {
  it('takes the month from a calendar day', () => {
    expect(impl.monthOfDay('2026-10-31')).toBe('2026-10');
  });

  it.each(INSTANTS)('monthOfInstant(%s) -> %s', (iso, month) => {
    expect(impl.monthOfInstant(new Date(iso))).toBe(month);
  });

  it.each(INHERIT)('inheritSource(%j, %s) -> %j', (existing, target, source) => {
    expect(impl.inheritSource(existing, target)).toBe(source);
  });

  it('does not modify the list it receives', () => {
    const list = [...EXISTING];
    impl.inheritSource(list, '2026-12');
    expect(list).toEqual(EXISTING);
  });
});

describe('months: web and backend twins', () => {
  it.each(INSTANTS)('give the same month for %s', (iso) => {
    expect(backend.monthOfInstant(new Date(iso))).toBe(web.monthOfInstant(new Date(iso)));
  });

  it.each(INHERIT)('give the same source for %j and %s', (existing, target) => {
    expect(backend.inheritSource(existing, target)).toBe(web.inheritSource(existing, target));
  });

  it('give the same month for a calendar day', () => {
    expect(backend.monthOfDay('2026-10-31')).toBe(web.monthOfDay('2026-10-31'));
  });
});
