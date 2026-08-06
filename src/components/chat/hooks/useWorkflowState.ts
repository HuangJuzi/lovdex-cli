import { useCallback } from 'react';

import type { SessionStore } from '../../../stores/useSessionStore';
import type { WorkflowEvent } from '../tools/workflowState';

/**
 * Dispatches Workflow SDK events into the session store, keyed by the Workflow
 * tool_use id (task_started.tool_use_id). background_tasks_changed is level-only
 * and routes to the store's backgroundTasks slice instead.
 */
export function useWorkflowState(sessionStore: SessionStore) {
  const dispatch = useCallback((toolUseId: string | null | undefined, event: WorkflowEvent) => {
    if (event.kind === 'background_tasks_changed') {
      sessionStore.setBackgroundTasks(event.tasks);
      return;
    }
    if (!toolUseId) return;
    sessionStore.applyWorkflowEvent(toolUseId, event);
  }, [sessionStore]);

  return { dispatch };
}
