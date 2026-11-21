import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
} from 'lucide-react';
import { formatDuration } from '../../../lib/timeMath';
import {
  calculateWorkOverviewMetrics,
  getDateISOInTimezone,
  type WorkOverviewMetrics,
  type WorkOverviewPeriod,
} from '../../../services/reportService';
import { useWorkspace } from '../../../context/WorkspaceContext';
import type { Task, TimeEntry, ActiveTimerState } from '../../../types/models';

export interface WorkOverviewProps {
  /** Optional override for tasks (useful for testing or custom scoping) */
  tasks?: readonly Task[];
  /** Optional override for timeEntries */
  timeEntries?: readonly TimeEntry[];
  /** Optional override for activeTimer */
  activeTimer?: ActiveTimerState | null;
  /** Optional override for activeElapsedSeconds */
  activeElapsedSeconds?: number;
  /** Optional override for timezone */
  timezone?: string;
  /** Optional loading override */
  isLoading?: boolean;
  /** Optional error message */
  error?: string | null;
  /** Optional retry handler */
  onRetry?: () => void;
  /** Optional controlled period */
  initialPeriod?: WorkOverviewPeriod;
}

export function WorkOverview({
  tasks: propTasks,
  timeEntries: propTimeEntries,
  activeTimer: propActiveTimer,
  activeElapsedSeconds: propActiveElapsedSeconds,
  timezone: propTimezone,
  isLoading: propIsLoading,
  error: propError,
  onRetry,
  initialPeriod = 'today',
}: WorkOverviewProps) {
  const workspace = useWorkspace();

  // Prefer props if provided, otherwise consume from WorkspaceContext
  const tasks = propTasks ?? workspace.tasks;
  const timeEntries = propTimeEntries ?? workspace.timeEntries;
  const activeTimer = propActiveTimer !== undefined ? propActiveTimer : workspace.activeTimer;
  const activeElapsedSeconds = propActiveElapsedSeconds ?? workspace.activeElapsedSeconds;
  const timezone = propTimezone || workspace.profile?.timezone || 'Asia/Kolkata';
  const isLoading = propIsLoading ?? workspace.isLoadingData;

  const [period, setPeriod] = useState<WorkOverviewPeriod>(initialPeriod);

  // Default custom range: past 7 days to today
  const defaultCustomDates = useMemo(() => {
    const today = getDateISOInTimezone(new Date(), timezone);
    const [y, m, d] = today.split('-').map(Number);
    const sevenDaysAgo = new Date(Date.UTC(y, m - 1, d - 6, 12, 0, 0))
      .toISOString()
      .slice(0, 10);
    return { start: sevenDaysAgo, end: today };
  }, [timezone]);

  const [customStart, setCustomStart] = useState<string>(defaultCustomDates.start);
  const [customEnd, setCustomEnd] = useState<string>(defaultCustomDates.end);

  // Compute dynamic metrics via centralized reportService utility
  const metrics: WorkOverviewMetrics = useMemo(() => {
    return calculateWorkOverviewMetrics({
      period,
      tasks,
      timeEntries,
      activeTimer,
      activeElapsedSeconds,
      customRange: { start: customStart, end: customEnd },
      timezone,
    });
  }, [
    period,
    tasks,
    timeEntries,
    activeTimer,
    activeElapsedSeconds,
    customStart,
    customEnd,
    timezone,
  ]);

  // SVG Circular Donut Chart Math
  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius; // ~238.76
  const strokeDashoffset =
    circleCircumference - metrics.completionRatio * circleCircumference;

  // Custom range change handlers with auto-clamping
  const handleStartChange = (val: string) => {
    setCustomStart(val);
    if (val > customEnd) {
      setCustomEnd(val);
    }
  };

  const handleEndChange = (val: string) => {
    setCustomEnd(val);
    if (val < customStart) {
      setCustomStart(val);
    }
  };

  return (
    <section
      aria-label="Work Overview"
      className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] transition-all"
    >
      {/* Header: Title + Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#1A1F2C]">Work Overview</h2>
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2F65F6]" />
          )}
        </div>

        {/* Period Filter Dropdown */}
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as WorkOverviewPeriod)}
            aria-label="Filter work overview period"
            className="h-8 rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] px-2.5 py-1 text-xs font-semibold text-[#1A1F2C] shadow-sm hover:border-[#D0D7E7] focus:border-[#2F65F6] focus:outline-none cursor-pointer transition-colors"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="all_time">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {/* Custom Range Picker (Visible only when 'custom' is active) */}
      {period === 'custom' && (
        <div className="mt-3.5 rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2.5">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#7E8B9B]" />
            <div className="flex flex-1 items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => handleStartChange(e.target.value)}
                aria-label="Custom start date"
                className="w-full min-w-0 rounded-lg border border-[#E9ECF5] bg-white px-2 py-1 text-[11px] font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none"
              />
              <span className="text-[11px] font-semibold text-[#7E8B9B]">to</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => handleEndChange(e.target.value)}
                aria-label="Custom end date"
                className="w-full min-w-0 rounded-lg border border-[#E9ECF5] bg-white px-2 py-1 text-[11px] font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {propError ? (
        <div className="mt-4 rounded-xl border border-[#FDE8E8] bg-[#FEF2F2] p-3 text-xs text-[#991B1B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
            <span>{propError}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="font-semibold underline hover:text-[#7F1D1D] cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        /* Main Chart + Metrics Display */
        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Left: SVG Circular Donut Chart */}
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 90 90">
              {/* Track circle */}
              <circle
                cx="45"
                cy="45"
                r={circleRadius}
                className="stroke-[#EDF2FE]"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Progress arc */}
              <circle
                cx="45"
                cy="45"
                r={circleRadius}
                className="stroke-[#2F65F6] transition-all duration-500 ease-out"
                strokeWidth="8"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Center text inside donut */}
            <div className="absolute text-center">
              <div className="text-xl font-bold text-[#1A1F2C] tabular-nums-strict">
                {metrics.completedTasksCount}/{metrics.totalTasksCount}
              </div>
              <div className="text-[11px] font-semibold text-[#7E8B9B]">Tasks</div>
            </div>
          </div>

          {/* Right: 3 Metric Rows */}
          <div className="flex-1 space-y-3">
            {/* 1. Tracked Time */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#7E8B9B]">
                <Clock className="h-4 w-4" />
                <span>Tracked time</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-[#1A1F2C] tabular-nums-strict">
                <span>{formatDuration(metrics.trackedSeconds)}</span>
                {metrics.isTimerRunningInPeriod && (
                  <span
                    title="Active timer is running and included in this total"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#16845B]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16845B] animate-pulse" />
                    <span>live</span>
                  </span>
                )}
              </div>
            </div>

            {/* 2. Completed */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#7E8B9B]">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                <span>Completed</span>
              </div>
              <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
                {metrics.completedTasksCount}
              </span>
            </div>

            {/* 3. Remaining */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#7E8B9B]">
                <Circle className="h-4 w-4 text-[#98A2B3]" />
                <span>Remaining</span>
              </div>
              <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
                {metrics.remainingTasksCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
