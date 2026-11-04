import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
// Only the backend tests live here; the web app has its own Vitest setup in web/.
// The web data layer (web/src/cards) is imported by the emulator tests; web/ has its own copy of `firebase`,
// so map it to the root copy to keep a single Firestore instance (instanceof checks fail across copies).
const rootFirebase = (sub) => fileURLToPath(new URL(`./node_modules/firebase/${sub}`, import.meta.url));
// Emulator test files share one Firestore database, so they must not run in parallel.
export default defineConfig({
  resolve: { alias: [{ find: /^firebase\/firestore$/, replacement: rootFirebase('firestore/dist/index.mjs') }] },
  test: { fileParallelism: false, environment: 'node', include: ['test/**/*.test.{js,ts}'] },
});
