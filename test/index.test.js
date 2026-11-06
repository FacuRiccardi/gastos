import { describe, it, expect, vi } from 'vitest';
import { createProcessHandler, withDeps } from '../src/index.js';

const config = { user: 'user@example.com', labelName: 'card-expenses' };

function res() {
  const r = { code: null, status: vi.fn((c) => { r.code = c; return r; }), send: vi.fn(() => r) };
  return r;
}
const body = (obj) => ({ body: { message: { data: Buffer.from(JSON.stringify(obj)).toString('base64') } } });

function deps(gmailOverrides = {}) {
  let historyId = '400';
  return {
    config,
    logger: { info: vi.fn(), error: vi.fn() },
    store: {
      getHistoryId: async () => historyId,
      setHistoryId: async (id) => { historyId = String(id); },
      saveExpense: async () => true,
    },
    gmail: {
      listHistory: async () => ({ messageIds: [], historyId: '500' }),
      listMessages: async () => [],
      getMessage: async () => { throw new Error('should not be called'); },
      startWatch: async () => ({ historyId: '1' }),
      ...gmailOverrides,
    },
  };
}

describe('createProcessHandler', () => {
  it('responds 204 to a valid notification (numeric historyId, as Gmail sends it)', async () => {
    const r = res();
    await createProcessHandler(deps())(body({ emailAddress: config.user, historyId: 500 }), r);
    expect(r.code).toBe(204);
  });

  it('responds 204 and logs ERROR on an invalid body', async () => {
    const d = deps();
    const r = res();
    await createProcessHandler(d)({ body: { foo: 'bar' } }, r);
    expect(r.code).toBe(204);
    expect(d.logger.error).toHaveBeenCalledTimes(1);
  });

  it('responds 500 when processNotification throws a transient error', async () => {
    const d = deps({ listHistory: async () => { throw new Error('503'); } });
    const r = res();
    await createProcessHandler(d)(body({ emailAddress: config.user, historyId: 500 }), r);
    expect(r.code).toBe(500);
    expect(d.logger.error).toHaveBeenCalled();
  });
});

describe('withDeps', () => {
  it('if building the dependencies fails (e.g. an invalid secret) it logs ERROR and responds 500', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const r = res();
    await withDeps(() => { throw new Error('invalid JSON'); }, () => async () => {}, logger)({}, r);
    expect(r.code).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
