import { describe, it, expect } from 'vitest';
import { levelFor } from '../src/capLevel.js';

describe('levelFor', () => {
  it.each([
    [0, null],
    [49.99, null],
    [50, 50],
    [74.99, 50],
    [75, 75],
    [99.99, 75],
    [100, 100],
    [109.99, 100],
    [110, 110],
    [125, 120],
  ])('%s%% -> %s', (percent, level) => {
    expect(levelFor(percent)).toBe(level);
  });

  it('absorbs float error', () => {
    expect(levelFor((2900 * 100) / 1000)).toBe(290);
  });
});
