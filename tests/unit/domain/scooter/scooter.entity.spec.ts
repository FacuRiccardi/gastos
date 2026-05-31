import { describe, expect, test } from 'vitest';
import { Scooter } from '../../../../src/domain/scooter/scooter.entity.js';
import { BatteryLevel } from '../../../../src/domain/scooter/value-objects/battery-level.vo.js';
import { Location } from '../../../../src/domain/scooter/value-objects/location.vo.js';
import { ScooterStatus } from '../../../../src/domain/scooter/value-objects/scooter-status.vo.js';
import { DomainError } from '../../../../src/domain/errors.js';

describe('Scooter', () => {
  test('create a valid Scooter', () => {
    const scooter = Scooter.create();
    // Check if the ID is a valid UUID v4
    expect(scooter.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    expect(scooter.batteryLevel).toBeInstanceOf(BatteryLevel);
    expect(scooter.location).toBeInstanceOf(Location);

    expect(scooter.batteryLevel.percentage).toBe(100);
    expect(scooter.location.latitude).toBe(0);
    expect(scooter.location.longitude).toBe(0);
    expect(scooter.status).toBe(ScooterStatus.Available);
  });

  test('reconstruct a valid Scooter', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const batteryLevel = new BatteryLevel(75);
    const location = new Location(40.7128, -74.0060);
    const status = ScooterStatus.InUse;

    const scooter = Scooter.reconstitute(id, batteryLevel, location, status);

    expect(scooter.id).toBe(id);

    expect(scooter.batteryLevel).toBeInstanceOf(BatteryLevel);
    expect(scooter.location).toBeInstanceOf(Location);

    expect(scooter.batteryLevel.percentage).toBe(batteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(batteryLevel.isLow);
    expect(scooter.location.latitude).toBe(location.latitude);
    expect(scooter.location.longitude).toBe(location.longitude);
    expect(scooter.status).toBe(status);
  });

  test('update scooter location', () => {
    const scooter = Scooter.create();
    const newLocation = new Location(34.0522, -118.2437);
    scooter.setLocation(newLocation);

    expect(scooter.location.latitude).toBe(newLocation.latitude);
    expect(scooter.location.longitude).toBe(newLocation.longitude);
  });
  
  test('update scooter battery level', () => {
    const scooter = Scooter.create();
    const newBatteryLevel = new BatteryLevel(50);
    scooter.setBatteryLevel(newBatteryLevel);

    expect(scooter.batteryLevel.percentage).toBe(newBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(newBatteryLevel.isLow);
  });

  test('when battery level is updated to low, status should change to LowBattery', () => {
    const scooter = Scooter.create();
    const newBatteryLevel = new BatteryLevel(15);
    scooter.setBatteryLevel(newBatteryLevel);

    expect(scooter.batteryLevel.percentage).toBe(newBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(true);
    expect(scooter.status).toBe(ScooterStatus.LowBattery);
  });

  test('when battery level is updated from low to normal, status should change from LowBattery to Available', () => {
    const scooter = Scooter.create();
    const lowBatteryLevel = new BatteryLevel(15);
    scooter.setBatteryLevel(lowBatteryLevel);

    expect(scooter.batteryLevel.percentage).toBe(lowBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(true);
    expect(scooter.status).toBe(ScooterStatus.LowBattery);

    const normalBatteryLevel = new BatteryLevel(50);
    scooter.setBatteryLevel(normalBatteryLevel);

    expect(scooter.batteryLevel.percentage).toBe(normalBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(false);
    expect(scooter.status).toBe(ScooterStatus.Available);
  });

  test('update scooter status', () => {
    const scooter = Scooter.create();
    scooter.setStatus(ScooterStatus.Maintenance);

    expect(scooter.status).toBe(ScooterStatus.Maintenance);
  });

  test('rental availability should return true for available scooter', () => {
    const scooter = Scooter.create();

    expect(scooter.isAvailableForRental()).toBe(true);
  });

  test('rental availability should return false for in-use scooter', () => {
    const scooter = Scooter.create();
    scooter.setStatus(ScooterStatus.InUse);

    expect(scooter.isAvailableForRental()).toBe(false);
  });

  test('rental availability should return false for low battery scooter', () => {
    const scooter = Scooter.create();
    scooter.setBatteryLevel(new BatteryLevel(15)); // Low battery level

    expect(scooter.isAvailableForRental()).toBe(false);
  });

  test('rental availability should return false for maintenance scooter', () => {
    const scooter = Scooter.create();
    scooter.setStatus(ScooterStatus.Maintenance);

    expect(scooter.isAvailableForRental()).toBe(false);
  });

  test('new telemetry data is updated correctly', () => {
    const scooter = Scooter.create();
    const newLocation = new Location(34.0522, -118.2437);
    const newBatteryLevel = new BatteryLevel(50);

    scooter.telemetryUpdate(newLocation, newBatteryLevel);
    
    expect(scooter.location.latitude).toBe(newLocation.latitude);
    expect(scooter.location.longitude).toBe(newLocation.longitude);
    expect(scooter.batteryLevel.percentage).toBe(newBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(newBatteryLevel.isLow);
    expect(scooter.status).toBe(ScooterStatus.Available); // Status should remain unchanged
  });

  test('new telemetry data with low battery is updated correctly and it changes the status to LowBattery', () => {
    const scooter = Scooter.create();
    const newLocation = new Location(34.0522, -118.2437);
    const newBatteryLevel = new BatteryLevel(15);

    scooter.telemetryUpdate(newLocation, newBatteryLevel);
    
    expect(scooter.location.latitude).toBe(newLocation.latitude);
    expect(scooter.location.longitude).toBe(newLocation.longitude);
    expect(scooter.batteryLevel.percentage).toBe(newBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(newBatteryLevel.isLow);
    expect(scooter.status).toBe(ScooterStatus.LowBattery);
  });

  test('new telemetry data with normal battery is updated correctly and it changes the status to Available', () => {
    const scooter = Scooter.create();
    scooter.setBatteryLevel(new BatteryLevel(15));
    expect(scooter.status).toBe(ScooterStatus.LowBattery);

    const newLocation = new Location(34.0522, -118.2437);
    const normalBatteryLevel = new BatteryLevel(50);
    scooter.telemetryUpdate(newLocation, normalBatteryLevel);

    expect(scooter.batteryLevel.percentage).toBe(normalBatteryLevel.percentage);
    expect(scooter.batteryLevel.isLow).toBe(normalBatteryLevel.isLow);
    expect(scooter.status).toBe(ScooterStatus.Available);
  });

  test('start rental process and check if scooter is available for rental', () => {
    const scooter = Scooter.create();

    scooter.startRental();
    expect(scooter.isAvailableForRental()).toBe(false);
    expect(scooter.status).toBe(ScooterStatus.InUse);
  });

  test('trying to start a rental process with a rented scooter throws a DomainError', () => {
    const scooter = Scooter.create();
    scooter.setStatus(ScooterStatus.InUse);

    expect(() => scooter.startRental()).toThrow(DomainError);
  });

  test('trying to start a rental process with a low battery scooter throws a DomainError', () => {
    const scooter = Scooter.create();
    scooter.setBatteryLevel(new BatteryLevel(15));

    expect(() => scooter.startRental()).toThrow(DomainError);
  });

  test('trying to start a rental process with a scooter under maintenance throws a DomainError', () => {
    const scooter = Scooter.create();
    scooter.setStatus(ScooterStatus.Maintenance);

    expect(() => scooter.startRental()).toThrow(DomainError);
  });

  test('telemetry update during rental should not change the status from InUse', () => {
    const scooter = Scooter.create();

    scooter.startRental();
    expect(scooter.isAvailableForRental()).toBe(false);
    expect(scooter.status).toBe(ScooterStatus.InUse);

    scooter.telemetryUpdate(new Location(34.0522, -118.2437), new BatteryLevel(15));
    expect(scooter.status).toBe(ScooterStatus.InUse);
  });
});
