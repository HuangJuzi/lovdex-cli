import { MessageSquare, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../../../shared/view/ui';
import { cn } from '../../../../lib/utils';

/**
 * 侧边栏顶部的「助手」入口。
 *
 * 布局参考 SidebarProjectItem 的桌面行：助手名在左，[+]（新建助手会话）和
 * [⚙]（Operator 设置）在右，默认 opacity-0，hover 整行时 group-hover:opacity-100
 * 淡入（触屏用 touch:opacity-100 常驻）。设置/新建不一直显示是因为日常只用
 * 助手本身；多数时候复用最近一个会话即可。
 *
 * 点击助手 → /assistant（复用最近会话或新建）；点击 + → /assistant?new=1
 * （强制新建）；点击 ⚙ → /settings/operator。实际跳转到 /session/:id 由
 * AssistantPanel 在整页 reload 后完成（见该组件注释）。
 */
export default function SidebarAssistant() {
  const navigate = useNavigate();
  return (
    <div className="md:group group flex-shrink-0 px-2 pt-1.5 md:px-1.5">
      {/* Mobile: 显式行，按钮常驻（触屏无 hover）。 */}
      <div className="md:hidden">
        <div
          className="mx-1 flex items-center justify-between rounded-lg bg-primary/5 p-2 active:scale-[0.98] transition-all duration-150"
          onClick={() => navigate('/assistant')}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <MessageSquare className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">助手</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-primary active:scale-90"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/assistant?new=1');
              }}
              title="新建助手会话"
              aria-label="新建助手会话"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground active:scale-90"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/settings/operator');
              }}
              title="Operator 设置"
              aria-label="Operator 设置"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: 与 SidebarProjectItem 同款 ghost Button + hover-revealed actions. */}
      <Button
        variant="ghost"
        className={cn(
          'hidden md:flex w-full justify-between p-2 h-auto font-normal hover:bg-primary/10',
          'bg-primary/5',
        )}
        onClick={() => navigate('/assistant')}
        title="Operator 助手"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <MessageSquare className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-primary">
            助手
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <div
            role="button"
            tabIndex={0}
            className="touch:opacity-100 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-all duration-150 hover:bg-primary/20 hover:text-primary hover:ring-1 hover:ring-primary/40 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/assistant?new=1');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                navigate('/assistant?new=1');
              }
            }}
            title="新建助手会话"
            aria-label="新建助手会话"
          >
            <Plus className="!h-5 !w-5" />
          </div>
          <div
            role="button"
            tabIndex={0}
            className="touch:opacity-100 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-all duration-150 hover:bg-foreground/15 hover:text-foreground hover:ring-1 hover:ring-foreground/30 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/settings/operator');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                navigate('/settings/operator');
              }
            }}
            title="Operator 设置"
            aria-label="Operator 设置"
          >
            <Settings className="h-3.5 w-3.5" />
          </div>
        </div>
      </Button>
    </div>
  );
}
