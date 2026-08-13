import { Terminal as TerminalIcon } from 'lucide-react';

import { useTerminalDrawer } from '../../hooks/useTerminalDrawer';
import { cn } from '../../lib/utils';

export function TerminalToggleButton({ className }: { className?: string }) {
  const { open, toggle } = useTerminalDrawer();
  return (
    <button
      type="button"
      onClick={toggle}
      title="终端 (Ctrl+`)"
      aria-pressed={open}
      className={cn(
        'flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
        open
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border/60 bg-card text-foreground hover:bg-accent',
        className,
      )}
    >
      <TerminalIcon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">终端</span>
    </button>
  );
}
