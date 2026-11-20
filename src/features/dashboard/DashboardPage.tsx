import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  Plus,
  Timer,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateSavedWorkSeconds,
  formatDuration,
  getLocalDateISO,
  isTaskOverdue,
} from '../../lib/timeMath';
import { TaskRow } from '../../components/tasks/TaskRow';
import { ActiveTimerCard } from '../../components/timer/ActiveTimerCard';
import { PriorityBadge, ProjectLabel } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard } from '../../components/ui/MetricCard';

type DashboardFilter = 'all' | 'todo' | 'in_progress' | 'completed';

export function DashboardPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeTimer,
    activeElapsedSeconds,
    nowMs,
    openCreateTaskDrawer,
    openEditTaskDrawer,
    toggleTaskCompletion,
    startTaskTimer,
    pauseActiveTimer,
    saveTask,
  } = useWorkspace();

  const [statusFilter, setStatusFilter] = useState<DashboardFilter>('all');
  const [quickTitle, setQuickTitle] = useState('');

  const todayIso = getLocalDateISO();

  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isArchived &&
          (t.scheduledDate === todayIso || isTaskOverdue(t, todayIso))
      ),
    [tasks, todayIso]
  );

  const filteredTodayTasks = useMemo(() => {
    if (statusFilter === 'all') return todayTasks;
    return todayTasks.filter((t) => t.status === statusFilter);
  }, [todayTasks, statusFilter]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            !t.isArchived &&
            t.status !== 'completed' &&
            t.scheduledDate !== null &&
            t.scheduledDate > todayIso
        )
        .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))
        .slice(0, 4),
    [tasks, todayIso]
  );

  // Accurate daily metrics (zero fabricated efficiency scores or double-counting)
  const completedTodayCount = todayTasks.filter((t) => t.status === 'completed').length;
  const remainingTodayCount = todayTasks.length - completedTodayCount;
  const completionPct =
    todayTasks.length > 0 ? Math.round((completedTodayCount / todayTasks.length) * 100) : 0;

  const plannedTodayMinutes = todayTasks.reduce(
    (sum, t) => sum + (t.plannedDurationMinutes ?? 0),
    0
  );

  const savedEntriesToday = useMemo(
    () =>
      timeEntries.filter(
        (e) => e.status === 'completed' && e.startedAt.startsWith(todayIso)
      ),
    [timeEntries, todayIso]
  );

  const savedTodaySeconds = calculateSavedWorkSeconds(savedEntriesToday);
  const liveTrackedTodaySeconds = savedTodaySeconds + activeElapsedSeconds;

  const plannedTodaySeconds = plannedTodayMinutes * 60;
  const progressRatio =
    plannedTodaySeconds > 0
      ? Math.min(100, Math.round((liveTrackedTodaySeconds / plannedTodaySeconds) * 100))
      : 0;

  // Per-project saved + active breakdown for today
  const projectTodayBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of savedEntriesToday) {
      const key = entry.projectId ?? 'none';
      map.set(key, (map.get(key) ?? 0) + entry.durationSeconds);
    }
    if (activeTimer && activeElapsedSeconds > 0) {
      const task = tasks.find((t) => t.id === activeTimer.taskId);
      const key = task?.projectId ?? 'none';
      map.set(key, (map.get(key) ?? 0) + activeElapsedSeconds);
    }
    return Array.from(map.entries())
      .map(([projectId, seconds]) => {
        const proj = projects.find((p) => p.id === projectId);
        return {
          id: projectId,
          name: proj?.name ?? 'No Project',
          color: proj?.color ?? '#98A2B3',
          seconds,
        };
      })
      .sort((a, b) => b.seconds - a.seconds);
  }, [activeElapsedSeconds, activeTimer, projects, savedEntriesToday, tasks]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    saveTask({
      title: trimmed,
      description: '',
      projectId: null,
      priority: 'medium',
      scheduledDate: todayIso,
      scheduledStartTime: '',
      plannedDurationMinutes: '',
      reminderOffsetMinutes: '',
      syncToGoogleCalendar: false,
    });
    setQuickTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
            Workspace / Daily Overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202531]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#667085]">
            Focus on today&apos;s scheduled tasks and compare planned duration against tracked work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/reports">
            <Button variant="secondary" size="sm">
              View Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Core PRD Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Today's Tasks"
          value={String(todayTasks.length)}
          subtext={`${remainingTodayCount} remaining · ${completedTodayCount} completed`}
          icon={<ListTodo className="h-4 w-4" />}
        />
        <MetricCard
          label="Completed"
          value={`${completedTodayCount} / ${todayTasks.length}`}
          subtext={`${completionPct}% of today's list`}
          progressPercent={completionPct}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Planned Time"
          value={formatDuration(plannedTodaySeconds)}
          subtext="Estimated across today's tasks"
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Actual Tracked"
          value={formatDuration(liveTrackedTodaySeconds)}
          subtext={
            activeElapsedSeconds > 0
              ? `${formatDuration(savedTodaySeconds)} saved + active session`
              : 'Saved work sessions today'
          }
          accentValue
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      {/* Active Timer Panel */}
      <ActiveTimerCard />

      {/* Main Split: Today's Tasks + Right Summary Column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Today's Task List */}
        <section className="space-y-3 lg:col-span-8" aria-label="Today's Tasks">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#202531]">Today&apos;s Tasks</h2>
              <p className="text-xs text-[#667085]">
                Includes tasks scheduled for today and any overdue items.
              </p>
            </div>

            <div
              className="inline-flex rounded-lg border border-[#E4E7EC] bg-white p-1 self-start"
              role="tablist"
              aria-label="Filter today's tasks by status"
            >
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'todo', label: 'To Do' },
                  { key: 'in_progress', label: 'In Progress' },
                  { key: 'completed', label: 'Done' },
                ] as { key: DashboardFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-[#EDF1FF] text-[#4968D6]'
                      : 'text-[#667085] hover:text-[#202531]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTodayTasks.length > 0 ? (
            <div className="space-y-2.5">
              {filteredTodayTasks.map((task) => (
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
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="No matching tasks for today"
              description="Add a task scheduled for today or adjust your status filter."
              action={
                <Button variant="primary" size="sm" onClick={() => openCreateTaskDrawer(todayIso)}>
                  <Plus className="h-4 w-4" />
                  <span>Add Task for Today</span>
                </Button>
              }
            />
          )}

          {/* Quick Inline Capture */}
          <form
            onSubmit={handleQuickAdd}
            className="flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white p-2.5"
          >
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Quickly add a task for today and press Enter..."
              aria-label="Quick add task for today"
              className="h-9 flex-1 bg-transparent px-2 text-sm text-[#202531] placeholder:text-[#98A2B3] focus:outline-none"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!quickTitle.trim()}>
              Add
            </Button>
          </form>
        </section>

        {/* Secondary Right Column */}
        <div className="space-y-5 lg:col-span-4">
          {/* Planned vs Tracked Today Card */}
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#202531]">Planned vs. Tracked</h2>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#98A2B3]">
                Today
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Planned Allocation</span>
                <span className="font-semibold text-[#202531] tabular-nums-strict">
                  {formatDuration(plannedTodaySeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Saved Work Today</span>
                <span className="font-semibold text-[#202531] tabular-nums-strict">
                  {formatDuration(savedTodaySeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Live Tracked (incl. Active)</span>
                <span className="font-semibold text-[#4968D6] tabular-nums-strict">
                  {formatDuration(liveTrackedTodaySeconds)}
                </span>
              </div>
            </div>

            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
              <div
                className="h-full rounded-full bg-[#4968D6] transition-all"
                style={{ width: `${progressRatio}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#667085] tabular-nums-strict">
              {plannedTodaySeconds > 0
                ? `${progressRatio}% of today's planned duration tracked`
                : 'Add planned durations to tasks to compare against actual time.'}
            </p>

            {projectTodayBreakdown.length > 0 && (
              <div className="mt-5 border-t border-[#F0F2F5] pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
                  Tracked by Project
                </div>
                <ul className="mt-2.5 space-y-2">
                  {projectTodayBreakdown.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-xs">
                      <ProjectLabel name={item.name} color={item.color} />
                      <span className="font-medium text-[#202531] tabular-nums-strict">
                        {formatDuration(item.seconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 border-t border-[#F0F2F5] pt-3">
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#4968D6] hover:underline"
              >
                <span>View Detailed Report</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          {/* Upcoming Preview Card */}
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#202531]">Upcoming Tasks</h2>
              <Link
                to="/tasks?tab=upcoming"
                className="text-xs font-medium text-[#4968D6] hover:underline"
              >
                View All
              </Link>
            </div>

            {upcomingTasks.length > 0 ? (
              <ul className="mt-3 divide-y divide-[#F0F2F5]">
                {upcomingTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  return (
                    <li key={task.id} className="py-3 first:pt-1 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/tasks/${task.id}`}
                          className="text-sm font-medium text-[#202531] hover:text-[#4968D6]"
                        >
                          {task.title}
                        </Link>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-[#667085]">
                        {project ? (
                          <ProjectLabel name={project.name} color={project.color} />
                        ) : (
                          <span className="text-[#98A2B3]">No project</span>
                        )}
                        <span className="inline-flex items-center gap-1 tabular-nums-strict">
                          <Calendar className="h-3 w-3 text-[#98A2B3]" />
                          {task.scheduledDate}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-[#667085]">No upcoming scheduled tasks.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
