import test from 'node:test';
import assert from 'node:assert/strict';

import { taskPromptOf } from './taskExecution';

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
