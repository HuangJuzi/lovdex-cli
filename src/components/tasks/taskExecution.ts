import type { Task } from '../../types/app';
import { safeLocalStorage } from '../chat/utils/chatStorage';

type ToolsSettings = {
  allowedTools?: string[];
  disallowedTools?: string[];
  skipPermissions?: boolean;
};

/**
 * The message the board/detail send over the shared WebSocket to actually run
 * a task. Same `chat.send` shape the composer uses, so the backend run path is
 * identical — the only difference is nobody navigates to the chat page.
 */
export type TaskChatSend = {
  type: 'chat.send';
  sessionId: string;
  content: string;
  options: {
    model?: string;
    permissionMode: string;
    toolsSettings: ToolsSettings;
    skipPermissions: boolean;
    sessionSummary: string;
  };
};

// Mirror the composer's per-provider tools-settings storage keys so a task run
// respects the same allow/deny lists and skip-permissions choice the user set
// for interactive chats.
function settingsKeyFor(provider: string): string {
  switch (provider) {
    case 'cursor':
      return 'cursor-tools-settings';
    case 'codex':
      return 'codex-settings';
    case 'opencode':
      return 'opencode-settings';
    default:
      return 'claude-settings';
  }
}

function readToolsSettings(provider: string): ToolsSettings {
  try {
    const raw = safeLocalStorage.getItem(settingsKeyFor(provider));
    if (raw) return JSON.parse(raw) as ToolsSettings;
  } catch (error) {
    console.error('read task tools settings failed', error);
  }
  return { allowedTools: [], disallowedTools: [], skipPermissions: false };
}

/**
 * The prompt actually sent to the agent: the task's execution content
 * (`description`), falling back to the display name for older tasks that only
 * ever had a title.
 */
export function taskPromptOf(task: Pick<Task, 'description' | 'title'>): string {
  return (task.description ?? '').trim() || task.title;
}

/**
 * Build the `chat.send` frame that starts a task's agent run on its linked
 * session. Sent over the board/detail's existing socket so execution begins in
 * place — the run streams and persists server-side exactly like an interactive
 * chat, and can be watched later by opening the session. Permission mode is the
 * default (ask): any prompt surfaces as the board's "等你批准" marker until the
 * user opens the session to decide.
 */
export function buildTaskChatSend(sessionId: string, task: Task): TaskChatSend {
  const toolsSettings = readToolsSettings(task.executor_provider);
  return {
    type: 'chat.send',
    sessionId,
    content: taskPromptOf(task),
    options: {
      model: task.executor_model || undefined,
      permissionMode: 'default',
      toolsSettings,
      skipPermissions: toolsSettings.skipPermissions ?? false,
      sessionSummary: task.title,
    },
  };
}
