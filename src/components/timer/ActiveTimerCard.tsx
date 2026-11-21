import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Folder,
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
import { PriorityBadge } from '../ui/Badges';

export function ActiveTimerCard({
  showRecoveryToggle = false,
  hideWhenIdle = false,
}: {
  showRecoveryToggle?: boolean;
  hideWhenIdle?: boolean;
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
    if (hideWhenIdle) {
      return null;
    }

    const quickStartCandidate = tasks.find(
      (t) => !t.isArchived && t.status !== 'completed'
    );

    return (
      <section
        aria-label="Active Timer"
        className="relative overflow-hidden rounded-[24px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl transition-all"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-xs font-semibold text-[#7E8B9B]">
                  Idle
                </span>
                <span className="text-xs text-[#98A2B3]">No active work session</span>
              </div>
              <h2 className="mt-1.5 text-base font-bold text-[#1A1F2C]">
                Ready to start a focused work session
              </h2>
              <p className="mt-0.5 text-xs text-[#7E8B9B]">
                Start the timer from any task row to track actual work time automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-3xl font-bold tracking-tight text-[#98A2B3] tabular-nums-strict">
              00:00:00
            </div>
            {quickStartCandidate && (
              <button
                type="button"
                onClick={() => startTaskTimer(quickStartCandidate.id)}
                className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(47,101,246,0.3)] hover:bg-[#2554DB] transition-all cursor-pointer active:scale-95"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Start Next Task</span>
              </button>
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
  const isPaused = activeTimer.status === 'paused';

  return (
    <section
      aria-label="Active Timer"
      className="relative overflow-hidden rounded-[24px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl transition-all"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Task info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-xs font-semibold text-[#2F65F6]">
                <span className="h-2 w-2 rounded-full bg-[#2F65F6] animate-pulse" aria-hidden="true" />
                Live focus
              </span>
            )}
            {isPaused && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-xs font-semibold text-[#B7791F]">
                <Pause className="h-3 w-3" aria-hidden="true" />
                Timer Paused
              </span>
            )}
            {isRecovering && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-xs font-semibold text-[#B7791F]">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                Recovering Session
              </span>
            )}

            {project && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7E8B9B]">
                <Folder className="h-3 w-3" />
                <span>{project.name}</span>
              </span>
            )}
            <PriorityBadge priority={activeTask.priority} />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Link
              to={`/tasks/${activeTask.id}`}
              className="truncate text-xl font-bold text-[#1A1F2C] hover:text-[#2F65F6] transition-colors"
            >
              {activeTask.title}
            </Link>
            <Link
              to={`/tasks/${activeTask.id}`}
              aria-label={`Open details for ${activeTask.title}`}
              className="text-[#98A2B3] hover:text-[#2F65F6]"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7E8B9B] tabular-nums-strict">
            <span>
              Planned:{' '}
              <strong className="font-semibold text-[#1A1F2C]">
                {activeTask.plannedDurationMinutes
                  ? formatDuration(activeTask.plannedDurationMinutes * 60)
                  : 'No estimate'}
              </strong>
            </span>
            <span>
              Saved Earlier:{' '}
              <strong className="font-semibold text-[#1A1F2C]">
                {formatDuration(savedBeforeThisSession)}
              </strong>
            </span>
            <span>
              Live Task Total:{' '}
              <strong className="font-bold text-[#2F65F6]">
                {formatDuration(liveTotalSeconds)}
              </strong>
            </span>
          </div>
        </div>

        {/* Clock & Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:gap-5">
          <div className="sm:border-l sm:border-[#E9ECF5] sm:pl-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7E8B9B]">
              Session
            </div>
            <div
              data-testid="active-timer-clock"
              className="mt-0.5 text-4xl font-bold tracking-tight text-[#1A1F2C] tabular-nums-strict"
            >
              {formatClockHHMMSS(activeElapsedSeconds)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={pauseActiveTimer}
                className="flex items-center gap-1.5 rounded-full bg-white border border-[#E9ECF5] px-4 py-2 text-xs font-semibold text-[#1A1F2C] hover:bg-[#F8FAFD] transition-colors cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeActiveTimer}
                className="flex items-center gap-1.5 rounded-full bg-[#2F65F6] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#2554DB] transition-all cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Resume</span>
              </button>
            )}

            <button
              type="button"
              onClick={stopAndSaveActiveTimer}
              className="flex items-center gap-1.5 rounded-full bg-[#FCE8E9] border border-[#F5C2C7] px-4 py-2 text-xs font-semibold text-[#C2414B] hover:bg-[#F8D7DA] transition-colors cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop &amp; Save</span>
            </button>

            <button
              type="button"
              onClick={() => toggleTaskCompletion(activeTask.id)}
              className="flex items-center gap-1.5 rounded-full bg-[#E8F5EF] border border-[#BCE3D1] px-4 py-2 text-xs font-semibold text-[#16845B] hover:bg-[#D6EFE3] transition-colors cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Complete</span>
            </button>
          </div>
        </div>
      </div>

      {showRecoveryToggle && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F3F9] pt-3 text-xs text-[#7E8B9B]">
          <span>
            Elapsed time is derived from timestamps so reload recovery remains accurate.
          </span>
          <button
            type="button"
            onClick={toggleRecoveringPreview}
            className="font-semibold text-[#2F65F6] hover:underline cursor-pointer"
          >
            {isRecovering ? 'Exit Recovering State Preview' : 'Preview Recovering State'}
          </button>
        </div>
      )}
    </section>
  );
}
