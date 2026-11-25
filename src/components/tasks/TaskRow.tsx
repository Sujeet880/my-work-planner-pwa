import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  Calendar,
  CalendarRange,
  Check,
  ExternalLink,
  Folder,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateLiveActualSeconds,
  formatDuration,
  getLocalDateISO,
  isTaskOverdue,
} from '../../lib/timeMath';
import type { ActiveTimerState, Project, Task, TimeEntry } from '../../types/models';
import { PriorityBadge, StatusBadge } from '../ui/Badges';

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
  const { requestDeleteTask, archiveTask } = useWorkspace();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const todayIso = getLocalDateISO();
  const isCompleted = task.status === 'completed';
  const overdue = isTaskOverdue(task, todayIso);
  const isThisTaskActive = activeTimer?.taskId === task.id;
  const isRunning = isThisTaskActive && activeTimer?.status === 'running';

  const liveActualSeconds = calculateLiveActualSeconds(timeEntries, activeTimer, task.id, nowMs);
  const plannedLabel = task.plannedDurationMinutes
    ? formatDuration(task.plannedDurationMinutes * 60)
    : '—';
  const actualLabel = formatDuration(liveActualSeconds);

  const isMultiDay = Boolean(
    task.scheduledEndDate &&
    task.scheduledDate &&
    task.scheduledEndDate > task.scheduledDate
  );

  const dailyHours = task.dailyPlannedMinutes
    ? `${task.dailyPlannedMinutes / 60}h/day`
    : '';

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
      className={`group relative flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
        isThisTaskActive
          ? 'border-[#2F65F6]/40 bg-[#EDF2FE]/40 shadow-xs'
          : 'border-[#E9ECF5] bg-white hover:border-[#D0D5DD] hover:bg-[#F9FAFD]/70'
      }`}
    >
      {/* Left: Checkbox + Title + Metadata */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={isCompleted ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
          onClick={() => onToggleComplete(task.id)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all cursor-pointer ${
            isCompleted
              ? 'bg-[#2F65F6] text-white shadow-xs'
              : 'border-2 border-[#D0D5DD] bg-white hover:border-[#2F65F6]'
          }`}
        >
          {isCompleted && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
        </button>

        <div className="min-w-0 flex-1">
          <Link
            to={`/tasks/${task.id}`}
            className={`block truncate text-sm font-semibold transition-colors ${
              isCompleted
                ? 'text-[#98A2B3] line-through'
                : isThisTaskActive
                  ? 'text-[#2F65F6]'
                  : 'text-[#1A1F2C] hover:text-[#2F65F6]'
            }`}
          >
            {task.title}
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#7E8B9B]">
            {project ? (
              <span className="flex items-center gap-1">
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[130px]">{project.name}</span>
              </span>
            ) : (
              <span className="text-[#98A2B3]">No project</span>
            )}

            {isMultiDay ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF2FE] px-2 py-0.5 text-[11px] font-semibold text-[#2F65F6] border border-[#DDE7FD] tabular-nums-strict">
                <CalendarRange className="h-3 w-3" />
                <span>
                  {task.scheduledDate} – {task.scheduledEndDate}
                  {dailyHours ? ` · ${dailyHours}` : ''}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 tabular-nums-strict">
                <Calendar className="h-3 w-3 text-[#98A2B3]" aria-hidden="true" />
                <span className={overdue ? 'font-medium text-[#C2414B]' : ''}>{scheduleText}</span>
              </span>
            )}

            <PriorityBadge priority={task.priority} />
            {!compact && <StatusBadge status={task.status} isOverdue={overdue} />}
          </div>
        </div>
      </div>

      {/* Right: Duration + Play/Pause Action + More Menu */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-[#1A1F2C] tabular-nums-strict">
            <span className={isThisTaskActive ? 'text-[#2F65F6]' : ''}>{actualLabel}</span>
            {task.plannedDurationMinutes && (
              <>
                <span className="mx-1 text-[#98A2B3]">/</span>
                <span className="text-[#7E8B9B]">{plannedLabel}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-[#98A2B3]">
            {task.plannedDurationMinutes ? 'Actual / Planned' : 'Actual time'}
          </div>
        </div>

        {!isCompleted && (
          <button
            type="button"
            onClick={() => (isRunning ? onPauseTimer() : onStartTimer(task.id))}
            aria-label={
              isRunning
                ? `Pause timer for "${task.title}"`
                : `Start timer for "${task.title}"`
            }
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer active:scale-95 ${
              isThisTaskActive
                ? 'bg-[#2F65F6] text-white shadow-sm'
                : 'bg-[#EDF2FE] text-[#2F65F6] hover:bg-[#DDE7FD]'
            }`}
          >
            {isRunning ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>
        )}

        {/* Action Menu (...) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={`Task actions for "${task.title}"`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#98A2B3] hover:bg-[#F0F2F5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-[#E9ECF5] bg-white py-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.1)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEditTask(task);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1A1F2C] hover:bg-[#F8FAFD] cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 text-[#7E8B9B]" />
                <span>Edit Task</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(`/tasks/${task.id}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1A1F2C] hover:bg-[#F8FAFD] cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#7E8B9B]" />
                <span>View Details</span>
              </button>

              <div className="my-1 border-t border-[#F0F3F9]" />

              {task.isArchived ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    archiveTask(task.id, false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[#2F65F6] hover:bg-[#EDF2FE] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Task</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    requestDeleteTask(task);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5 text-amber-600" />
                  <span>Move to Archive</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
