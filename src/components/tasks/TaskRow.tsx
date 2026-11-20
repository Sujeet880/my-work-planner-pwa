import { Link } from 'react-router-dom';
import { Calendar, Check, Pause, Play, Pencil } from 'lucide-react';
import {
  calculateLiveActualSeconds,
  formatDuration,
  getLocalDateISO,
  isTaskOverdue,
} from '../../lib/timeMath';
import type { ActiveTimerState, Project, Task, TimeEntry } from '../../types/models';
import { PriorityBadge, ProjectLabel, StatusBadge } from '../ui/Badges';
import { Button } from '../ui/Button';

export interface TaskRowProps {
  task: Task;
  project: Project | undefined;
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimerState | null;
  nowMs: number;
  onToggleComplete: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
  onEditTask: (task: Task) => void;
  compact?: boolean;
}

export function TaskRow({
  task,
  project,
  timeEntries,
  activeTimer,
  nowMs,
  onToggleComplete,
  onStartTimer,
  onPauseTimer,
  onEditTask,
  compact = false,
}: TaskRowProps) {
  const todayIso = getLocalDateISO();
  const isCompleted = task.status === 'completed';
  const overdue = isTaskOverdue(task, todayIso);
  const isThisTaskActive = activeTimer?.taskId === task.id;
  const timerState = isThisTaskActive ? activeTimer?.status ?? null : null;

  const liveActualSeconds = calculateLiveActualSeconds(timeEntries, activeTimer, task.id, nowMs);
  const plannedLabel = task.plannedDurationMinutes
    ? formatDuration(task.plannedDurationMinutes * 60)
    : 'No est.';
  const actualLabel = formatDuration(liveActualSeconds);

  const scheduleText = task.scheduledDate
    ? task.scheduledDate === todayIso
      ? task.scheduledStartTime
        ? `Today · ${task.scheduledStartTime}`
        : 'Today'
      : task.scheduledStartTime
        ? `${task.scheduledDate} · ${task.scheduledStartTime}`
        : task.scheduledDate
    : 'Inbox';

  return (
    <div
      className={`group flex flex-col gap-3 rounded-xl border bg-white px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        isThisTaskActive
          ? 'border-[#4968D6]/40 bg-[#EDF1FF]/30'
          : 'border-[#E4E7EC] hover:border-[#D0D5DD]'
      }`}
    >
      {/* Left: Checkbox + Title + Metadata */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={isCompleted ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
          onClick={() => onToggleComplete(task.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
            isCompleted
              ? 'border-[#16845B] bg-[#16845B] text-white'
              : 'border-[#D0D5DD] bg-white hover:border-[#4968D6]'
          }`}
        >
          {isCompleted && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
        </button>

        <div className="min-w-0 flex-1">
          <Link
            to={`/tasks/${task.id}`}
            className={`block truncate text-sm font-medium leading-snug hover:text-[#4968D6] ${
              isCompleted ? 'text-[#98A2B3] line-through' : 'text-[#202531]'
            }`}
          >
            {task.title}
          </Link>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#667085]">
            {project ? (
              <ProjectLabel name={project.name} color={project.color} />
            ) : (
              <span className="text-[#98A2B3]">No project</span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums-strict">
              <Calendar className="h-3.5 w-3.5 text-[#98A2B3]" aria-hidden="true" />
              <span className={overdue ? 'font-medium text-[#C2414B]' : ''}>{scheduleText}</span>
            </span>
            <PriorityBadge priority={task.priority} />
            {!compact && <StatusBadge status={task.status} isOverdue={overdue} timerState={timerState} />}
          </div>
        </div>
      </div>

      {/* Right: Planned vs Actual + Actions */}
      <div className="flex items-center justify-between gap-3 border-t border-[#F0F2F5] pt-2.5 sm:border-t-0 sm:pt-0 sm:justify-end">
        <div className="text-left sm:text-right">
          <div className="text-xs font-medium text-[#202531] tabular-nums-strict">
            <span className={isThisTaskActive ? 'text-[#4968D6]' : ''}>{actualLabel}</span>
            <span className="mx-1 text-[#98A2B3]">/</span>
            <span className="text-[#667085]">{plannedLabel}</span>
          </div>
          <div className="text-[11px] text-[#98A2B3]">Actual / Planned</div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isCompleted && (
            <>
              {isThisTaskActive && activeTimer?.status === 'running' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onPauseTimer}
                  aria-label={`Pause timer for "${task.title}"`}
                >
                  <Pause className="h-3.5 w-3.5 text-[#4968D6]" />
                  <span>Pause</span>
                </Button>
              ) : (
                <Button
                  variant={isThisTaskActive ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => onStartTimer(task.id)}
                  aria-label={
                    isThisTaskActive
                      ? `Resume timer for "${task.title}"`
                      : `Start timer for "${task.title}"`
                  }
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{isThisTaskActive ? 'Resume' : 'Start'}</span>
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditTask(task)}
            aria-label={`Edit "${task.title}"`}
            className="px-2"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
