import { formatDuration } from '../../../lib/timeMath';

export interface WeekDayStat {
  name: string;
  iso: string;
  seconds: number;
  isToday: boolean;
}

export interface WeeklyTimeOverviewProps {
  weekDays: WeekDayStat[];
  weekTotalSeconds: number;
  weekDateRange: string;
  maxDaySeconds: number;
}

export function WeeklyTimeOverview({
  weekDays,
  weekTotalSeconds,
  weekDateRange,
  maxDaySeconds,
}: WeeklyTimeOverviewProps) {
  return (
    <section
      aria-label="This Week Overview"
      className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1A1F2C]">This week</h2>
        <span className="text-xs font-medium text-[#7E8B9B]">{weekDateRange}</span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        {/* Left: Total Hours + Active Indicator */}
        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1F2C] tabular-nums-strict">
            {formatDuration(weekTotalSeconds)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#10B981]">
            <span>▲ Active week total</span>
          </div>
        </div>

        {/* Right: 7-Day Mini Bar Chart */}
        <div className="flex items-end gap-1.5 sm:gap-2 h-20">
          {weekDays.map((day) => {
            const heightPercent =
              maxDaySeconds > 0
                ? Math.max(14, Math.round((day.seconds / maxDaySeconds) * 100))
                : 14;

            return (
              <div
                key={day.name}
                className="flex flex-col items-center gap-1.5"
                title={`${day.name}: ${formatDuration(day.seconds)}`}
              >
                <div
                  className={`w-3.5 sm:w-4 rounded-md transition-all duration-300 ${
                    day.isToday
                      ? 'bg-[#2F65F6] shadow-sm shadow-[#2F65F6]/30'
                      : 'bg-[#DDE5F8] hover:bg-[#CBD7F5]'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span
                  className={`text-[10px] font-semibold ${
                    day.isToday ? 'text-[#2F65F6]' : 'text-[#7E8B9B]'
                  }`}
                >
                  {day.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
