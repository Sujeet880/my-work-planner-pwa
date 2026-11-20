import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RefreshCw,
  Square,
  ArrowUpRight,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateSavedWorkSeconds,
  formatClockHHMMSS,
  formatDuration,
} from '../../lib/timeMath';
import { PriorityBadge, ProjectLabel } from '../ui/Badges';
import { Button } from '../ui/Button';

export function ActiveTimerCard({
  showRecoveryToggle = false,
}: {
  showRecoveryToggle?: boolean;
}) {
  const {
    activeTimer,
    activeTask,
    activeElapsedSeconds,
    projects,
    timeEntries,
    tasks,
    pauseActiveTimer,
    resumeActiveTimer,
    stopAndSaveActiveTimer,
    toggleTaskCompletion,
    startTaskTimer,
    toggleRecoveringPreview,
  } = useWorkspace();

  if (!activeTimer || !activeTask) {
    const quickStartCandidate = tasks.find(
      (t) => !t.isArchived && t.status !== 'completed'
    );

    return (
      <section
        aria-label="Active Timer"
        className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0F2F5] text-[#667085]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F0F2F5] px-2 py-0.5 text-xs font-medium text-[#667085]">
                  Idle
                </span>
                <span className="text-xs text-[#98A2B3]">No active work session</span>
              </div>
              <h2 className="mt-1.5 text-base font-semibold text-[#202531]">
                Ready to start a focused work session
              </h2>
              <p className="mt-0.5 text-sm text-[#667085]">
                Start the timer from any task row to track actual work time automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="text-2xl font-semibold tracking-tight text-[#98A2B3] tabular-nums-strict">
              00:00:00
            </div>
            {quickStartCandidate && (
              <Button
                variant="primary"
                size="md"
                onClick={() => startTaskTimer(quickStartCandidate.id)}
              >
                <Play className="h-4 w-4" />
                <span>Start Next Task</span>
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const project = projects.find((p) => p.id === activeTask.projectId);
  const savedBeforeThisSession = calculateSavedWorkSeconds(timeEntries, activeTask.id);
  const liveTotalSeconds = savedBeforeThisSession + activeElapsedSeconds;
  const isRunning = activeTimer.status === 'running';
  const isRecovering = activeTimer.status === 'recovering';

  return (
    <section
      aria-label="Active Timer"
      className={`rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
        isRunning
          ? 'border-[#4968D6]/40'
          : isRecovering
            ? 'border-[#B7791F]/50'
            : 'border-[#E4E7EC]'
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Task info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EDF1FF] px-2.5 py-0.5 text-xs font-semibold text-[#4968D6]">
                <span className="h-2 w-2 rounded-full bg-[#4968D6]" aria-hidden="true" />
                Timer Running
              </span>
            )}
            {activeTimer.status === 'paused' && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FEF3E2] px-2.5 py-0.5 text-xs font-semibold text-[#B7791F]">
                <Pause className="h-3 w-3" aria-hidden="true" />
                Timer Paused
              </span>
            )}
            {isRecovering && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FEF3E2] px-2.5 py-0.5 text-xs font-semibold text-[#B7791F]">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                Recovering Active Session
              </span>
            )}

            {project && <ProjectLabel name={project.name} color={project.color} />}
            <PriorityBadge priority={activeTask.priority} />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Link
              to={`/tasks/${activeTask.id}`}
              className="truncate text-lg font-semibold text-[#202531] hover:text-[#4968D6]"
            >
              {activeTask.title}
            </Link>
            <Link
              to={`/tasks/${activeTask.id}`}
              aria-label={`Open details for ${activeTask.title}`}
              className="text-[#98A2B3] hover:text-[#4968D6]"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#667085] tabular-nums-strict">
            <span>
              Planned:{' '}
              <strong className="font-medium text-[#202531]">
                {activeTask.plannedDurationMinutes
                  ? formatDuration(activeTask.plannedDurationMinutes * 60)
                  : 'No estimate'}
              </strong>
            </span>
            <span>
              Saved Earlier:{' '}
              <strong className="font-medium text-[#202531]">
                {formatDuration(savedBeforeThisSession)}
              </strong>
            </span>
            <span>
              Live Task Total:{' '}
              <strong className="font-medium text-[#4968D6]">
                {formatDuration(liveTotalSeconds)}
              </strong>
            </span>
          </div>
        </div>

        {/* Clock & Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:gap-5">
          <div className="sm:border-l sm:border-[#E4E7EC] sm:pl-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[#667085]">
              Current Session
            </div>
            <div
              data-testid="active-timer-clock"
              className="mt-0.5 text-3xl font-semibold tracking-tight text-[#202531] tabular-nums-strict"
            >
              {formatClockHHMMSS(activeElapsedSeconds)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <Button variant="secondary" size="md" onClick={pauseActiveTimer}>
                <Pause className="h-4 w-4" />
                <span>Pause</span>
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={resumeActiveTimer}>
                <Play className="h-4 w-4" />
                <span>Resume</span>
              </Button>
            )}

            <Button variant="destructive" size="md" onClick={stopAndSaveActiveTimer}>
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop & Save</span>
            </Button>

            <Button
              variant="success"
              size="md"
              onClick={() => toggleTaskCompletion(activeTask.id)}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Complete</span>
            </Button>
          </div>
        </div>
      </div>

      {showRecoveryToggle && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F2F5] pt-3 text-xs text-[#667085]">
          <span>
            Elapsed time is derived from timestamps so reload recovery remains accurate.
          </span>
          <button
            type="button"
            onClick={toggleRecoveringPreview}
            className="font-medium text-[#4968D6] hover:underline cursor-pointer"
          >
            {isRecovering ? 'Exit Recovering State Preview' : 'Preview Recovering State'}
          </button>
        </div>
      )}
    </section>
  );
}
