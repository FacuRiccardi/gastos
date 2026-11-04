import { levelFor } from './capLevel.js';
import { buenosAiresDay } from './dates.js';
import { capFor, currentPeriodSpend } from './periodSpend.js';

export function createCapAlerts({ store, notifier, logger, now = () => new Date() }) {
  return {
    // The level is raised in the store before the push: a failed push is logged, never retried by a duplicate.
    async check() {
      const ctx = await store.getCapContext();
      const spend = currentPeriodSpend({ ...ctx, today: buenosAiresDay(now()) });
      if (!spend) return { level: null, announced: false };
      const cap = capFor(spend.month, ctx.caps);
      if (!cap) return { level: null, announced: false };
      const level = levelFor((spend.total * 100) / cap.amount);
      if (level === null) return { level: null, announced: false };
      const announced = await store.raiseCapAlert(spend.month, { level, total: spend.total, cap: cap.amount });
      if (announced) {
        try {
          await notifier.notifyLevel(level);
        } catch (e) {
          logger.error({ message: `Could not send the cap push for level ${level}: ${e.message}`, level });
        }
      }
      return { level, announced };
    },
  };
}
