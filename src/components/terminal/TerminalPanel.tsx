import type { ReactNode } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

type TerminalPanelProps = {
  onClose: () => void;
  /** The terminal pane to mount; injectable for tests. */
  pane?: ReactNode;
};

/**
 * Embedded terminal panel at the bottom of the Files page. The parent mounts it
 * only while the terminal is open, so the pane's WebSocket (and the remote PTY)
 * lives exactly for the panel's lifetime — closing exits the shell.
 */
export function TerminalPanel({ onClose, pane }: TerminalPanelProps) {
  return (
    <div className="flex min-h-[140px] flex-1 flex-col border-t border-border/60 bg-card">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border/60 bg-background px-3 py-1.5">
        <TerminalIcon className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-semibold">终端</span>
        <span className="ml-auto text-[11px] text-muted-foreground">关闭即退出会话</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭终端"
          className="ml-1 rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="relative min-h-0 flex-1">{pane}</div>
    </div>
  );
}
