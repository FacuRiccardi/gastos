import { describe, expect, test } from 'vitest';
import { Location } from '../../../../../src/domain/scooter/value-objects/location.vo.js';
import { DomainError } from '../../../../../src/domain/errors.js';

describe('Location', () => {
  test('create a valid Location', () => {
    const location = new Location(40.7128, -74.0060);
    expect(location.latitude).toBe(40.7128);
    expect(location.longitude).toBe(-74.0060);
  });

  test('throws DomainError when latitude is out of range', () => {
    expect(() => new Location(-91, 0)).toThrow(DomainError);
    expect(() => new Location(91, 0)).toThrow(DomainError);
  });

  test('throws DomainError when longitude is out of range', () => {
    expect(() => new Location(0, -181)).toThrow(DomainError);
    expect(() => new Location(0, 181)).toThrow(DomainError);
  });

  test('create a Location with edge case latitude and longitude values', () => {
    const locationNorthPole = new Location(90, 0);
    expect(locationNorthPole.latitude).toBe(90);
    expect(locationNorthPole.longitude).toBe(0);

    const locationSouthPole = new Location(-90, 0);
    expect(locationSouthPole.latitude).toBe(-90);
    expect(locationSouthPole.longitude).toBe(0);

    const locationInternationalDateLineEast = new Location(0, 180);
    expect(locationInternationalDateLineEast.latitude).toBe(0);
    expect(locationInternationalDateLineEast.longitude).toBe(180);

    const locationInternationalDateLineWest = new Location(0, -180);
    expect(locationInternationalDateLineWest.latitude).toBe(0);
    expect(locationInternationalDateLineWest.longitude).toBe(-180);
  });
});
