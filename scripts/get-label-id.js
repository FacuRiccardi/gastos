// Prints the internal Gmail id of a label, using the OAuth credentials stored in Secret Manager
// by scripts/authorize.js.
// Usage: GCP_PROJECT_ID=<id> node scripts/get-label-id.js ["Label name"]   (default: "Gastos BBVA")
import { spawnSync } from 'node:child_process';
import { google } from 'googleapis';
import { findLabelId } from '../src/labels.js';

const { GCP_PROJECT_ID } = process.env;
const labelName = process.argv[2] ?? 'Gastos BBVA';
if (!GCP_PROJECT_ID) {
  console.error('GCP_PROJECT_ID is missing from the environment.');
  process.exit(1);
}

const r = spawnSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=gmail-oauth', `--project=${GCP_PROJECT_ID}`], {
  shell: process.platform === 'win32',
  encoding: 'utf8',
});
if (r.status !== 0) {
  console.error('Could not read the gmail-oauth secret (did you run scripts/authorize.js?):\n' + (r.stderr || r.error));
  process.exit(1);
}

const { clientId, clientSecret, refreshToken } = JSON.parse(r.stdout);
const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });
const { data } = await google.gmail({ version: 'v1', auth }).users.labels.list({ userId: 'me' });

const id = findLabelId(data.labels ?? [], labelName);
console.log(`Label "${labelName}" has id: ${id}`);
console.log(`Add to terraform/terraform.tfvars:  gmail_label_id = "${id}"`);
