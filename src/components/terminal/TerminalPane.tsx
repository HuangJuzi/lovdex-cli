import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { buildWebSocketUrl } from '../../utils/wsUrl';
import { createTerminalSession } from './terminalSession';

/**
 * Mounts an xterm.js terminal and a dedicated /ws/terminal WebSocket. The
 * socket is opened on mount and torn down on unmount (closing the drawer
 * therefore exits the remote shell — a fresh shell spawns next open).
 */
export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      theme: { background: '#141414' },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth-token') : null;
    const ws = new WebSocket(buildWebSocketUrl(token, '/ws/terminal'));
    const session = createTerminalSession(term, ws);

    const sendResize = () => {
      try {
        fitAddon.fit();
        session.resize(term.cols, term.rows);
      } catch {
        // container not measurable yet (e.g. drawer animating in); next tick will retry
      }
    };
    sendResize();
    const observer = new ResizeObserver(sendResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      session.dispose();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full bg-[#141414]" />;
}
