/**
 * Operator-session creation helpers for the Lovdex助手 panel.
 *
 * `ensureOperatorSession` single-flights the whole "open the assistant" flow
 * (settings gate → reuse latest → create) at module level. React.StrictMode in
 * dev remounts the component (fresh refs/state per mount), so a per-instance
 * guard would let each mount run the flow and a single click would allocate
 * two operator sessions. The module-level `flows` map is shared by every mount
 * of the same navigation, so the second mount awaits the first mount's flow
 * instead of running its own.
 *
 * The flow promise is *sticky*: it is not cleared when it settles successfully.
 * A non-sticky holder reintroduces a race — the first mount's POST can settle
 * (and reset the holder) while the second mount is still awaiting its own
 * `settings()`/`listSessions()` call, so the second mount fires a duplicate
 * POST. Sticky-on-success closes that window; `resetOperatorSessionFlow` (used
 * by the sidebar「+」button, an explicit "new session" intent) clears the cache
 * so a later click still creates a fresh session. Failures clear their own
 * entry so a retry starts a new request.
 */

import { api } from '../../utils/api';

export type EnsureOperatorSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'disabled' | 'http' | 'missing-id' | 'error'; status?: number; message?: string };

export type OperatorSessionDeps = {
  settings: () => Promise<Response>;
  listSessions: () => Promise<Response>;
  createSession: () => Promise<Response>;
};

const productionDeps: OperatorSessionDeps = {
  settings: () => api.operator.settings(),
  listSessions: () => api.operator.listSessions(),
  createSession: () => api.operator.createSession(),
};

/**
 * Per-`forceNew` in-flight/sticky flows. At most two entries exist (false and
 * true); a redirect reloads the page and resets the module, so entries cannot
 * accumulate across navigations.
 */
const flows = new Map<boolean, Promise<EnsureOperatorSessionResult>>();

/** Clears a cached flow (or all), forcing the next call to start a new one. */
export function resetOperatorSessionFlow(forceNew?: boolean): void {
  if (forceNew === undefined) flows.clear();
  else flows.delete(forceNew);
}

export function ensureOperatorSession(
  forceNew: boolean,
  deps: OperatorSessionDeps = productionDeps,
): Promise<EnsureOperatorSessionResult> {
  const existing = flows.get(forceNew);
  if (existing) return existing;

  const flow = (async (): Promise<EnsureOperatorSessionResult> => {
    try {
      // Interactive chat can be disabled in the operator settings.
      const cfgRes = await deps.settings();
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { interactive_chat_enabled?: boolean };
        if (cfg.interactive_chat_enabled === false) {
          return { ok: false, reason: 'disabled' };
        }
      }

      // Reuse the latest session unless the user explicitly asked for a new one.
      if (!forceNew) {
        const listRes = await deps.listSessions();
        if (listRes.ok) {
          const body = (await listRes.json()) as { data?: { sessions?: { session_id?: string }[] } };
          const latest = body?.data?.sessions?.[0]?.session_id;
          if (latest) return { ok: true, sessionId: latest };
        }
      }

      const createRes = await deps.createSession();
      if (!createRes.ok) {
        // Transient failure — do not poison later attempts with a sticky error.
        flows.delete(forceNew);
        return { ok: false, reason: 'http', status: createRes.status };
      }
      const created = (await createRes.json()) as { data?: { sessionId?: string } };
      const sessionId = created?.data?.sessionId;
      if (!sessionId) {
        flows.delete(forceNew);
        return { ok: false, reason: 'missing-id' };
      }
      return { ok: true, sessionId };
    } catch (err) {
      // Failure must not poison later attempts — allow a retry.
      flows.delete(forceNew);
      return { ok: false, reason: 'error', message: (err as Error).message ?? '启动 Lovdex助手失败' };
    }
  })();

  flows.set(forceNew, flow);
  return flow;
}
