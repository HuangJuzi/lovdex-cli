import { Pill, PillBar } from '../../shared/view/ui';

import type { TaskProjectOption } from './TaskCard';
import { ASSISTANT_OPTION_VALUE } from './projectOptions';
import {
  EMPTY_TASK_FILTER,
  type TaskDateField,
  type TaskFilter,
  type TaskFilterPreset,
} from './taskFilter';

const DATE_FIELD_OPTIONS: { value: TaskDateField; label: string }[] = [
  { value: 'created', label: '创建时间' },
  { value: 'deadline', label: '截止时间' },
  { value: 'activity', label: '最近活动' },
];

const PRESET_OPTIONS: { value: TaskFilterPreset; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '今年' },
  { value: 'all', label: '全部' },
];

type TaskFilterBarProps = {
  projectOptions: TaskProjectOption[];
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
};

/**
 * Task 页筛选栏：项目下拉 + 只看助手开关 + 日期字段切换 + 快捷项 + 自定义范围。
 * 项目单选与助手开关互斥：选具体项目关闭助手；开助手则项目重置为全部。
 */
export function TaskFilterBar({ projectOptions, filter, onChange }: TaskFilterBarProps) {
  const hasFilter =
    filter.projectPath !== '' ||
    filter.assistantOnly ||
    filter.preset !== 'all' ||
    filter.customFrom !== '' ||
    filter.customTo !== '';

  const selectProject = (value: string) => {
    onChange({ ...filter, projectPath: value, assistantOnly: false });
  };

  const toggleAssistant = () => {
    onChange(
      filter.assistantOnly
        ? { ...filter, assistantOnly: false }
        : { ...filter, projectPath: '', assistantOnly: true },
    );
  };

  const pickPreset = (preset: TaskFilterPreset) => {
    onChange({ ...filter, preset, customFrom: '', customTo: '' });
  };

  const presetActive = (preset: TaskFilterPreset) =>
    filter.preset === preset && filter.customFrom === '' && filter.customTo === '';

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-2 sm:px-4">
      {/* 项目下拉 */}
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
        <span className="text-xs text-muted-foreground">项目</span>
        <select
          className="bg-transparent text-xs text-foreground outline-none"
          value={filter.projectPath}
          onChange={(e) => selectProject(e.target.value)}
        >
          <option value="">全部项目</option>
          <option value={ASSISTANT_OPTION_VALUE}>🤖 Lovdex助手</option>
          {projectOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* 只看助手 */}
      <button
        type="button"
        aria-pressed={filter.assistantOnly}
        onClick={toggleAssistant}
        className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
          filter.assistantOnly
            ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
        }`}
      >
        🤖 只看助手
      </button>

      {/* 日期字段 */}
      <PillBar>
        {DATE_FIELD_OPTIONS.map((o) => (
          <Pill
            key={o.value}
            isActive={filter.dateField === o.value}
            onClick={() => onChange({ ...filter, dateField: o.value })}
            className="px-2 py-1.5 text-xs"
          >
            {o.label}
          </Pill>
        ))}
      </PillBar>

      {/* 快捷项 */}
      <PillBar>
        {PRESET_OPTIONS.map((o) => (
          <Pill
            key={o.value}
            isActive={presetActive(o.value)}
            onClick={() => pickPreset(o.value)}
            className="px-2 py-1.5 text-xs"
          >
            {o.label}
          </Pill>
        ))}
      </PillBar>

      {/* 自定义范围 */}
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
        <span className="text-xs text-muted-foreground">从</span>
        <input
          type="date"
          className={`bg-transparent text-xs text-foreground outline-none ${
            filter.customFrom === '' ? 'date-empty' : ''
          }`}
          value={filter.customFrom}
          onChange={(e) => onChange({ ...filter, preset: 'all', customFrom: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">至</span>
        <input
          type="date"
          className={`bg-transparent text-xs text-foreground outline-none ${
            filter.customTo === '' ? 'date-empty' : ''
          }`}
          value={filter.customTo}
          onChange={(e) => onChange({ ...filter, preset: 'all', customTo: e.target.value })}
        />
      </div>

      {/* 清除筛选 */}
      {hasFilter && (
        <button
          type="button"
          className="rounded-md px-2 py-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onChange(EMPTY_TASK_FILTER)}
        >
          清除筛选
        </button>
      )}
    </div>
  );
}
