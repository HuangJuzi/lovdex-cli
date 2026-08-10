import type { TaskVerdict } from '../../types/app';

const VERDICT_META: Record<
  TaskVerdict,
  { label: string; className: string; dot: string }
> = {
  done: {
    label: '已完成',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    dot: 'bg-green-500',
  },
  only_plan: {
    label: '仅出计划',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  needs_review: {
    label: '待你判断',
    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
  blocked: {
    label: '已卡住',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
};

export function VerdictBadge({ verdict }: { verdict: TaskVerdict | null }) {
  if (!verdict) return null;
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
