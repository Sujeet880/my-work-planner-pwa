import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Folder,
  Inbox,
  ListTodo,
  Play,
  Pause,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateSavedWorkSeconds,
  formatDuration,
  getLocalDateISO,
  isTaskOverdue,
} from '../../lib/timeMath';
import type { TaskPriority, TaskViewTab } from '../../types/models';
import { TaskRow } from '../../components/tasks/TaskRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Field';

const VALID_TABS: TaskViewTab[] = ['today', 'upcoming', 'inbox', 'all', 'completed', 'archived'];

export function MyTasksPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeTimer,
    activeTask,
    activeElapsedSeconds,
    nowMs,
    openCreateTaskDrawer,
    openEditTaskDrawer,
    toggleTaskCompletion,
    startTaskTimer,
    pauseActiveTimer,
    resumeActiveTimer,
    stopAndSaveActiveTimer,
    scheduleTaskToDate,
    saveTask,
  } = useWorkspace();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TaskViewTab) || 'today';
  const [activeTab, setActiveTab] = useState<TaskViewTab>(
    VALID_TABS.includes(initialTab) ? initialTab : 'today'
  );

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [todaySubFilter, setTodaySubFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');

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

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }, []);

  const nonArchived = useMemo(() => tasks.filter((t) => !t.isArchived), [tasks]);

  const counts = useMemo(
    () => ({
      today: nonArchived.filter(
        (t) =>
          t.status !== 'completed' &&
          (t.scheduledDate === todayIso || isTaskOverdue(t, todayIso))
      ).length,
      upcoming: nonArchived.filter(
        (t) =>
          t.status !== 'completed' &&
          t.scheduledDate !== null &&
          t.scheduledDate > todayIso
      ).length,
      inbox: nonArchived.filter(
        (t) => t.status !== 'completed' && t.scheduledDate === null
      ).length,
      all: nonArchived.filter((t) => t.status !== 'completed').length,
      completed: nonArchived.filter((t) => t.status === 'completed').length,
      archived: tasks.filter((t) => t.isArchived).length,
    }),
    [nonArchived, tasks, todayIso]
  );

  // Today specific lists and calculations
  const todayAllTasks = useMemo(
    () =>
      nonArchived.filter(
        (t) => t.scheduledDate === todayIso || isTaskOverdue(t, todayIso)
      ),
    [nonArchived, todayIso]
  );

  const todayCompletedCount = todayAllTasks.filter((t) => t.status === 'completed').length;
  const todayTotalCount = todayAllTasks.length;
  const todayRemainingCount = todayTotalCount - todayCompletedCount;

  const savedEntriesToday = useMemo(
    () =>
      timeEntries.filter(
        (e) => e.status === 'completed' && e.startedAt.startsWith(todayIso)
      ),
    [timeEntries, todayIso]
  );

  const savedTodaySeconds = calculateSavedWorkSeconds(savedEntriesToday);
  const liveTrackedTodaySeconds = savedTodaySeconds + activeElapsedSeconds;

  // Filtered tasks for current active tab
  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const baseTasks = activeTab === 'archived' ? tasks.filter((t) => t.isArchived) : nonArchived;

    return baseTasks
      .filter((t) => {
        if (activeTab === 'archived') {
          return true;
        }
        if (activeTab === 'today') {
          const isTodayTask = t.scheduledDate === todayIso || isTaskOverdue(t, todayIso);
          if (!isTodayTask) return false;
          if (todaySubFilter === 'completed') return t.status === 'completed';
          if (todaySubFilter === 'todo') return t.status === 'todo';
          if (todaySubFilter === 'in_progress') return t.status === 'in_progress';
          return true; // 'all'
        }
        if (activeTab === 'upcoming') {
          return (
            t.status !== 'completed' &&
            t.scheduledDate !== null &&
            t.scheduledDate > todayIso
          );
        }
        if (activeTab === 'inbox') {
          return t.status !== 'completed' && t.scheduledDate === null;
        }
        if (activeTab === 'completed') {
          return t.status === 'completed';
        }
        // 'all' active tasks
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
        const priorityRank: Record<TaskPriority, number> = {
          high: 0,
          medium: 1,
          low: 2,
        };
        return priorityRank[a.priority] - priorityRank[b.priority];
      });
  }, [
    activeTab,
    nonArchived,
    tasks,
    todayIso,
    todaySubFilter,
    projectFilter,
    priorityFilter,
    searchQuery,
  ]);

  // Grouped for Upcoming view
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

  // Grouped by priority for 'All Tasks' view
  const allTasksByPriority = useMemo(() => {
    if (activeTab !== 'all') return { high: [], medium: [], low: [] };
    return {
      high: visibleTasks.filter((t) => t.priority === 'high'),
      medium: visibleTasks.filter((t) => t.priority === 'medium'),
      low: visibleTasks.filter((t) => t.priority === 'low'),
    };
  }, [activeTab, visibleTasks]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = quickTitle.trim();
    if (!t) return;
    saveTask({
      title: t,
      description: '',
      projectId: null,
      priority: 'medium',
      scheduledDate: activeTab === 'inbox' ? '' : todayIso,
      scheduledStartTime: '',
      plannedDurationMinutes: '',
      reminderOffsetMinutes: '',
      syncToGoogleCalendar: activeTab !== 'inbox',
    });
    setQuickTitle('');
  };

  const tabs: { key: TaskViewTab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: counts.today },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { key: 'inbox', label: 'Inbox', count: counts.inbox },
    { key: 'all', label: 'All Tasks', count: counts.all },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'archived', label: 'Archived', count: counts.archived },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* 1. Page Header (Identical to Dashboard Header) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">
            {activeTab === 'today'
              ? 'Today'
              : activeTab === 'upcoming'
                ? 'Upcoming'
                : activeTab === 'inbox'
                  ? 'Inbox'
                  : activeTab === 'completed'
                    ? 'Completed'
                    : activeTab === 'archived'
                      ? 'Archived'
                      : 'My Tasks'}
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            {activeTab === 'today'
              ? `${formattedDate} · Focus on executing today's plan`
              : activeTab === 'upcoming'
                ? 'Look ahead across future deadlines and scheduled commitments'
                : activeTab === 'inbox'
                  ? `${counts.inbox} unscheduled ideas awaiting your decision`
                  : activeTab === 'completed'
                    ? `${counts.completed} tasks accomplished`
                    : activeTab === 'archived'
                      ? `${counts.archived} archived tasks with preserved historical work sessions`
                      : 'Overview of all active workspace tasks'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Search tasks"
            onClick={() => setShowSearchInput((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all cursor-pointer ${
              showSearchInput
                ? 'border-[#2F65F6] bg-[#EDF2FE] text-[#2F65F6] shadow-sm'
                : 'border-[#E9ECF5] bg-white text-[#1A1F2C] shadow-sm hover:bg-[#F8FAFD]'
            }`}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E9ECF5] bg-white text-[#1A1F2C] shadow-sm hover:bg-[#F8FAFD] transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#2F65F6] ring-2 ring-white" />
          </button>

          <button
            type="button"
            onClick={() =>
              openCreateTaskDrawer(activeTab === 'inbox' ? null : todayIso)
            }
            className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_6px_20px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{activeTab === 'inbox' ? 'Add to Inbox' : 'New task'}</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-view Pill Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => selectTab(tab.key)}
              className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#2F65F6] text-white shadow-[0_4px_14px_rgba(47,101,246,0.3)]'
                  : 'bg-white/80 text-[#7E8B9B] border border-[#E9ECF5] hover:bg-white hover:text-[#1A1F2C]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums-strict font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EDF2FE] text-[#2F65F6]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Collapsible / Floating Filter Bar */}
      <div className="flex flex-col gap-3 rounded-[24px] border border-white/80 bg-white/80 p-3.5 shadow-[0_8px_25px_rgba(25,45,100,0.03)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="h-9.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] pl-9 pr-8 text-xs font-medium text-[#1A1F2C] placeholder:text-[#9AA6B8] focus:bg-white focus:border-[#2F65F6] focus:outline-none focus:ring-4 focus:ring-[#2F65F6]/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#1A1F2C]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9.5 rounded-xl border-[#E9ECF5] bg-[#F8FAFD] text-xs font-semibold w-auto min-w-[130px]"
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

          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | TaskPriority)}
            className="h-9.5 rounded-xl border-[#E9ECF5] bg-[#F8FAFD] text-xs font-semibold w-auto min-w-[125px]"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </Select>
        </div>
      </div>

      {/* 4. Tab Specific Layout Presentation */}

      {/* ======================= TAB: TODAY ======================= */}
      {activeTab === 'today' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Main Column (~65%) */}
          <div className="space-y-6 lg:col-span-8">
            {/* Today's Tasks Glass Card */}
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              {/* Header with Sub-filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#F0F3F9] pb-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-[#1A1F2C]">Today&apos;s Focus</h2>
                  <span className="rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-xs font-bold text-[#2F65F6] tabular-nums-strict">
                    {todayAllTasks.length} tasks
                  </span>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-[#E9ECF5] bg-[#F8FAFD] p-1">
                  {(['all', 'todo', 'in_progress', 'completed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTodaySubFilter(mode)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                        todaySubFilter === mode
                          ? 'bg-white text-[#2F65F6] shadow-xs'
                          : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                      }`}
                    >
                      {mode === 'all'
                        ? 'All'
                        : mode === 'todo'
                          ? 'To Do'
                          : mode === 'in_progress'
                            ? 'In Progress'
                            : 'Done'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline Quick Capture Bar */}
              <form onSubmit={handleQuickAdd} className="mt-4 mb-4">
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFD]/80 px-3.5 py-2 transition-all focus-within:border-[#2F65F6] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#2F65F6]/10">
                  <Plus className="h-4 w-4 text-[#2F65F6] shrink-0" />
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder="Quick capture task for today... (Press Enter)"
                    className="flex-1 bg-transparent text-xs font-medium text-[#1A1F2C] placeholder:text-[#9AA6B8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!quickTitle.trim()}
                    className="rounded-full bg-[#2F65F6] px-3 py-1 text-xs font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2554DB] transition-all cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Task Rows */}
              {visibleTasks.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6 text-[#10B981]" />}
                  title="No tasks match your selection"
                  description="All scheduled tasks for today in this filter are completed or none exist."
                  action={
                    <button
                      type="button"
                      onClick={() => openCreateTaskDrawer(todayIso)}
                      className="rounded-full bg-[#2F65F6] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2554DB]"
                    >
                      Add Today&apos;s Task
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {visibleTasks.map((task) => (
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
              )}
            </section>
          </div>

          {/* Side Column (~35%): Daily Overview & Priority Breakdown */}
          <div className="space-y-6 lg:col-span-4">
            {/* Daily Overview Ring Card */}
            <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              <h3 className="text-base font-bold text-[#1A1F2C]">Daily Overview</h3>
              <div className="mt-5 flex items-center justify-between gap-4">
                {/* Ring Indicator */}
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      className="stroke-[#E9ECF5]"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      className="stroke-[#2F65F6] transition-all duration-500"
                      strokeWidth="3.5"
                      strokeDasharray="94.25"
                      strokeDashoffset={
                        todayTotalCount === 0
                          ? 94.25
                          : 94.25 - (todayCompletedCount / todayTotalCount) * 94.25
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-base font-bold text-[#1A1F2C] tabular-nums-strict">
                      {todayCompletedCount}/{todayTotalCount}
                    </span>
                    <span className="text-[10px] font-semibold text-[#7E8B9B]">Tasks</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex-1 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#7E8B9B]">
                      <Clock className="h-3.5 w-3.5 text-[#2F65F6]" />
                      Tracked time
                    </span>
                    <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
                      {formatDuration(liveTrackedTodaySeconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#7E8B9B]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                      Completed
                    </span>
                    <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
                      {todayCompletedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#7E8B9B]">
                      <span className="h-2 w-2 rounded-full border border-[#98A2B3]" />
                      Remaining
                    </span>
                    <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
                      {todayRemainingCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Focus Note Card */}
            <div className="rounded-[28px] border border-white/80 bg-gradient-to-br from-[#EDF2FE]/70 to-[#F4F7FD]/80 p-5 shadow-[0_8px_25px_rgba(25,45,100,0.02)] backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2F65F6]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2F65F6]">
                  Deep Focus Tip
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#6E7687]">
                Start the live timer for your highest priority task first. Continuous focus without
                multitasking leads to measurable time savings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB: UPCOMING ======================= */}
      {activeTab === 'upcoming' && (
        <div className="space-y-6">
          {upcomingGrouped.length === 0 ? (
            <div className="rounded-[28px] border border-white/80 bg-white/85 p-8 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              <EmptyState
                icon={<Calendar className="h-6 w-6 text-[#2F65F6]" />}
                title="No upcoming scheduled tasks"
                description="Assign scheduled dates to tasks to organize future work sprints."
                action={
                  <button
                    type="button"
                    onClick={() => openCreateTaskDrawer(tomorrowIso)}
                    className="rounded-full bg-[#2F65F6] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#2554DB]"
                  >
                    Schedule a Future Task
                  </button>
                }
              />
            </div>
          ) : (
            upcomingGrouped.map(([dateKey, groupTasks]) => {
              const isTomorrow = dateKey === tomorrowIso;
              const totalPlannedMins = groupTasks.reduce(
                (sum, t) => sum + (t.plannedDurationMinutes || 0),
                0
              );

              return (
                <section
                  key={dateKey}
                  className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#F0F3F9] pb-3.5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#EDF2FE] px-3.5 py-1 text-xs font-bold text-[#2F65F6] tabular-nums-strict">
                        {isTomorrow ? 'Tomorrow' : dateKey}
                      </span>
                      <span className="text-xs font-semibold text-[#7E8B9B]">
                        {groupTasks.length} task{groupTasks.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {totalPlannedMins > 0 && (
                      <span className="text-xs font-semibold text-[#7E8B9B] tabular-nums-strict">
                        Planned:{' '}
                        <strong className="text-[#1A1F2C]">{formatDuration(totalPlannedMins * 60)}</strong>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
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
              );
            })
          )}
        </div>
      )}

      {/* ======================= TAB: INBOX ======================= */}
      {activeTab === 'inbox' && (
        <div className="space-y-6">
          {/* Inbox Triage Hero Card */}
          <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 sm:p-7 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6] shadow-sm">
                  <Inbox className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-[#1A1F2C]">Unscheduled Inbox</h2>
                    <span className="rounded-full bg-[#EDF2FE] px-3 py-0.5 text-xs font-bold text-[#2F65F6] tabular-nums-strict">
                      {counts.inbox}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7E8B9B] max-w-xl leading-relaxed">
                    Capture raw thoughts and ideas here. When ready, triage each task by moving it to
                    Today or scheduling it for a future date.
                  </p>
                </div>
              </div>

              {/* Inline Quick Capture into Inbox */}
              <form onSubmit={handleQuickAdd} className="w-full sm:w-auto">
                <div className="flex items-center gap-2 rounded-full border border-[#E9ECF5] bg-[#F8FAFD] p-1.5 focus-within:bg-white focus-within:border-[#2F65F6] focus-within:ring-4 focus-within:ring-[#2F65F6]/10">
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder="Capture into inbox..."
                    className="w-full sm:w-56 bg-transparent px-3 text-xs font-medium text-[#1A1F2C] placeholder:text-[#9AA6B8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!quickTitle.trim()}
                    className="rounded-full bg-[#2F65F6] px-3.5 py-1 text-xs font-semibold text-white disabled:opacity-30 hover:bg-[#2554DB] transition-all cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Inbox Task Listing with Quick Scheduling Actions */}
          {visibleTasks.length === 0 ? (
            <div className="rounded-[28px] border border-white/80 bg-white/85 p-8 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              <EmptyState
                icon={<Inbox className="h-6 w-6 text-[#2F65F6]" />}
                title="Your Inbox is completely clear"
                description="All captured thoughts and tasks have been scheduled or completed."
                action={
                  <button
                    type="button"
                    onClick={() => openCreateTaskDrawer(null)}
                    className="rounded-full bg-[#2F65F6] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#2554DB]"
                  >
                    Capture an Idea
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3.5">
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_8px_25px_rgba(25,45,100,0.03)] backdrop-blur-md transition-all hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)]"
                >
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

                  {/* Quick Triage Buttons */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F3F9] pt-2.5 text-xs">
                    <span className="font-semibold text-[#7E8B9B]">Triage task:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => scheduleTaskToDate(task.id, todayIso)}
                        className="rounded-full bg-[#EDF2FE] px-3.5 py-1 text-xs font-bold text-[#2F65F6] hover:bg-[#DDE7FD] transition-colors cursor-pointer"
                      >
                        Move to Today
                      </button>
                      <button
                        type="button"
                        onClick={() => scheduleTaskToDate(task.id, tomorrowIso)}
                        className="rounded-full bg-white border border-[#E9ECF5] px-3.5 py-1 text-xs font-semibold text-[#1A1F2C] hover:bg-[#F8FAFD] transition-colors cursor-pointer"
                      >
                        Move to Tomorrow
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB: ALL TASKS ======================= */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          {(['high', 'medium', 'low'] as const).map((pri) => {
            const list = allTasksByPriority[pri];
            if (list.length === 0) return null;

            return (
              <section
                key={pri}
                className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl space-y-3.5"
              >
                <div className="flex items-center justify-between border-b border-[#F0F3F9] pb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1F2C]">
                    {pri === 'high'
                      ? 'High Priority'
                      : pri === 'medium'
                        ? 'Medium Priority'
                        : 'Low Priority'}
                  </h2>
                  <span className="rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-xs font-bold text-[#2F65F6] tabular-nums-strict">
                    {list.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {list.map((task) => (
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
            );
          })}
        </div>
      )}

      {/* ======================= TAB: COMPLETED ======================= */}
      {activeTab === 'completed' && (
        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          {visibleTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6 text-[#10B981]" />}
              title="No completed tasks found"
              description="Completed tasks will appear here for historical review."
            />
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((task) => (
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
          )}
        </div>
      )}

      {/* ======================= TAB: ARCHIVED ======================= */}
      {activeTab === 'archived' && (
        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          {visibleTasks.length === 0 ? (
            <EmptyState
              icon={<Archive className="h-6 w-6 text-amber-600" />}
              title="No archived tasks"
              description="Tasks moved to Archive will appear here. Their historical work sessions and time entries remain safely preserved in reports."
            />
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((task) => (
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
          )}
        </div>
      )}
    </div>
  );
}
