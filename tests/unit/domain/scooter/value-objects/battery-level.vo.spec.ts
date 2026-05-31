import { describe, expect, test } from 'vitest';
import { BatteryLevel } from '../../../../../src/domain/scooter/value-objects/battery-level.vo.js';
import { DomainError } from '../../../../../src/domain/errors.js';

describe('BatteryLevel', () => {
  test('create a valid BatteryLevel without Low battery level', () => {
    const batteryLevel = new BatteryLevel(75);
    expect(batteryLevel.percentage).toBe(75);
    expect(batteryLevel.isLow).toBe(false);
  });

  test('create a valid BatteryLevel with Low battery level', () => {
    const batteryLevel = new BatteryLevel(19);
    expect(batteryLevel.percentage).toBe(19);
    expect(batteryLevel.isLow).toBe(true);
  });

  test('throws DomainError when percentage is below 0', () => {
    expect(() => new BatteryLevel(-1)).toThrow(DomainError);
  });

  test('throws DomainError when percentage is above 100', () => {
    expect(() => new BatteryLevel(101)).toThrow(DomainError);
  });

  test('create a BatteryLevel with edge case percentage values', () => {
    const batteryLevelZero = new BatteryLevel(0);
    expect(batteryLevelZero.percentage).toBe(0);
    expect(batteryLevelZero.isLow).toBe(true);

    const batteryLevelHundred = new BatteryLevel(100);
    expect(batteryLevelHundred.percentage).toBe(100);
    expect(batteryLevelHundred.isLow).toBe(false);
  });
});
