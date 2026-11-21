import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Info,
  ListChecks,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  buildReportWorkbook,
  calculateDailyAggregations,
  calculateProjectReportRows,
  calculateReportSummary,
  calculateTaskReportRows,
  downloadCSVFile,
  downloadWorkbookFile,
  formatReportRangeLabel,
  generateReportCSV,
  getReportDateRange,
  shiftAnchorDate,
  type DayAggregation,
  type ProjectReportRow,
  type ReportSummaryMetrics,
  type TaskReportRow,
} from '../../services/reportService';
import { formatDuration, getLocalDateISO } from '../../lib/timeMath';
import type { ReportPeriod, TaskPriority, TaskStatus } from '../../types/models';
import { PriorityBadge, ProjectLabel, StatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { MetricCard } from '../../components/ui/MetricCard';
import { Modal } from '../../components/ui/Modal';

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateISO(d);
}

type SortField = 'actual' | 'planned' | 'variance' | 'title' | 'status';
type SortDirection = 'asc' | 'desc';

export function ReportsPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeTimer,
    activeTask,
    activeElapsedSeconds,
  } = useWorkspace();

  // Period and navigation state
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [customStart, setCustomStart] = useState(() => shiftDays(-6));
  const [customEnd, setCustomEnd] = useState(() => getLocalDateISO());

  // Filters & sorting
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('actual');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // UI interaction state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Computed date range based on period and anchor
  const dateRange = useMemo(
    () => getReportDateRange(period, anchorDate, customStart, customEnd),
    [period, anchorDate, customStart, customEnd]
  );

  // Formatted date range label for UI
  const rangeLabel = useMemo(
    () => formatReportRangeLabel(period, dateRange),
    [period, dateRange]
  );

  // Daily aggregations with midnight-splitting
  const dailyAggregations: DayAggregation[] = useMemo(
    () => calculateDailyAggregations(timeEntries, dateRange),
    [timeEntries, dateRange]
  );

  // Raw task rows
  const rawTaskRows: TaskReportRow[] = useMemo(
    () => calculateTaskReportRows(tasks, projects, timeEntries, dateRange, projectFilter),
    [tasks, projects, timeEntries, dateRange, projectFilter]
  );

  // Filtered & sorted task rows
  const taskRows: TaskReportRow[] = useMemo(() => {
    let rows =
      statusFilter === 'all'
        ? rawTaskRows
        : rawTaskRows.filter((r) => r.status === statusFilter);

    return rows.sort((a, b) => {
      let diff = 0;
      if (sortField === 'actual') {
        diff = a.actualSeconds - b.actualSeconds;
      } else if (sortField === 'planned') {
        diff = (a.plannedSeconds ?? 0) - (b.plannedSeconds ?? 0);
      } else if (sortField === 'variance') {
        diff = (a.deltaSeconds ?? 0) - (b.deltaSeconds ?? 0);
      } else if (sortField === 'title') {
        diff = a.taskTitle.localeCompare(b.taskTitle);
      } else if (sortField === 'status') {
        diff = a.status.localeCompare(b.status);
      }
      return sortDirection === 'desc' ? -diff : diff;
    });
  }, [rawTaskRows, statusFilter, sortField, sortDirection]);

  // Project breakdown rows
  const projectRows: ProjectReportRow[] = useMemo(
    () => calculateProjectReportRows(projects, rawTaskRows, timeEntries, dateRange, projectFilter),
    [projects, rawTaskRows, timeEntries, dateRange, projectFilter]
  );

  // Executive summary metrics
  const summary: ReportSummaryMetrics = useMemo(
    () => calculateReportSummary(timeEntries, rawTaskRows, dateRange, dailyAggregations),
    [timeEntries, rawTaskRows, dateRange, dailyAggregations]
  );

  // Check if current anchor is today / current week
  const isCurrentPeriod = useMemo(() => {
    const today = getLocalDateISO();
    if (period === 'daily') return dateRange.start === today;
    if (period === 'weekly' || period === 'monthly') {
      return today >= dateRange.start && today <= dateRange.end;
    }
    return false;
  }, [period, dateRange]);

  // Handlers for period navigation
  const handlePrevPeriod = () => {
    setAnchorDate((prev) => shiftAnchorDate(prev, period, 'prev'));
  };

  const handleNextPeriod = () => {
    setAnchorDate((prev) => shiftAnchorDate(prev, period, 'next'));
  };

  const handleResetPeriod = () => {
    setAnchorDate(new Date());
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    try {
      const csv = generateReportCSV(timeEntries, tasks, projects, dateRange);
      const filename = `my-work-planner-report-${dateRange.start}-to-${dateRange.end}.csv`;
      downloadCSVFile(csv, filename);
      setExportFeedback('CSV report downloaded successfully.');
      setTimeout(() => setExportFeedback(null), 3500);
      setExportModalOpen(false);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  const handleExportXLSX = () => {
    try {
      const wb = buildReportWorkbook(
        summary,
        dailyAggregations,
        rawTaskRows,
        projectRows,
        timeEntries,
        tasks,
        projects,
        period,
        dateRange
      );
      const filename = `my-work-planner-report-${dateRange.start}-to-${dateRange.end}.xlsx`;
      downloadWorkbookFile(wb, filename);
      setExportFeedback('Excel (.xlsx) workbook downloaded successfully.');
      setTimeout(() => setExportFeedback(null), 3500);
      setExportModalOpen(false);
    } catch (err) {
      console.error('Failed to export Excel workbook:', err);
    }
  };

  // Bar chart calculations
  const maxDailySeconds = useMemo(
    () => Math.max(1, ...dailyAggregations.map((d) => d.seconds)),
    [dailyAggregations]
  );
  const totalChartSessions = useMemo(
    () => dailyAggregations.reduce((sum, d) => sum + d.sessionCount, 0),
    [dailyAggregations]
  );

  const periods: { key: ReportPeriod; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Toast Notification for Export */}
      {exportFeedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-[#16845B]/20 bg-[#E8F5EF] px-5 py-3 text-sm font-semibold text-[#16845B] shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{exportFeedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">
            Reports &amp; Analytics
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            Precision time tracking metrics, planned vs. actual variance, and exportable reports.
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

      {/* Period Selector & Navigation Controls */}
      <div className="rounded-[28px] border border-white/80 bg-white/80 p-4 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Period Tabs */}
          <div
            className="inline-flex flex-wrap rounded-full border border-[#E9ECF5] bg-[#F4F7FD] p-1 self-start"
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

          {/* Period Navigation (< Range > Today) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {period !== 'custom' && (
              <div className="flex items-center gap-1 rounded-full border border-[#E9ECF5] bg-white p-1 shadow-xs">
                <button
                  type="button"
                  aria-label="Previous period"
                  onClick={handlePrevPeriod}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F4F7FD] hover:text-[#1A1F2C] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-[#1A1F2C]">
                  <Calendar className="h-3.5 w-3.5 text-[#2F65F6]" />
                  <span>{rangeLabel}</span>
                </div>
                <button
                  type="button"
                  aria-label="Next period"
                  onClick={handleNextPeriod}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F4F7FD] hover:text-[#1A1F2C] transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {period !== 'custom' && !isCurrentPeriod && (
              <button
                type="button"
                onClick={handleResetPeriod}
                className="flex items-center gap-1.5 rounded-full border border-[#E9ECF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#7E8B9B] hover:bg-[#F4F7FD] hover:text-[#1A1F2C] shadow-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Today</span>
              </button>
            )}

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

            {/* Filter Dropdowns */}
            <Select
              aria-label="Filter report by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-9.5 w-auto min-w-[140px] text-xs font-semibold rounded-xl"
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

            <Select
              aria-label="Filter report by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9.5 w-auto min-w-[130px] text-xs font-semibold rounded-xl"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="todo">To Do</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Active Running Session Notice */}
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

      {/* 5 Executive KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Total Tracked"
          value={summary.formattedTotalTracked}
          subtext={`${dateRange.start} to ${dateRange.end}`}
          accentValue
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Planned Time"
          value={summary.formattedTotalPlanned}
          subtext="Estimated for period"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-5 sm:p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] transition-all hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
              Time Variance
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4F7FD] text-[#2F65F6] shrink-0">
              {summary.varianceStatus === 'over_plan' ? (
                <TrendingUp className="h-4 w-4 text-[#C2414B]" />
              ) : summary.varianceStatus === 'under_plan' ? (
                <TrendingDown className="h-4 w-4 text-[#16845B]" />
              ) : (
                <Clock className="h-4 w-4 text-[#7E8B9B]" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums-strict ${
                summary.varianceStatus === 'over_plan'
                  ? 'bg-[#FCE8E9] text-[#C2414B]'
                  : summary.varianceStatus === 'under_plan' || summary.varianceStatus === 'on_target'
                    ? 'bg-[#E8F5EF] text-[#16845B]'
                    : 'bg-[#F0F2F5] text-[#7E8B9B]'
              }`}
            >
              {summary.varianceLabel}
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-[#7E8B9B]">
            {summary.varianceStatus === 'over_plan'
              ? 'Exceeded estimated duration'
              : summary.varianceStatus === 'under_plan'
                ? 'Under estimated duration'
                : summary.varianceStatus === 'on_target'
                  ? 'Exactly on target'
                  : 'Tasks have no estimates'}
          </p>
        </div>
        <MetricCard
          label="Tasks Completed"
          value={`${summary.completedTasksCount} / ${summary.totalTasksWorkedCount}`}
          subtext="Active in period"
          progressPercent={
            summary.totalTasksWorkedCount > 0
              ? Math.round((summary.completedTasksCount / summary.totalTasksWorkedCount) * 100)
              : 0
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Daily Average"
          value={summary.formattedAverageDaily}
          subtext="Tracked / calendar day"
          icon={<ListChecks className="h-4 w-4" />}
        />
      </div>

      {/* Visual Analytics: Activity Bar Chart */}
      <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1A1F2C]">Work Session Activity</h2>
            <p className="text-xs text-[#7E8B9B]">
              Daily distribution of saved work hours ({totalChartSessions} session{totalChartSessions === 1 ? '' : 's'} recorded)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-[#7E8B9B]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2F65F6]" />
              Tracked Hours
            </span>
          </div>
        </div>

        {/* Bar Chart Canvas */}
        <div className="mt-6">
          <div className="flex h-52 items-end gap-2 sm:gap-3 rounded-2xl border border-[#F0F3F9] bg-[#F8FAFD]/60 p-4 pt-8">
            {dailyAggregations.map((d, index) => {
              const heightPercent =
                d.seconds > 0
                  ? Math.max(8, Math.round((d.seconds / maxDailySeconds) * 100))
                  : 0;
              const isHovered = hoveredBarIndex === index;

              return (
                <div
                  key={d.date}
                  className="group relative flex flex-1 flex-col items-center h-full justify-end"
                  onMouseEnter={() => setHoveredBarIndex(index)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-14 z-20 flex flex-col items-center rounded-xl bg-[#1A1F2C] px-3 py-1.5 text-center text-white shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in duration-150">
                      <span className="text-[10px] font-semibold text-[#9AA6B8]">
                        {d.dayName}, {d.date}
                      </span>
                      <span className="text-xs font-bold text-white tabular-nums-strict">
                        {d.formatted} ({d.sessionCount} session{d.sessionCount === 1 ? '' : 's'})
                      </span>
                      <div className="absolute -bottom-1 h-2 w-2 rotate-45 bg-[#1A1F2C]" />
                    </div>
                  )}

                  {/* Bar */}
                  <div className="w-full max-w-[40px] flex items-end justify-center h-full">
                    {heightPercent > 0 ? (
                      <div
                        className="w-full rounded-t-lg bg-[#2F65F6] transition-all duration-300 group-hover:bg-[#2554DB] group-hover:shadow-[0_0_12px_rgba(47,101,246,0.35)]"
                        style={{ height: `${heightPercent}%` }}
                      />
                    ) : (
                      <div className="h-1 w-full rounded-full bg-[#E9ECF5]" />
                    )}
                  </div>

                  {/* X-Axis Label */}
                  <div className="mt-2 text-center">
                    <span className="block text-[11px] font-semibold text-[#7E8B9B]">
                      {d.dayName}
                    </span>
                    <span className="block text-[10px] text-[#9AA6B8] tabular-nums-strict">
                      {d.date.slice(8)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Planned vs Actual by Project */}
      <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1A1F2C]">
              Project Time Distribution
            </h2>
            <p className="text-xs text-[#7E8B9B]">
              Share of total tracked time and completed tasks by project in {rangeLabel}.
            </p>
          </div>
        </div>

        {projectRows.length > 0 ? (
          <div className="mt-6 space-y-5">
            {projectRows.map((proj) => (
              <div key={proj.projectId || 'no-proj'} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <ProjectLabel name={proj.projectName} color={proj.projectColor} />
                    {proj.clientName && (
                      <span className="text-[#7E8B9B] font-medium hidden sm:inline">
                        — {proj.clientName}
                      </span>
                    )}
                    <span className="text-[#9AA6B8] tabular-nums-strict font-semibold">
                      ({proj.taskCount} task{proj.taskCount === 1 ? '' : 's'}, {proj.completedTaskCount} completed)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums-strict">
                    <span className="text-[#1A1F2C] font-semibold">
                      {proj.formattedActual}
                    </span>
                    <span className="rounded-full bg-[#F4F7FD] px-2 py-0.5 text-[11px] font-bold text-[#2F65F6]">
                      {proj.percentOfTotal}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#F4F7FD]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(2, proj.percentOfTotal)}%`,
                      backgroundColor: proj.projectColor || '#2F65F6',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-[#7E8B9B]">
            No project hours recorded for the selected period.
          </p>
        )}
      </section>

      {/* Task Planned vs Actual Breakdown Table */}
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 border-b border-[#F0F3F9] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1A1F2C]">Task Planned vs. Actual</h2>
            <p className="mt-0.5 text-xs text-[#7E8B9B]">
              Detailed task time tracking with variance indicators. Tasks without estimates show &ldquo;No estimate&rdquo;.
            </p>
          </div>
          <div className="text-xs font-semibold text-[#7E8B9B]">
            Showing {taskRows.length} task{taskRows.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E9ECF5] bg-[#F8FAFD] text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
                <th
                  className="px-6 py-3.5 cursor-pointer hover:text-[#1A1F2C] transition-colors"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Task</span>
                    {sortField === 'title' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3.5">Project</th>
                <th className="px-4 py-3.5">Priority</th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-[#1A1F2C] transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-[#1A1F2C] transition-colors"
                  onClick={() => handleSort('planned')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Planned</span>
                    {sortField === 'planned' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-[#1A1F2C] transition-colors"
                  onClick={() => handleSort('actual')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Actual</span>
                    {sortField === 'actual' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3.5 text-right cursor-pointer hover:text-[#1A1F2C] transition-colors"
                  onClick={() => handleSort('variance')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Variance</span>
                    {sortField === 'variance' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {taskRows.map((task) => (
                <tr key={task.taskId} className="hover:bg-[#F8FAFD]/70 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-[#1A1F2C]">
                    <Link
                      to={`/tasks/${task.taskId}`}
                      className="hover:text-[#2F65F6] transition-colors"
                    >
                      {task.taskTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    {task.projectId ? (
                      <ProjectLabel name={task.projectName} color={task.projectColor} />
                    ) : (
                      <span className="text-xs text-[#9AA6B8]">No project</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-medium text-[#7E8B9B] tabular-nums-strict">
                    {task.plannedSeconds ? formatDuration(task.plannedSeconds) : 'No estimate'}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-semibold text-[#1A1F2C] tabular-nums-strict">
                    {formatDuration(task.actualSeconds)}
                  </td>
                  <td className="px-6 py-3.5 text-right tabular-nums-strict">
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        task.varianceStatus === 'over_plan'
                          ? 'bg-[#FCE8E9] text-[#C2414B]'
                          : task.varianceStatus === 'under_plan' || task.varianceStatus === 'on_target'
                            ? 'bg-[#E8F5EF] text-[#16845B]'
                            : 'bg-[#F0F2F5] text-[#7E8B9B]'
                      }`}
                    >
                      {task.varianceLabel}
                    </span>
                  </td>
                </tr>
              ))}
              {taskRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#7E8B9B]">
                    No tasks found for this period and filter combination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Export Modal */}
      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Reports"
        description={`Download structured report data for period ${dateRange.start} to ${dateRange.end}.`}
        footer={
          <Button variant="secondary" onClick={() => setExportModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Excel Option */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 transition-all hover:border-[#16845B]/30">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F5EF] text-[#16845B]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-[#1A1F2C]">Excel Workbook (.xlsx)</div>
                <p className="mt-0.5 text-xs text-[#7E8B9B] leading-relaxed">
                  5-sheet workbook: Executive Summary, Daily Breakdown, Task Breakdown, Project Breakdown, and Work Sessions.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportXLSX}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#16845B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#126b4a] transition-colors shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Excel</span>
            </button>
          </div>

          {/* CSV Option */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 transition-all hover:border-[#2F65F6]/30">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF2FE] text-[#2F65F6]">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-[#1A1F2C]">CSV Flat File (.csv)</div>
                <p className="mt-0.5 text-xs text-[#7E8B9B] leading-relaxed">
                  RFC 4180 standard CSV with proper escaping for accounting software, spreadsheets, and data pipelines.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2F65F6] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2554DB] transition-colors shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
