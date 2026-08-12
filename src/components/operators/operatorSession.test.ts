import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureOperatorSession, resetOperatorSessionFlow } from './operatorSession';

type FakeDepsOptions = {
  interactiveChatEnabled?: boolean;
  latestSessionId?: string | null;
  createSession?: () => Promise<Response>;
};

/** Builds a full deps set; `createSession` is the only call site we count. */
const fakeDeps = (opts: FakeDepsOptions = {}) => {
  const createCalls: string[] = [];
  const deps = {
    settings: async () =>
      new Response(JSON.stringify({ interactive_chat_enabled: opts.interactiveChatEnabled ?? true }), { status: 200 }),
    listSessions: async () =>
      new Response(
        JSON.stringify({
          data: {
            sessions: opts.latestSessionId
              ? [{ session_id: opts.latestSessionId }]
              : [],
          },
        }),
        { status: 200 },
      ),
    createSession: opts.createSession ?? (async () => {
      createCalls.push('create');
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ data: { sessionId: 's1' } }), { status: 201 });
    }),
  };
  return { deps, createCalls };
};

test('concurrent ensureOperatorSession calls share one in-flight flow (StrictMode double-mount)', async () => {
  resetOperatorSessionFlow();
  const { deps, createCalls } = fakeDeps();

  // React.StrictMode in dev runs the effect twice back-to-back (mount →
  // cleanup → mount); both runs call ensureOperatorSession synchronously while
  // the first flow is still in flight. Only one createSession may leave.
  const [a, b] = await Promise.all([
    ensureOperatorSession(false, deps),
    ensureOperatorSession(false, deps),
  ]);

  assert.equal(createCalls.length, 1, 'second run must reuse the first in-flight flow');
  assert.deepEqual(a, { ok: true, sessionId: 's1' });
  assert.deepEqual(b, { ok: true, sessionId: 's1' });
});

test('module-level flows map dedupes across StrictMode remounts', async () => {
  resetOperatorSessionFlow();
  const { deps, createCalls } = fakeDeps({ latestSessionId: null });

  // forceNew=true skips the reuse step so both remounts land on createSession;
  // the shared module-level flows map must make them share one POST.
  const [a, b] = await Promise.all([
    ensureOperatorSession(true, deps),
    ensureOperatorSession(true, deps),
  ]);

  assert.equal(createCalls.length, 1, 'both remounts must share one POST');
  assert.deepEqual(a, { ok: true, sessionId: 's1' });
  assert.deepEqual(b, { ok: true, sessionId: 's1' });
});

test('successful flow is sticky; resetOperatorSessionFlow clears it for a fresh request', async () => {
  resetOperatorSessionFlow();
  const { deps, createCalls } = fakeDeps();

  const first = await ensureOperatorSession(false, deps);
  assert.equal(createCalls.length, 1);

  // Sticky on success: a later call returns the cached flow without POSTing.
  const second = await ensureOperatorSession(false, deps);
  assert.equal(createCalls.length, 1, 'sticky success must not re-POST');
  assert.deepEqual(second, first);

  // Explicit "new session" intent (sidebar「+」) clears the cache.
  resetOperatorSessionFlow(false);
  const third = await ensureOperatorSession(false, deps);
  assert.equal(createCalls.length, 2, 'reset must allow a fresh request');
  assert.deepEqual(third, { ok: true, sessionId: 's1' });
});

test('reuses the latest session when one exists and forceNew is false', async () => {
  resetOperatorSessionFlow();
  const { deps, createCalls } = fakeDeps({ latestSessionId: 'latest-s' });

  const result = await ensureOperatorSession(false, deps);

  assert.equal(createCalls.length, 0, 'reuse must not create a session');
  assert.deepEqual(result, { ok: true, sessionId: 'latest-s' });
});

test('disabled settings surfaces as reason disabled', async () => {
  resetOperatorSessionFlow();
  const { deps, createCalls } = fakeDeps({ interactiveChatEnabled: false });

  const result = await ensureOperatorSession(false, deps);

  assert.equal(createCalls.length, 0, 'disabled must not create a session');
  assert.deepEqual(result, { ok: false, reason: 'disabled' });
});

test('non-ok createSession response surfaces as an http failure', async () => {
  resetOperatorSessionFlow();
  const { deps } = fakeDeps({
    createSession: async () => new Response('{}', { status: 500 }),
  });

  const result = await ensureOperatorSession(false, deps);

  assert.deepEqual(result, { ok: false, reason: 'http', status: 500 });
});

test('response without a sessionId surfaces as missing-id', async () => {
  resetOperatorSessionFlow();
  const { deps } = fakeDeps({
    createSession: async () => new Response(JSON.stringify({ data: {} }), { status: 201 }),
  });

  const result = await ensureOperatorSession(false, deps);

  assert.deepEqual(result, { ok: false, reason: 'missing-id' });
});
