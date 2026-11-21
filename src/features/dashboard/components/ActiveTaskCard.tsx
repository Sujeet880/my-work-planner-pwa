import { Link } from 'react-router-dom';
import { Folder, Pause, Play, Plus, Square } from 'lucide-react';
import type { ActiveTimerState, Project, Task } from '../../../types/models';
import { formatClockHHMMSS } from '../../../lib/timeMath';

export interface ActiveTaskCardProps {
  activeTimer: ActiveTimerState | null;
  activeTask: Task | null;
  activeProject?: Project;
  activeElapsedSeconds: number;
  quickStartCandidate: Task | null;
  quickStartProject?: Project;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onStartFocus: (taskId: string) => void;
  onNewTask: () => void;
}

export function ActiveTaskCard({
  activeTimer,
  activeTask,
  activeProject,
  activeElapsedSeconds,
  quickStartCandidate,
  quickStartProject,
  onPause,
  onResume,
  onStop,
  onStartFocus,
  onNewTask,
}: ActiveTaskCardProps) {
  const isRunning = activeTimer?.status === 'running';
  const isPaused = activeTimer?.status === 'paused';
  const isRecovering = activeTimer?.status === 'recovering';

  return (
    <section
      aria-label="Active Focus Session"
      className="relative overflow-hidden rounded-[24px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl transition-all"
    >
      {/* Subtle Fluid Wave Background Decoration */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 text-[#2F65F6]/10 blur-xl"
        viewBox="0 0 200 200"
        fill="currentColor"
      >
        <path
          d="M45.7,-78.3C58.9,-71.1,69.2,-58.7,76.5,-44.6C83.7,-30.5,88,-15.2,86.6,-0.8C85.2,13.6,78.2,27.2,69.5,39.3C60.8,51.4,50.5,62.1,38,70.5C25.6,78.9,11,85.1,-3.2,89.5C-17.4,93.9,-34.8,96.5,-48.5,89.9C-62.2,83.3,-72.1,67.5,-78.9,51.5C-85.7,35.5,-89.3,17.7,-88.2,0.6C-87.1,-16.5,-81.2,-33.1,-72,-47.1C-62.8,-61.2,-50.2,-72.8,-36.2,-79.6C-22.1,-86.3,-6.7,-88.3,4.4,-94.4C15.5,-100.5,32.4,-85.5,45.7,-78.3Z"
          transform="translate(100 100)"
        />
      </svg>

      {activeTimer && activeTask ? (
        /* Active or Paused Session */
        <div className="relative z-10 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6]">
              <span
                className={`h-2 w-2 rounded-full ${
                  isRunning
                    ? 'bg-[#2F65F6] animate-pulse'
                    : isPaused
                      ? 'bg-[#B7791F]'
                      : 'bg-[#4968D6]'
                }`}
              />
              <span>
                {isRunning
                  ? 'Live focus'
                  : isPaused
                    ? 'Focus paused'
                    : 'Recovering session'}
              </span>
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#1A1F2C]">
              <Link
                to={`/tasks/${activeTask.id}`}
                className="hover:text-[#2F65F6] transition-colors"
              >
                {activeTask.title}
              </Link>
            </h2>

            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#7E8B9B]">
              <Folder className="h-3.5 w-3.5" />
              <span>{activeProject ? activeProject.name : 'Personal Workspace'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              data-testid="active-timer-clock"
              className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1A1F2C] tabular-nums-strict"
            >
              {formatClockHHMMSS(activeElapsedSeconds)}
            </div>

            {/* Segmented Floating Pill Control */}
            <div className="flex items-center rounded-full border border-[#E9ECF4] bg-white/90 p-1 shadow-[0_2px_10px_rgba(25,45,100,0.06)] backdrop-blur-md self-start sm:self-auto">
              {isRunning ? (
                <button
                  type="button"
                  onClick={onPause}
                  aria-label="Pause active focus session"
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1A1F2C] hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResume}
                  aria-label="Resume active focus session"
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#2F65F6] hover:bg-[#EDF2FE] transition-colors cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Resume</span>
                </button>
              )}

              <button
                type="button"
                onClick={onStop}
                aria-label="Stop and save focus session"
                className="flex items-center gap-1.5 rounded-full bg-[#2F65F6] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#2554DB] cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Idle State: Ready to Focus */
        <div className="relative z-10 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#7E8B9B]">
              <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
              <span>Focus session</span>
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#1A1F2C]">
              {quickStartCandidate
                ? quickStartCandidate.title
                : 'Ready for your next priority'}
            </h2>

            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#7E8B9B]">
              <Folder className="h-3.5 w-3.5" />
              <span>
                {quickStartProject ? quickStartProject.name : 'Personal Workspace'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-4xl sm:text-5xl font-bold tracking-tight text-[#98A2B3] tabular-nums-strict">
              00:00:00
            </div>

            {quickStartCandidate ? (
              <button
                type="button"
                onClick={() => onStartFocus(quickStartCandidate.id)}
                aria-label={`Start focus session for ${quickStartCandidate.title}`}
                className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(47,101,246,0.3)] transition-all hover:bg-[#2554DB] cursor-pointer self-start sm:self-auto active:scale-95"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Start focus</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNewTask}
                aria-label="Add focus task"
                className="flex items-center gap-2 rounded-full bg-[#EDF2FE] px-5 py-2.5 text-sm font-semibold text-[#2F65F6] hover:bg-[#DDE7FD] transition-colors cursor-pointer self-start sm:self-auto active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add focus task</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
