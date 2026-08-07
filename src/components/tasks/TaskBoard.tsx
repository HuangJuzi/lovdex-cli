import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useWebSocket } from '../../contexts/WebSocketContext';
import { useTasks } from '../../hooks/useTasks';
import { Button, Input } from '../../shared/view/ui';
import type { Project, Task, TaskDeletedEvent, TaskEngine, TaskUpsertedEvent } from '../../types/app';
import { api } from '../../utils/api';

import { TaskCard } from './TaskCard';
import { openExecutionSession } from './taskNavigation';
import { STATUS_META, STATUS_ORDER, groupByStatus } from './taskStatus';

const projectPathOf = (project: Project): string => project.fullPath || project.path || '';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const { tasks, loading, loadError, refresh, upsert } = useTasks({}, subscribe);
  const [approvalTaskIds, setApprovalTaskIds] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupByStatus(tasks), [tasks]);

  // Create-task form state.
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [newEngine, setNewEngine] = useState<TaskEngine>('claude');
  const [projects, setProjects] = useState<Project[]>([]);

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

  function toggleCreateForm() {
    setNewTitle('');
    setCreating((prev) => !prev);
  }

  async function createTask() {
    const projectPath = newProjectPath;
    if (!projectPath || !newTitle.trim()) return;
    try {
      const res = await api.tasks.create({
        projectPath,
        title: newTitle.trim(),
        executorProvider: newEngine,
        status: 'backlog',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('createTask failed', err?.error?.message ?? res.status);
        return;
      }
      setCreating(false);
      setNewTitle('');
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
      if (data?.sessionId) {
        openExecutionSession(navigate, String(data.sessionId), task);
      } else {
        void refresh();
      }
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
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← 返回
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-foreground">任务面板</h1>
        <div className="ml-auto">
          <Button size="sm" onClick={toggleCreateForm}>
            ＋ 新建任务
          </Button>
        </div>
      </header>
      {creating && (
        <div className="flex flex-col gap-2 border-b border-border bg-card/50 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6 sm:py-4">
          <Input
            className="w-full sm:w-64"
            placeholder="任务标题"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <select
            className="h-9 w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground sm:w-auto"
            value={newProjectPath}
            onChange={(e) => setNewProjectPath(e.target.value)}
          >
            {projects.length === 0 && <option value="">选择项目</option>}
            {projects.map((project) => (
              <option key={project.projectId} value={projectPathOf(project)}>
                {project.displayName || projectPathOf(project)}
              </option>
            ))}
          </select>
          <select
            className="h-9 w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground sm:w-auto"
            value={newEngine}
            onChange={(e) => setNewEngine(e.target.value as TaskEngine)}
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </select>
          <Button size="sm" disabled={!newTitle.trim()} onClick={() => void createTask()}>
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
