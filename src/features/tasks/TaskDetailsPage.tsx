import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  CalendarOff,
  CheckCircle2,
  Clock,
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
  ProjectLabel,
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4968D6] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to My Tasks</span>
        </Link>
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="Task not found"
          description="This task may have been deleted or does not exist in the current preview state."
          action={
            <Link to="/tasks">
              <Button variant="primary">Go to My Tasks</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const project = projects.find((p) => p.id === task.projectId);
  const todayIso = getLocalDateISO();
  const overdue = isTaskOverdue(task, todayIso);
  const isThisTaskActive = activeTimer?.taskId === task.id;
  const activeSessionSeconds = isThisTaskActive
    ? calculateActiveSessionSeconds(activeTimer, nowMs)
    : 0;
  const taskEntries = timeEntries.filter(
    (e) => e.taskId === task.id && e.status === 'completed'
  );
  const savedSeconds = calculateSavedWorkSeconds(timeEntries, task.id);
  const liveActualSeconds = savedSeconds + activeSessionSeconds;
  const variance = calculateTimeVariance(task.plannedDurationMinutes, liveActualSeconds);

  const handleConfirmDelete = () => {
    deleteTask(task.id);
    setConfirmDeleteOpen(false);
    navigate('/tasks');
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <Link to="/tasks" className="inline-flex items-center gap-1 hover:text-[#202531]">
            <ArrowLeft className="h-4 w-4" />
            <span>My Tasks</span>
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-[#202531]">{task.title}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditTaskDrawer(task)}>
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>
          <Button
            variant={task.status === 'completed' ? 'secondary' : 'success'}
            size="sm"
            onClick={() => toggleTaskCompletion(task.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{task.status === 'completed' ? 'Reopen Task' : 'Mark Completed'}</span>
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

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Task Overview & Work Sessions */}
        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={task.status}
                isOverdue={overdue}
                timerState={isThisTaskActive ? activeTimer?.status ?? null : null}
              />
              <PriorityBadge priority={task.priority} />
              {project && <ProjectLabel name={project.name} color={project.color} />}
            </div>

            <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#202531] sm:text-2xl">
              {task.title}
            </h1>

            <p className="mt-2.5 text-sm leading-relaxed text-[#667085]">
              {task.description || 'No description provided for this task.'}
            </p>

            {/* Metadata row */}
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#F0F2F5] pt-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-[#667085]">Scheduled Date</dt>
                <dd className="mt-1 font-medium text-[#202531] tabular-nums-strict">
                  {task.scheduledDate ?? 'Unscheduled (Inbox)'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Start Time</dt>
                <dd className="mt-1 font-medium text-[#202531] tabular-nums-strict">
                  {task.scheduledStartTime ?? 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Planned Duration</dt>
                <dd className="mt-1 font-medium text-[#202531] tabular-nums-strict">
                  {task.plannedDurationMinutes
                    ? formatDuration(task.plannedDurationMinutes * 60)
                    : 'No estimate'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#667085]">Reminder</dt>
                <dd className="mt-1 font-medium text-[#202531]">
                  {task.reminderOffsetMinutes !== null
                    ? task.reminderOffsetMinutes === 0
                      ? 'At start time'
                      : `${task.reminderOffsetMinutes}m before`
                    : 'None'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Work Sessions History */}
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#202531]">Work Sessions</h2>
                <p className="mt-0.5 text-xs text-[#667085] tabular-nums-strict">
                  {taskEntries.length} saved session{taskEntries.length === 1 ? '' : 's'} · Total
                  saved: <strong className="text-[#202531]">{formatDuration(savedSeconds)}</strong>
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
              <ul className="mt-4 divide-y divide-[#F0F2F5]">
                {taskEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <EntryTypeBadge type={entry.entryType} />
                        <span className="text-xs font-medium text-[#202531] tabular-nums-strict">
                          {entry.startedAt.slice(0, 10)}
                        </span>
                        <span className="text-xs text-[#667085] tabular-nums-strict">
                          {entry.startedAt.slice(11, 16)}
                          {entry.endedAt ? ` – ${entry.endedAt.slice(11, 16)}` : ''}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="mt-1 text-xs text-[#667085]">{entry.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-sm font-semibold text-[#202531] tabular-nums-strict">
                        {formatDuration(entry.durationSeconds)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete work session from ${entry.startedAt.slice(0, 10)}`}
                        onClick={() => deleteTimeEntry(entry.id)}
                        className="px-2 text-[#98A2B3] hover:text-[#C2414B]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title="No saved work sessions yet"
                  description="Start the timer for this task or add a manual time entry."
                />
              </div>
            )}
          </section>
        </div>

        {/* Right: Live Timer, Planned vs Actual Breakdown, Google Calendar */}
        <div className="space-y-5 lg:col-span-4">
          {/* Task Timer Control Card */}
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
              Task Timer
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-[#202531] tabular-nums-strict">
              {isThisTaskActive ? formatClockHHMMSS(activeSessionSeconds) : '00:00:00'}
            </div>
            <p className="mt-1 text-xs text-[#667085]">
              {isThisTaskActive
                ? activeTimer?.status === 'running'
                  ? 'Active session running for this task.'
                  : 'Active session paused for this task.'
                : 'No active timer running on this task.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {task.status !== 'completed' ? (
                isThisTaskActive ? (
                  <>
                    {activeTimer?.status === 'running' ? (
                      <Button variant="secondary" size="md" onClick={pauseActiveTimer} className="flex-1">
                        <Pause className="h-4 w-4" />
                        <span>Pause</span>
                      </Button>
                    ) : (
                      <Button variant="primary" size="md" onClick={resumeActiveTimer} className="flex-1">
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
                <p className="text-xs text-[#667085]">Reopen task to start a new timer session.</p>
              )}
            </div>
          </section>

          {/* Planned vs Actual Time Reconciliation */}
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="text-sm font-semibold text-[#202531]">Planned vs. Actual</h2>
            <dl className="mt-3.5 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[#667085]">Planned Estimate</dt>
                <dd className="font-medium text-[#202531] tabular-nums-strict">
                  {task.plannedDurationMinutes
                    ? formatDuration(task.plannedDurationMinutes * 60)
                    : 'No estimate'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#667085]">Saved Work Time</dt>
                <dd className="font-medium text-[#202531] tabular-nums-strict">
                  {formatDuration(savedSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#667085]">Active Session</dt>
                <dd className="font-medium text-[#4968D6] tabular-nums-strict">
                  {formatDuration(activeSessionSeconds, true)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-[#F0F2F5] pt-2.5">
                <dt className="font-medium text-[#202531]">Live Actual Total</dt>
                <dd className="font-semibold text-[#202531] tabular-nums-strict">
                  {formatDuration(liveActualSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#667085]">Variance</dt>
                <dd
                  className={`font-medium tabular-nums-strict ${
                    variance.status === 'over_plan'
                      ? 'text-[#C2414B]'
                      : variance.status === 'under_plan' || variance.status === 'on_target'
                        ? 'text-[#16845B]'
                        : 'text-[#667085]'
                  }`}
                >
                  {variance.label}
                </dd>
              </div>
            </dl>
          </section>

          {/* Google Calendar Sync Status */}
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#667085]" />
                <h2 className="text-sm font-semibold text-[#202531]">Google Calendar</h2>
              </div>
              <CalendarSyncBadge status={task.calendarSyncStatus} />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#F6F7F9] p-3 text-xs text-[#667085]">
              <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-[#98A2B3]" />
              <span>
                Google Calendar is not connected in Milestone 0. One-way sync (My Work Planner →
                Google Calendar) will be configured in Milestone 6.
              </span>
            </div>

            <Link
              to="/settings/google-calendar"
              className="mt-3 inline-block text-xs font-medium text-[#4968D6] hover:underline"
            >
              Manage Calendar Integration
            </Link>
          </section>
        </div>
      </div>

      {/* Permanent Delete Confirmation Modal */}
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
