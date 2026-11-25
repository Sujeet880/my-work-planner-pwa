import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Calendar,
  CalendarOff,
  CalendarRange,
  CalendarX2,
  CheckCircle2,
  Clock,
  Folder,
  History,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateActiveSessionSeconds,
  calculateSavedWorkSeconds,
  calculateTimeVariance,
  formatClockHHMMSS,
  formatDuration,
  getLocalDateISO,
  isTaskOverdue,
} from '../../lib/timeMath';
import {
  CalendarSyncBadge,
  ClientVisibilityBadge,
  EntryTypeBadge,
  PriorityBadge,
  ReminderBadge,
  StatusBadge,
} from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { ProjectDiscussionsView } from '../../components/discussions/ProjectDiscussionsView';

export function TaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const {
    tasks,
    calendarBlocks,
    projects,
    timeEntries,
    calendarConnection,
    activeTimer,
    nowMs,
    openEditTaskDrawer,
    openManualEntryModal,
    toggleTaskCompletion,
    archiveTask,
    deleteTask,
    startTaskTimer,
    pauseActiveTimer,
    resumeActiveTimer,
    stopAndSaveActiveTimer,
    deleteTimeEntry,
  } = useWorkspace();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return (
      <div className="space-y-4">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2F65F6] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to My Tasks</span>
        </Link>
        <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-8">
          <EmptyState
            icon={<Clock className="h-6 w-6 text-[#7E8B9B]" />}
            title="Task not found"
            description="This task may have been deleted or does not exist."
            action={
              <Link to="/tasks">
                <Button variant="primary">Return to Tasks</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const project = projects.find((p) => p.id === task.projectId);
  const todayIso = getLocalDateISO();
  const overdue = isTaskOverdue(task, todayIso);
  const isThisTaskActive = activeTimer?.taskId === task.id;
  const isRunning = isThisTaskActive && activeTimer?.status === 'running';
  const isPaused = isThisTaskActive && activeTimer?.status === 'paused';

  const activeSessionSeconds = isThisTaskActive
    ? calculateActiveSessionSeconds(activeTimer, nowMs)
    : 0;
  const taskEntries = timeEntries.filter(
    (e) => e.taskId === task.id && e.status === 'completed'
  );
  const savedSeconds = calculateSavedWorkSeconds(timeEntries, task.id);
  const liveActualSeconds = savedSeconds + activeSessionSeconds;
  const variance = calculateTimeVariance(
    task.plannedDurationMinutes,
    liveActualSeconds
  );

  const isMultiDay = Boolean(
    task.scheduledEndDate &&
    task.scheduledDate &&
    task.scheduledEndDate > task.scheduledDate
  );

  const taskBlocks = calendarBlocks.filter((b) => b.taskId === task.id);
  const totalScheduledMinutes = taskBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const completedMinutes = Math.floor(liveActualSeconds / 60);
  const totalPlannedMinutes = task.plannedDurationMinutes || 0;
  const remainingMinutes = Math.max(0, totalPlannedMinutes - completedMinutes);

  const dailyHours = task.dailyPlannedMinutes
    ? `${(task.dailyPlannedMinutes / 60).toFixed(1).replace(/\.0$/, '')}h`
    : task.plannedDurationMinutes
    ? `${(task.plannedDurationMinutes / 60).toFixed(1).replace(/\.0$/, '')}h`
    : '—';
  const totalPlannedHours = (totalPlannedMinutes / 60).toFixed(1).replace(/\.0$/, '') + 'h';
  const scheduledHours = (totalScheduledMinutes / 60).toFixed(1).replace(/\.0$/, '') + 'h';
  const completedHours = (completedMinutes / 60).toFixed(1).replace(/\.0$/, '') + 'h';
  const remainingHours = (remainingMinutes / 60).toFixed(1).replace(/\.0$/, '') + 'h';

  const handleConfirmArchive = async () => {
    const ok = await archiveTask(task.id, true);
    if (ok) {
      setConfirmDeleteOpen(false);
      navigate('/tasks');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Breadcrumb & Action Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-[#7E8B9B]">
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1 font-medium hover:text-[#1A1F2C] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>My Tasks</span>
          </Link>
          <span>/</span>
          <span className="truncate font-semibold text-[#1A1F2C] max-w-[200px] sm:max-w-md">
            {task.title}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openEditTaskDrawer(task)}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>

          <Button
            variant={task.status === 'completed' ? 'secondary' : 'success'}
            size="sm"
            onClick={() => toggleTaskCompletion(task.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {task.status === 'completed' ? 'Reopen Task' : 'Mark Completed'}
            </span>
          </Button>

          {task.isArchived ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => archiveTask(task.id, false)}
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#2F65F6]" />
              <span>Restore Task</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
              className="text-amber-700 hover:bg-amber-50"
            >
              <Archive className="h-3.5 w-3.5 text-amber-600" />
              <span>Move to Archive</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main 2-Column Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column (~65%): Task Info & Work Sessions */}
        <div className="space-y-6 lg:col-span-8">
          {/* Task Info Card */}
          <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 sm:p-7 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={task.status}
                isOverdue={overdue}
                timerState={isThisTaskActive ? activeTimer?.status ?? null : null}
              />
              <PriorityBadge priority={task.priority} />
              <ReminderBadge offsetMinutes={task.reminderOffsetMinutes} />
              <ClientVisibilityBadge clientVisible={task.clientVisible} />
              {project && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-xs font-semibold text-[#2F65F6]">
                  <Folder className="h-3 w-3" />
                  <span>{project.name}</span>
                </span>
              )}
            </div>

            <h1 className="mt-3.5 text-2xl font-bold tracking-tight text-[#1A1F2C]">
              {task.title}
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-[#7E8B9B]">
              {task.description || 'No description provided.'}
            </p>

            {/* Metadata Grid */}
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[#F0F3F9] pt-5 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-[#7E8B9B]">Scheduled Date</dt>
                <dd className="mt-1 font-semibold text-[#1A1F2C] tabular-nums-strict">
                  {task.scheduledDate ?? 'Inbox (Unscheduled)'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#7E8B9B]">Start Time</dt>
                <dd className="mt-1 font-semibold text-[#1A1F2C] tabular-nums-strict">
                  {task.scheduledStartTime || 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#7E8B9B]">Planned Duration</dt>
                <dd className="mt-1 font-semibold text-[#1A1F2C] tabular-nums-strict">
                  {task.plannedDurationMinutes
                    ? formatDuration(task.plannedDurationMinutes * 60)
                    : 'No estimate'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#7E8B9B]">Reminder</dt>
                <dd className="mt-1 font-semibold text-[#1A1F2C]">
                  {task.reminderOffsetMinutes !== null
                    ? task.reminderOffsetMinutes === 0
                    ? 'At start time'
                    : `${task.reminderOffsetMinutes}m before`
                    : 'None'}
                </dd>
              </div>
              {task.remainingEstimateMinutes !== null && task.remainingEstimateMinutes !== undefined && (
                <div>
                  <dt className="text-xs font-medium text-[#7E8B9B]">Remaining Estimate</dt>
                  <dd className="mt-1 font-semibold text-[#1A1F2C] tabular-nums-strict">
                    {task.remainingEstimateMinutes} min
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Multi-Day Progress Metrics Strip */}
          {isMultiDay && (
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2F65F6]/10 text-[#2F65F6]">
                  <CalendarRange className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#1A1F2C]">Multi-Day Scheduling Progress</h2>
                  <p className="text-xs text-[#7E8B9B]">Daily effort targets and planned timeline reconciliation</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">Start Date</div>
                  <div className="mt-1 text-xs font-bold text-[#1A1F2C] truncate tabular-nums-strict">{task.scheduledDate}</div>
                </div>

                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">End Date</div>
                  <div className="mt-1 text-xs font-bold text-[#1A1F2C] truncate tabular-nums-strict">{task.scheduledEndDate}</div>
                </div>

                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">Daily Planned</div>
                  <div className="mt-1 text-xs font-bold text-[#2F65F6] tabular-nums-strict">{dailyHours}</div>
                </div>

                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">Total Planned</div>
                  <div className="mt-1 text-xs font-bold text-[#1A1F2C] tabular-nums-strict">{totalPlannedHours}</div>
                </div>

                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">Scheduled</div>
                  <div className="mt-1 text-xs font-bold text-[#1A1F2C] tabular-nums-strict">{scheduledHours}</div>
                </div>

                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">Completed</div>
                  <div className="mt-1 text-xs font-bold text-emerald-600 tabular-nums-strict">{completedHours}</div>
                </div>

                <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-center">
                  <div className="text-[11px] font-medium text-[#7E8B9B]">Remaining</div>
                  <div className="mt-1 text-xs font-bold text-amber-600 tabular-nums-strict">{remainingHours}</div>
                </div>
              </div>
            </section>
          )}

          {/* Allocated Calendar Blocks Card */}
          {taskBlocks.length > 0 && (
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1A1F2C]">Allocated Calendar Blocks</h2>
                  <p className="mt-0.5 text-xs text-[#7E8B9B]">
                    {taskBlocks.length} scheduled time block{taskBlocks.length === 1 ? '' : 's'} linked to this task
                  </p>
                </div>
                <Link
                  to="/calendar"
                  className="text-xs font-semibold text-[#2F65F6] hover:underline"
                >
                  View in Calendar →
                </Link>
              </div>

              <div className="divide-y divide-[#F0F3F9] rounded-xl border border-[#E9ECF5] bg-white overflow-hidden">
                {taskBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 hover:bg-[#F8FAFD] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EDF2FE] text-[#2F65F6]">
                        <Calendar className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1A1F2C] tabular-nums-strict">
                            {block.blockDate}
                          </span>
                          <span className="text-xs text-[#7E8B9B] tabular-nums-strict">
                            {block.startTime} – {block.endTime}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#7E8B9B]">
                          <span>Duration: {block.durationMinutes} min ({(block.durationMinutes / 60).toFixed(1)}h)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-[#EDF2FE] px-2 py-0.5 text-[10px] font-semibold text-[#2F65F6]">
                        {isMultiDay ? 'Multi-Day Block' : 'Task Block'}
                      </span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        block.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {block.status === 'completed' ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Work Sessions History Card */}
          <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1A1F2C]">Work Sessions</h2>
                <p className="mt-0.5 text-xs text-[#7E8B9B] tabular-nums-strict">
                  {taskEntries.length} saved session{taskEntries.length === 1 ? '' : 's'} · Total
                  saved: <strong className="text-[#1A1F2C]">{formatDuration(savedSeconds)}</strong>
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openManualEntryModal(task.id)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Manual Time</span>
              </Button>
            </div>

            {taskEntries.length > 0 ? (
              <ul className="mt-4 divide-y divide-[#F0F3F9]">
                {taskEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <EntryTypeBadge type={entry.entryType} />
                        <span className="text-xs font-semibold text-[#1A1F2C] tabular-nums-strict">
                          {entry.startedAt.slice(0, 10)}
                        </span>
                        <span className="text-xs text-[#7E8B9B] tabular-nums-strict">
                          {entry.startedAt.slice(11, 16)}
                          {entry.endedAt ? ` – ${entry.endedAt.slice(11, 16)}` : ''}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="mt-1 text-xs text-[#7E8B9B]">{entry.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-sm font-bold text-[#1A1F2C] tabular-nums-strict">
                        {formatDuration(entry.durationSeconds)}
                      </span>
                      <button
                        type="button"
                        aria-label="Delete work session"
                        onClick={() => deleteTimeEntry(entry.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#98A2B3] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <Clock className="mx-auto h-6 w-6 text-[#CBD5E1]" />
                <p className="mt-2 text-xs text-[#7E8B9B]">
                  No saved work sessions yet. Start the timer to log work automatically.
                </p>
              </div>
            )}
          </section>

          {/* Task Discussion Card */}
          {project && (
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
              <div className="mb-4">
                <h2 className="text-base font-bold text-[#1A1F2C]">Task Discussion &amp; Feedback</h2>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  Leave notes, updates, or questions for this specific task.
                </p>
              </div>
              <ProjectDiscussionsView
                projectId={project.id}
                projectOwnerId={project.userId}
                currentUserId={task.userId}
                taskId={task.id}
                allowComments={project.clientAllowComments ?? true}
              />
            </section>
          )}
        </div>

        {/* Right Column (~35%): Timer Control, Planned vs Actual, Calendar */}
        <div className="space-y-6 lg:col-span-4">
          {/* Task Timer Control Card (Liquid Glass style) */}
          <section className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
              Task Timer
            </div>
            <div className="mt-2 text-4xl font-bold tracking-tight text-[#1A1F2C] tabular-nums-strict">
              {isThisTaskActive ? formatClockHHMMSS(activeSessionSeconds) : '00:00:00'}
            </div>
            <p className="mt-1 text-xs text-[#7E8B9B]">
              {isThisTaskActive
                ? isRunning
                  ? 'Active session running for this task.'
                  : 'Active session paused for this task.'
                : 'No active timer running on this task.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {task.status !== 'completed' ? (
                isThisTaskActive ? (
                  <>
                    {isRunning ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={pauseActiveTimer}
                        className="flex-1"
                      >
                        <Pause className="h-4 w-4" />
                        <span>Pause</span>
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={resumeActiveTimer}
                        className="flex-1"
                      >
                        <Play className="h-4 w-4" />
                        <span>Resume</span>
                      </Button>
                    )}
                    <Button variant="destructive" size="md" onClick={stopAndSaveActiveTimer}>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop &amp; Save</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => startTaskTimer(task.id)}
                    className="w-full"
                  >
                    <Play className="h-4 w-4" />
                    <span>Start Timer</span>
                  </Button>
                )
              ) : (
                <p className="text-xs text-[#7E8B9B]">
                  Reopen this task to track new work sessions.
                </p>
              )}
            </div>
          </section>

          {/* Planned vs Actual Reconciliation Card */}
          <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
            <h2 className="text-base font-bold text-[#1A1F2C]">Planned vs. Actual</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-[#7E8B9B]">Planned Estimate</dt>
                <dd className="font-semibold text-[#1A1F2C] tabular-nums-strict">
                  {task.plannedDurationMinutes
                    ? formatDuration(task.plannedDurationMinutes * 60)
                    : 'No estimate'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7E8B9B]">Saved Work Time</dt>
                <dd className="font-semibold text-[#1A1F2C] tabular-nums-strict">
                  {formatDuration(savedSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7E8B9B]">Active Session</dt>
                <dd className="font-semibold text-[#2F65F6] tabular-nums-strict">
                  {formatDuration(activeSessionSeconds, true)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-[#F0F3F9] pt-3">
                <dt className="font-bold text-[#1A1F2C]">Live Actual Total</dt>
                <dd className="font-bold text-[#1A1F2C] tabular-nums-strict">
                  {formatDuration(liveActualSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#7E8B9B]">Variance</dt>
                <dd
                  className={`font-semibold tabular-nums-strict ${
                    variance.status === 'over_plan'
                      ? 'text-[#C2414B]'
                      : variance.status === 'under_plan' || variance.status === 'on_target'
                        ? 'text-[#10B981]'
                        : 'text-[#7E8B9B]'
                  }`}
                >
                  {variance.label}
                </dd>
              </div>
            </dl>
          </section>

          {/* Google Calendar Card */}
          <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#2F65F6]" />
                <h2 className="text-sm font-bold text-[#1A1F2C]">Google Calendar</h2>
              </div>
              <CalendarSyncBadge status={task.calendarSyncStatus} />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#F8FAFD] p-3 text-xs text-[#7E8B9B]">
              <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-[#98A2B3]" />
              <span>
                {calendarConnection.isConnected
                  ? 'Scheduled tasks are automatically synchronized one-way to your Google Calendar.'
                  : 'Connect your Google Calendar in Settings to automatically synchronize scheduled tasks one-way.'}
              </span>
            </div>

            <Link
              to="/settings/google-calendar"
              className="mt-3 inline-block text-xs font-semibold text-[#2F65F6] hover:underline"
            >
              Calendar Settings →
            </Link>
          </section>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Move Task to Archive?"
        description=""
        footer={
          <div className="flex w-full items-center justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmArchive} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Archive className="h-4 w-4 mr-1.5" />
              Move to Archive
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Archive className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-[#1A1F2C] break-words">
                {task.title}
              </h4>
              <p className="mt-1 text-xs text-[#7E8B9B]">
                This task will be moved to Archive and removed from your active task lists and calendar.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3.5 text-xs text-[#4A5568]">
            <div className="flex items-start gap-2">
              <CalendarX2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2F65F6]" />
              <span>
                <strong>Calendar cleanup:</strong> Future scheduled calendar time blocks allocated for this task will be removed, while historical calendar records remain intact.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                <strong>Work session safety:</strong> All previously completed work sessions and time entries remain preserved in your reports.
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
