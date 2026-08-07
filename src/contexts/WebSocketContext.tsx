import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../constants/config';
import { dbg } from '../dbg';

/**
 * One frame received from the chat websocket. The server guarantees every
 * frame carries a `kind` (provider message kinds plus gateway kinds such as
 * `chat_subscribed`, `session_upserted`, `loading_progress`,
 * `protocol_error`). The synthetic `websocket_reconnected` kind is injected
 * client-side when the socket re-opens after a drop.
 */
export type ServerEvent = {
  kind?: string;
  type?: string;
  sessionId?: string;
  seq?: number;
  [key: string]: unknown;
};

type ServerEventListener = (event: ServerEvent) => void;

type WebSocketContextType = {
  ws: WebSocket | null;
  sendMessage: (message: unknown) => void;
  /**
   * Subscribes to every websocket frame. Returns an unsubscribe function.
   *
   * This is the primary consumption API: events are dispatched synchronously
   * to every listener, so rapid back-to-back frames can never be coalesced or
   * dropped the way a single "latest message" state slot could.
   */
  subscribe: (listener: ServerEventListener) => () => void;
  isConnected: boolean;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

const buildWebSocketUrl = () => {
  // When API_BASE_URL is set (cross-origin backend), derive the WS URL from it;
  // otherwise fall back to same-origin (dev proxy / monolith deployment).
  if (API_BASE_URL) {
    const httpUrl = new URL(API_BASE_URL);
    const protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${httpUrl.host}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

const useWebSocketProviderState = (): WebSocketContextType => {
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false); // Track if component is unmounted
  const hasConnectedRef = useRef(false); // Track if we've ever connected (to detect reconnects)
  /**
   * Listener registry for the subscribe API. A ref (not state) because the
   * set must be readable synchronously inside `onmessage` and never trigger
   * re-renders of the provider tree.
   */
  const listenersRef = useRef(new Set<ServerEventListener>());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /**
   * Outbox for messages sent while the socket was not OPEN. They are flushed
   * in order on (re)connect. Without this, a send during a brief disconnect
   * (e.g. after a Vite proxy idle drop, before the 3s reconnect) would be
   * silently dropped while the UI had already optimistically shown the
   * message as sent+processing — the user would see their message with no
   * reply forever.
   */
  const outboxRef = useRef<unknown[]>([]);

  const dispatch = useCallback((event: ServerEvent) => {
    for (const listener of listenersRef.current) {
      try {
        listener(event);
      } catch (error) {
        console.error('WebSocket listener error:', error);
      }
    }
  }, []);

  useEffect(() => {
    // The cleanup below sets unmountedRef = true. Without this reset, a re-run
    // of the effect would short-circuit connect() at its unmounted guard and
    // leave the socket permanently disconnected.
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return; // Prevent connection if unmounted
    try {
      const wsUrl = buildWebSocketUrl();

      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        dbg('WS onopen');
        setIsConnected(true);
        wsRef.current = websocket;
        // Flush anything queued while the socket was down, in order.
        const pending = outboxRef.current;
        outboxRef.current = [];
        for (const queued of pending) {
          try {
            websocket.send(JSON.stringify(queued));
          } catch (error) {
            console.error('WebSocket failed to flush queued message:', error);
          }
        }
        if (hasConnectedRef.current) {
          // This is a reconnect — signal so components can catch up on missed messages
          dispatch({ kind: 'websocket_reconnected', timestamp: Date.now() });
        }
        hasConnectedRef.current = true;
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerEvent;
          dispatch(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        dbg('WS onclose -> reconnect in 3s');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (unmountedRef.current) return; // Prevent reconnection if unmounted
          connect();
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('WebSocket error', error);
    }
  }, [dispatch]);

  const sendMessage = useCallback((message: unknown) => {
    const socket = wsRef.current;
    const ready = socket ? socket.readyState : 'no-socket';
    const t = (message as { type?: string })?.type ?? '?';
    dbg(`sendMessage type=${t} ready=${ready} open=${WebSocket.OPEN} outbox=${outboxRef.current.length}`);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      dbg(`sent type=${t}`);
    } else {
      // Socket is down (initial connect or between reconnects). Queue so the
      // message is delivered once the socket reopens instead of being lost.
      outboxRef.current.push(message);
      dbg(`queued type=${t} (WS not open)`);
    }
  }, []);

  const subscribe = useCallback((listener: ServerEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value: WebSocketContextType = useMemo(() =>
  ({
    ws: wsRef.current,
    sendMessage,
    subscribe,
    isConnected
  }), [sendMessage, subscribe, isConnected]);

  return value;
};

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const webSocketData = useWebSocketProviderState();

  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
