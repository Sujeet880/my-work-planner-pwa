import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { formatDuration } from '../../../lib/timeMath';

export interface DailyOverviewProps {
  completedTodayCount: number;
  totalTodayCount: number;
  remainingTodayCount: number;
  liveTrackedTodaySeconds: number;
}

export function DailyOverview({
  completedTodayCount,
  totalTodayCount,
  remainingTodayCount,
  liveTrackedTodaySeconds,
}: DailyOverviewProps) {
  // SVG Circular Donut Chart Math
  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius; // ~238.76
  const completionRatio =
    totalTodayCount > 0 ? completedTodayCount / totalTodayCount : 0;
  const strokeDashoffset =
    circleCircumference - completionRatio * circleCircumference;

  return (
    <section
      aria-label="Daily Overview"
      className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]"
    >
      <h2 className="text-base font-bold text-[#1A1F2C]">Daily overview</h2>

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
              {completedTodayCount}/{totalTodayCount}
            </div>
            <div className="text-[11px] font-semibold text-[#7E8B9B]">Tasks</div>
          </div>
        </div>

        {/* Right: 3 Metric Rows */}
        <div className="flex-1 space-y-3">
          {/* Tracked Time */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#7E8B9B]">
              <Clock className="h-4 w-4" />
              <span>Tracked time</span>
            </div>
            <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
              {formatDuration(liveTrackedTodaySeconds)}
            </span>
          </div>

          {/* Completed */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#7E8B9B]">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              <span>Completed</span>
            </div>
            <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
              {completedTodayCount}
            </span>
          </div>

          {/* Remaining */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#7E8B9B]">
              <Circle className="h-4 w-4 text-[#98A2B3]" />
              <span>Remaining</span>
            </div>
            <span className="font-bold text-[#1A1F2C] tabular-nums-strict">
              {remainingTodayCount}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
