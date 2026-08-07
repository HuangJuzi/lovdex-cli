import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useWebSocket } from '../../contexts/WebSocketContext';
import { useTasks } from '../../hooks/useTasks';
import { Button, Input } from '../../shared/view/ui';
import type {
  Project,
  ProviderModelOption,
  Task,
  TaskDeletedEvent,
  TaskEngine,
  TaskUpsertedEvent,
} from '../../types/app';
import { api, authenticatedFetch } from '../../utils/api';

// Matches the `/api/providers/:provider/models` response consumed by
// useChatProviderState: `{ success, data: { models: { OPTIONS, DEFAULT } } }`.
type ProviderModelsApiResponse = {
  success?: boolean;
  data?: {
    models?: {
      OPTIONS?: ProviderModelOption[];
      DEFAULT?: string;
    };
  };
};

import { TaskCard } from './TaskCard';
import { ViewSwitcher } from './ViewSwitcher';
import { buildTaskChatSend } from './taskExecution';
import { deriveTaskName } from './taskName';
import { STATUS_META, STATUS_ORDER, groupByStatus } from './taskStatus';

const projectPathOf = (project: Project): string => project.fullPath || project.path || '';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const { subscribe, sendMessage } = useWebSocket();
  const { tasks, loading, loadError, refresh, upsert } = useTasks({}, subscribe);
  const [approvalTaskIds, setApprovalTaskIds] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupByStatus(tasks), [tasks]);

  // Create-task form state.
  const [creating, setCreating] = useState(false);
  // The prompt is the actual content executed by the agent; the name is only a
  // board label. A blank name is distilled from the prompt at submit time.
  const [newPrompt, setNewPrompt] = useState('');
  const [newName, setNewName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [newEngine, setNewEngine] = useState<TaskEngine>('claude');
  const [projects, setProjects] = useState<Project[]>([]);
  const [models, setModels] = useState<ProviderModelOption[]>([]);
  const [newModel, setNewModel] = useState('');
  // Monotonic token so a slow response for a previous engine can't overwrite a
  // newer engine's model list when the user switches quickly.
  const modelsRequestRef = useRef(0);

  // `displayName` can collide across projects while the path stays unique (it is
  // what a task stores as `project_path`). Disambiguate only the names that
  // actually repeat, so the dropdown stays clean when names are unique.
  const duplicateProjectNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      const name = project.displayName || projectPathOf(project);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );
  }, [projects]);

  // Load the project list once for the create form. The `/api/projects`
  // response JSON is an array of projects; the display name lives in
  // `displayName` and the path in `fullPath` (with `path` as a fallback).
  useEffect(() => {
    let cancelled = false;
    api.projects()
      .then(async (res) => {
        if (!res.ok) {
          console.error('load projects for task create failed', res.status);
          return [];
        }
        const data = (await res.json()) as Project[];
        return Array.isArray(data) ? data : [];
      })
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        if (list.length > 0) setNewProjectPath(projectPathOf(list[0]));
      })
      .catch((err) => console.error('load projects for task create failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Load models for the selected engine whenever the form is open or the engine
  // changes. A Claude model isn't valid for Codex, so the list reloads per
  // provider. Falls back to an empty list (=> default model) on any failure.
  useEffect(() => {
    if (!creating) return;
    const requestId = modelsRequestRef.current + 1;
    modelsRequestRef.current = requestId;
    const engine = newEngine;
    authenticatedFetch(`/api/providers/${engine}/models`)
      .then(async (res) => {
        if (!res.ok) {
          console.error('load models for task create failed', res.status);
          return [] as ProviderModelOption[];
        }
        const body = (await res.json()) as ProviderModelsApiResponse;
        const options = body.success ? body.data?.models?.OPTIONS : undefined;
        return Array.isArray(options) ? options : [];
      })
      .then((list) => {
        // Ignore stale responses from a superseded engine selection.
        if (modelsRequestRef.current !== requestId) return;
        setModels(list);
        setNewModel(list.length > 0 ? list[0].value : '');
      })
      .catch((err) => {
        if (modelsRequestRef.current !== requestId) return;
        console.error('load models for task create failed', err);
        setModels([]);
        setNewModel('');
      });
  }, [creating, newEngine]);

  function toggleCreateForm() {
    setNewPrompt('');
    setNewName('');
    setCreating((prev) => !prev);
  }

  async function createTask() {
    const projectPath = newProjectPath;
    const prompt = newPrompt.trim();
    if (!projectPath || !prompt) return;
    // Name is optional: fall back to a locally distilled label from the prompt.
    const title = newName.trim() || deriveTaskName(prompt);
    try {
      const res = await api.tasks.create({
        projectPath,
        title,
        description: prompt,
        executorProvider: newEngine,
        executorModel: newModel || null,
        status: 'backlog',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('createTask failed', err?.error?.message ?? res.status);
        return;
      }
      setCreating(false);
      setNewPrompt('');
      setNewName('');
      void refresh();
    } catch (err) {
      console.error('createTask failed', err);
    }
  }

  // Mirror the live `approval.pending` flag so cards waiting on engine
  // approval show the amber "等你批准" marker. Cleared on pending:false or when
  // the task is deleted.
  useEffect(() => {
    if (!subscribe) return;
    return subscribe((event) => {
      if (event.kind === 'task_upserted') {
        const upserted = event as unknown as TaskUpsertedEvent;
        const task = upserted.task;
        if (!task) return;
        setApprovalTaskIds(prev => {
          const pending = upserted.approval?.pending;
          // No-op when the approval field is absent or the set already reflects it.
          if (pending === undefined || pending === prev.has(task.task_id)) return prev;
          const next = new Set(prev);
          if (pending) next.add(task.task_id);
          else next.delete(task.task_id);
          return next;
        });
      } else if (event.kind === 'task_deleted') {
        const deleted = event as unknown as TaskDeletedEvent;
        const taskId = deleted.taskId;
        if (!taskId) return;
        setApprovalTaskIds(prev => {
          if (!prev.has(taskId)) return prev;
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    });
  }, [subscribe]);

  async function startExecution(task: Task) {
    try {
      const res = await api.tasks.startExecution(task.task_id);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('startExecution failed', err?.error?.message ?? res.status);
        void refresh();
        return;
      }
      const data = (await res.json()) as { sessionId?: unknown };
      const sessionId = data?.sessionId ? String(data.sessionId) : null;
      if (!sessionId) {
        void refresh();
        return;
      }
      // Kick off the agent over the board's existing socket and stay on the
      // board; the run streams/persists server-side and the card flips to
      // in_progress via the task↔session status linkage. Open it later with
      // "打开会话" to watch or answer an approval prompt.
      sendMessage(buildTaskChatSend(sessionId, task));
    } catch (err) {
      console.error('startExecution failed', err);
    }
  }

  async function updateStatus(task: Task, status: Task['status']) {
    try {
      const res = await api.tasks.update(task.task_id, { status });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('updateStatus failed', err?.error?.message ?? res.status);
        return;
      }
      const updated = (await res.json()) as Task;
      upsert(updated);
    } catch (err) {
      console.error('updateStatus failed', err);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <ViewSwitcher active="tasks" className="w-44 flex-shrink-0 sm:w-48" />
        <div className="ml-auto">
          <Button size="sm" onClick={toggleCreateForm}>
            ＋ 新建任务
          </Button>
        </div>
      </header>
      {creating && (
        <div className="flex flex-col gap-2 border-b border-border bg-card/50 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6 sm:py-4">
          <textarea
            className="min-h-[64px] w-full resize-y rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60"
            placeholder="任务提示词（发给 agent 执行的内容）"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={2}
            autoFocus
          />
          <Input
            className="w-full sm:w-64"
            placeholder="名称（可选，留空自动从提示词提炼）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            className="h-9 w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground sm:w-auto"
            value={newProjectPath}
            onChange={(e) => setNewProjectPath(e.target.value)}
          >
            {projects.length === 0 && <option value="">选择项目</option>}
            {projects.map((project) => {
              const path = projectPathOf(project);
              const name = project.displayName || path;
              const label =
                duplicateProjectNames.has(name) && name !== path ? `${name} — ${path}` : name;
              return (
                <option key={project.projectId} value={path} title={path}>
                  {label}
                </option>
              );
            })}
          </select>
          <select
            className="h-9 w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground sm:w-auto"
            value={newEngine}
            onChange={(e) => setNewEngine(e.target.value as TaskEngine)}
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </select>
          <select
            className="h-9 w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground sm:w-auto"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            disabled={models.length === 0}
          >
            {models.length === 0 ? (
              <option value="">默认模型 (default)</option>
            ) : (
              models.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label || model.value}
                </option>
              ))
            )}
          </select>
          <Button size="sm" disabled={!newPrompt.trim()} onClick={() => void createTask()}>
            创建
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleCreateForm}>
            取消
          </Button>
        </div>
      )}
      {loading ? (
        <div className="px-3 text-sm text-muted-foreground sm:px-6">加载中…</div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="text-sm text-muted-foreground">加载任务失败</div>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => void refresh()}
          >
            重试
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3 sm:flex-row sm:gap-3 sm:overflow-x-auto sm:overflow-y-hidden sm:px-4 sm:pb-4">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="flex w-full flex-col rounded-xl border border-border bg-muted/30 sm:w-64 sm:shrink-0"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: STATUS_META[status].color }}
                />
                <span className="text-sm font-semibold text-foreground">
                  {STATUS_META[status].label}
                </span>
                <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                  {groups[status].length}
                </span>
              </div>
              <div className="flex flex-col gap-2 px-2 pb-2 sm:min-h-0 sm:flex-1 sm:overflow-y-auto">
                {groups[status].length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">暂无任务</div>
                )}
                {groups[status].map((task) => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
                    waitingApproval={approvalTaskIds.has(task.task_id)}
                    onStart={() => startExecution(task)}
                    onStatusChange={(s) => updateStatus(task, s)}
                    onOpenSession={() => task.session_id && navigate(`/session/${task.session_id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
