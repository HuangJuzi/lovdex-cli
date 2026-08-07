import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../../utils/api';
import type { Task } from '../../types/app';

import { STATUS_META, STATUS_ORDER } from './taskStatus';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    void api.tasks
      .get(taskId)
      .then((r) => r.json())
      .then((data: Task) => {
        if (cancelled) return;
        setTask(data);
        setTitle(data.title);
        setDescription(data.description ?? '');
      })
      .catch((err) => console.error('load task failed', err));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const saveFields = useCallback(async () => {
    if (!task) return;
    const res = await api.tasks.update(task.task_id, { title, description });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('save task failed', err?.error?.message ?? res.status);
      return;
    }
    setTask(await res.json());
  }, [task, title, description]);

  async function updateStatus(status: Task['status']) {
    if (!task) return;
    const res = await api.tasks.update(task.task_id, { status });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('updateStatus failed', err?.error?.message ?? res.status);
      return;
    }
    setTask(await res.json());
  }

  async function remove() {
    if (!task) return;
    await api.tasks.remove(task.task_id);
    navigate('/tasks');
  }

  async function startExecution() {
    if (!task) return;
    const res = await api.tasks.startExecution(task.task_id);
    if (!res.ok) return;
    const data = await res.json();
    if (data?.sessionId) navigate(`/session/${data.sessionId}`);
  }

  if (!task) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>;

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl p-8">
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/tasks')}
        >
          ← 返回任务面板
        </button>
        <div className="mt-4 flex items-start gap-3">
          <span
            className="mt-2 h-3 w-3 shrink-0 rounded-full"
            style={{ background: STATUS_META[task.status].color }}
          />
          <div className="flex-1">
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
          <div className="flex gap-2">
            {task.status !== 'done' && (
              <button
                className="rounded-md bg-green-500/15 px-3 py-1.5 text-sm font-semibold text-green-500 hover:bg-green-500/25 dark:text-green-400"
                onClick={() => updateStatus('done')}
              >
                ✓ 标记完成
              </button>
            )}
            <button
              className="rounded-md bg-red-500/10 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/20 dark:text-red-400"
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
                  onChange={(e) => updateStatus(e.target.value as Task['status'])}
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
