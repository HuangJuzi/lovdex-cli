import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../utils/api';
import type { Task, TaskStatus } from '../../types/app';

import { buildTaskChatSend } from './taskExecution';
import { STATUS_META, STATUS_ORDER } from './taskStatus';
import { formatAbsoluteTime } from './taskTimestamp';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { sendMessage } = useWebSocket();
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loadError, setLoadError] = useState(false);
  const loadSeq = useRef(0);
  const savingRef = useRef(false);

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

  useEffect(() => {
    void load();
  }, [load]);

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
      <div className="mx-auto max-w-3xl px-4 py-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
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
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <span
            className="mt-2 h-3 w-3 shrink-0 rounded-full"
            style={{ background: STATUS_META[task.status].color }}
          />
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
                <div className="text-sm text-foreground">{task.project_path}</div>
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
