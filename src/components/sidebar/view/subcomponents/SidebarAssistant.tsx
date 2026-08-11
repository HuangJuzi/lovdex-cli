import { MessageSquare, Plus, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../../../shared/view/ui';
import { cn } from '../../../../lib/utils';
import { api } from '../../../../utils/api';
import { formatRelativeTime } from '../../../tasks/taskTimestamp';

type OperatorSession = {
  session_id: string;
  summary: string | null;
  updated_at: string;
  created_at: string;
};

/**
 * 把助手会话打开到 /session/:id。用整页跳转（不是 SPA navigate）这样
 * AppContent 的 useProjectsState 会重新拉项目列表（含 operator 工作区），
 * session 才能正确解析为 selectedSession——和 AssistantPanel 同一理由。
 */
function openSession(sessionId: string) {
  window.location.href = `${import.meta.env.BASE_URL}session/${sessionId}`
    .replace(/\/+/g, '/')
    .replace(/^\/\//, '/');
}

/**
 * 侧边栏顶部的「助手」入口 + 其会话记录列表。
 *
 * 布局参考 SidebarProjectItem 的桌面行：助手名在左，[+]（新建助手会话）和
 * [⚙]（Operator 设置）在右，默认 opacity-0，hover 整行 group-hover:opacity-100
 * 淡入（触屏 touch:opacity-100 常驻）。
 *
 * 助手按钮下面列出 operator session 历史（is_operator=1，按 updated_at 倒序），
 * 点击整页跳转到 /session/:id。挂载时拉一次 + 窗口重新获焦时刷新，覆盖"发完
 * 消息切回来"的场景。
 *
 * 点击助手 → /assistant（复用最近会话或新建）；点击 + → /assistant?new=1
 * （强制新建）；点击 ⚙ → /settings/operator。
 */
export default function SidebarAssistant() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<OperatorSession[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.operator.listSessions();
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { sessions?: OperatorSession[] } };
        if (cancelled) return;
        setSessions(body?.data?.sessions ?? []);
        setNow(new Date());
      } catch {
        // swallow — the list just stays empty
      }
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

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
        {sessions.length > 0 && (
          <div className="mx-1 mb-1 mt-1 max-h-[28vh] overflow-y-auto rounded-lg bg-muted/20 p-1">
            {sessions.map((s) => (
              <button
                key={s.session_id}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent/60"
                onClick={() => openSession(s.session_id)}
                title={s.summary ?? '新会话'}
              >
                <span className="block truncate">{s.summary ?? '新会话'}</span>
                <span className="block text-[10px] text-muted-foreground/70">
                  {formatRelativeTime(s.updated_at || s.created_at, now)}
                </span>
              </button>
            ))}
          </div>
        )}
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

      {/* Desktop: operator session history under the assistant button. */}
      {sessions.length > 0 && (
        <div className="hidden md:block mt-1 max-h-[40vh] overflow-y-auto rounded-lg bg-muted/20 p-1">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            会话记录
          </div>
          {sessions.map((s) => (
            <button
              key={s.session_id}
              className="block w-full truncate rounded-md px-2 py-1.5 text-left hover:bg-accent/60"
              onClick={() => openSession(s.session_id)}
              title={s.summary ?? '新会话'}
            >
              <span className="block truncate text-xs text-foreground">{s.summary ?? '新会话'}</span>
              <span className="block text-[10px] text-muted-foreground/70">
                {formatRelativeTime(s.updated_at || s.created_at, now)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
