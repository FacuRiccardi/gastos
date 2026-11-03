import { describe, it, expect } from 'vitest';
import { findLabelId } from '../src/labels.js';

const labels = [
  { id: 'INBOX', name: 'INBOX' },
  { id: 'Label_8472913650123456789', name: 'Gastos BBVA' },
  { id: 'Label_2', name: 'Other' },
];

describe('findLabelId', () => {
  it('returns the id of the label with that exact name', () => {
    expect(findLabelId(labels, 'Gastos BBVA')).toBe('Label_8472913650123456789');
  });

  it('throws listing the available names when the label does not exist', () => {
    expect(() => findLabelId(labels, 'Missing')).toThrow(/Missing.*Gastos BBVA/s);
  });
});
