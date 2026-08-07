import test from 'node:test';
import assert from 'node:assert/strict';

import type { Task } from '../../types/app';

import { groupByStatus, STATUS_ORDER, STATUS_META, taskSessionState } from './taskStatus';

function mk(overrides: Record<string, unknown> = {}) {
  return {
    task_id: 'x',
    project_path: '/p',
    title: 't',
    description: null,
    status: 'todo',
    executor_provider: 'claude',
    executor_model: null,
    position: 0,
    session_id: null,
    started_at: null,
    completed_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

test('STATUS_ORDER is canonical backlog→todo→in_progress→in_review→done', () => {
  assert.deepEqual(STATUS_ORDER, ['backlog', 'todo', 'in_progress', 'in_review', 'done']);
});

test('STATUS_META has a label for every status', () => {
  for (const s of STATUS_ORDER) assert.ok(STATUS_META[s].label.length > 0);
});

test('groupByStatus groups tasks in canonical column order', () => {
  const tasks = [
    mk({ task_id: 'a', status: 'done' }),
    mk({ task_id: 'b', status: 'todo' }),
    mk({ task_id: 'c', status: 'backlog' }),
  ];
  const groups = groupByStatus(tasks as Task[]);
  assert.deepEqual(Object.keys(groups), STATUS_ORDER);
  assert.equal(groups.todo.length, 1);
  assert.equal(groups.done[0].task_id, 'a');
});

test('taskSessionState maps status + session_id', () => {
  assert.equal(taskSessionState(mk({ session_id: null }) as Task), 'none');
  assert.equal(taskSessionState(mk({ status: 'in_progress', session_id: 's' }) as Task), 'running');
  assert.equal(taskSessionState(mk({ status: 'in_review', session_id: 's' }) as Task), 'review');
  assert.equal(taskSessionState(mk({ status: 'done', session_id: 's' }) as Task), 'done');
  // Default branch: a session without a running/review/done status is 'none',
  // and the awaiting-approval overlay is NOT a session state (status stays
  // in_progress → 'running').
  assert.equal(taskSessionState(mk({ status: 'todo', session_id: 's' }) as Task), 'none');
  assert.equal(taskSessionState(mk({ status: 'backlog', session_id: 's' }) as Task), 'none');
});