import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export function isTerminalShortcut(event: { ctrlKey: boolean; altKey: boolean; metaKey: boolean; key: string }): boolean {
  return event.ctrlKey && !event.altKey && !event.metaKey && event.key === '`';
}

type TerminalDrawerContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const TerminalDrawerContext = createContext<TerminalDrawerContextValue | null>(null);

export function TerminalDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTerminalShortcut(event)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<TerminalDrawerContextValue>(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <TerminalDrawerContext.Provider value={value}>{children}</TerminalDrawerContext.Provider>;
}

export function useTerminalDrawer(): TerminalDrawerContextValue {
  const context = useContext(TerminalDrawerContext);
  if (!context) throw new Error('useTerminalDrawer must be used within TerminalDrawerProvider');
  return context;
}
