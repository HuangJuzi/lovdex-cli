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

test('groupByStatus sorts backlog/todo newest-created first', () => {
  const tasks = [
    mk({ task_id: 'old-backlog', status: 'backlog', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }),
    mk({ task_id: 'new-backlog', status: 'backlog', created_at: '2026-02-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' }),
    mk({ task_id: 'old-todo', status: 'todo', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }),
    mk({ task_id: 'new-todo', status: 'todo', created_at: '2026-02-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' }),
  ];
  const groups = groupByStatus(tasks as Task[]);
  assert.deepEqual(groups.backlog.map(t => t.task_id), ['new-backlog', 'old-backlog']);
  assert.deepEqual(groups.todo.map(t => t.task_id), ['new-todo', 'old-todo']);
});

test('groupByStatus sorts in_progress by started_at, in_review by updated_at, done by completed_at', () => {
  const tasks = [
    mk({ task_id: 'ip-new', status: 'in_progress', started_at: '2026-02-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' }),
    mk({ task_id: 'ip-old', status: 'in_progress', started_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }),
    mk({ task_id: 'ir-new', status: 'in_review', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' }),
    mk({ task_id: 'ir-old', status: 'in_review', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }),
    mk({ task_id: 'done-new', status: 'done', completed_at: '2026-02-01T00:00:00.000Z', created_at: '2026-01-05T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' }),
    mk({ task_id: 'done-old', status: 'done', completed_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-05T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }),
  ];
  const groups = groupByStatus(tasks as Task[]);
  assert.deepEqual(groups.in_progress.map(t => t.task_id), ['ip-new', 'ip-old']);
  assert.deepEqual(groups.in_review.map(t => t.task_id), ['ir-new', 'ir-old']);
  assert.deepEqual(groups.done.map(t => t.task_id), ['done-new', 'done-old']);
});

test('groupByStatus falls back to created_at when lifecycle timestamps are absent', () => {
  const tasks = [
    // done row with no completed_at → updated_at, then created_at
    mk({ task_id: 'done-no-completed', status: 'done', completed_at: null, updated_at: '2026-01-10T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }),
    mk({ task_id: 'done-with-completed', status: 'done', completed_at: '2026-01-05T00:00:00.000Z', updated_at: '2026-01-05T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }),
    // in_progress row with no started_at → updated_at, then created_at
    mk({ task_id: 'ip-no-started', status: 'in_progress', started_at: null, updated_at: '2026-01-10T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }),
  ];
  const groups = groupByStatus(tasks as Task[]);
  assert.deepEqual(groups.done.map(t => t.task_id), ['done-no-completed', 'done-with-completed']);
  assert.deepEqual(groups.in_progress.map(t => t.task_id), ['ip-no-started']);
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