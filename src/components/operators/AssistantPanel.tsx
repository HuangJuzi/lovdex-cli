import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../../utils/api';

/**
 * 助手面板入口（路由组件 /assistant）。
 *
 * 「助手」是一个跑在 operator 工作区的 Claude session（is_operator=1），后端
 * 在 queryClaudeSDK 的 operator 分支里给它换上封闭工具集（list_tasks /
 * create_task / write_task_summary 等，无 Bash/Edit/Write）。
 *
 * 这里只负责「拿到一个 operator session 然后打开它」：复用现有 /session/:id
 * 聊天 UI，不重写一套 chat。用整页跳转（window.location）而非 SPA navigate，
 * 这样 AppContent 的 useProjectsState 会重新拉项目列表（含 operator 工作区
 * 这个项目 + 它的 session），session 才能正确解析为 selectedSession。
 *
 * 两种入口：
 *  - /assistant        → 复用最近一个 operator session，没有则新建
 *  - /assistant?new=1  → 强制新建一个 operator session（侧边栏「+」按钮）
 *
 * 工作区路径由后端 operator 配置决定（不再出现在设置页面），客户端不需要也不
 * 传 projectPath。
 */
export function AssistantPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceNew = searchParams.get('new') === '1';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. 不强制新建时，先复用最近一个现成的 operator session。
        if (!forceNew) {
          const listRes = await api.operator.listSessions();
          if (listRes.ok) {
            const body = (await listRes.json()) as { data?: { sessions?: { session_id?: string }[] } };
            const sessions = body?.data?.sessions ?? [];
            const latest = sessions[0]?.session_id;
            if (latest && !cancelled) {
              window.location.href = `${import.meta.env.BASE_URL}session/${latest}`.replace(/\/+/g, '/').replace(/^\/\//, '/');
              return;
            }
          }
        }

        // 2. 没有现成的（或强制新建）→ 新建。工作区由后端决定。
        const cfgRes = await api.operator.settings();
        if (cfgRes.ok) {
          const cfg = (await cfgRes.json()) as { interactive_chat_enabled?: boolean };
          if (cfg.interactive_chat_enabled === false) {
            if (!cancelled) setError('交互式 Lovdex助手已在设置中关闭');
            return;
          }
        }

        const createRes = await api.operator.createSession();
        if (!createRes.ok) {
          if (!cancelled) setError(`创建 Lovdex助手会话失败（${createRes.status}）`);
          return;
        }
        const created = (await createRes.json()) as { data?: { sessionId?: string } };
        const sessionId = created?.data?.sessionId;
        if (!sessionId) {
          if (!cancelled) setError('创建 Lovdex助手会话失败：无 sessionId');
          return;
        }
        if (cancelled) return;
        // 整页跳转：触发 useProjectsState 重新加载（含 operator 工作区项目）。
        window.location.href = `${import.meta.env.BASE_URL}session/${sessionId}`.replace(/\/+/g, '/').replace(/^\/\//, '/');
      } catch (err) {
        if (!cancelled) setError((err as Error).message ?? '启动 Lovdex助手失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, forceNew]);

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background">
        <div className="text-sm text-red-500">{error}</div>
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={() => navigate('/tasks')}
        >
          返回任务面板
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">正在启动 Lovdex助手…</div>
    </div>
  );
}

export default AssistantPanel;
