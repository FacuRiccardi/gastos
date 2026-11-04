import { describe, it, expect, vi } from 'vitest';
import { createNotifier } from '../src/notifier.js';

const setup = (tokens, responses) => {
  const store = { listPushTokens: vi.fn().mockResolvedValue(tokens), deletePushTokens: vi.fn().mockResolvedValue() };
  const messaging = { sendEachForMulticast: vi.fn().mockResolvedValue({ responses }) };
  return { store, messaging, notifier: createNotifier({ store, messaging, logger: { info: vi.fn(), error: vi.fn() } }) };
};

describe('createNotifier', () => {
  it('does not call FCM without tokens', async () => {
    const { messaging, notifier } = setup([], []);
    await notifier.notifyLevel(75);
    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends a data-only high priority message', async () => {
    const { messaging, notifier } = setup(['a', 'b'], [{ success: true }, { success: true }]);
    await notifier.notifyLevel(75);
    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['a', 'b'],
      data: { title: 'Tope de gasto', body: 'Llegaste al 75% del tope', url: '/' },
      android: { priority: 'high' },
      webpush: { headers: { Urgency: 'high' } },
    });
  });

  it('deletes only the unregistered or invalid tokens', async () => {
    const { store, notifier } = setup(
      ['a', 'b', 'c', 'd'],
      [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    );
    await notifier.notifyLevel(50);
    expect(store.deletePushTokens).toHaveBeenCalledWith(['b', 'd']);
  });

  it('does not delete when nothing is stale', async () => {
    const { store, notifier } = setup(['a'], [{ success: true }]);
    await notifier.notifyLevel(50);
    expect(store.deletePushTokens).not.toHaveBeenCalled();
  });

  it('rejects when FCM throws', async () => {
    const { messaging, notifier } = setup(['a'], []);
    messaging.sendEachForMulticast.mockRejectedValue(new Error('boom'));
    await expect(notifier.notifyLevel(50)).rejects.toThrow('boom');
  });
});
