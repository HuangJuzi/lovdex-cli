import type { Task, TaskStatus } from '../../types/app';

export const STATUS_ORDER: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  backlog: { label: '积压', color: '#94a3b8' },
  todo: { label: '待做', color: '#fbbf24' },
  in_progress: { label: '进行中', color: '#60a5fa' },
  in_review: { label: '评审中', color: '#a78bfa' },
  done: { label: '已完成', color: '#34d399' },
};

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = {
    backlog: [],
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
  } as Record<TaskStatus, Task[]>;
  for (const t of tasks) {
    if (groups[t.status]) groups[t.status].push(t);
  }
  return groups;
}

// The "等你批准" (awaiting approval) marker is a live WS overlay tracked
// separately via TaskBoard's `waitingApproval` prop (backed by the
// `approvalTaskIds` set), not a value of `taskSessionState` — a task waiting on
// approval is still `in_progress` here.
export function taskSessionState(
  t: Task,
): 'none' | 'running' | 'review' | 'done' {
  if (!t.session_id) return 'none';
  switch (t.status) {
    case 'in_progress':
      return 'running';
    case 'in_review':
      return 'review';
    case 'done':
      return 'done';
    default:
      return 'none';
  }
}
