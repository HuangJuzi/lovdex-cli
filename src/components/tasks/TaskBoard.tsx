import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useWebSocket } from '../../contexts/WebSocketContext';
import { useTasks } from '../../hooks/useTasks';
import { Button } from '../../shared/view/ui';
import type { Task, TaskDeletedEvent, TaskUpsertedEvent } from '../../types/app';
import { api } from '../../utils/api';

import { TaskCard } from './TaskCard';
import { STATUS_META, STATUS_ORDER, groupByStatus } from './taskStatus';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const { tasks, loading, refresh, upsert } = useTasks({}, subscribe);
  const [approvalTaskIds, setApprovalTaskIds] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupByStatus(tasks), [tasks]);

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
      if (data?.sessionId) navigate(`/session/${data.sessionId}`);
      else void refresh();
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
      <header className="flex items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-bold text-foreground">任务面板</h1>
        <Button size="sm" disabled title="创建任务即将上线">
          ＋ 新建任务
        </Button>
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
