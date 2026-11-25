import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Folder,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  formatDuration,
  getLocalDateISO,
} from '../../lib/timeMath';
import {
  timeStringToMinutes,
  minutesToTimeString,
} from '../../services/schedulingEngine';
import type { Task, TaskCalendarBlock } from '../../types/models';
import { Button } from '../../components/ui/Button';

export type CalendarViewMode = 'week' | 'day' | 'month';

export function CalendarPage() {
  const {
    tasks,
    projects,
    calendarBlocks,
    openCreateTaskDrawer,
    openEditTaskDrawer,
  } = useWorkspace();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const todayIso = getLocalDateISO();

  // Compute Monday of current week
  const weekDates = useMemo(() => {
    const monday = new Date(currentDate);
    const day = monday.getDay();
    const diff = (day + 6) % 7; // 0 for Monday, 6 for Sunday
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);

    const dates: { dateIso: string; dateObj: Date; isToday: boolean; dayName: string; dayNum: number }[] = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = getLocalDateISO(d);
      dates.push({
        dateIso: iso,
        dateObj: d,
        isToday: iso === todayIso,
        dayName: dayNames[i],
        dayNum: d.getDate(),
      });
    }

    return dates;
  }, [currentDate, todayIso]);

  // Navigate functions
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const dateHeaderLabel = useMemo(() => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    // Week mode: "Nov 23 – Nov 29, 2026"
    const first = weekDates[0].dateObj;
    const last = weekDates[6].dateObj;
    const m1 = first.toLocaleDateString('en-US', { month: 'short' });
    const m2 = last.toLocaleDateString('en-US', { month: 'short' });
    const y1 = first.getFullYear();
    const y2 = last.getFullYear();

    if (m1 === m2) {
      return `${m1} ${first.getDate()} – ${last.getDate()}, ${y1}`;
    }
    return `${m1} ${first.getDate()} – ${m2} ${last.getDate()}, ${y1 === y2 ? y1 : `${y1}/${y2}`}`;
  }, [currentDate, viewMode, weekDates]);

  // Filter tasks & blocks by project if specified
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.isArchived) return false;
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;
      return true;
    });
  }, [tasks, selectedProjectId]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    return map;
  }, [tasks]);

  const projectMap = useMemo(() => {
    const map = new Map<string, (typeof projects)[0]>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  // Group blocks by date
  const blocksByDate = useMemo(() => {
    const map = new Map<string, TaskCalendarBlock[]>();
    for (const b of calendarBlocks) {
      const task = taskMap.get(b.taskId);
      if (!task || task.isArchived) continue;
      if (selectedProjectId !== 'all' && task.projectId !== selectedProjectId) continue;

      const list = map.get(b.blockDate) || [];
      list.push(b);
      map.set(b.blockDate, list);
    }

    // Also include timed single-day tasks that might not have an explicit TaskCalendarBlock
    for (const t of filteredTasks) {
      if (t.scheduledDate && t.scheduledStartTime && !t.scheduledEndDate) {
        const existingForTask = (map.get(t.scheduledDate) || []).some((b) => b.taskId === t.id);
        if (!existingForTask) {
          const sm = t.scheduledStartTime;
          const duration = t.plannedDurationMinutes || 60;
          const em = minutesToTimeString(timeStringToMinutes(sm) + duration);
          const virtualBlock: TaskCalendarBlock = {
            id: `virtual-${t.id}`,
            userId: t.userId,
            taskId: t.id,
            blockDate: t.scheduledDate,
            startTime: sm,
            endTime: em,
            durationMinutes: duration,
            status: t.status === 'completed' ? 'completed' : 'scheduled',
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          };
          const list = map.get(t.scheduledDate) || [];
          list.push(virtualBlock);
          map.set(t.scheduledDate, list);
        }
      }
    }

    return map;
  }, [calendarBlocks, filteredTasks, selectedProjectId, taskMap]);

  // Hours range for time grid (08:00 to 20:00)
  const gridHours = useMemo(() => {
    const hours: number[] = [];
    for (let h = 8; h <= 20; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2F65F6]">
            <CalendarIcon className="h-4 w-4" />
            <span>Time Blocking & Scheduling</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">
            Calendar
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            Multi-day workload allocation, daily focus blocks, and conflict-free schedule planning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Filter */}
          <select
            aria-label="Filter by project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-10 rounded-xl border border-[#E9ECF5] bg-white px-3 text-xs font-semibold text-[#1A1F2C] shadow-xs hover:border-[#D0D5DD] cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* New Task Button */}
          <button
            type="button"
            onClick={() => openCreateTaskDrawer(todayIso)}
            className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_6px_20px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Calendar Controls & Navigation Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E9ECF5] bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleToday}>
            Today
          </Button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E9ECF5] text-[#7E8B9B] hover:bg-[#F8FAFD] hover:text-[#1A1F2C] transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E9ECF5] text-[#7E8B9B] hover:bg-[#F8FAFD] hover:text-[#1A1F2C] transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="ml-2 text-base font-bold text-[#1A1F2C]">{dateHeaderLabel}</div>
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center gap-1 rounded-xl bg-[#F4F7FD] p-1">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'day'
                ? 'bg-white text-[#2F65F6] shadow-xs'
                : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'week'
                ? 'bg-white text-[#2F65F6] shadow-xs'
                : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Main Calendar Grid: Week View */}
      {viewMode === 'week' && (
        <div className="overflow-x-auto rounded-[28px] border border-white/80 bg-white/85 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          <div className="min-w-[760px]">
            {/* Day Header Row */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#F0F3F9] bg-[#F8FAFD]/60">
              <div className="p-3 text-center text-xs font-semibold text-[#98A2B3]">Time</div>
              {weekDates.map((col) => {
                const dayBlocks = blocksByDate.get(col.dateIso) || [];
                const totalMins = dayBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);

                return (
                  <div
                    key={col.dateIso}
                    className={`p-3 text-center border-l border-[#F0F3F9] transition-colors ${
                      col.isToday ? 'bg-[#2F65F6]/5' : ''
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7E8B9B]">
                      {col.dayName}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                          col.isToday
                            ? 'bg-[#2F65F6] text-white shadow-xs'
                            : 'text-[#1A1F2C]'
                        }`}
                      >
                        {col.dayNum}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] font-medium text-[#7E8B9B]">
                      {totalMins > 0 ? (
                        <span className="font-semibold text-[#2F65F6]">
                          {formatDuration(totalMins * 60)}
                        </span>
                      ) : (
                        <span className="text-[#98A2B3]">Free</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Grid Matrix */}
            <div className="relative">
              {gridHours.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#F0F3F9] min-h-[58px]"
                >
                  <div className="p-2 text-right text-[11px] font-semibold text-[#98A2B3] tabular-nums-strict select-none">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {weekDates.map((col) => (
                    <div
                      key={col.dateIso}
                      className={`relative border-l border-[#F0F3F9] hover:bg-[#F8FAFD]/40 transition-colors ${
                        col.isToday ? 'bg-[#2F65F6]/2' : ''
                      }`}
                      onClick={() => openCreateTaskDrawer(col.dateIso)}
                      title={`Click to schedule task on ${col.dateIso} at ${String(hour).padStart(2, '0')}:00`}
                    />
                  ))}
                </div>
              ))}

              {/* Overlay: Rendered Calendar Time Blocks */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-[60px_repeat(7,1fr)]">
                <div className="w-[60px]" /> {/* Time column spacer */}
                {weekDates.map((col) => {
                  const dayBlocks = blocksByDate.get(col.dateIso) || [];

                  return (
                    <div key={col.dateIso} className="relative h-full pointer-events-auto px-1">
                      {dayBlocks.map((block) => {
                        const task = taskMap.get(block.taskId);
                        const project = task?.projectId ? projectMap.get(task.projectId) : undefined;

                        // Position calculation: 08:00 = 0px, each hour = 58px
                        const startMin = timeStringToMinutes(block.startTime);
                        const duration = block.durationMinutes;
                        const topPx = Math.max(0, ((startMin - 8 * 60) / 60) * 58);
                        const heightPx = Math.max(38, (duration / 60) * 58 - 3);

                        const isMultiDay = Boolean(task?.scheduledEndDate && task.scheduledEndDate > (task.scheduledDate || ''));

                        return (
                          <div
                            key={block.id}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (task) openEditTaskDrawer(task);
                            }}
                            className={`absolute inset-x-1 z-10 rounded-xl p-2 shadow-xs border transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                              isMultiDay
                                ? 'bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] border-[#6366F1]/40 text-[#1E1B4B]'
                                : 'bg-gradient-to-br from-[#EDF2FE] to-[#DBEAFE] border-[#2F65F6]/30 text-[#1E3A8A]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="truncate text-xs font-bold leading-tight">
                                {task?.title || 'Scheduled Block'}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                                  isMultiDay
                                    ? 'bg-[#6366F1] text-white'
                                    : 'bg-[#2F65F6] text-white'
                                }`}
                              >
                                {isMultiDay ? 'Multi-Day Block' : 'Task Block'}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] opacity-85">
                              <span className="flex items-center gap-1 font-semibold tabular-nums-strict">
                                <Clock className="h-2.5 w-2.5" />
                                {block.startTime}–{block.endTime} ({formatDuration(block.durationMinutes * 60)})
                              </span>
                              {project && (
                                <span className="flex items-center gap-1 font-medium">
                                  <Folder className="h-2.5 w-2.5" />
                                  <span className="truncate max-w-[80px]">{project.name}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0F3F9] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#1A1F2C]">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-xs text-[#7E8B9B]">
                  {(blocksByDate.get(getLocalDateISO(currentDate)) || []).length} scheduled block(s) for this day
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openCreateTaskDrawer(getLocalDateISO(currentDate))}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task Block</span>
              </Button>
            </div>

            {/* Day Schedule List */}
            <div className="space-y-3 pt-2">
              {(blocksByDate.get(getLocalDateISO(currentDate)) || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E9ECF5] p-12 text-center">
                  <Clock className="mx-auto h-8 w-8 text-[#98A2B3]" />
                  <h3 className="mt-2 text-sm font-bold text-[#1A1F2C]">No Blocks Scheduled</h3>
                  <p className="mt-1 text-xs text-[#7E8B9B]">
                    This day is completely free. Schedule a task or create a multi-day plan to block focus time.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => openCreateTaskDrawer(getLocalDateISO(currentDate))}
                  >
                    Schedule a Task
                  </Button>
                </div>
              ) : (
                (blocksByDate.get(getLocalDateISO(currentDate)) || [])
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((block) => {
                    const task = taskMap.get(block.taskId);
                    const project = task?.projectId ? projectMap.get(task.projectId) : undefined;
                    const isMultiDay = Boolean(task?.scheduledEndDate && task.scheduledEndDate > (task.scheduledDate || ''));

                    return (
                      <div
                        key={block.id}
                        className={`flex items-center justify-between rounded-2xl border p-4 transition-all hover:shadow-sm ${
                          isMultiDay
                            ? 'border-[#6366F1]/30 bg-[#EEF2FF]/40'
                            : 'border-[#2F65F6]/30 bg-[#EDF2FE]/40'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isMultiDay ? 'bg-[#6366F1] text-white' : 'bg-[#2F65F6] text-white'
                              }`}
                            >
                              {isMultiDay ? 'Multi-Day Task Block' : 'Task Block'}
                            </span>
                            {project && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-[#7E8B9B]">
                                <Folder className="h-3 w-3" />
                                <span>{project.name}</span>
                              </span>
                            )}
                          </div>
                          <Link
                            to={task ? `/tasks/${task.id}` : '#'}
                            className="block text-base font-bold text-[#1A1F2C] hover:text-[#2F65F6] transition-colors"
                          >
                            {task?.title || 'Unknown Task'}
                          </Link>
                          <div className="flex items-center gap-3 text-xs text-[#7E8B9B] tabular-nums-strict">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-[#2F65F6]" />
                              <span>{block.startTime} – {block.endTime}</span>
                            </span>
                            <span>·</span>
                            <span>Allocated: {formatDuration(block.durationMinutes * 60)}</span>
                          </div>
                        </div>

                        {task && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditTaskDrawer(task)}
                            >
                              Edit Task
                            </Button>
                            <Link to={`/tasks/${task.id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
