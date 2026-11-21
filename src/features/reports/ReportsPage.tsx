import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Info,
  ListChecks,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateSavedWorkSeconds,
  calculateTimeVariance,
  formatDuration,
  getLocalDateISO,
} from '../../lib/timeMath';
import type { ReportPeriod } from '../../types/models';
import { ProjectLabel, StatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Input, Select } from '../../components/ui/Field';
import { MetricCard } from '../../components/ui/MetricCard';
import { Modal } from '../../components/ui/Modal';

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateISO(d);
}

export function ReportsPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeTimer,
    activeTask,
    activeElapsedSeconds,
  } = useWorkspace();

  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState(() => shiftDate(-6));
  const [customEnd, setCustomEnd] = useState(() => getLocalDateISO());
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const dateRange = useMemo(() => {
    const today = getLocalDateISO();
    if (period === 'daily') return { start: today, end: today };
    if (period === 'weekly') return { start: shiftDate(-6), end: today };
    if (period === 'monthly') return { start: shiftDate(-29), end: today };
    return {
      start: customStart <= customEnd ? customStart : customEnd,
      end: customEnd >= customStart ? customEnd : customStart,
    };
  }, [period, customStart, customEnd]);

  // Saved completed entries ONLY within selected range (never includes future dates or active running timer)
  const scopedEntries = useMemo(
    () =>
      timeEntries.filter((e) => {
        if (e.status !== 'completed') return false;
        const datePart = e.startedAt.slice(0, 10);
        if (datePart < dateRange.start || datePart > dateRange.end) return false;
        if (projectFilter !== 'all' && e.projectId !== projectFilter) return false;
        return true;
      }),
    [timeEntries, dateRange, projectFilter]
  );

  // Tasks relevant to the selected period (scheduled in range OR having saved entries in range)
  const scopedTasks = useMemo(() => {
    const entryTaskIds = new Set(scopedEntries.map((e) => e.taskId));
    return tasks.filter((t) => {
      if (t.isArchived) return false;
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      const inScheduleRange =
        t.scheduledDate !== null &&
        t.scheduledDate >= dateRange.start &&
        t.scheduledDate <= dateRange.end;
      return inScheduleRange || entryTaskIds.has(t.id);
    });
  }, [tasks, scopedEntries, dateRange, projectFilter]);

  const totalSavedSeconds = calculateSavedWorkSeconds(scopedEntries);
  const totalPlannedSeconds = scopedTasks.reduce(
    (sum, t) => sum + (t.plannedDurationMinutes ? t.plannedDurationMinutes * 60 : 0),
    0
  );
  const completedTasksCount = scopedTasks.filter((t) => t.status === 'completed').length;

  // Project breakdown (Planned vs Saved Actual)
  const projectSummary = useMemo(() => {
    const rows = projects
      .filter((p) => !p.isArchived && (projectFilter === 'all' || p.id === projectFilter))
      .map((proj) => {
        const projTasks = scopedTasks.filter((t) => t.projectId === proj.id);
        const plannedSec = projTasks.reduce(
          (sum, t) => sum + (t.plannedDurationMinutes ? t.plannedDurationMinutes * 60 : 0),
          0
        );
        const actualSec = scopedEntries
          .filter((e) => e.projectId === proj.id)
          .reduce((sum, e) => sum + e.durationSeconds, 0);
        return {
          project: proj,
          taskCount: projTasks.length,
          plannedSec,
          actualSec,
        };
      })
      .filter((r) => r.plannedSec > 0 || r.actualSec > 0);

    const maxSec = Math.max(
      1,
      ...rows.map((r) => Math.max(r.plannedSec, r.actualSec))
    );
    return { rows, maxSec };
  }, [projects, projectFilter, scopedEntries, scopedTasks]);

  const periods: { key: ReportPeriod; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">
            Reports &amp; Analytics
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            Compare planned vs. actual tracked hours across projects with precision analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E9ECF5] bg-white text-[#1A1F2C] shadow-sm hover:bg-[#F8FAFD] transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#2F65F6] ring-2 ring-white" />
          </button>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_6px_20px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Period Selector & Project Filter Controls */}
      <div className="flex flex-col gap-3 rounded-[28px] border border-white/80 bg-white/80 p-3.5 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div
          className="inline-flex flex-wrap rounded-full border border-[#E9ECF5] bg-[#F4F7FD] p-1"
          role="tablist"
          aria-label="Report time period"
        >
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                period === p.key
                  ? 'bg-white text-[#2F65F6] shadow-xs'
                  : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Custom start date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 w-auto text-xs rounded-xl"
              />
              <span className="text-xs text-[#7E8B9B] font-medium">to</span>
              <Input
                type="date"
                aria-label="Custom end date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 w-auto text-xs rounded-xl"
              />
            </div>
          )}

          <Select
            aria-label="Filter report by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9.5 w-auto min-w-[150px] text-xs font-semibold rounded-xl"
          >
            <option value="all">All Projects</option>
            {projects
              .filter((p) => !p.isArchived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>
      </div>

      {/* Separate Notice for Active Unsaved Session (PRD §14.3) */}
      {activeTimer && activeTask && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#2F65F6]/20 bg-[#EDF2FE]/70 px-4 py-3 text-xs text-[#1A1F2C]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2F65F6]" />
          <div className="tabular-nums-strict">
            <strong className="font-semibold">Active session excluded from saved totals:</strong>{' '}
            &ldquo;{activeTask.title}&rdquo; currently has{' '}
            <strong className="font-semibold text-[#2F65F6]">
              {formatDuration(activeElapsedSeconds, true)}
            </strong>{' '}
            in progress. Stop and save the timer to include it in finalized report totals.
          </div>
        </div>
      )}

      {/* 4 Core Report KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Saved Tracked Time"
          value={formatDuration(totalSavedSeconds)}
          subtext={`${dateRange.start} to ${dateRange.end}`}
          accentValue
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Planned Time"
          value={formatDuration(totalPlannedSeconds)}
          subtext="Sum of estimated tasks in range"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Tasks Completed"
          value={`${completedTasksCount} / ${scopedTasks.length}`}
          subtext="Within selected period"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Saved Work Sessions"
          value={String(scopedEntries.length)}
          subtext="Completed timer & manual logs"
          icon={<ListChecks className="h-4 w-4" />}
        />
      </div>

      {/* Planned vs Actual by Project (Restrained Data Visualization) */}
      <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1A1F2C]">
              Planned vs. Saved Actual by Project
            </h2>
            <p className="text-xs text-[#7E8B9B]">
              Shows only saved completed entries within {dateRange.start} – {dateRange.end}.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-[#7E8B9B]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
              Planned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2F65F6]" />
              Saved Actual
            </span>
          </div>
        </div>

        {projectSummary.rows.length > 0 ? (
          <div className="mt-6 space-y-5">
            {projectSummary.rows.map(({ project, taskCount, plannedSec, actualSec }) => {
              const plannedWidth = Math.round((plannedSec / projectSummary.maxSec) * 100);
              const actualWidth = Math.round((actualSec / projectSummary.maxSec) * 100);
              return (
                <div key={project.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <ProjectLabel name={project.name} color={project.color} />
                      <span className="text-[#9AA6B8] tabular-nums-strict font-semibold">
                        ({taskCount} task{taskCount === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums-strict">
                      <span className="text-[#7E8B9B]">
                        Planned: <strong className="text-[#1A1F2C] font-semibold">{formatDuration(plannedSec)}</strong>
                      </span>
                      <span className="text-[#7E8B9B]">
                        Actual: <strong className="text-[#2F65F6] font-semibold">{formatDuration(actualSec)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F4F7FD]">
                      <div
                        className="h-full rounded-full bg-[#E2E8F0] transition-all duration-300"
                        style={{ width: `${plannedWidth}%` }}
                      />
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F4F7FD]">
                      <div
                        className="h-full rounded-full bg-[#2F65F6] transition-all duration-300 shadow-[0_0_8px_rgba(47,101,246,0.25)]"
                        style={{ width: `${actualWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-[#7E8B9B]">
            No planned or saved work hours recorded for the selected period.
          </p>
        )}
      </section>

      {/* Task Planned vs Actual Breakdown Table */}
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="border-b border-[#F0F3F9] px-6 py-4">
          <h2 className="text-base font-bold text-[#1A1F2C]">Task Planned vs. Actual</h2>
          <p className="mt-0.5 text-xs text-[#7E8B9B]">
            Tasks without a planned estimate display &ldquo;No estimate&rdquo; rather than a fabricated
            variance.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E9ECF5] bg-[#F8FAFD] text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
                <th className="px-6 py-3.5">Task</th>
                <th className="px-4 py-3.5">Project</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Planned</th>
                <th className="px-4 py-3.5 text-right">Saved Actual</th>
                <th className="px-6 py-3.5 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {scopedTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const taskSaved = scopedEntries
                  .filter((e) => e.taskId === task.id)
                  .reduce((sum, e) => sum + e.durationSeconds, 0);
                const variance = calculateTimeVariance(task.plannedDurationMinutes, taskSaved);

                return (
                  <tr key={task.id} className="hover:bg-[#F8FAFD]/70 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-[#1A1F2C]">
                      <Link to={`/tasks/${task.id}`} className="hover:text-[#2F65F6] transition-colors">
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      {project ? (
                        <ProjectLabel name={project.name} color={project.color} />
                      ) : (
                        <span className="text-xs text-[#9AA6B8]">No project</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs font-medium text-[#7E8B9B] tabular-nums-strict">
                      {task.plannedDurationMinutes
                        ? formatDuration(task.plannedDurationMinutes * 60)
                        : 'No estimate'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs font-semibold text-[#1A1F2C] tabular-nums-strict">
                      {formatDuration(taskSaved)}
                    </td>
                    <td className="px-6 py-3.5 text-right tabular-nums-strict">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          variance.status === 'over_plan'
                            ? 'bg-[#FEECEE] text-[#E03137]'
                            : variance.status === 'under_plan' || variance.status === 'on_target'
                              ? 'bg-[#E8F5EF] text-[#16845B]'
                              : 'text-[#7E8B9B]'
                        }`}
                      >
                        {variance.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {scopedTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#7E8B9B]">
                    No tasks found for this period and filter combination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Export Modal (Honest Milestone 5 Scope Disclosure) */}
      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Report"
        description="Structured Excel (.xlsx) and CSV (.csv) exports will generate multi-sheet workbooks in Milestone 5."
        footer={
          <Button variant="primary" onClick={() => setExportModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-[#16845B]" />
            <div>
              <div className="font-semibold text-[#1A1F2C]">Planned Export Formats (Milestone 5)</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[#7E8B9B]">
                <li>Excel Workbook (.xlsx): Summary, Tasks, Time Entries, and Project Breakdown sheets</li>
                <li>CSV (.csv): UTF-8 flat export for spreadsheet or accounting imports</li>
                <li>Active date range: {dateRange.start} to {dateRange.end}</li>
              </ul>
            </div>
          </div>
          <FieldWrapper id="export-note" label="Milestone 0 Status">
            <p className="text-xs text-[#7E8B9B] leading-relaxed">
              Export file generation is not yet active in Milestone 0. It will be implemented on top
              of verified Supabase records in Milestone 5.
            </p>
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
