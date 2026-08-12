import type { Task } from '../../types/app';

import { PRIORITY_ORDER, STATUS_ORDER } from './taskStatus';

export type TaskSortKey =
  | 'title'
  | 'project'
  | 'status'
  | 'priority'
  | 'deadline'
  | 'created'
  | 'activity';

export type TaskSortDir = 'asc' | 'desc';

function sortValue(task: Task, key: TaskSortKey): string | number {
  switch (key) {
    case 'title':
      return task.title;
    case 'project':
      return task.project_path;
    case 'status':
      return STATUS_ORDER.indexOf(task.status);
    case 'priority':
      return PRIORITY_ORDER.indexOf(task.priority ?? 'P2');
    case 'deadline':
      return task.deadline ?? '';
    case 'created':
      return Date.parse(task.created_at) || 0;
    case 'activity':
      return Date.parse(task.updated_at) || 0;
  }
}

/** 组内排序：按 key 升/降序，等值回退到「创建时间 desc」再按 task_id 保证稳定。不修改入参。 */
export function sortTasks(tasks: Task[], key: TaskSortKey, dir: TaskSortDir): Task[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    return tb - ta || a.task_id.localeCompare(b.task_id);
  });
}
