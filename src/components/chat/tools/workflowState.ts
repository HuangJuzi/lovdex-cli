/**
 * Pure aggregation of Workflow SDK events into a WorkflowState tree.
 *
 * The frontend receives task_started/task_progress/tool_progress/task_notification
 * as separate WS events keyed by taskId (+ toolUseId for the Workflow root).
 * This function reduces them into a single WorkflowState per Workflow tool_use,
 * which WorkflowContainer renders as a three-level tree:
 *   Workflow → agents[] → tools[]
 *
 * Kept as a pure function so it can be unit-tested with node:test (no jsdom).
 * The hook (useWorkflowState) wraps this with a per-toolUseId Map.
 */

export interface WorkflowAgentNode {
  taskId: string;
  subagentType?: string;
  taskType?: string;
  description: string;
  lastToolName?: string;
  usage?: { total_tokens: number; tool_uses: number; duration_ms: number };
  tools: Array<{
    toolUseId: string;
    toolName: string;
    elapsedTimeSeconds: number;
  }>;
}

export interface WorkflowState {
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'async_launched';
  workflowName?: string;
  agents: WorkflowAgentNode[];
  notification?: {
    status: 'completed' | 'failed' | 'stopped';
    summary: string;
    usage?: { total_tokens: number; tool_uses: number; duration_ms: number };
  };
}

export type WorkflowEvent =
  | { kind: 'task_started'; taskId: string; toolUseId?: string | null; taskType?: string | null; workflowName?: string | null; subagentType?: string | null; description?: string }
  | { kind: 'task_progress'; taskId: string; toolUseId?: string | null; description: string; lastToolName?: string | null; usage?: unknown; subagentType?: string | null; summary?: string | null }
  | { kind: 'tool_progress'; toolUseId: string; toolName: string; parentToolUseId?: string | null; taskId?: string | null; elapsedTimeSeconds?: number }
  | { kind: 'task_notification'; taskId: string; toolUseId?: string | null; status: 'completed' | 'failed' | 'stopped'; summary: string; usage?: unknown }
  | { kind: 'background_tasks_changed'; tasks: Array<{ taskId: string; taskType: string; description: string }> };

export function applyWorkflowEvent(state: WorkflowState | undefined, event: WorkflowEvent): WorkflowState | undefined {
  switch (event.kind) {
    case 'task_started':
      return {
        status: 'running',
        workflowName: event.workflowName ?? undefined,
        agents: [],
      };

    case 'task_progress': {
      if (!state) return undefined;
      const existing = state.agents.find((a) => a.taskId === event.taskId);
      if (existing) {
        existing.description = event.description;
        if (event.lastToolName) existing.lastToolName = event.lastToolName;
        if (event.usage) existing.usage = event.usage as WorkflowAgentNode['usage'];
      } else {
        state.agents.push({
          taskId: event.taskId,
          subagentType: event.subagentType ?? undefined,
          description: event.description,
          lastToolName: event.lastToolName ?? undefined,
          usage: event.usage as WorkflowAgentNode['usage'],
          tools: [],
        });
      }
      return state;
    }

    case 'tool_progress': {
      if (!state || !event.taskId) return undefined;
      const agent = state.agents.find((a) => a.taskId === event.taskId);
      if (!agent) return undefined;
      const existing = agent.tools.find((t) => t.toolUseId === event.toolUseId);
      if (existing) {
        existing.elapsedTimeSeconds = event.elapsedTimeSeconds ?? existing.elapsedTimeSeconds;
      } else {
        agent.tools.push({
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          elapsedTimeSeconds: event.elapsedTimeSeconds ?? 0,
        });
      }
      return state;
    }

    case 'task_notification': {
      if (!state) return undefined;
      state.status = event.status;
      state.notification = {
        status: event.status,
        summary: event.summary,
        usage: (event.usage ?? undefined) as { total_tokens: number; tool_uses: number; duration_ms: number } | undefined,
      };
      return state;
    }

    case 'background_tasks_changed':
      // Handled separately in the session store (level payload).
      return state;

    default:
      return state;
  }
}
