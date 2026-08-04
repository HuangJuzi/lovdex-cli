import test from 'node:test';
import assert from 'node:assert/strict';

import type { Project, ProjectSession } from '../../../types/app';
import { getSessionDotState, isProjectActive, sortProjects } from './utils';

const mkSession = (id: string, lastActivity?: string): ProjectSession => ({
  id,
  summary: `session ${id}`,
  lastActivity,
});

const mkProject = (
  projectId: string,
  displayName: string,
  opts: { isStarred?: boolean; sessions?: ProjectSession[] } = {},
): Project => ({
  projectId,
  displayName,
  fullPath: `/${projectId}`,
  isStarred: opts.isStarred ?? false,
  sessions: opts.sessions ?? [],
});

test('isProjectActive returns true when any loaded session is processing', () => {
  const project = mkProject('p1', 'P1', { sessions: [mkSession('s1'), mkSession('s2')] });
  assert.equal(isProjectActive(project, new Set(['s2'])), true);
});

test('isProjectActive handles numeric session ids', () => {
  const project = mkProject('p1', 'P1', { sessions: [{ id: '42', summary: 'x' }] });
  assert.equal(isProjectActive(project, new Set(['42'])), true);
});

test('isProjectActive returns false when no session is processing', () => {
  const project = mkProject('p1', 'P1', { sessions: [mkSession('s1')] });
  assert.equal(isProjectActive(project, new Set(['other'])), false);
});

test('isProjectActive returns false for empty or missing session lists', () => {
  assert.equal(isProjectActive(mkProject('p1', 'P1'), new Set(['s1'])), false);
  const noSessions: Project = { projectId: 'p2', displayName: 'P2', fullPath: '/p2' };
  assert.equal(isProjectActive(noSessions, new Set(['s1'])), false);
});

test('isProjectActive returns false for an empty active set', () => {
  const project = mkProject('p1', 'P1', { sessions: [mkSession('s1')] });
  assert.equal(isProjectActive(project, new Set()), false);
});

test('getSessionDotState prioritizes attention over running', () => {
  assert.equal(getSessionDotState(true, true), 'attention');
  assert.equal(getSessionDotState(true, false), 'attention');
});

test('getSessionDotState maps running to active and idle otherwise', () => {
  assert.equal(getSessionDotState(false, true), 'active');
  assert.equal(getSessionDotState(false, false), 'idle');
});

test('sortProjects floats active projects above inactive regardless of star', () => {
  const activeUnstarred = mkProject('pa', 'Active project', { sessions: [mkSession('a1')] });
  const inactiveStarred = mkProject('pb', 'Starred idle', { isStarred: true });
  const result = sortProjects([inactiveStarred, activeUnstarred], 'name', new Set(['a1']));
  assert.deepEqual(result.map((p) => p.projectId), ['pa', 'pb']);
});

test('sortProjects keeps starred first within the same activity bucket', () => {
  const activeStarred = mkProject('pa', 'B', { isStarred: true, sessions: [mkSession('a1')] });
  const activeUnstarred = mkProject('pb', 'A', { sessions: [mkSession('a1')] });
  const result = sortProjects([activeUnstarred, activeStarred], 'name', new Set(['a1']));
  assert.deepEqual(result.map((p) => p.projectId), ['pa', 'pb']);
});

test('sortProjects falls back to name order for idle projects', () => {
  const result = sortProjects(
    [mkProject('zc', 'Charlie'), mkProject('aa', 'Alpha'), mkProject('bb', 'Bravo')],
    'name',
    new Set(),
  );
  assert.deepEqual(result.map((p) => p.projectId), ['aa', 'bb', 'zc']);
});

test('sortProjects uses date order within an activity bucket', () => {
  const older = mkProject('older', 'Older', { sessions: [mkSession('s1', '2026-01-01T00:00:00Z')] });
  const newer = mkProject('newer', 'Newer', { sessions: [mkSession('s2', '2026-02-01T00:00:00Z')] });
  const result = sortProjects([older, newer], 'date', new Set());
  assert.deepEqual(result.map((p) => p.projectId), ['newer', 'older']);
});
