// Authorizes the Gmail account (read-only) and stores the OAuth credentials in Secret Manager.
// Usage: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GCP_PROJECT_ID=... node scripts/authorize.js
// The refresh token is never printed or written to disk: it goes through stdin to `gcloud secrets versions add`.
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { google } from 'googleapis';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GCP_PROJECT_ID } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GCP_PROJECT_ID) {
  console.error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or GCP_PROJECT_ID is missing from the environment.');
  process.exit(1);
}

function abrirNavegador(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replaceAll('&', '^&')]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

const servidor = http.createServer();
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const redirectUri = `http://127.0.0.1:${servidor.address().port}`;
const oauth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);

const url = oauth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
});
console.log('Opening the browser to authorize... If it does not open, copy this URL:\n' + url);
abrirNavegador(url);

const code = await new Promise((ok, fail) => {
  servidor.on('request', (req, res) => {
    const params = new URL(req.url, redirectUri).searchParams;
    res.end('Done, you can close this tab.');
    if (params.get('code')) ok(params.get('code'));
    else if (params.get('error')) fail(new Error(`Authorization rejected: ${params.get('error')}`));
  });
});
servidor.close();

const { tokens } = await oauth.getToken(code);
if (!tokens.refresh_token) throw new Error('Google did not return a refresh token (revoke the previous access of the app and try again).');

const secreto = JSON.stringify({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, refreshToken: tokens.refresh_token });
const r = spawnSync('gcloud', ['secrets', 'versions', 'add', 'gmail-oauth', '--data-file=-', `--project=${GCP_PROJECT_ID}`], {
  input: secreto,
  shell: process.platform === 'win32',
  encoding: 'utf8',
});
if (r.status !== 0) {
  console.error('Could not store the secret with gcloud:\n' + (r.stderr || r.error));
  process.exit(1);
}
console.log('Done: stored a new version of the gmail-oauth secret.');
