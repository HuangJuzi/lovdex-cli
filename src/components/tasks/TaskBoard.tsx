import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTasks } from '../../hooks/useTasks';
import type { Task } from '../../types/app';
import { api } from '../../utils/api';

import { TaskCard } from './TaskCard';
import { STATUS_META, STATUS_ORDER, groupByStatus } from './taskStatus';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const { tasks, loading, refresh, upsert } = useTasks();
  const groups = useMemo(() => groupByStatus(tasks), [tasks]);

  async function startExecution(task: Task) {
    try {
      const res = await api.tasks.startExecution(task.task_id);
      const data = (await res.json()) as { sessionId?: unknown };
      if (data?.sessionId) navigate(`/session/${data.sessionId}`);
      else void refresh();
    } catch (err) {
      console.error('startExecution failed', err);
    }
  }

  async function updateStatus(task: Task, status: Task['status']) {
    try {
      const res = await api.tasks.update(task.task_id, { status });
      const updated = (await res.json()) as Task;
      upsert(updated);
    } catch (err) {
      console.error('updateStatus failed', err);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-bold text-foreground">任务面板</h1>
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => navigate('/tasks/new')}
        >
          ＋ 新建任务
        </button>
      </header>
      {loading ? (
        <div className="px-6 text-sm text-muted-foreground">加载中…</div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/30"
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
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {groups[status].length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">暂无任务</div>
                )}
                {groups[status].map((task) => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
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
