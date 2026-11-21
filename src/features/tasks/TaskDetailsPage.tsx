import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  CalendarOff,
  CheckCircle2,
  Clock,
  Folder,
  Pause,
  Pencil,
  Play,
  Plus,
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
  EntryTypeBadge,
  PriorityBadge,
  StatusBadge,
} from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';

export function TaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const {
    tasks,
    projects,
    timeEntries,
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

  const handleConfirmDelete = () => {
    deleteTask(task.id);
    setConfirmDeleteOpen(false);
    navigate('/tasks');
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              archiveTask(task.id);
              navigate('/tasks');
            }}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
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
            </dl>
          </section>

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
                One-way sync (My Work Planner → Google Calendar) will push scheduled tasks once
                OAuth credentials are configured.
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete Task Permanently?"
        description="Deleting this task removes the task and its linked work sessions from this view. Use Archive instead if you want to preserve historical time logs."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Permanently
            </Button>
          </>
        }
      />
    </div>
  );
}
