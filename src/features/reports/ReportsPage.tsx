import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
            Workspace / Analytics &amp; Exports
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202531]">Reports</h1>
          <p className="mt-1 text-sm text-[#667085]">
            Compare saved tracked work time against planned task durations across projects and dates.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => setExportModalOpen(true)}>
          <Download className="h-4 w-4" />
          <span>Export Report</span>
        </Button>
      </div>

      {/* Period Selector & Project Filter */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E4E7EC] bg-white p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div
          className="inline-flex flex-wrap rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-1"
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
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                period === p.key
                  ? 'bg-white text-[#4968D6] shadow-[0_1px_2px_rgba(16,24,40,0.06)]'
                  : 'text-[#667085] hover:text-[#202531]'
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
                className="h-9 w-auto text-xs"
              />
              <span className="text-xs text-[#667085]">to</span>
              <Input
                type="date"
                aria-label="Custom end date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 w-auto text-xs"
              />
            </div>
          )}

          <Select
            aria-label="Filter report by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 w-auto min-w-[150px] text-xs"
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
        <div className="flex items-start gap-2.5 rounded-xl border border-[#4968D6]/30 bg-[#EDF1FF]/60 px-4 py-3 text-xs text-[#202531]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4968D6]" />
          <div className="tabular-nums-strict">
            <strong className="font-semibold">Active session excluded from saved totals:</strong>{' '}
            &ldquo;{activeTask.title}&rdquo; currently has{' '}
            <strong className="font-semibold text-[#4968D6]">
              {formatDuration(activeElapsedSeconds, true)}
            </strong>{' '}
            in progress. Stop and save the timer to include it in finalized report totals.
          </div>
        </div>
      )}

      {/* 4 PRD-Compliant Core Report KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#202531]">
              Planned vs. Saved Actual by Project
            </h2>
            <p className="text-xs text-[#667085]">
              Shows only saved completed entries within {dateRange.start} – {dateRange.end}.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#667085]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#D0D5DD]" />
              Planned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#4968D6]" />
              Saved Actual
            </span>
          </div>
        </div>

        {projectSummary.rows.length > 0 ? (
          <div className="mt-5 space-y-4">
            {projectSummary.rows.map(({ project, taskCount, plannedSec, actualSec }) => {
              const plannedWidth = Math.round((plannedSec / projectSummary.maxSec) * 100);
              const actualWidth = Math.round((actualSec / projectSummary.maxSec) * 100);
              return (
                <div key={project.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <ProjectLabel name={project.name} color={project.color} />
                      <span className="text-[#98A2B3] tabular-nums-strict">
                        ({taskCount} task{taskCount === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums-strict">
                      <span className="text-[#667085]">
                        Planned: <strong className="text-[#202531]">{formatDuration(plannedSec)}</strong>
                      </span>
                      <span className="text-[#667085]">
                        Actual: <strong className="text-[#4968D6]">{formatDuration(actualSec)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
                      <div
                        className="h-full rounded-full bg-[#D0D5DD]"
                        style={{ width: `${plannedWidth}%` }}
                      />
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
                      <div
                        className="h-full rounded-full bg-[#4968D6]"
                        style={{ width: `${actualWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#667085]">
            No planned or saved work hours recorded for the selected period.
          </p>
        )}
      </section>

      {/* Task Planned vs Actual Breakdown Table */}
      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-[#E4E7EC] px-5 py-4">
          <h2 className="text-base font-semibold text-[#202531]">Task Planned vs. Actual</h2>
          <p className="text-xs text-[#667085]">
            Tasks without a planned estimate display &ldquo;No estimate&rdquo; rather than a fabricated
            variance.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F6F7F9] text-xs font-medium uppercase tracking-wider text-[#667085]">
                <th className="px-5 py-3">Task</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Planned</th>
                <th className="px-4 py-3 text-right">Saved Actual</th>
                <th className="px-5 py-3 text-right">Variance</th>
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
                  <tr key={task.id} className="hover:bg-[#F6F7F9]/60">
                    <td className="px-5 py-3 font-medium text-[#202531]">
                      <Link to={`/tasks/${task.id}`} className="hover:text-[#4968D6]">
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {project ? (
                        <ProjectLabel name={project.name} color={project.color} />
                      ) : (
                        <span className="text-xs text-[#98A2B3]">No project</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-[#667085] tabular-nums-strict">
                      {task.plannedDurationMinutes
                        ? formatDuration(task.plannedDurationMinutes * 60)
                        : 'No estimate'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-[#202531] tabular-nums-strict">
                      {formatDuration(taskSaved)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right text-xs font-medium tabular-nums-strict ${
                        variance.status === 'over_plan'
                          ? 'text-[#C2414B]'
                          : variance.status === 'under_plan' || variance.status === 'on_target'
                            ? 'text-[#16845B]'
                            : 'text-[#667085]'
                      }`}
                    >
                      {variance.label}
                    </td>
                  </tr>
                );
              })}
              {scopedTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#667085]">
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
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3.5">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-[#16845B]" />
            <div>
              <div className="font-medium text-[#202531]">Planned Export Formats (Milestone 5)</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#667085]">
                <li>Excel Workbook (.xlsx): Summary, Tasks, Time Entries, and Project Breakdown sheets</li>
                <li>CSV (.csv): UTF-8 flat export for spreadsheet or accounting imports</li>
                <li>Active date range: {dateRange.start} to {dateRange.end}</li>
              </ul>
            </div>
          </div>
          <FieldWrapper id="export-note" label="Milestone 0 Status">
            <p className="text-xs text-[#667085]">
              Export file generation is not yet active in Milestone 0. It will be implemented on top
              of verified Supabase records in Milestone 5.
            </p>
          </FieldWrapper>
        </div>
      </Modal>
    </div>
  );
}
