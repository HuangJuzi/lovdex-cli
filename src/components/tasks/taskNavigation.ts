import type { NavigateFunction } from 'react-router-dom';

import type { Task } from '../../types/app';

/**
 * Navigate to the session created for a task's "start execution", carrying
 * the task context in router state so the composer can prefill the first
 * message with the task title/description (see the taskContext handling in
 * useChatComposerState). The context shape lives here so both the board and
 * the detail page stay in sync.
 */
export function openExecutionSession(
  navigate: NavigateFunction,
  sessionId: string,
  task: Task,
) {
  navigate(`/session/${sessionId}`, {
    state: {
      taskContext: { title: task.title, description: task.description ?? '' },
    },
  });
}
