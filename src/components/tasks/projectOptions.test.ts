import test from 'node:test';
import assert from 'node:assert/strict';
import type { Project } from '../../types/app';
import { ASSISTANT_OPTION_VALUE, projectPathOf, taskFormProjects } from './projectOptions';

const mkProject = (over: Partial<Project> & { displayName: string; fullPath: string }): Project => ({
  projectId: over.fullPath,
  path: over.fullPath,
  isStarred: false,
  isMainAgentWorkspace: false,
  ...over,
});

test('taskFormProjects excludes main agent workspace and sorts starred first', () => {
  const main = mkProject({ displayName: 'lovdex', fullPath: '/root', isMainAgentWorkspace: true });
  const star = mkProject({ displayName: 'zeta', fullPath: '/z', isStarred: true });
  const plain = mkProject({ displayName: 'alpha', fullPath: '/a' });
  const out = taskFormProjects([plain, main, star]);
  assert.deepEqual(out.map((p) => p.fullPath), ['/z', '/a']);
});

test('projectPathOf falls back from fullPath to path', () => {
  assert.equal(projectPathOf({ fullPath: '/x' } as Project), '/x');
  assert.equal(projectPathOf({ path: '/y' } as Project), '/y');
});

test('assistant sentinel is a stable string', () => {
  assert.equal(typeof ASSISTANT_OPTION_VALUE, 'string');
});
