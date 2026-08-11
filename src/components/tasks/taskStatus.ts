import type { SubStatus, Task, TaskStatus } from '../../types/app';

import { taskTimeLabel } from './taskTimestamp';

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: '待办', color: '#fbbf24' },
  in_progress: { label: '进行中', color: '#60a5fa' },
  in_review: { label: '评审', color: '#a78bfa' },
  done: { label: '完成', color: '#34d399' },
};

export const SUB_STATUS_ORDER: SubStatus[] = [
  'running', 'failed', 'waiting_answer', 'waiting_plan', 'waiting_approval',
  'pending_acceptance', 'done', 'only_plan', 'needs_review', 'blocked',
];

export const SUB_STATUS_META: Record<SubStatus, { label: string; color: string }> = {
  running: { label: '会话运行中', color: '#60a5fa' },
  failed: { label: '执行失败', color: '#ef4444' },
  waiting_answer: { label: '等你回答', color: '#f59e0b' },
  waiting_plan: { label: '等你确认计划', color: '#6366f1' },
  waiting_approval: { label: '等你批准', color: '#f59e0b' },
  pending_acceptance: { label: '待你验收', color: '#a855f7' },
  done: { label: '已完成，待评审', color: '#34d399' },
  only_plan: { label: '计划待执行', color: '#3b82f6' },
  needs_review: { label: '待你决策', color: '#eab308' },
  blocked: { label: '需协助', color: '#ef4444' },
};

function statusSortTime(task: Task): number {
  const ms = Date.parse(taskTimeLabel(task).iso);
  return Number.isNaN(ms) ? 0 : ms;
}

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Task[]])) as Record<TaskStatus, Task[]>;
  for (const t of tasks) {
    if (groups[t.status]) groups[t.status].push(t);
  }
  for (const status of STATUS_ORDER) {
    groups[status].sort((a, b) => statusSortTime(b) - statusSortTime(a));
  }
  return groups;
}

export function taskSessionState(t: Task): 'none' | 'running' | 'review' | 'done' {
  if (!t.session_id) return 'none';
  switch (t.status) {
    case 'in_progress': return 'running';
    case 'in_review': return 'review';
    case 'done': return 'done';
    default: return 'none';
  }
}
