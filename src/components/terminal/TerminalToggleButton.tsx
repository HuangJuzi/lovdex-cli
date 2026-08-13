import { Terminal as TerminalIcon } from 'lucide-react';

import { useTerminalDrawer } from '../../hooks/useTerminalDrawer';
import { cn } from '../../lib/utils';
import { Button } from '../../shared/view/ui';

export function TerminalToggleButton({ className }: { className?: string }) {
  const { open, toggle } = useTerminalDrawer();
  return (
    <Button
      type="button"
      variant={open ? 'chunkyPrimary' : 'chunky'}
      size="toolbar"
      onClick={toggle}
      title="终端 (Ctrl+`)"
      aria-pressed={open}
      className={cn('gap-1.5', className)}
    >
      <TerminalIcon />
      <span className="hidden sm:inline">终端</span>
    </Button>
  );
}