import { API_BASE_URL } from '../constants/config';

/**
 * Builds the chat WebSocket URL. Browsers cannot set headers on WebSocket
 * connections, so a valid auth token is appended as `?token=` (the backend's
 * verifyWebSocketClient reads it). Returns the bare URL when no token is
 * present (e.g. IS_PLATFORM deployments that bypass the login gate).
 */
export function buildWebSocketUrl(token?: string | null): string {
  const wsBase = API_BASE_URL
    ? (() => {
        const httpUrl = new URL(API_BASE_URL);
        const protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${httpUrl.host}/ws`;
      })()
    : (() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
      })();
  return token ? `${wsBase}?token=${encodeURIComponent(token)}` : wsBase;
}
