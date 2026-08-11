import type { ProjectSession, TaskEngine, TaskStatus } from '../../../../types/app';
import { resolveSessionTitle } from '../../../../utils/sessionTitle';

export type SessionToTaskPayload = {
  title: string;
  description: string;
  executorProvider: TaskEngine;
  status: TaskStatus;
};

function isTaskEngine(value: unknown): value is TaskEngine {
  return value === 'claude' || value === 'codex' || value === 'sophcode';
}

/**
 * Compute the conversion dialog's default payload from a session.
 * Pure so it can be unit-tested without a React renderer.
 * Status defaults from the running rule (running → in_progress, else todo);
 * the dialog lets the user override it.
 */
export function buildSessionToTaskPayload(input: {
  session: ProjectSession | null;
  isRunning: boolean;
}): SessionToTaskPayload {
  const session = input.session;
  const title = resolveSessionTitle(session) ?? '';
  const description = typeof session?.summary === 'string' ? session.summary : '';
  const executorProvider = isTaskEngine(session?.provider) ? session.provider : 'claude';
  const status: TaskStatus = input.isRunning ? 'in_progress' : 'todo';
  return { title, description, executorProvider, status };
}
