import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Task, TaskStatus } from '../../types/app';

import { STATUS_META, taskSessionState } from './taskStatus';
import { formatAbsoluteTime, formatRelativeTime, taskTimeLabel } from './taskTimestamp';
import { VerdictBadge } from './VerdictBadge';

type TaskCardProps = {
  task: Task;
  onStart?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
  onOpenSession?: () => void;
  waitingApproval?: boolean;
};

export const TaskCard = memo(function TaskCard({
  task,
  onStart,
  onStatusChange,
  onOpenSession,
  waitingApproval = false,
}: TaskCardProps) {
  const navigate = useNavigate();
  const sessionState = taskSessionState(task);
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

      {/* Session/approval/failure indicator. A failed task keeps its
          in_progress slot but swaps the running/approval badges for a red
          "执行失败" badge so it never reads as actively running. */}
      {task.session_id && sessionState === 'running' && (
        task.failed ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> 执行失败
          </div>
        ) : waitingApproval ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> 等你批准
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 会话运行中
          </div>
        )
      )}
      {task.session_id && sessionState === 'review' && (
        task.verdict ? (
          <div className="mt-2">
            <VerdictBadge verdict={task.verdict} />
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-purple-500 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 dark:bg-purple-400" /> 待你验收
          </div>
        )
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
        {task.failed && onStart && (
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
      </div>
    </div>
  );
});
