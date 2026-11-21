import { useMemo, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateSavedWorkSeconds,
  getLocalDateISO,
  isTaskOverdue,
} from '../../lib/timeMath';
import { DashboardHeader } from './components/DashboardHeader';
import { ActiveTaskCard } from './components/ActiveTaskCard';
import { WorkOverview } from './components/WorkOverview';
import { TodayTaskList, type DashboardFilter } from './components/TodayTaskList';
import { UpcomingTasks } from './components/UpcomingTasks';
import { WeeklyTimeOverview } from './components/WeeklyTimeOverview';

export function DashboardPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeTimer,
    activeTask,
    activeElapsedSeconds,
    openCreateTaskDrawer,
    openEditTaskDrawer,
    toggleTaskCompletion,
    startTaskTimer,
    pauseActiveTimer,
    resumeActiveTimer,
    stopAndSaveActiveTimer,
    saveTask,
  } = useWorkspace();

  const [statusFilter, setStatusFilter] = useState<DashboardFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const todayIso = getLocalDateISO();

  // Greeting & Date
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }, []);

  // Today's scheduled + overdue incomplete tasks
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
    let list = todayTasks;
    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [todayTasks, statusFilter, searchQuery]);

  // Upcoming scheduled tasks (next 3-4 tasks scheduled after today)
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

  // Today's task counts
  const completedTodayCount = todayTasks.filter((t) => t.status === 'completed').length;
  const totalTodayCount = todayTasks.length;
  const remainingTodayCount = totalTodayCount - completedTodayCount;
  const todoCount = todayTasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = todayTasks.filter((t) => t.status === 'in_progress').length;

  // Tracked time today
  const savedEntriesToday = useMemo(
    () =>
      timeEntries.filter(
        (e) => e.status === 'completed' && e.startedAt.startsWith(todayIso)
      ),
    [timeEntries, todayIso]
  );

  const savedTodaySeconds = calculateSavedWorkSeconds(savedEntriesToday);
  const liveTrackedTodaySeconds = savedTodaySeconds + activeElapsedSeconds;

  // Candidate task to quick-start when idle
  const quickStartCandidate = useMemo(
    () =>
      todayTasks.find((t) => t.status !== 'completed') ||
      tasks.find((t) => !t.isArchived && t.status !== 'completed') ||
      null,
    [todayTasks, tasks]
  );

  const quickStartProject = projects.find(
    (p) => p.id === quickStartCandidate?.projectId
  );
  const activeProject = projects.find((p) => p.id === activeTask?.projectId);

  // Weekly Tracked Time & 7-Day Mini Bar Chart (Mon - Sun)
  const { weekDays, weekTotalSeconds, weekDateRange, maxDaySeconds } = useMemo(() => {
    const now = new Date();
    // Monday as start of week
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startMonth = monday.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
    const rangeText =
      startMonth === endMonth
        ? `${startMonth} ${monday.getDate()} – ${sunday.getDate()}`
        : `${startMonth} ${monday.getDate()} – ${endMonth} ${sunday.getDate()}`;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
      (name, idx) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + idx);
        const iso = getLocalDateISO(d);

        let seconds = timeEntries
          .filter((e) => e.status === 'completed' && e.startedAt.startsWith(iso))
          .reduce((sum, e) => sum + e.durationSeconds, 0);

        if (iso === todayIso && activeElapsedSeconds > 0) {
          seconds += activeElapsedSeconds;
        }

        return {
          name,
          iso,
          seconds,
          isToday: iso === todayIso,
        };
      }
    );

    const totalSec = days.reduce((sum, d) => sum + d.seconds, 0);
    const maxSec = Math.max(...days.map((d) => d.seconds), 3600); // 1h scale baseline

    return {
      weekDays: days,
      weekTotalSeconds: totalSec,
      weekDateRange: rangeText,
      maxDaySeconds: maxSec,
    };
  }, [timeEntries, todayIso, activeElapsedSeconds]);

  // Handler for quick-add inline task
  const handleQuickAdd = (title: string) => {
    saveTask({
      title,
      description: '',
      projectId: null,
      priority: 'medium',
      scheduledDate: todayIso,
      scheduledStartTime: '',
      plannedDurationMinutes: '',
      reminderOffsetMinutes: '',
      syncToGoogleCalendar: false,
    });
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* A. Dashboard Header */}
      <DashboardHeader
        greeting={greeting}
        formattedDate={formattedDate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewTask={() => openCreateTaskDrawer(todayIso)}
      />

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column (~60-65%): Active Task & Today's Tasks */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-7">
          {/* C. Active Task / Live Focus Card */}
          <ActiveTaskCard
            activeTimer={activeTimer}
            activeTask={activeTask}
            activeProject={activeProject}
            activeElapsedSeconds={activeElapsedSeconds}
            quickStartCandidate={quickStartCandidate}
            quickStartProject={quickStartProject}
            onPause={pauseActiveTimer}
            onResume={resumeActiveTimer}
            onStop={stopAndSaveActiveTimer}
            onStartFocus={startTaskTimer}
            onNewTask={() => openCreateTaskDrawer(todayIso)}
          />

          {/* E. Today's Tasks Card */}
          <TodayTaskList
            todayTasks={todayTasks}
            filteredTasks={filteredTodayTasks}
            projects={projects}
            activeTimer={activeTimer}
            statusFilter={statusFilter}
            todoCount={todoCount}
            inProgressCount={inProgressCount}
            completedCount={completedTodayCount}
            onStatusFilterChange={setStatusFilter}
            onToggleComplete={toggleTaskCompletion}
            onStartTimer={startTaskTimer}
            onPauseTimer={pauseActiveTimer}
            onEditTask={openEditTaskDrawer}
            onQuickAdd={handleQuickAdd}
            onOpenCreateDrawer={() => openCreateTaskDrawer(todayIso)}
          />
        </div>

        {/* Right Column (~35-40%): Work Overview, Upcoming Tasks, Weekly Chart */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-5">
          {/* D. Work Overview Card */}
          <WorkOverview />

          {/* F. Upcoming Tasks Card */}
          <UpcomingTasks
            upcomingTasks={upcomingTasks}
            todayIso={todayIso}
          />

          {/* G. Weekly Work Overview Card */}
          <WeeklyTimeOverview
            weekDays={weekDays}
            weekTotalSeconds={weekTotalSeconds}
            weekDateRange={weekDateRange}
            maxDaySeconds={maxDaySeconds}
          />
        </div>
      </div>
    </div>
  );
}
