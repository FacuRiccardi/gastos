import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let testEnv;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with `npm run test:rules` (Firestore emulator)');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-expenses',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const household = () =>
  testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();
const stranger = () => testEnv.authenticatedContext('u2', { email_verified: true }).firestore();

const seed = (fn) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });

describe('capAlerts', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'capAlerts/2026-11'), { level: 80 });
      await setDoc(doc(db, 'capAlerts/2026-11/dismissals/user2'), { level: 50 });
    });
  });

  it('the household reads an alert but never writes it', async () => {
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'capAlerts/2026-11')));
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11'), { level: 100 }));
    await assertFails(deleteDoc(doc(db, 'capAlerts/2026-11')));
  });

  it('a member dismisses with their own uid only', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'capAlerts/2026-11/dismissals/user1'), { level: 50 }));
    await assertSucceeds(getDoc(doc(db, 'capAlerts/2026-11/dismissals/user1')));
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11/dismissals/user2'), { level: 50 }));
    await assertFails(getDoc(doc(db, 'capAlerts/2026-11/dismissals/user2')));
  });

  it('rejects bad dismissal data', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11/dismissals/user1'), { level: 50, extra: 1 }));
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11/dismissals/user1'), { level: 'x' }));
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11/dismissals/user1'), { level: 0 }));
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11/dismissals/user1'), {}));
  });

  it('denies everyone else', async () => {
    const db = stranger();
    await assertFails(getDoc(doc(db, 'capAlerts/2026-11')));
    await assertFails(getDoc(doc(db, 'capAlerts/2026-11/dismissals/u2')));
    await assertFails(setDoc(doc(db, 'capAlerts/2026-11/dismissals/u2'), { level: 50 }));
  });
});

describe('pushTokens', () => {
  const now = () => ({ uid: 'user1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  it('a member registers, updates and deletes their own token', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'pushTokens/abc'), now()));
    await assertSucceeds(getDoc(doc(db, 'pushTokens/abc')));
    await assertSucceeds(setDoc(doc(db, 'pushTokens/abc'), now()));
    await assertSucceeds(deleteDoc(doc(db, 'pushTokens/abc')));
  });

  it('rejects a token for another uid, extra fields or bad types', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'pushTokens/abc'), { ...now(), uid: 'user2' }));
    await assertFails(setDoc(doc(db, 'pushTokens/abc'), { ...now(), extra: 1 }));
    await assertFails(setDoc(doc(db, 'pushTokens/abc'), { createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'pushTokens/abc'), { ...now(), createdAt: 'x' }));
  });

  it('reads a nonexistent token but never another user\'s', async () => {
    await seed((db) => setDoc(doc(db, 'pushTokens/other'), { uid: 'user2' }));
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'pushTokens/nothing-here')));
    await assertFails(getDoc(doc(db, 'pushTokens/other')));
    // taking over another user's token document is not allowed either
    await assertFails(setDoc(doc(db, 'pushTokens/other'), now()));
  });

  it('cannot delete another user\'s token', async () => {
    await seed((db) => setDoc(doc(db, 'pushTokens/other'), { uid: 'user2' }));
    await assertFails(deleteDoc(doc(household(), 'pushTokens/other')));
  });

  it('denies everyone else', async () => {
    const db = stranger();
    await assertFails(getDoc(doc(db, 'pushTokens/abc')));
    await assertFails(setDoc(doc(db, 'pushTokens/abc'), { uid: 'u2' }));
  });
});
