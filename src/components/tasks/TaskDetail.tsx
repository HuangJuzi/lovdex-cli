import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../utils/api';
import type { Project, Task, TaskStatus, TaskUpsertedEvent, TaskVerdict } from '../../types/app';

import { buildTaskChatSend, TASK_RETRY_MESSAGE } from './taskExecution';
import { TaskResultPanel } from './TaskResultPanel';
import { pickLastAssistantText } from './taskResult';
import type { TaskResultState } from './taskResult';
import { STATUS_META, STATUS_ORDER, taskSessionState } from './taskStatus';
import { formatAbsoluteTime } from './taskTimestamp';
import { VerdictBadge } from './VerdictBadge';
import { ViewSwitcher } from './ViewSwitcher';

const VERDICT_HEADER_LABEL: Record<TaskVerdict, string> = {
  done: '已完成',
  only_plan: '仅出计划',
  needs_review: '待你判断',
  blocked: '已卡住',
};
const VERDICT_HEADER_COLOR: Record<TaskVerdict, string> = {
  done: '#34d399',
  only_plan: '#3b82f6',
  needs_review: '#eab308',
  blocked: '#ef4444',
};

/**
 * Live status badge for the detail header. A running session shows "进行中"
 * (or 等你回答/等你确认计划/等你批准/执行失败) instead of the stale stored
 * status — mirrors the TaskCard indicator so the top of the page reads the
 * same as the board card. Falls back to the stored status label when idle.
 */
function liveHeaderBadge(
  task: Task,
  operatorEnabled: boolean,
): { label: string; color: string; pulse?: boolean } {
  const sessionState = taskSessionState(task);
  if (sessionState === 'running') {
    if (task.failed) return { label: '执行失败', color: '#ef4444' };
    if (task.approval_pending) {
      const tool = task.pending_tool;
      if (operatorEnabled && tool === 'AskUserQuestion') return { label: '等你回答', color: '#f59e0b', pulse: true };
      if (operatorEnabled && (tool === 'ExitPlanMode' || tool === 'exit_plan_mode')) return { label: '等你确认计划', color: '#6366f1', pulse: true };
      return { label: operatorEnabled ? '等你批准' : '待审批', color: '#f59e0b', pulse: true };
    }
    return { label: '进行中', color: '#3b82f6', pulse: true };
  }
  if (sessionState === 'review') {
    if (task.verdict) return { label: VERDICT_HEADER_LABEL[task.verdict], color: VERDICT_HEADER_COLOR[task.verdict] };
    return { label: '待你验收', color: '#a855f7' };
  }
  return { label: STATUS_META[task.status].label, color: STATUS_META[task.status].color };
}

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { sendMessage, subscribe } = useWebSocket();
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loadError, setLoadError] = useState(false);
  const loadSeq = useRef(0);
  const savingRef = useRef(false);
  const [resultState, setResultState] = useState<TaskResultState>('idle');
  const [resultContent, setResultContent] = useState('');
  // Project selector for backlog/todo tasks. `projects` mirrors the TaskBoard
  // create-form dropdown; `projectPath` is the pending selection (reverted on
  // cancel/failure).
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectPath, setProjectPath] = useState('');
  const [operatorEnabled, setOperatorEnabled] = useState(false);
  const resultSeq = useRef(0);

  const load = useCallback(async () => {
    if (!taskId) return;
    const seq = ++loadSeq.current;
    try {
      const res = await api.tasks.get(taskId);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('load task failed', err?.error?.message ?? res.status);
        if (seq === loadSeq.current) setLoadError(true);
        return;
      }
      const data = (await res.json()) as Task;
      if (seq !== loadSeq.current) return;
      setTask(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setLoadError(false);
    } catch (err) {
      console.error('load task failed', err);
      if (seq === loadSeq.current) setLoadError(true);
    }
  }, [taskId]);

  const projectPathOf = (project: Project): string => project.fullPath || project.path || '';

  // `displayName` can collide across projects while the path stays unique — the
  // same disambiguation the TaskBoard create form uses.
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

  // Keep the pending selection in sync with the task's actual project.
  useEffect(() => {
    if (task) setProjectPath(task.project_path);
  }, [task?.project_path]);

  useEffect(() => {
    let cancelled = false;
    api.projects()
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as Project[];
        return Array.isArray(data) ? data : [];
      })
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch((err) => console.error('load projects for task detail failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Whether the Operator Agent is enabled — gates the classified wait-reason
  // label (等你回答/等你确认计划/等你批准) vs the generic 待审批 in the approval block.
  useEffect(() => {
    let cancelled = false;
    api.operator
      .settings()
      .then(async (res) => {
        if (!res.ok) return;
        const cfg = (await res.json()) as { enabled?: boolean };
        if (!cancelled) setOperatorEnabled(Boolean(cfg.enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadResult = useCallback(async (sessionId: string) => {
    const seq = ++resultSeq.current;
    setResultState('loading');
    try {
      const res = await api.unifiedSessionMessages(sessionId, 'claude', {});
      if (seq !== resultSeq.current) return;
      if (!res.ok) {
        setResultState('error');
        return;
      }
      const body = (await res.json()) as { data?: { messages?: unknown[] } } | { messages?: unknown[] };
      const messages = Array.isArray((body as { data?: { messages?: unknown[] } })?.data?.messages)
        ? (body as { data: { messages: unknown[] } }).data.messages
        : Array.isArray((body as { messages?: unknown[] }).messages)
          ? (body as { messages: unknown[] }).messages
          : [];
      const text = pickLastAssistantText(messages as { kind: string; role?: string; content?: string }[]);
      if (text) {
        setResultContent(text);
        setResultState('ready');
      } else {
        setResultContent('');
        setResultState('empty');
      }
    } catch (err) {
      console.error('load task result failed', err);
      if (seq === resultSeq.current) setResultState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fetch the result whenever the linked session changes.
  useEffect(() => {
    if (!task?.session_id) {
      setResultState('idle');
      setResultContent('');
      return;
    }
    void loadResult(task.session_id);
  }, [task?.session_id, loadResult]);

  // Live-refresh the result when the engine advances this task's session
  // (running → in_progress, completed → in_review). We deliberately do NOT
  // replace title/description here, to avoid clobbering in-flight edits — but
  // we DO patch the engine-owned fields (status, session_id, approval_pending,
  // lifecycle timestamps) so the "等你批准" overlay and status badge stay live.
  useEffect(() => {
    if (!subscribe || !taskId) return;
    return subscribe((event) => {
      if (event.kind !== 'task_upserted') return;
      const upserted = event as unknown as TaskUpsertedEvent;
      if (!upserted.task || upserted.task.task_id !== taskId) return;
      const next = upserted.task;
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: next.status,
              session_id: next.session_id,
              approval_pending: next.approval_pending,
              pending_tool: next.pending_tool,
              failed: next.failed,
              started_at: next.started_at,
              completed_at: next.completed_at,
              ai_summary: next.ai_summary,
              verdict: next.verdict,
              verdict_reason: next.verdict_reason,
              verdict_at: next.verdict_at,
              updated_at: next.updated_at,
            }
          : prev,
      );
      const sid = next.session_id;
      if (!sid) return;
      if (next.status === 'in_progress' || next.status === 'in_review' || next.status === 'done') {
        void loadResult(sid);
      }
    });
  }, [subscribe, taskId, loadResult]);

  const saveFields = useCallback(async () => {
    if (!task) return;
    // Guard against concurrent title/description blur saves racing each other.
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const res = await api.tasks.update(task.task_id, { title, description });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('save task failed', err?.error?.message ?? res.status);
        return;
      }
      setTask(await res.json());
    } catch (err) {
      console.error('save task failed', err);
    } finally {
      savingRef.current = false;
    }
  }, [task, title, description]);

  async function updateStatus(status: TaskStatus) {
    if (!task) return;
    try {
      const res = await api.tasks.update(task.task_id, { status });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('updateStatus failed', err?.error?.message ?? res.status);
        return;
      }
      setTask(await res.json());
    } catch (err) {
      console.error('updateStatus failed', err);
    }
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm('确定删除该任务？')) return;
    try {
      const res = await api.tasks.remove(task.task_id);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('remove failed', err?.error?.message ?? res.status);
        return;
      }
      navigate('/tasks');
    } catch (err) {
      console.error('remove failed', err);
    }
  }

  async function startExecution() {
    if (!task) return;
    try {
      const res = await api.tasks.startExecution(task.task_id);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('startExecution failed', err?.error?.message ?? res.status);
        return;
      }
      const data = (await res.json()) as { sessionId?: unknown };
      const sessionId = data?.sessionId ? String(data.sessionId) : null;
      if (sessionId) {
        // Run the agent over the shared socket and stay on the detail page; the
        // button flips to "打开会话" once the refetch picks up the linkage.
        sendMessage(buildTaskChatSend(sessionId, task));
      }
      // Refetch so status/session linkage refreshes.
      const refreshed = await api.tasks.get(task.task_id);
      if (!refreshed.ok) {
        const err = await refreshed.json().catch(() => null);
        console.error('startExecution refetch failed', err?.error?.message ?? refreshed.status);
        return;
      }
      setTask(await refreshed.json());
    } catch (err) {
      console.error('startExecution failed', err);
    }
  }

  /**
   * Retry a failed task in its existing session: send the retry message over
   * the socket so the agent resumes with the full conversation context, instead
   * of `startExecution` which would create a brand-new session and orphan the
   * old one. Defensive fallback to `startExecution` if the task somehow has no
   * session (the retry button only renders when `session_id` is set).
   */
  function retryTask() {
    if (!task) return;
    if (task.session_id) {
      sendMessage(buildTaskChatSend(task.session_id, task, TASK_RETRY_MESSAGE));
      return;
    }
    void startExecution();
  }

  async function changeProject(nextPath: string) {
    if (!task || nextPath === task.project_path) return;
    const previous = task.project_path;
    if (task.session_id) {
      const ok = window.confirm('修改项目将删除当前会话及其全部对话记录，此操作不可恢复。是否继续？');
      if (!ok) {
        setProjectPath(previous);
        return;
      }
    }
    setProjectPath(nextPath);
    try {
      const res = await api.tasks.update(task.task_id, { projectPath: nextPath });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error('changeProject failed', err?.error?.message ?? res.status);
        setProjectPath(previous);
        return;
      }
      setTask(await res.json());
    } catch (err) {
      console.error('changeProject failed', err);
      setProjectPath(previous);
    }
  }

  if (loadError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background">
        <div className="text-sm text-muted-foreground">加载任务失败</div>
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={() => void load()}
        >
          重试
        </button>
      </div>
    );
  }

  if (!task) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>;

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <header className="pwa-header-safe sticky top-0 z-10 flex flex-shrink-0 items-center gap-2 border-b border-border/60 bg-background px-3 py-1.5 sm:px-4 sm:py-2">
        <ViewSwitcher active="tasks" className="w-40 flex-shrink-0 sm:w-44" />
        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/tasks')}
          >
            ← 返回任务面板
          </button>
          <span className="text-xs text-muted-foreground/50">·</span>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/')}
          >
            返回主页
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:p-8">
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {(() => {
            const badge = liveHeaderBadge(task, operatorEnabled);
            return (
              <span
                className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] font-semibold"
                style={{ color: badge.color }}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${badge.pulse ? 'animate-pulse' : ''}`}
                  style={{ background: badge.color }}
                />
                {badge.label}
              </span>
            );
          })()}
          <div className="min-w-0 flex-1">
            <input
              className="w-full bg-transparent text-xl font-bold text-foreground outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title !== task.title) void saveFields();
              }}
            />
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {task.project_path} · {task.task_id.slice(0, 8)}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {task.status !== 'done' && (
              <button
                className="flex-1 rounded-md bg-green-500/15 px-3 py-1.5 text-sm font-semibold text-green-500 hover:bg-green-500/25 dark:text-green-400 sm:flex-none"
                onClick={() => updateStatus('done')}
              >
                ✓ 标记完成
              </button>
            )}
            <button
              className="flex-1 rounded-md bg-red-500/10 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/20 dark:text-red-400 sm:flex-none"
              onClick={remove}
            >
              删除
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-6">
            <div className="rounded-lg border border-border bg-card p-4">
              <textarea
                className="min-h-[160px] w-full resize-y bg-transparent text-sm text-muted-foreground outline-none"
                value={description}
                placeholder="暂无描述"
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description !== (task.description ?? '')) void saveFields();
                }}
              />
            </div>
            {task.verdict && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground">完成度</h4>
                  <VerdictBadge verdict={task.verdict} />
                </div>
                {task.ai_summary && (
                  <p className="text-sm text-foreground">{task.ai_summary}</p>
                )}
                {task.verdict_reason && (
                  <p className="mt-1 text-xs text-muted-foreground">理由：{task.verdict_reason}</p>
                )}
                {task.verdict_at && (
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    {formatAbsoluteTime(task.verdict_at)}
                  </p>
                )}
              </div>
            )}
            <TaskResultPanel
              state={resultState}
              content={resultContent}
              onRefresh={() => {
                if (task?.session_id) void loadResult(task.session_id);
              }}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">属性</h4>
              <div className="mb-3">
                <div className="mb-1 text-xs text-muted-foreground">状态</div>
                <select
                  className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground"
                  value={task.status}
                  onChange={(e) => updateStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <div className="mb-1 text-xs text-muted-foreground">所属项目</div>
                {task.status === 'backlog' || task.status === 'todo' ? (
                  <select
                    className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground"
                    value={projectPath}
                    onChange={(e) => void changeProject(e.target.value)}
                  >
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
                ) : (
                  <div className="text-sm text-foreground">{task.project_path}</div>
                )}
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">执行引擎</div>
                <div className="text-sm text-foreground">
                  {task.executor_provider}
                  {task.executor_model ? ` · ${task.executor_model}` : ''}
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <div className="mb-1 text-xs text-muted-foreground">创建时间</div>
                <div className="text-sm text-foreground">{formatAbsoluteTime(task.created_at)}</div>
              </div>
              <div className="mt-3">
                <div className="mb-1 text-xs text-muted-foreground">更新时间</div>
                <div className="text-sm text-foreground">{formatAbsoluteTime(task.updated_at)}</div>
              </div>
              {task.started_at && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-muted-foreground">开始时间</div>
                  <div className="text-sm text-foreground">{formatAbsoluteTime(task.started_at)}</div>
                </div>
              )}
              {task.completed_at && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-muted-foreground">完成时间</div>
                  <div className="text-sm text-foreground">{formatAbsoluteTime(task.completed_at)}</div>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">执行</h4>
              {task.failed && task.session_id && (
                <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> 执行失败
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    任务执行出错，可以重试或打开会话查看原因。
                  </p>
                  <button
                    className="mt-2 w-full rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={() => retryTask()}
                  >
                    ↻ 重试
                  </button>
                </div>
              )}
              {task.approval_pending && task.session_id && (() => {
                const tool = task.pending_tool;
                let label = '待审批';
                let desc = '关联会话有一个待审批的权限请求，需要你处理。';
                if (operatorEnabled) {
                  if (tool === 'AskUserQuestion') {
                    label = '等你回答';
                    desc = '助手在等你回答一个问题，去会话里回复它即可继续。';
                  } else if (tool === 'ExitPlanMode' || tool === 'exit_plan_mode') {
                    label = '等你确认计划';
                    desc = '助手已出 plan，等你确认后才会开始执行。';
                  } else {
                    label = '等你批准';
                    desc = '关联会话有一个待审批的权限请求，需要你处理。';
                  }
                }
                return (
                  <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {label}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                    <button
                      className="mt-2 w-full rounded-md bg-amber-500/15 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
                      onClick={() => navigate(`/session/${task.session_id}`)}
                    >
                      去处理
                    </button>
                  </div>
                );
              })()}
              {task.session_id ? (
                <button
                  className="w-full rounded-md border border-primary/40 bg-primary/10 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
                  onClick={() => navigate(`/session/${task.session_id}`)}
                >
                  打开会话
                </button>
              ) : (
                <button
                  className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={() => void startExecution()}
                >
                  ▶ 开始执行
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
