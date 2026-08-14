import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import useLocalStorage from '../../../hooks/useLocalStorage';

const MIN_TERMINAL_HEIGHT = 140;
const MIN_FILE_LIST_HEIGHT = 120;

/**
 * Manages the resizable terminal height on the Files page.
 *
 * The height is stored as a fraction (0–1) of the Files content area and
 * persisted in localStorage so the user's chosen split survives closing the
 * terminal, tab switches, and reloads. Dragging the handle between the file
 * list and the terminal updates the fraction, clamped so both panels keep a
 * usable minimum height.
 */
export function useTerminalResize() {
  const [terminalFraction, setTerminalFraction] = useLocalStorage<number>('filesTerminalHeight', 0.5);
  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);

  // useLocalStorage's setter is recreated each render; keep the latest in a ref
  // so the drag effect can subscribe only on [isResizing] without churn.
  const setFractionRef = useRef(setTerminalFraction);
  setFractionRef.current = setTerminalFraction;

  const handleResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    event.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!isResizing) return;
      const container = resizeHandleRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      // The terminal sits at the bottom of the container, so its height is the
      // distance from the pointer to the container's bottom edge.
      const terminalHeight = rect.bottom - event.clientY;
      const minFraction = MIN_TERMINAL_HEIGHT / rect.height;
      const maxFraction = 1 - MIN_FILE_LIST_HEIGHT / rect.height;
      const fraction = Math.min(Math.max(terminalHeight / rect.height, minFraction), maxFraction);
      setFractionRef.current(fraction);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return { terminalFraction, resizeHandleRef, handleResizeStart };
}
