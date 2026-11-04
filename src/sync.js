import { extractMessage, extractHeaders } from './message.js';
import { merchantKey } from './merchant.js';
import { parsePurchaseApproved, ParseError } from './parser.js';

// Sender and subject of the bank's emails (external data, in Spanish: "Compra aprobada" = "Approved purchase")
const SENDER = 'avisos-bbva-ar@bbva.com';
const SUBJECT = 'Compra aprobada';

export class HistoryExpiredError extends Error {
  constructor(message = 'The historyId has expired') {
    super(message);
    this.name = 'HistoryExpiredError';
  }
}

function isApprovedPurchase(headers) {
  return headers.sender.toLowerCase() === SENDER && headers.subject.trim() === SUBJECT;
}

// Returns true if a new expense was saved. Emails that cannot be parsed are logged as ERROR
// (which triggers the alert) and skipped; transient failures propagate so Pub/Sub retries.
async function processMessage({ gmail, store, logger }, id) {
  try {
    const raw = await gmail.getMessage(id);
    if (!isApprovedPurchase(extractHeaders(raw))) {
      logger.info({ message: 'Message ignored: not an approved purchase', id });
      return false;
    }
    const message = extractMessage(raw);
    const expense = parsePurchaseApproved(message.html);
    // A merchant the household already categorized gets that category; a new one stays uncategorized.
    const categoryId = await store.getMerchantCategory(merchantKey(expense.merchant));
    return await store.saveExpense(id, { ...expense, receivedAt: message.receivedAt, ...(categoryId ? { categoryId } : {}) });
  } catch (e) {
    if (e.code === 404 || e.status === 404) {
      logger.info({ message: 'Message no longer exists (deleted), skipping', id });
      return false;
    }
    if (e instanceof ParseError) {
      logger.error({ severity: 'ERROR', message: `Could not parse email ${id}: ${e.message}`, id });
      return false;
    }
    throw e;
  }
}

async function processIds(deps, ids) {
  let saved = 0;
  for (const id of ids) {
    if (await processMessage(deps, id)) saved++;
  }
  // A failed cap check must never change the ingestion result: the purchases are already saved.
  if (saved > 0 && deps.capAlerts) {
    try {
      await deps.capAlerts.check();
    } catch (e) {
      deps.logger.error({ message: `Cap check failed: ${e.message}` });
    }
  }
  return { saved };
}

// Saves the labelled emails from the last `days` days that are missing (3 by default; a larger
// window is used by scripts/reprocess.js to load older purchases).
export async function reconcile(deps, { days = 3 } = {}) {
  // In Gmail search syntax, spaces in a label name are written as hyphens
  const label = deps.config.labelName.replaceAll(' ', '-');
  const ids = await deps.gmail.listMessages(`label:${label} newer_than:${days}d`);
  return processIds(deps, ids);
}

export async function processNotification(deps, { emailAddress, historyId }) {
  const { gmail, store, config, logger } = deps;
  if (emailAddress !== config.user) {
    logger.info({ message: 'Notification for another mailbox ignored', emailAddress });
    return { saved: 0 };
  }

  const stored = await store.getHistoryId();
  if (stored !== null && BigInt(historyId) <= BigInt(stored)) return { saved: 0 };

  if (stored === null) {
    const result = await reconcile(deps);
    await store.setHistoryId(historyId);
    return result;
  }

  let history;
  try {
    history = await gmail.listHistory(stored);
  } catch (e) {
    if (!(e instanceof HistoryExpiredError)) throw e;
    logger.info({ message: 'historyId expired: reconciling and resetting', stored });
    const result = await reconcile(deps);
    await store.setHistoryId(historyId);
    return result;
  }

  const result = await processIds(deps, history.messageIds);
  await store.setHistoryId(history.historyId);
  return result;
}

export async function renewWatch(deps) {
  const { historyId } = await deps.gmail.startWatch();
  if ((await deps.store.getHistoryId()) === null) await deps.store.setHistoryId(historyId);
  await reconcile(deps);
}
