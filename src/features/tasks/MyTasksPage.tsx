import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Inbox,
  Info,
  Plus,
  Search,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getLocalDateISO, isTaskOverdue } from '../../lib/timeMath';
import type { TaskPriority, TaskViewTab } from '../../types/models';
import { TaskRow } from '../../components/tasks/TaskRow';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Field';

const VALID_TABS: TaskViewTab[] = ['today', 'upcoming', 'inbox', 'all', 'completed'];

export function MyTasksPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeTimer,
    nowMs,
    globalSearchQuery,
    setGlobalSearchQuery,
    openCreateTaskDrawer,
    openEditTaskDrawer,
    toggleTaskCompletion,
    startTaskTimer,
    pauseActiveTimer,
    scheduleTaskToDate,
  } = useWorkspace();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TaskViewTab) || 'today';
  const [activeTab, setActiveTab] = useState<TaskViewTab>(
    VALID_TABS.includes(initialTab) ? initialTab : 'today'
  );
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');

  useEffect(() => {
    const paramTab = searchParams.get('tab') as TaskViewTab | null;
    if (paramTab && VALID_TABS.includes(paramTab)) {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  const selectTab = (tab: TaskViewTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const todayIso = getLocalDateISO();
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateISO(d);
  }, []);

  const nonArchived = useMemo(() => tasks.filter((t) => !t.isArchived), [tasks]);

  const counts = useMemo(
    () => ({
      today: nonArchived.filter(
        (t) => t.status !== 'completed' && (t.scheduledDate === todayIso || isTaskOverdue(t, todayIso))
      ).length,
      upcoming: nonArchived.filter(
        (t) => t.status !== 'completed' && t.scheduledDate !== null && t.scheduledDate > todayIso
      ).length,
      inbox: nonArchived.filter((t) => t.status !== 'completed' && t.scheduledDate === null).length,
      all: nonArchived.filter((t) => t.status !== 'completed').length,
      completed: nonArchived.filter((t) => t.status === 'completed').length,
    }),
    [nonArchived, todayIso]
  );

  const visibleTasks = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();

    return nonArchived
      .filter((t) => {
        if (activeTab === 'today') {
          if (t.status === 'completed') return false;
          return t.scheduledDate === todayIso || isTaskOverdue(t, todayIso);
        }
        if (activeTab === 'upcoming') {
          return t.status !== 'completed' && t.scheduledDate !== null && t.scheduledDate > todayIso;
        }
        if (activeTab === 'inbox') {
          return t.status !== 'completed' && t.scheduledDate === null;
        }
        if (activeTab === 'completed') {
          return t.status === 'completed';
        }
        // all active tasks
        return t.status !== 'completed';
      })
      .filter((t) => (projectFilter === 'all' ? true : t.projectId === projectFilter))
      .filter((t) => (priorityFilter === 'all' ? true : t.priority === priorityFilter))
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        if (activeTab === 'upcoming') {
          return (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
        }
        const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        return priorityRank[a.priority] - priorityRank[b.priority];
      });
  }, [activeTab, globalSearchQuery, nonArchived, priorityFilter, projectFilter, todayIso]);

  const upcomingGrouped = useMemo(() => {
    if (activeTab !== 'upcoming') return [];
    const groups = new Map<string, typeof visibleTasks>();
    for (const task of visibleTasks) {
      const key = task.scheduledDate ?? 'Unscheduled';
      const existing = groups.get(key) ?? [];
      existing.push(task);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeTab, visibleTasks]);

  const tabs: { key: TaskViewTab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: counts.today },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { key: 'inbox', label: 'Inbox', count: counts.inbox },
    { key: 'all', label: 'All Tasks', count: counts.all },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
            Workspace / Task Views
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202531]">My Tasks</h1>
          <p className="mt-1 text-sm text-[#667085]">
            Plan Today, review Upcoming dates, triage Inbox items, and keep historical work logs intact.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => openCreateTaskDrawer(activeTab === 'inbox' ? null : todayIso)}
        >
          <Plus className="h-4 w-4" />
          <span>{activeTab === 'inbox' ? 'Add Inbox Task' : 'Add Task'}</span>
        </Button>
      </div>

      {/* Sub-view Tabs */}
      <div
        className="flex items-center gap-1 overflow-x-auto border-b border-[#E4E7EC]"
        role="tablist"
        aria-label="Task list views"
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => selectTab(tab.key)}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'border-[#4968D6] text-[#4968D6]'
                  : 'border-transparent text-[#667085] hover:text-[#202531]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums-strict ${
                  isSelected ? 'bg-[#EDF1FF] text-[#4968D6]' : 'bg-[#F0F2F5] text-[#667085]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inbox Unscheduled Notice (PRD §8.2 & §10.2) */}
      {activeTab === 'inbox' && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#E4E7EC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3574B8]" />
            <div>
              <p className="text-sm font-medium text-[#202531]">Inbox tasks are unscheduled</p>
              <p className="mt-0.5 text-xs text-[#667085]">
                Tasks without a scheduled date remain in Inbox and are not synced to Google Calendar
                until assigned a date.
              </p>
            </div>
          </div>
          <Link
            to="/settings/google-calendar"
            className="text-xs font-medium text-[#4968D6] hover:underline whitespace-nowrap"
          >
            Calendar Sync Rules
          </Link>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E4E7EC] bg-white p-3 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            placeholder="Filter tasks by title or description..."
            aria-label="Filter tasks by keyword"
            className="pl-9"
          />
        </div>

        <div className="sm:col-span-3">
          <Select
            aria-label="Filter by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projects
              .filter((p) => !p.isArchived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | TaskPriority)}
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </Select>
        </div>
      </div>

      {/* Task List Body */}
      {visibleTasks.length === 0 ? (
        <EmptyState
          icon={activeTab === 'inbox' ? <Inbox className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          title={
            activeTab === 'inbox'
              ? 'Inbox is clear'
              : activeTab === 'completed'
                ? 'No completed tasks match your filters'
                : 'No tasks in this view'
          }
          description="Create a new task or adjust your project, priority, or keyword filters."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCreateTaskDrawer(activeTab === 'inbox' ? null : todayIso)}
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </Button>
          }
        />
      ) : activeTab === 'upcoming' ? (
        <div className="space-y-5">
          {upcomingGrouped.map(([dateKey, groupTasks]) => (
            <section key={dateKey} className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#667085]">
                <Calendar className="h-3.5 w-3.5 text-[#98A2B3]" />
                <span className="tabular-nums-strict">{dateKey}</span>
                <span className="rounded-md bg-[#F0F2F5] px-1.5 py-0.5 text-[11px] text-[#667085] tabular-nums-strict">
                  {groupTasks.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {groupTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={projects.find((p) => p.id === task.projectId)}
                    timeEntries={timeEntries}
                    activeTimer={activeTimer}
                    nowMs={nowMs}
                    onToggleComplete={toggleTaskCompletion}
                    onStartTimer={startTaskTimer}
                    onPauseTimer={pauseActiveTimer}
                    onEditTask={openEditTaskDrawer}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleTasks.map((task) => (
            <div key={task.id} className="space-y-1.5">
              <TaskRow
                task={task}
                project={projects.find((p) => p.id === task.projectId)}
                timeEntries={timeEntries}
                activeTimer={activeTimer}
                nowMs={nowMs}
                onToggleComplete={toggleTaskCompletion}
                onStartTimer={startTaskTimer}
                onPauseTimer={pauseActiveTimer}
                onEditTask={openEditTaskDrawer}
              />
              {activeTab === 'inbox' && (
                <div className="flex flex-wrap items-center justify-end gap-2 px-1">
                  <span className="text-xs text-[#667085]">Quick schedule:</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => scheduleTaskToDate(task.id, todayIso)}
                  >
                    Move to Today
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => scheduleTaskToDate(task.id, tomorrowIso)}
                  >
                    Move to Tomorrow
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
