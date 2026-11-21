import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Task } from '../../../types/models';
import { formatDuration, getLocalDateISO } from '../../../lib/timeMath';

export interface UpcomingTasksProps {
  upcomingTasks: Task[];
  todayIso: string;
}

function formatUpcomingDate(dateStr: string, todayIso: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === getLocalDateISO(tomorrow)) {
    return 'Tomorrow';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function UpcomingTasks({ upcomingTasks, todayIso }: UpcomingTasksProps) {
  return (
    <section
      aria-label="Coming Up"
      className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1A1F2C]">Coming up</h2>
        <Link
          to="/tasks?tab=upcoming"
          className="text-xs font-semibold text-[#2F65F6] hover:underline cursor-pointer"
        >
          View all
        </Link>
      </div>

      {upcomingTasks.length > 0 ? (
        <ul className="mt-3.5 divide-y divide-[#F0F3F9]">
          {upcomingTasks.map((task) => (
            <li key={task.id} className="py-3 first:pt-1 last:pb-0">
              <Link
                to={`/tasks/${task.id}`}
                className="group flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="shrink-0 rounded-lg bg-[#EDF2FE] px-2.5 py-1 text-[11px] font-semibold text-[#2F65F6] tabular-nums-strict">
                    {formatUpcomingDate(task.scheduledDate ?? '', todayIso)}
                  </span>
                  <span className="truncate text-xs font-semibold text-[#1A1F2C] transition-colors group-hover:text-[#2F65F6]">
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-[#7E8B9B] tabular-nums-strict">
                    {task.plannedDurationMinutes
                      ? formatDuration(task.plannedDurationMinutes * 60)
                      : '—'}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-[#98A2B3] transition-all group-hover:translate-x-0.5 group-hover:text-[#2F65F6]" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[#7E8B9B]">No upcoming tasks scheduled.</p>
      )}
    </section>
  );
}
