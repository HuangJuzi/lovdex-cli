import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TerminalPanel } from './TerminalPanel';

test('renders the terminal header with close affordance', () => {
  const html = renderToStaticMarkup(
    React.createElement(TerminalPanel, {
      onClose: () => {},
      pane: React.createElement('div', null, 'pane-stub'),
    }),
  );
  assert.match(html, /终端/);
  assert.match(html, /关闭即退出会话/);
  assert.match(html, /关闭终端/);
});

test('renders the injected pane', () => {
  const html = renderToStaticMarkup(
    React.createElement(TerminalPanel, {
      onClose: () => {},
      pane: React.createElement('div', null, 'pane-stub'),
    }),
  );
  assert.match(html, /pane-stub/);
});
