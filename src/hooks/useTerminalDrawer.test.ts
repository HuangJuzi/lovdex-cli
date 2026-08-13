import assert from 'node:assert/strict';
import test from 'node:test';

import { isTerminalShortcut } from './useTerminalDrawer';

test('matches Ctrl+`', () => {
  assert.equal(isTerminalShortcut({ ctrlKey: true, altKey: false, metaKey: false, key: '`' }), true);
});

test('rejects a plain backtick without Ctrl', () => {
  assert.equal(isTerminalShortcut({ ctrlKey: false, altKey: false, metaKey: false, key: '`' }), false);
});

test('rejects Ctrl+Shift+` (key becomes ~)', () => {
  assert.equal(isTerminalShortcut({ ctrlKey: true, altKey: false, metaKey: false, key: '~' }), false);
});
