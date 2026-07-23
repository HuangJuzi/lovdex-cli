import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../shared/view/ui/Command';
import { Dialog, DialogContent, DialogTitle } from '../../../../shared/view/ui/Dialog';
import { api } from '../../../../utils/api';
import type { LLMProvider, ProjectSession } from '../../../../types/app';

interface ResumeSessionOverlayProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  provider: LLMProvider;
  onSelect: (session: ProjectSession) => void;
}

const formatRelativeTime = (iso?: string): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export function ResumeSessionOverlay({
  open,
  onClose,
  projectId,
  provider,
  onSelect,
}: ResumeSessionOverlayProps) {
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await api.projectSessions(projectId, { limit: 50, offset: 0 });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string | { message?: string };
          };
          const errorPayload = payload.error;
          const message =
            typeof errorPayload === 'string'
              ? errorPayload
              : errorPayload && typeof errorPayload === 'object' && errorPayload.message
                ? errorPayload.message
                : 'Failed to load sessions';
          throw new Error(message);
        }
        const page = (await response.json()) as { sessions?: ProjectSession[] };
        if (cancelled) return;
        setSessions(page.sessions ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      const p = (session.provider ?? session.__provider) as LLMProvider | undefined;
      return !p || p === provider;
    });
  }, [sessions, provider]);

  const handleSelect = useCallback(
    (session: ProjectSession) => {
      onSelect(session);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[min(70dvh,32rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-3 p-4">
        <DialogTitle>Resume a conversation</DialogTitle>
        <Command className="flex-1 overflow-hidden">
          <CommandInput placeholder="Search sessions…" />
          <CommandList>
            {loading && <div className="px-3 py-2 text-sm opacity-70">Loading…</div>}
            {error && <div className="px-3 py-2 text-sm text-red-500">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <CommandEmpty>No conversations found.</CommandEmpty>
            )}
            {!loading && !error && filtered.length > 0 && (
              <CommandGroup heading="Recent conversations">
                {filtered.map((session) => (
                  <CommandItem
                    key={session.id}
                    value={`${session.title ?? session.summary ?? session.id} ${session.id}`}
                    onSelect={() => handleSelect(session)}
                  >
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {session.title ?? session.summary ?? 'Untitled conversation'}
                      </span>
                      <span className="text-xs opacity-60">
                        {session.messageCount != null ? `${session.messageCount} messages · ` : ''}
                        {formatRelativeTime(
                          session.lastActivity ?? session.updated_at ?? session.created_at,
                        )}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
