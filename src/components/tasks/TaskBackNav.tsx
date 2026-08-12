import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '../../lib/utils';
import { Button } from '../../shared/view/ui';

/** 「← 返回任务面板」outline 按钮，供 OperatorSettingsPage 头部复用。 */
export function BackToTasksButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'gap-1.5 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:text-blue-600 dark:border-blue-400/40 dark:hover:bg-blue-400/15 dark:hover:text-blue-400',
        className,
      )}
      onClick={() => navigate('/tasks')}
    >
      <ArrowLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      返回任务面板
    </Button>
  );
}

/** 「返回主页」outline 按钮。 */
export function HomeButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'gap-1.5 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:text-amber-600 dark:border-amber-400/40 dark:hover:bg-amber-400/15 dark:hover:text-amber-400',
        className,
      )}
      onClick={() => navigate('/')}
    >
      <Home className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      返回主页
    </Button>
  );
}

/** TaskDetail 头部右侧的两个返回按钮。 */
export function TaskBackNav({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BackToTasksButton />
      <HomeButton className="hidden sm:inline-flex" />
    </div>
  );
}
