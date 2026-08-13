import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TerminalDrawerPanel } from './TerminalDrawerPanel';

test('renders nothing interactive when closed and hides the pane', () => {
  const html = renderToStaticMarkup(
    React.createElement(TerminalDrawerPanel, { open: false, onClose: () => {} }),
  );
  assert.match(html, /translate-x-full/);
  assert.doesNotMatch(html, /pane-stub/);
});

test('renders the pane when open', () => {
  const html = renderToStaticMarkup(
    React.createElement(TerminalDrawerPanel, {
      open: true,
      onClose: () => {},
      pane: React.createElement('div', null, 'pane-stub'),
    }),
  );
  assert.match(html, /translate-x-0/);
  assert.match(html, /pane-stub/);
});
