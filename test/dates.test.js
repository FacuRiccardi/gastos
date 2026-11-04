import { describe, it, expect } from 'vitest';
import { buenosAiresDay, addDays } from '../src/dates.js';

describe('buenosAiresDay', () => {
  it('is still the previous day before 03:00 UTC', () => {
    expect(buenosAiresDay(new Date('2026-11-04T02:30:00Z'))).toBe('2026-11-03');
  });

  it('rolls over at 03:00 UTC', () => {
    expect(buenosAiresDay(new Date('2026-11-04T03:00:00Z'))).toBe('2026-11-04');
  });
});

describe('addDays', () => {
  it('crosses month ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('subtracts', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
