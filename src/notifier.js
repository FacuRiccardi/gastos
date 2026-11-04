// Sends the cap push through FCM. Data-only: the service worker builds the visible notification.
const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export function createNotifier({ store, messaging, logger }) {
  return {
    async notifyLevel(level) {
      const tokens = await store.listPushTokens();
      if (tokens.length === 0) {
        logger.info({ message: 'No push tokens registered, nothing to send', level });
        return;
      }
      const result = await messaging.sendEachForMulticast({
        tokens,
        data: { title: 'Tope de gasto', body: `Llegaste al ${level}% del tope`, url: '/' },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high' } },
      });
      const stale = tokens.filter((_, i) => {
        const r = result.responses[i];
        return r && !r.success && STALE_TOKEN_CODES.has(r.error?.code);
      });
      if (stale.length > 0) await store.deletePushTokens(stale);
    },
  };
}
