import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Folder,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import type { ActiveTimerState, Project, Task } from '../../../types/models';
import { formatDuration } from '../../../lib/timeMath';

export type DashboardFilter = 'all' | 'todo' | 'in_progress' | 'completed';

export interface TodayTaskListProps {
  todayTasks: Task[];
  filteredTasks: Task[];
  projects: Project[];
  activeTimer: ActiveTimerState | null;
  statusFilter: DashboardFilter;
  todoCount: number;
  inProgressCount: number;
  completedCount: number;
  onStatusFilterChange: (filter: DashboardFilter) => void;
  onToggleComplete: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
  onEditTask: (task: Task) => void;
  onQuickAdd: (title: string) => void;
  onOpenCreateDrawer: () => void;
}

export function TodayTaskList({
  todayTasks,
  filteredTasks,
  projects,
  activeTimer,
  statusFilter,
  todoCount,
  inProgressCount,
  completedCount,
  onStatusFilterChange,
  onToggleComplete,
  onStartTimer,
  onPauseTimer,
  onEditTask,
  onQuickAdd,
  onOpenCreateDrawer,
}: TodayTaskListProps) {
  const [quickTitle, setQuickTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    onQuickAdd(trimmed);
    setQuickTitle('');
  };

  return (
    <section
      aria-label="Today's Tasks"
      className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]"
    >
      {/* Header: Title, Count Badge & View All Link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold text-[#1A1F2C]">Today</h2>
          <span className="rounded-full bg-[#EDF2FE] px-3 py-0.5 text-xs font-semibold text-[#2F65F6] tabular-nums-strict">
            {todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#2F65F6] hover:underline cursor-pointer"
        >
          <span>View all</span>
          <ChevronRight className="h-4 w-4 stroke-[2.5]" />
        </Link>
      </div>

      {/* Quick Inline Task Capture Form */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-2 transition-all focus-within:border-[#2F65F6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2F65F6]/15"
      >
        <Plus className="ml-2.5 h-4 w-4 text-[#98A2B3] shrink-0" />
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task for today and press Enter..."
          aria-label="Quick add task for today"
          className="h-9 flex-1 bg-transparent px-2 text-sm text-[#1A1F2C] placeholder:text-[#98A2B3] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!quickTitle.trim()}
          className="rounded-xl bg-[#2F65F6] px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40 cursor-pointer active:scale-95"
        >
          Add
        </button>
      </form>

      {/* Filter Tabs Bar */}
      <div
        className="mt-4 flex items-center gap-1.5 border-b border-[#F0F3F9] pb-3"
        role="tablist"
        aria-label="Filter tasks by status"
      >
        {(
          [
            { key: 'all', label: `All (${todayTasks.length})` },
            { key: 'todo', label: `To Do (${todoCount})` },
            { key: 'in_progress', label: `In Progress (${inProgressCount})` },
            { key: 'completed', label: `Done (${completedCount})` },
          ] as { key: DashboardFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.key}
            onClick={() => onStatusFilterChange(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === tab.key
                ? 'bg-[#EDF2FE] text-[#2F65F6]'
                : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task Rows List */}
      {filteredTasks.length > 0 ? (
        <div className="mt-2 divide-y divide-[#F0F3F9]">
          {filteredTasks.map((task) => {
            const project = projects.find((p) => p.id === task.projectId);
            const isDone = task.status === 'completed';
            const isThisTaskActive = activeTimer?.taskId === task.id;

            return (
              <div
                key={task.id}
                className="group -mx-2.5 flex items-center justify-between gap-3 rounded-2xl px-2.5 py-3.5 transition-colors hover:bg-[#F9FAFD]/80"
              >
                {/* Left: Checkbox + Title + Project */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={
                      isDone
                        ? `Mark ${task.title} incomplete`
                        : `Complete ${task.title}`
                    }
                    onClick={() => onToggleComplete(task.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all cursor-pointer ${
                      isDone
                        ? 'bg-[#2F65F6] text-white shadow-xs'
                        : 'border-2 border-[#D0D5DD] bg-white hover:border-[#2F65F6]'
                    }`}
                  >
                    {isDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/tasks/${task.id}`}
                      className={`block truncate text-sm font-semibold transition-colors ${
                        isDone
                          ? 'text-[#98A2B3] line-through'
                          : isThisTaskActive
                            ? 'text-[#2F65F6]'
                            : 'text-[#1A1F2C] hover:text-[#2F65F6]'
                      }`}
                    >
                      {task.title}
                    </Link>

                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#7E8B9B]">
                      <Folder className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {project ? project.name : 'Personal Workspace'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Duration + Play Timer Button + Options */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs font-semibold text-[#1A1F2C] tabular-nums-strict">
                    {task.plannedDurationMinutes
                      ? formatDuration(task.plannedDurationMinutes * 60)
                      : '—'}
                  </span>

                  {!isDone && (
                    <button
                      type="button"
                      onClick={() =>
                        isThisTaskActive && activeTimer?.status === 'running'
                          ? onPauseTimer()
                          : onStartTimer(task.id)
                      }
                      aria-label={
                        isThisTaskActive && activeTimer?.status === 'running'
                          ? `Pause timer for ${task.title}`
                          : `Start timer for ${task.title}`
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer active:scale-95 ${
                        isThisTaskActive
                          ? 'bg-[#2F65F6] text-white shadow-sm'
                          : 'bg-[#EDF2FE] text-[#2F65F6] hover:bg-[#DDE7FD]'
                      }`}
                    >
                      {isThisTaskActive && activeTimer?.status === 'running' ? (
                        <Pause className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEditTask(task)}
                    aria-label={`Edit task ${task.title}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#98A2B3] hover:bg-[#F0F2F5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-[#10B981]" />
          <h3 className="mt-2 text-sm font-bold text-[#1A1F2C]">
            {todayTasks.length === 0
              ? 'All tasks cleared for today'
              : 'No matching tasks'}
          </h3>
          <p className="mt-1 text-xs text-[#7E8B9B]">
            {todayTasks.length === 0
              ? 'Add a task above or take time to recharge.'
              : 'Try selecting a different filter tab.'}
          </p>
          {todayTasks.length === 0 && (
            <button
              type="button"
              onClick={onOpenCreateDrawer}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#EDF2FE] px-4 py-1.5 text-xs font-semibold text-[#2F65F6] hover:bg-[#DDE7FD] transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add a task for today</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
