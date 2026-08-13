import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TerminalToggleButton } from './TerminalToggleButton';
import { TerminalDrawerProvider } from '../../hooks/useTerminalDrawer';

function renderToggle() {
  return renderToStaticMarkup(
    React.createElement(TerminalDrawerProvider, null, React.createElement(TerminalToggleButton)),
  );
}

test('renders a terminal button with a label', () => {
  const html = renderToggle();
  assert.match(html, /终端/);
});
