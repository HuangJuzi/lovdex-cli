import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

type View = 'chat' | 'tasks';

/**
 * Top-level mode switch between the chat/session workspace ("/") and the task
 * board ("/tasks"). Rendered in both the sidebar header and the task board
 * header so the two views toggle symmetrically, mirroring the sidebar's
 * project FilterToggle segmented-control styling.
 */
export function ViewSwitcher({ active, className }: { active: View; className?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation('sidebar');

  const items: { value: View; label: string; icon: LucideIcon; to: string }[] = [
    { value: 'chat', label: t('navigation.chat'), icon: MessageSquare, to: '/' },
    { value: 'tasks', label: t('navigation.tasks'), icon: ClipboardList, to: '/tasks' },
  ];

  return (
    <div className={cn('flex rounded-lg bg-muted/50 p-0.5', className)}>
      {items.map(({ value, label, icon: Icon, to }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) navigate(to);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-normal transition-all',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
