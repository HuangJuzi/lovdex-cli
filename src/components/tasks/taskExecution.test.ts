import test from 'node:test';
import assert from 'node:assert/strict';

import type { Task } from '../../types/app';

import { TASK_RETRY_MESSAGE, buildTaskChatSend, taskPromptOf } from './taskExecution';

// A minimal Task fixture — only fields buildTaskChatSend reads matter
// (executor_provider, executor_model, title, description).
const task = {
  task_id: 't1',
  project_path: '/p',
  title: '修登录',
  description: '把登录页 500 报错修好',
  status: 'in_progress',
  executor_provider: 'claude',
  executor_model: null,
  position: 1,
  session_id: 's1',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as Task;

test('taskPromptOf sends the description (the execution content) when present', () => {
  assert.equal(taskPromptOf({ title: '修登录', description: '把登录页 500 报错修好' }), '把登录页 500 报错修好');
});

test('taskPromptOf falls back to the title for older tasks with no description', () => {
  assert.equal(taskPromptOf({ title: '修登录', description: null }), '修登录');
  assert.equal(taskPromptOf({ title: '修登录', description: '' }), '修登录');
  assert.equal(taskPromptOf({ title: '修登录', description: '   ' }), '修登录');
});

test('taskPromptOf trims the description', () => {
  assert.equal(taskPromptOf({ title: 't', description: '  do the thing  ' }), 'do the thing');
});

test('buildTaskChatSend defaults content to the task prompt', () => {
  const frame = buildTaskChatSend('s1', task);
  assert.equal(frame.type, 'chat.send');
  assert.equal(frame.sessionId, 's1');
  assert.equal(frame.content, '把登录页 500 报错修好');
});

test('buildTaskChatSend sends TASK_RETRY_MESSAGE when provided as content', () => {
  const frame = buildTaskChatSend('s1', task, TASK_RETRY_MESSAGE);
  assert.equal(frame.sessionId, 's1');
  assert.equal(frame.content, '上次执行中断/出错了，请重试继续完成');
  assert.equal(frame.options.sessionSummary, task.title);
});

test('buildTaskChatSend passes through an arbitrary custom content', () => {
  const frame = buildTaskChatSend('s1', task, '继续完成');
  assert.equal(frame.content, '继续完成');
});

test('TASK_RETRY_MESSAGE is non-empty and mentions retrying', () => {
  assert.ok(TASK_RETRY_MESSAGE.length > 0);
  assert.match(TASK_RETRY_MESSAGE, /重试/);
});
