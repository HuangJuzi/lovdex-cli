export type LLMProvider = 'claude' | 'cursor' | 'codex' | 'opencode';

export type ProviderModelOption = {
  value: string;
  label: string;
  description?: string;
  effort?: {
    default?: string;
    values: {
      value: string;
      description?: string;
    }[];
  };
};

export type ProviderModelsDefinition = {
  OPTIONS: ProviderModelOption[];
  DEFAULT: string;
};

export type ProviderModelsCacheInfo = {
  updatedAt: string;
  expiresAt: string;
  source: 'memory' | 'disk' | 'fresh';
};

export type AppTab = 'chat' | 'files' | 'shell' | 'git' | 'tasks' | 'browser' | `plugin:${string}`;

export interface ProjectSession {
  id: string;
  title?: string;
  summary?: string;
  name?: string;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  lastActivity?: string;
  messageCount?: number;
  provider?: LLMProvider;
  __provider?: LLMProvider;
  // Tags the session with the owning project's DB `projectId` so UI handlers
  // (session switching, sidebar focus, etc.) can match against selectedProject.
  __projectId?: string;
  [key: string]: unknown;
}

export interface ProjectSessionMeta {
  total?: number;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface ProjectTaskmasterInfo {
  hasTaskmaster?: boolean;
  status?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// After the projectName → projectId migration the backend no longer returns a
// folder-derived `name` string. Projects are now addressed everywhere by the
// DB-assigned `projectId` (primary key in the `projects` table), and the UI
// uses the same identifier for routing, state keys and API calls.
export interface Project {
  projectId: string;
  displayName: string;
  fullPath: string;
  path?: string;
  isStarred?: boolean;
  sessions?: ProjectSession[];
  sessionMeta?: ProjectSessionMeta;
  taskmaster?: ProjectTaskmasterInfo;
  [key: string]: unknown;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskEngine = 'claude' | 'codex';

export interface Task {
  task_id: string;
  project_path: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  executor_provider: TaskEngine;
  executor_model: string | null;
  position: number;
  session_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Realtime-only flag (server-decorated, never persisted): true when the linked
   * session currently has a pending tool-approval. Drives the board/detail
   * "等你批准" overlay and is reconstructed on list load and WS reconnect, so a
   * marker that fired while this tab was closed still reappears.
   */
  approval_pending?: boolean;
  /**
   * Realtime-only flag (server-decorated, never persisted): true when the task
   * reads as in_progress but its linked session has no live run (failed /
   * orphaned run). Drives the board/detail "失败" badge + retry, reconstructed
   * on list load and WS reconnect like `approval_pending`.
   */
  failed?: boolean;
}

export interface TaskUpsertedEvent {
  kind: 'task_upserted';
  task: Task;
  actor: 'user' | 'engine';
  approval?: { pending: boolean };
  timestamp: string;
}

export interface TaskDeletedEvent {
  kind: 'task_deleted';
  taskId: string;
  actor: 'user' | 'engine';
  timestamp: string;
}

export interface LoadingProgress {
  kind?: 'loading_progress';
  phase?: string;
  current: number;
  total: number;
  currentProject?: string;
  [key: string]: unknown;
}
