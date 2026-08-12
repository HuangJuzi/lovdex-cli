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
      className={cn('gap-1.5', className)}
      onClick={() => navigate('/tasks')}
    >
      <ArrowLeft className="h-4 w-4" />
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
      className={cn('gap-1.5', className)}
      onClick={() => navigate('/')}
    >
      <Home className="h-4 w-4" />
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
