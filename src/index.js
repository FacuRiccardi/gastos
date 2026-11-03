import functions from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import { createGmailClient } from './gmailClient.js';
import { createStore } from './store.js';
import { processNotification, renewWatch } from './sync.js';

const logger = {
  info: (o) => console.log(JSON.stringify({ severity: 'INFO', ...o })),
  error: (o) => console.error(JSON.stringify({ severity: 'ERROR', ...o })),
};

export function createProcessHandler(deps) {
  return async (req, res) => {
    let notification;
    try {
      const data = req.body?.message?.data;
      const parsed = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
      if (!parsed.emailAddress || parsed.historyId === undefined) throw new Error('missing fields');
      notification = { emailAddress: parsed.emailAddress, historyId: String(parsed.historyId) };
    } catch {
      // Permanent error: log it (triggers the alert) and answer 2xx so Pub/Sub does not retry.
      deps.logger.error({ message: 'Invalid notification body', body: req.body });
      return res.status(204).send();
    }
    try {
      await processNotification(deps, notification);
      return res.status(204).send();
    } catch (e) {
      deps.logger.error({ message: `Transient failure processing notification: ${e.message}` });
      return res.status(500).send();
    }
  };
}

export function createRenewHandler(deps) {
  return async (_req, res) => {
    try {
      await renewWatch(deps);
      return res.status(204).send();
    } catch (e) {
      deps.logger.error({ message: `Failed to renew the watch: ${e.message}` });
      return res.status(500).send();
    }
  };
}

// If building the dependencies fails (e.g. a secret with invalid JSON) it is logged as a structured
// ERROR so the alert fires; an uncaught throw would be written as plain text without a severity.
export function withDeps(getDeps, createHandler, log = logger) {
  return async (req, res) => {
    let deps;
    try {
      deps = getDeps();
    } catch (e) {
      log.error({ message: `Could not build dependencies: ${e.message}` });
      return res.status(500).send();
    }
    return createHandler(deps)(req, res);
  };
}

let depsCache;
function deps() {
  if (!depsCache) {
    const oauth = JSON.parse(process.env.GMAIL_OAUTH_SECRET);
    depsCache = {
      logger,
      config: { user: process.env.GMAIL_USER, labelName: process.env.GMAIL_LABEL_NAME },
      store: createStore(new Firestore()),
      gmail: createGmailClient({ ...oauth, labelId: process.env.GMAIL_LABEL_ID, topicName: process.env.PUBSUB_TOPIC }),
    };
  }
  return depsCache;
}

functions.http('processNotification', withDeps(deps, createProcessHandler));
functions.http('renewWatch', withDeps(deps, createRenewHandler));
