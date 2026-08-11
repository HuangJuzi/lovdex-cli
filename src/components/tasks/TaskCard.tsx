import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Task, TaskStatus } from '../../types/app';

import { STATUS_META } from './taskStatus';
import { formatAbsoluteTime, formatRelativeTime, taskTimeLabel } from './taskTimestamp';
import { SubStatusBadge } from './SubStatusBadge';

type TaskCardProps = {
  task: Task;
  onStart?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
  onOpenSession?: () => void;
};

export const TaskCard = memo(function TaskCard({
  task,
  onStart,
  onStatusChange,
  onOpenSession,
}: TaskCardProps) {
  const navigate = useNavigate();
  const isClaude = task.executor_provider === 'claude';
  const timeLabel = taskTimeLabel(task);
  const now = new Date();

  return (
    <div
      className="cursor-pointer rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
      onClick={() => navigate(`/task/${task.task_id}`)}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: STATUS_META[task.status].color }}
        />
        <span className="min-w-0 flex-1 break-words text-sm font-semibold text-card-foreground">
          {task.title}
        </span>
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{task.description}</p>
      )}
      {task.ai_summary && (
        <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground/80">
          {task.ai_summary}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
          {task.project_path}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            isClaude
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
        >
          {isClaude ? '◈ Claude' : '◈ Codex'}
        </span>
        {task.executor_model && (
          <span className="rounded-full bg-muted/60 px-2 py-0.5 font-mono text-muted-foreground">
            {task.executor_model}
          </span>
        )}
      </div>

      <div className="mt-1 text-[11px] text-muted-foreground/80" title={formatAbsoluteTime(timeLabel.iso)}>
        {timeLabel.label} {formatRelativeTime(timeLabel.iso, now)}
      </div>

      {task.sub_status && (
        <div className="mt-2">
          <SubStatusBadge subStatus={task.sub_status} />
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-wrap gap-2">
        {task.status === 'todo' && onStart && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            className="min-h-9 min-w-0 flex-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:min-h-0"
          >
            ▶ 开始执行
          </button>
        )}
        {task.sub_status === 'failed' && onStart && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            className="min-h-9 min-w-0 flex-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:min-h-0"
          >
            ↻ 重试
          </button>
        )}
        {task.status === 'in_review' && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange?.('done');
              }}
              className="min-h-9 min-w-0 flex-1 rounded-md bg-green-500/10 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400 sm:min-h-0"
            >
              ✓ 标记完成
            </button>
            {task.session_id && onOpenSession && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSession();
                }}
                className="min-h-9 min-w-0 flex-1 rounded-md bg-primary/10 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 sm:min-h-0"
              >
                打开会话
              </button>
            )}
          </>
        )}
        {task.status === 'in_progress' && task.session_id && onOpenSession && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSession();
            }}
            className="min-h-9 min-w-0 flex-1 rounded-md bg-primary/10 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 sm:min-h-0"
          >
            打开会话
          </button>
        )}
        {['only_plan', 'needs_review', 'blocked'].includes(task.sub_status ?? '') &&
          task.session_id &&
          onOpenSession && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSession();
              }}
              className="min-h-9 min-w-0 flex-1 rounded-md bg-primary/10 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 sm:min-h-0"
            >
              打开会话
            </button>
          )}
      </div>
    </div>
  );
});
