// One-off backfill: loads into Firestore the labelled emails from the last N days that are missing.
// Existing expenses are never overwritten. Uses the OAuth credentials stored in Secret Manager by
// scripts/authorize.js and your gcloud Application Default Credentials for Firestore.
// Usage: GCP_PROJECT_ID=<id> GMAIL_USER=<your gmail> node scripts/reprocess.js --days 35 ["Label name"]
//   (label name defaults to "Gastos BBVA")
import { spawnSync } from 'node:child_process';
import { Firestore } from '@google-cloud/firestore';
import { createGmailClient } from '../src/gmailClient.js';
import { createStore } from '../src/store.js';
import { reconcile } from '../src/sync.js';

const { GCP_PROJECT_ID, GMAIL_USER } = process.env;
const args = process.argv.slice(2);
const daysIndex = args.indexOf('--days');
const days = Number(args[daysIndex + 1]);
const labelName = args.find((a, i) => !a.startsWith('--') && i !== daysIndex + 1) ?? 'Gastos BBVA';

if (!GCP_PROJECT_ID || !GMAIL_USER || daysIndex === -1 || !Number.isInteger(days) || days < 1) {
  console.error('Usage: GCP_PROJECT_ID=<id> GMAIL_USER=<gmail> node scripts/reprocess.js --days <N> ["Label name"]');
  process.exit(1);
}

const r = spawnSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=gmail-oauth', `--project=${GCP_PROJECT_ID}`], {
  shell: process.platform === 'win32',
  encoding: 'utf8',
});
if (r.status !== 0) {
  console.error('Could not read the gmail-oauth secret:\n' + (r.stderr || r.error));
  process.exit(1);
}

const logger = {
  info: (o) => console.log(JSON.stringify(o)),
  error: (o) => console.error(JSON.stringify(o)),
};
const deps = {
  logger,
  config: { user: GMAIL_USER, labelName },
  store: createStore(new Firestore({ projectId: GCP_PROJECT_ID })),
  gmail: createGmailClient({ ...JSON.parse(r.stdout), labelId: '', topicName: '' }),
};

const { saved } = await reconcile(deps, { days });
console.log(`Done: saved ${saved} new expense(s) from the last ${days} days (label "${labelName}").`);
