import { describe, it, expect, vi } from 'vitest';
import { createCapAlerts } from '../src/capAlerts.js';

const at = (day) => new Date(`${day}T15:00:00Z`);
const exp = (day, amount, extra = {}) => ({
  purchaseDate: at(day),
  amount,
  currency: 'ARS',
  cardLast4: '1111',
  cardType: 'credit',
  ...extra,
});

function setup({ expenses = [], caps = { '2026-11': 1000 }, rates = {} } = {}) {
  const ctx = {
    expenses,
    accounts: [{ id: 'a' }],
    cards: [{ last4: '1111', type: 'credit', accountId: 'a' }],
    cycles: [
      { accountId: 'a', closingDate: '2026-10-05' },
      { accountId: 'a', closingDate: '2026-11-05' },
    ],
    rates,
    caps,
  };
  const last = {};
  const store = {
    getCapContext: vi.fn(async () => ctx),
    raiseCapAlert: vi.fn(async (month, { level }) => {
      if (last[month] !== undefined && level <= last[month]) return false;
      last[month] = level;
      return true;
    }),
  };
  const notifier = { notifyLevel: vi.fn().mockResolvedValue() };
  const logger = { info: vi.fn(), error: vi.fn() };
  const capAlerts = createCapAlerts({ store, notifier, logger, now: () => new Date('2026-11-04T15:00:00Z') });
  return { ctx, last, store, notifier, logger, capAlerts };
}

describe('createCapAlerts', () => {
  it('announces only the highest level reached', async () => {
    const { store, notifier, capAlerts } = setup({ expenses: [exp('2026-10-20', 800)] });
    const r = await capAlerts.check();
    expect(store.raiseCapAlert).toHaveBeenCalledTimes(1);
    expect(store.raiseCapAlert).toHaveBeenCalledWith('2026-11', { level: 75, total: 800, cap: 1000 });
    expect(notifier.notifyLevel).toHaveBeenCalledTimes(1);
    expect(notifier.notifyLevel).toHaveBeenCalledWith(75);
    expect(r).toEqual({ level: 75, announced: true });
  });

  it('does not announce twice', async () => {
    const { notifier, capAlerts } = setup({ expenses: [exp('2026-10-20', 800)] });
    await capAlerts.check();
    const r = await capAlerts.check();
    expect(r.announced).toBe(false);
    expect(notifier.notifyLevel).toHaveBeenCalledTimes(1);
  });

  it('keeps the level when the total drops', async () => {
    const { ctx, last, notifier, capAlerts } = setup({ expenses: [exp('2026-10-20', 1000), exp('2026-10-21', 50)] });
    await capAlerts.check();
    ctx.expenses.pop();
    ctx.expenses[0] = exp('2026-10-20', 600);
    await capAlerts.check();
    expect(notifier.notifyLevel).toHaveBeenCalledTimes(1);
    expect(last['2026-11']).toBe(100);
  });

  it('does not re-announce when the cap is raised with the same spend', async () => {
    const { ctx, notifier, capAlerts } = setup({ expenses: [exp('2026-10-20', 800)] });
    await capAlerts.check();
    ctx.caps = { '2026-11': 2000 };
    await capAlerts.check();
    expect(notifier.notifyLevel).toHaveBeenCalledTimes(1);
  });

  it('announces again when a lowered cap pushes the spend higher', async () => {
    const { ctx, notifier, capAlerts } = setup({ expenses: [exp('2026-10-20', 650)] });
    await capAlerts.check();
    ctx.caps = { '2026-11': 500 };
    await capAlerts.check();
    expect(notifier.notifyLevel).toHaveBeenCalledTimes(2);
    expect(notifier.notifyLevel).toHaveBeenLastCalledWith(130);
  });

  it('does nothing without a cap', async () => {
    const { store, notifier, capAlerts } = setup({ expenses: [exp('2026-10-20', 800)], caps: {} });
    const r = await capAlerts.check();
    expect(r).toEqual({ level: null, announced: false });
    expect(store.raiseCapAlert).not.toHaveBeenCalled();
    expect(notifier.notifyLevel).not.toHaveBeenCalled();
  });

  it('counts USD as 0 with no rates', async () => {
    const { store, capAlerts } = setup({ expenses: [exp('2026-10-20', 900, { currency: 'USD' })] });
    await capAlerts.check();
    expect(store.raiseCapAlert).not.toHaveBeenCalled();
  });

  it('logs and swallows a notifier failure, keeping the alert written', async () => {
    const { store, notifier, logger, capAlerts } = setup({ expenses: [exp('2026-10-20', 800)] });
    notifier.notifyLevel.mockRejectedValue(new Error('fcm down'));
    const r = await capAlerts.check();
    expect(store.raiseCapAlert).toHaveBeenCalledWith('2026-11', { level: 75, total: 800, cap: 1000 });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('fcm down') }));
    expect(r.announced).toBe(true);
  });
});
