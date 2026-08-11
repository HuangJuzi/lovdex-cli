import { ChevronDown, ChevronRight, Check, Edit2, MessageSquare, Plus, Settings, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

const COLLAPSE_KEY = 'lovdex:assistant:sessions-collapsed';

/**
 * 侧边栏顶部的「Lovdex助手」入口 + 其会话记录列表。
 *
 * Lovdex助手 是一个特殊的 Project（operator 工作区）：项目列表里它的工作区
 * 项目被过滤掉（isOperatorWorkspace），会话只在这里展示。折叠行为参考普通
 * Project 的整行折叠——点击 Lovdex助手 整行展开/收起会话列表，右侧 chevron
 * 指示状态。
 *
 * 会话列表（is_operator=1，按 updated_at 倒序）：
 *  - 每行 hover 出 [✎]（重命名）和 [🗑]（删除）；重命名走 api.renameSession，
 *    删除走 api.deleteSession(hard)。
 *  - 点击行用 SPA navigate 打开 /session/:id（不再整页跳转，避免闪屏）。
 *    operator 工作区项目一直保留在全局 projects state 里（仅侧边栏渲染层
 *    过滤），所以 useProjectsState 的 session 解析可以直接命中，无需 reload。
 *
 * 挂载时拉一次 + 窗口重新获焦时刷新。[+] → /assistant?new=1（强制新建）；
 * [⚙] → /settings/operator。
 */
export default function SidebarAssistant() {
  const navigate = useNavigate();
  /** SPA 打开 Lovdex助手 会话；点击行后由 useProjectsState 解析为 selectedSession。 */
  const openSession = useCallback((sessionId: string) => {
    navigate(`/session/${sessionId}`);
  }, [navigate]);
  const [sessions, setSessions] = useState<OperatorSession[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editContainerRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.operator.listSessions();
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { sessions?: OperatorSession[] } };
      setSessions(body?.data?.sessions ?? []);
      setNow(new Date());
    } catch {
      // swallow — the list just stays empty
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const safeLoad = async () => {
      await loadSessions();
      if (cancelled) return;
    };
    void safeLoad();
    const onFocus = () => void safeLoad();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [loadSessions]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  function startEdit(s: OperatorSession) {
    setEditingId(s.session_id);
    setEditingName(s.summary ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function saveEdit() {
    const id = editingId;
    const name = editingName.trim();
    if (!id) return;
    // Empty rename clears the custom summary → falls back to "新会话".
    setSessions((prev) =>
      prev.map((s) => (s.session_id === id ? { ...s, summary: name || null } : s)),
    );
    setEditingId(null);
    setEditingName('');
    try {
      const res = await api.renameSession(id, name);
      if (!res.ok) {
        console.error('rename operator session failed', res.status);
        await loadSessions();
      }
    } catch (err) {
      console.error('rename operator session failed', err);
      await loadSessions();
    }
  }

  async function deleteSession(sessionId: string) {
    if (!window.confirm('删除该 Lovdex助手 会话？历史对话记录将一并删除，不可恢复。')) return;
    setDeleting((prev) => new Set(prev).add(sessionId));
    setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    try {
      const res = await api.deleteSession(sessionId, true);
      if (!res.ok) {
        console.error('delete operator session failed', res.status);
        await loadSessions();
      }
    } catch (err) {
      console.error('delete operator session failed', err);
      await loadSessions();
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }

  // Dismiss the inline rename when clicking outside its panel (matches Escape).
  useEffect(() => {
    if (!editingId) return;
    const onPointerDown = (event: MouseEvent) => {
      const container = editContainerRef.current;
      if (container && !container.contains(event.target as Node)) cancelEdit();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [editingId]);

  /** One session row: open-on-click + hover rename/delete, or inline rename form. */
  const renderRow = (s: OperatorSession) => {
    const isEditing = editingId === s.session_id;
    const label = s.summary ?? '新会话';
    return (
      <div key={s.session_id} className="group/row relative flex items-center">
        {isEditing ? (
          <div ref={editContainerRef} className="flex w-full items-center gap-1 px-1 py-1">
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') void saveEdit();
                else if (e.key === 'Escape') cancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-green-50 hover:bg-green-100 dark:bg-green-900/20"
              onClick={(e) => {
                e.stopPropagation();
                void saveEdit();
              }}
              title="保存"
            >
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            </button>
            <button
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20"
              onClick={(e) => {
                e.stopPropagation();
                cancelEdit();
              }}
              title="取消"
            >
              <X className="h-3 w-3 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        ) : (
          <>
            <button
              className="block min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left hover:bg-accent/60"
              onClick={() => openSession(s.session_id)}
              title={label}
            >
              <span className="block truncate text-xs text-foreground">{label}</span>
              <span className="block text-[10px] text-muted-foreground/70">
                {formatRelativeTime(s.updated_at || s.created_at, now)}
              </span>
            </button>
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
              <button
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(s);
                }}
                title="重命名"
                aria-label="重命名"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/70 hover:bg-red-500/15 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteSession(s.session_id);
                }}
                disabled={deleting.has(s.session_id)}
                title="删除会话"
                aria-label="删除会话"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const hasSessions = sessions.length > 0;
  const expanded = hasSessions && !collapsed;

  /** Collapsible list body shared by mobile + desktop (container classes differ). */
  const sessionList = (containerCls: string) =>
    expanded ? (
      <div className={cn('overflow-y-auto rounded-lg bg-muted/20 p-1', containerCls)}>
        {sessions.map(renderRow)}
      </div>
    ) : null;

  const chevron = hasSessions ? (
    collapsed ? (
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    )
  ) : null;

  return (
    <div className="md:group group flex-shrink-0 px-2 pt-1.5 md:px-1.5">
      {/* Mobile: 显式行，按钮常驻（触屏无 hover）。点击整行折叠。 */}
      <div className="md:hidden">
        <div
          className="mx-1 flex items-center justify-between rounded-lg bg-primary/5 p-2 active:scale-[0.98] transition-all duration-150"
          onClick={toggleCollapsed}
          title={hasSessions ? (collapsed ? '展开 Lovdex助手 会话' : '收起 Lovdex助手 会话') : 'Lovdex助手'}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <MessageSquare className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">Lovdex助手</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-primary active:scale-90"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/assistant?new=1');
              }}
              title="新建 Lovdex助手 会话"
              aria-label="新建 Lovdex助手 会话"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground active:scale-90"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/settings/operator');
              }}
              title="Lovdex助手 设置"
              aria-label="Lovdex助手 设置"
            >
              <Settings className="h-4 w-4" />
            </button>
            {chevron}
          </div>
        </div>
        {sessionList('mr-1 mb-1 mt-0.5 ml-3 max-h-[28vh] border-l border-border pl-3')}
      </div>

      {/* Desktop: 与 SidebarProjectItem 同款 ghost Button + hover-revealed actions. */}
      <Button
        variant="ghost"
        className={cn(
          'hidden md:flex w-full justify-between p-2 h-auto font-normal hover:bg-primary/10',
          'bg-primary/5',
        )}
        onClick={toggleCollapsed}
        title={hasSessions ? (collapsed ? '展开 Lovdex助手 会话' : '收起 Lovdex助手 会话') : 'Lovdex助手'}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <MessageSquare className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-primary">
            Lovdex助手
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
            title="新建 Lovdex助手 会话"
            aria-label="新建 Lovdex助手 会话"
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
            title="Lovdex助手 设置"
            aria-label="Lovdex助手 设置"
          >
            <Settings className="h-3.5 w-3.5" />
          </div>
          {chevron}
        </div>
      </Button>

      {/* Desktop: collapsible Lovdex助手 session history under the row. */}
      {sessionList('ml-3 mt-1 hidden max-h-[40vh] border-l border-border pl-3 md:block')}
    </div>
  );
}
