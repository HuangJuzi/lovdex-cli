import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../utils/api';

/**
 * 助手面板入口。
 *
 * 「助手」是一个跑在 operator 工作区的 Claude session（is_operator=1），后端
 * 在 queryClaudeSDK 的 operator 分支里给它换上封闭工具集（list_tasks /
 * create_task / write_task_summary 等，无 Bash/Edit/Write）。
 *
 * 这里只负责「确保有一个 operator session 然后打开它」：复用现有 /session/:id
 * 聊天 UI，不重写一套 chat。用整页跳转（window.location）而非 SPA navigate，
 * 这样 AppContent 的 useProjectsState 会重新拉项目列表（含 operator 工作区
 * 这个项目 + 它的 session），session 才能正确解析为 selectedSession。
 *
 * v1 限制：不在这里渲染 operator session 历史列表/切换；每次点「助手」会复用
 * 最近一个 operator session，没有则新建。历史切换以后再做。
 */
export function AssistantPanel() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. 先看有没有现成的 operator session，有就直接打开最近一个。
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

        // 2. 没有就新建：需要 operator 工作区路径（来自 settings）。
        const cfgRes = await api.operator.settings();
        if (!cfgRes.ok) {
          if (!cancelled) setError('加载 Operator 配置失败');
          return;
        }
        const cfg = (await cfgRes.json()) as { workspace?: string; interactive_chat_enabled?: boolean };
        if (cfg.interactive_chat_enabled === false) {
          if (!cancelled) setError('交互式助手已在设置中关闭');
          return;
        }
        const workspace = cfg.workspace || '';
        if (!workspace) {
          if (!cancelled) setError('Operator 工作区未配置');
          return;
        }

        const createRes = await api.operator.createSession(workspace);
        if (!createRes.ok) {
          if (!cancelled) setError(`创建助手会话失败（${createRes.status}）`);
          return;
        }
        const created = (await createRes.json()) as { data?: { sessionId?: string } };
        const sessionId = created?.data?.sessionId;
        if (!sessionId) {
          if (!cancelled) setError('创建助手会话失败：无 sessionId');
          return;
        }
        if (cancelled) return;
        // 整页跳转：触发 useProjectsState 重新加载（含 operator 工作区项目）。
        window.location.href = `${import.meta.env.BASE_URL}session/${sessionId}`.replace(/\/+/g, '/').replace(/^\/\//, '/');
      } catch (err) {
        if (!cancelled) setError((err as Error).message ?? '启动助手失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

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
      <div className="text-sm text-muted-foreground">正在启动助手…</div>
    </div>
  );
}

export default AssistantPanel;
