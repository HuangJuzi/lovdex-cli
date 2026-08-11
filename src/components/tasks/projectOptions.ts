import type { Project } from '../../types/app';

/** 「Lovdex 助手」选项的哨兵 value。 */
export const ASSISTANT_OPTION_VALUE = '__lovdex_assistant__';

export const projectPathOf = (project: Project): string => project.fullPath || project.path || '';

/**
 * 任务表单的项目候选：排除主Agent/操作员工作目录，收藏优先，再按 displayName 升序。
 * 「Lovdex 助手」选项由调用方放在列表头部（见 ASSISTANT_OPTION_VALUE）。
 */
export function taskFormProjects(projects: Project[]): Project[] {
  return projects
    .filter((p) => !p.isMainAgentWorkspace && !p.isOperatorWorkspace)
    .sort((a, b) => {
      const aStarred = Boolean(a.isStarred);
      const bStarred = Boolean(b.isStarred);
      if (aStarred !== bStarred) return aStarred ? -1 : 1;
      return (a.displayName || projectPathOf(a)).localeCompare(b.displayName || projectPathOf(b));
    });
}
