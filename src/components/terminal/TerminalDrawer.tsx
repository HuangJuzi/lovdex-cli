import { useTerminalDrawer } from '../../hooks/useTerminalDrawer';

import { TerminalDrawerPanel } from './TerminalDrawerPanel';
import { TerminalPane } from './TerminalPane';

export function TerminalDrawer() {
  const { open, setOpen } = useTerminalDrawer();
  return (
    <TerminalDrawerPanel
      open={open}
      onClose={() => setOpen(false)}
      pane={<TerminalPane />}
    />
  );
}
