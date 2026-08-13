import type { ReactNode } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

type TerminalDrawerPanelProps = {
  open: boolean;
  onClose: () => void;
  /** The terminal pane to mount while open; injectable for tests. */
  pane?: ReactNode;
};

/**
 * Presentational slide-out terminal drawer. The pane is only mounted while
 * `open` so its WebSocket (and the remote PTY) exists exactly for the drawer's
 * lifetime — closing the drawer exits the shell.
 */
export function TerminalDrawerPanel({ open, onClose, pane }: TerminalDrawerPanelProps) {
  return (
    <div className={cn('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div
        className={cn(
          'absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-150',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute right-0 top-0 flex h-full w-[min(72vw,720px)] flex-col border-l border-border/60 bg-card shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-border/60 bg-background px-3 py-2">
          <TerminalIcon className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold">终端</span>
          <span className="ml-auto text-[11px] text-muted-foreground">关闭即退出会话</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭终端"
            className="ml-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        {open && <div className="min-h-0 flex-1">{pane}</div>}
      </div>
    </div>
  );
}
