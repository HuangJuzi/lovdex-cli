import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../utils/api';
import type { Task, TaskStatus } from '../types/app';

/**
 * Data layer for the task board. Fetches the task list (optionally scoped by
 * project path and/or status) and exposes local upsert/remove helpers that the
 * realtime `task_upserted` / `task_deleted` subscriptions will call into.
 */
export function useTasks(options: { projectPath?: string; status?: TaskStatus } = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.tasks.list({ projectPath: options.projectPath, status: options.status });
      if (!res.ok) throw new Error(`tasks.list failed: ${res.status}`);
      const data = (await res.json()) as Task[];
      if (mounted.current) setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [options.projectPath, options.status]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const upsert = useCallback((task: Task) => {
    setTasks(prev => {
      const i = prev.findIndex(t => t.task_id === task.task_id);
      if (i === -1) return [...prev, task];
      const next = [...prev];
      next[i] = task;
      return next;
    });
  }, []);

  const remove = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.task_id !== taskId));
  }, []);

  return { tasks, loading, refresh, upsert, remove };
}
