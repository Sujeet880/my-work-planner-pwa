import * as XLSX from 'xlsx';
import type {
  ActiveTimerState,
  Project,
  ReportPeriod,
  Task,
  TimeEntry,
} from '../types/models';
import {
  calculateTimeVariance,
  formatDuration,
  getLocalDateISO,
} from '../lib/timeMath';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface DayAggregation {
  date: string;         // YYYY-MM-DD
  dayName: string;      // Mon, Tue, etc.
  seconds: number;      // Total seconds tracked on this day
  formatted: string;    // e.g. 2h 15m
  sessionCount: number; // Number of sessions contributing to this day
}

export interface TaskReportRow {
  taskId: string;
  taskTitle: string;
  projectId: string | null;
  projectName: string;
  projectColor: string;
  status: Task['status'];
  priority: Task['priority'];
  plannedMinutes: number | null;
  plannedSeconds: number | null;
  actualSeconds: number;
  deltaSeconds: number | null;
  varianceStatus: 'no_estimate' | 'under_plan' | 'on_target' | 'over_plan';
  varianceLabel: string;
  sessionCount: number;
}

export interface ProjectReportRow {
  projectId: string | null;
  projectName: string;
  clientName: string;
  projectColor: string;
  actualSeconds: number;
  formattedActual: string;
  taskCount: number;
  completedTaskCount: number;
  percentOfTotal: number;
}

export interface ReportSummaryMetrics {
  totalTrackedSeconds: number;
  formattedTotalTracked: string;
  completedTasksCount: number;
  totalTasksWorkedCount: number;
  totalPlannedSeconds: number;
  formattedTotalPlanned: string;
  varianceDeltaSeconds: number | null;
  varianceStatus: 'no_estimate' | 'under_plan' | 'on_target' | 'over_plan';
  varianceLabel: string;
  averageDailySeconds: number;
  formattedAverageDaily: string;
}

/**
 * Calculates start and end dates (YYYY-MM-DD) for a given period and anchor date.
 * Weeks start strictly on Monday (ISO 8601).
 */
export function getReportDateRange(
  period: ReportPeriod,
  anchorDate: Date = new Date(),
  customStart?: string,
  customEnd?: string
): DateRange {
  if (period === 'custom') {
    const start = customStart || getLocalDateISO(anchorDate);
    const end = customEnd || start;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const date = anchorDate.getDate();

  if (period === 'daily') {
    const iso = getLocalDateISO(anchorDate);
    return { start: iso, end: iso };
  }

  if (period === 'weekly') {
    // ISO week: Monday is 1, Sunday is 7 (in JS getDay(): Sunday is 0)
    const dayOfWeek = anchorDate.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(year, month, date - distanceToMonday);
    const sunday = new Date(year, month, date - distanceToMonday + 6);
    return {
      start: getLocalDateISO(monday),
      end: getLocalDateISO(sunday),
    };
  }

  if (period === 'monthly') {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: getLocalDateISO(firstDay),
      end: getLocalDateISO(lastDay),
    };
  }

  const today = getLocalDateISO(anchorDate);
  return { start: today, end: today };
}

/**
 * Shifts anchor date by one step (prev/next) for the selected period.
 */
export function shiftAnchorDate(
  anchorDate: Date,
  period: ReportPeriod,
  direction: 'prev' | 'next'
): Date {
  const delta = direction === 'next' ? 1 : -1;
  const newDate = new Date(anchorDate);

  if (period === 'daily') {
    newDate.setDate(newDate.getDate() + delta);
    return newDate;
  }

  if (period === 'weekly') {
    newDate.setDate(newDate.getDate() + delta * 7);
    return newDate;
  }

  if (period === 'monthly') {
    newDate.setMonth(newDate.getMonth() + delta);
    return newDate;
  }

  return newDate;
}

/**
 * Returns formatted human-readable label for a report range.
 * e.g. "Monday, Nov 16, 2026" or "Nov 16 – Nov 22, 2026" or "November 2026".
 */
export function formatReportRangeLabel(
  period: ReportPeriod,
  dateRange: DateRange
): string {
  if (period === 'daily') {
    const [y, m, d] = dateRange.start.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (period === 'monthly' && dateRange.start.slice(0, 7) === dateRange.end.slice(0, 7)) {
    const [y, m] = dateRange.start.split('-').map(Number);
    const dt = new Date(y, m - 1, 1);
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const [sy, sm, sd] = dateRange.start.split('-').map(Number);
  const [ey, em, ed] = dateRange.end.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sy !== ey ? 'numeric' : undefined,
  });
  return `${startStr} – ${endStr}, ${endDate.getFullYear()}`;
}

/**
 * Returns a YYYY-MM-DD date string formatted according to the user's configured timezone.
 */
export function getDateISOInTimezone(
  date: Date = new Date(),
  timezone: string = 'Asia/Kolkata'
): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return getLocalDateISO(date);
  }
}

/**
 * Finds the exact midnight timestamp (in ms) when the calendar date advances in a given timezone.
 */
export function findNextMidnightInTimezone(
  currentStartMs: number,
  endUtcMs: number,
  timezone: string
): number {
  const currentDay = getDateISOInTimezone(new Date(currentStartMs), timezone);
  const endDay = getDateISOInTimezone(new Date(endUtcMs), timezone);
  if (currentDay === endDay) return endUtcMs;

  let low = currentStartMs;
  let high = endUtcMs;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (getDateISOInTimezone(new Date(mid), timezone) === currentDay) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.round(high / 1000) * 1000;
}

/**
 * Splits a work session that spans across midnight into daily slices (in seconds)
 * attributed to each local calendar day.
 */
export function splitSessionByDay(
  entry: TimeEntry,
  dateRange: DateRange,
  timezone?: string
): { date: string; seconds: number }[] {
  if (!entry.startedAt) {
    const sessionDate = entry.startedAt?.slice(0, 10) || dateRange.start;
    return [{ date: sessionDate, seconds: entry.durationSeconds }];
  }

  const startUtc = new Date(entry.startedAt).getTime();
  const endUtc = entry.endedAt
    ? new Date(entry.endedAt).getTime()
    : startUtc + entry.durationSeconds * 1000;

  if (isNaN(startUtc) || isNaN(endUtc) || endUtc <= startUtc) {
    const sessionDate = timezone
      ? getDateISOInTimezone(new Date(startUtc || Date.now()), timezone)
      : entry.startedAt.slice(0, 10);
    return [{ date: sessionDate, seconds: Math.max(0, entry.durationSeconds) }];
  }

  const slices: { date: string; seconds: number }[] = [];
  let currentStart = startUtc;

  while (currentStart < endUtc) {
    const startDateObj = new Date(currentStart);
    const dayIso = timezone
      ? getDateISOInTimezone(startDateObj, timezone)
      : getLocalDateISO(startDateObj);

    let nextMidnight: number;
    if (timezone) {
      nextMidnight = findNextMidnightInTimezone(currentStart, endUtc, timezone);
    } else {
      // Midnight of the next day in system local time
      nextMidnight = new Date(
        startDateObj.getFullYear(),
        startDateObj.getMonth(),
        startDateObj.getDate() + 1,
        0, 0, 0, 0
      ).getTime();
    }

    const segmentEnd = Math.min(endUtc, nextMidnight);
    const durationSec = Math.max(0, Math.round((segmentEnd - currentStart) / 1000));

    if (durationSec > 0) {
      slices.push({ date: dayIso, seconds: durationSec });
    }

    // Guard against infinite loop if segmentEnd equals currentStart
    if (segmentEnd <= currentStart) {
      currentStart += 1000;
    } else {
      currentStart = segmentEnd;
    }
  }

  // If no slices were created due to rounding, attribute entire duration to start date
  if (slices.length === 0) {
    const sessionDate = timezone
      ? getDateISOInTimezone(new Date(startUtc), timezone)
      : entry.startedAt.slice(0, 10);
    slices.push({ date: sessionDate, seconds: entry.durationSeconds });
  }

  return slices;
}

/**
 * Generates continuous array of DayAggregation items for every calendar day in dateRange.
 */
export function calculateDailyAggregations(
  entries: TimeEntry[],
  dateRange: DateRange,
  timezone?: string
): DayAggregation[] {
  const [sy, sm, sd] = dateRange.start.split('-').map(Number);
  const [ey, em, ed] = dateRange.end.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  // Initialize day map
  const daysMap = new Map<string, { seconds: number; count: number; dayName: string }>();
  const curr = new Date(startDate);

  while (curr <= endDate) {
    const iso = getLocalDateISO(curr);
    const dayName = curr.toLocaleDateString('en-US', { weekday: 'short' });
    daysMap.set(iso, { seconds: 0, count: 0, dayName });
    curr.setDate(curr.getDate() + 1);
  }

  // Aggregate sessions
  for (const entry of entries) {
    if (entry.status !== 'completed') continue;

    const slices = splitSessionByDay(entry, dateRange, timezone);
    for (const slice of slices) {
      if (daysMap.has(slice.date)) {
        const item = daysMap.get(slice.date)!;
        item.seconds += slice.seconds;
        item.count += 1;
      }
    }
  }

  return Array.from(daysMap.entries()).map(([date, val]) => ({
    date,
    dayName: val.dayName,
    seconds: val.seconds,
    formatted: formatDuration(val.seconds),
    sessionCount: val.count,
  }));
}

/**
 * Aggregates task-level report rows within dateRange.
 */
export function calculateTaskReportRows(
  tasks: Task[],
  projects: Project[],
  entries: TimeEntry[],
  dateRange: DateRange,
  projectFilter: string = 'all'
): TaskReportRow[] {
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Sum actual seconds per task strictly within dateRange using splitSessionByDay
  const taskActualMap = new Map<string, { seconds: number; count: number }>();
  for (const entry of entries) {
    if (entry.status !== 'completed' || !entry.taskId) continue;
    if (projectFilter !== 'all' && entry.projectId !== projectFilter) continue;

    const slices = splitSessionByDay(entry, dateRange);
    let taskEntrySeconds = 0;
    for (const slice of slices) {
      if (slice.date >= dateRange.start && slice.date <= dateRange.end) {
        taskEntrySeconds += slice.seconds;
      }
    }

    if (taskEntrySeconds > 0) {
      const prev = taskActualMap.get(entry.taskId) || { seconds: 0, count: 0 };
      prev.seconds += taskEntrySeconds;
      prev.count += 1;
      taskActualMap.set(entry.taskId, prev);
    }
  }

  // Determine tasks to include:
  // 1. Tasks scheduled within the dateRange, OR
  // 2. Tasks that have recorded sessions in the dateRange
  const rows: TaskReportRow[] = [];

  for (const task of tasks) {
    if (task.isArchived) continue;
    if (projectFilter !== 'all' && task.projectId !== projectFilter) continue;

    const inDateRange =
      task.scheduledDate !== null &&
      task.scheduledDate >= dateRange.start &&
      task.scheduledDate <= dateRange.end;

    const actualData = taskActualMap.get(task.id);
    const hasWorkInPeriod = (actualData?.seconds ?? 0) > 0;

    if (!inDateRange && !hasWorkInPeriod) {
      continue;
    }

    const actualSeconds = actualData?.seconds ?? 0;
    const sessionCount = actualData?.count ?? 0;
    const plannedMinutes = inDateRange ? task.plannedDurationMinutes : null;
    const plannedSeconds = plannedMinutes ? plannedMinutes * 60 : null;

    const variance = calculateTimeVariance(plannedMinutes, actualSeconds);
    const project = task.projectId ? projectMap.get(task.projectId) : undefined;

    rows.push({
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      projectName: project ? project.name : 'No Project',
      projectColor: project ? project.color : '#9AA6B8',
      status: task.status,
      priority: task.priority,
      plannedMinutes,
      plannedSeconds,
      actualSeconds,
      deltaSeconds: variance.deltaSeconds,
      varianceStatus: variance.status,
      varianceLabel: variance.label,
      sessionCount,
    });
  }

  // Sort descending by actual time, then status
  return rows.sort((a, b) => b.actualSeconds - a.actualSeconds || a.taskTitle.localeCompare(b.taskTitle));
}

/**
 * Aggregates project-level report rows within dateRange.
 */
export function calculateProjectReportRows(
  projects: Project[],
  taskRows: TaskReportRow[],
  entries: TimeEntry[],
  dateRange: DateRange,
  projectFilter: string = 'all'
): ProjectReportRow[] {
  const rows: ProjectReportRow[] = [];
  let totalPeriodSeconds = 0;

  // Filter relevant projects
  const activeProjects = projects.filter(
    (p) => !p.isArchived && (projectFilter === 'all' || p.id === projectFilter)
  );

  for (const proj of activeProjects) {
    const projTasks = taskRows.filter((t) => t.projectId === proj.id);
    const actualSeconds = projTasks.reduce((acc, t) => acc + t.actualSeconds, 0);
    const completedTaskCount = projTasks.filter((t) => t.status === 'completed').length;

    if (actualSeconds > 0 || projTasks.length > 0) {
      totalPeriodSeconds += actualSeconds;
      rows.push({
        projectId: proj.id,
        projectName: proj.name,
        clientName: proj.description || '',
        projectColor: proj.color,
        actualSeconds,
        formattedActual: formatDuration(actualSeconds),
        taskCount: projTasks.length,
        completedTaskCount,
        percentOfTotal: 0, // Calculated below
      });
    }
  }

  // Handle "No Project" tasks if any
  const noProjTasks = taskRows.filter((t) => !t.projectId);
  const noProjActual = noProjTasks.reduce((acc, t) => acc + t.actualSeconds, 0);
  if (noProjActual > 0 || noProjTasks.length > 0) {
    totalPeriodSeconds += noProjActual;
    rows.push({
      projectId: null,
      projectName: 'No Project',
      clientName: 'Personal Workspace',
      projectColor: '#9AA6B8',
      actualSeconds: noProjActual,
      formattedActual: formatDuration(noProjActual),
      taskCount: noProjTasks.length,
      completedTaskCount: noProjTasks.filter((t) => t.status === 'completed').length,
      percentOfTotal: 0,
    });
  }

  // Compute percentages
  for (const row of rows) {
    row.percentOfTotal =
      totalPeriodSeconds > 0 ? Math.round((row.actualSeconds / totalPeriodSeconds) * 100) : 0;
  }

  return rows.sort((a, b) => b.actualSeconds - a.actualSeconds);
}

/**
 * Computes high-level summary metrics for the report period.
 */
export function calculateReportSummary(
  entries: TimeEntry[],
  taskRows: TaskReportRow[],
  dateRange: DateRange,
  dailyAggregations?: DayAggregation[]
): ReportSummaryMetrics {
  // Total tracked time is sum of all daily aggregated slices in period
  const daily = dailyAggregations ?? calculateDailyAggregations(entries, dateRange);
  const totalTrackedSeconds = daily.reduce((sum, d) => sum + d.seconds, 0);

  // Total planned time for tasks scheduled in this period
  const totalPlannedSeconds = taskRows.reduce((sum, t) => sum + (t.plannedSeconds ?? 0), 0);
  const plannedMinutes = totalPlannedSeconds > 0 ? Math.round(totalPlannedSeconds / 60) : null;

  const variance = calculateTimeVariance(plannedMinutes, totalTrackedSeconds);
  const completedTasksCount = taskRows.filter((t) => t.status === 'completed').length;
  const totalTasksWorkedCount = taskRows.filter((t) => t.actualSeconds > 0).length;

  // Days in range for daily average
  const [sy, sm, sd] = dateRange.start.split('-').map(Number);
  const [ey, em, ed] = dateRange.end.split('-').map(Number);
  const diffDays = Math.max(1, Math.round((new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000) + 1);
  const averageDailySeconds = Math.round(totalTrackedSeconds / diffDays);

  return {
    totalTrackedSeconds,
    formattedTotalTracked: formatDuration(totalTrackedSeconds),
    completedTasksCount,
    totalTasksWorkedCount,
    totalPlannedSeconds,
    formattedTotalPlanned: formatDuration(totalPlannedSeconds),
    varianceDeltaSeconds: variance.deltaSeconds,
    varianceStatus: variance.status,
    varianceLabel: variance.label,
    averageDailySeconds,
    formattedAverageDaily: formatDuration(averageDailySeconds),
  };
}

/**
 * Generates an RFC 4180 compliant CSV string for the selected period.
 */
export function generateReportCSV(
  entries: TimeEntry[],
  tasks: Task[],
  projects: Project[],
  dateRange: DateRange
): string {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const headers = [
    'Session Date',
    'Task Title',
    'Project Name',
    'Client Name',
    'Entry Type',
    'Started At',
    'Ended At',
    'Duration (Seconds)',
    'Duration (Formatted)',
    'Notes',
  ];

  const escapeCSV = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

  const scopedEntries = entries
    .filter((e) => {
      if (e.status !== 'completed') return false;
      const datePart = e.startedAt ? e.startedAt.slice(0, 10) : dateRange.start;
      return datePart >= dateRange.start && datePart <= dateRange.end;
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  for (const entry of scopedEntries) {
    const task = entry.taskId ? taskMap.get(entry.taskId) : undefined;
    const project = entry.projectId ? projectMap.get(entry.projectId) : undefined;

    const row = [
      entry.startedAt ? entry.startedAt.slice(0, 10) : dateRange.start,
      task ? task.title : 'Unassigned Task',
      project ? project.name : 'No Project',
      project?.description || 'Personal Workspace',
      entry.entryType,
      entry.startedAt || '',
      entry.endedAt || '',
      entry.durationSeconds,
      formatDuration(entry.durationSeconds),
      entry.notes || '',
    ];

    rows.push(row.map(escapeCSV).join(','));
  }

  return rows.join('\r\n');
}

/**
 * Builds a multi-sheet Excel Workbook using SheetJS (xlsx).
 */
export function buildReportWorkbook(
  summary: ReportSummaryMetrics,
  daily: DayAggregation[],
  taskRows: TaskReportRow[],
  projectRows: ProjectReportRow[],
  entries: TimeEntry[],
  tasks: Task[],
  projects: Project[],
  period: ReportPeriod,
  dateRange: DateRange
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Summary
  const summaryAoa = [
    ['My Work Planner — Executive Report'],
    ['Generated On', new Date().toISOString()],
    ['Reporting Period', period.toUpperCase()],
    ['Date Range', `${dateRange.start} to ${dateRange.end}`],
    [],
    ['Metric', 'Value'],
    ['Total Tracked Time', summary.formattedTotalTracked],
    ['Total Tracked Seconds', summary.totalTrackedSeconds],
    ['Planned Time', summary.formattedTotalPlanned],
    ['Planned Seconds', summary.totalPlannedSeconds],
    ['Time Variance', summary.varianceLabel],
    ['Completed Tasks', summary.completedTasksCount],
    ['Active Tasks Worked', summary.totalTasksWorkedCount],
    ['Average Daily Time', summary.formattedAverageDaily],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // 2. Sheet: Daily Breakdown
  const dailyAoa = [
    ['Date', 'Day of Week', 'Tracked Duration', 'Duration (Seconds)', 'Sessions Count'],
    ...daily.map((d) => [d.date, d.dayName, d.formatted, d.seconds, d.sessionCount]),
  ];
  const dailyWs = XLSX.utils.aoa_to_sheet(dailyAoa);
  XLSX.utils.book_append_sheet(wb, dailyWs, 'Daily Breakdown');

  // 3. Sheet: Task Breakdown
  const taskAoa = [
    ['Task Title', 'Project', 'Status', 'Priority', 'Planned Duration', 'Actual Tracked', 'Variance', 'Sessions Count'],
    ...taskRows.map((t) => [
      t.taskTitle,
      t.projectName,
      t.status.toUpperCase(),
      t.priority.toUpperCase(),
      t.plannedSeconds ? formatDuration(t.plannedSeconds) : 'No estimate',
      formatDuration(t.actualSeconds),
      t.varianceLabel,
      t.sessionCount,
    ]),
  ];
  const taskWs = XLSX.utils.aoa_to_sheet(taskAoa);
  XLSX.utils.book_append_sheet(wb, taskWs, 'Task Breakdown');

  // 4. Sheet: Project Breakdown
  const projectAoa = [
    ['Project Name', 'Client / Description', 'Tracked Duration', 'Duration (Seconds)', 'Tasks Worked', 'Completed Tasks', '% of Total'],
    ...projectRows.map((p) => [
      p.projectName,
      p.clientName,
      p.formattedActual,
      p.actualSeconds,
      p.taskCount,
      p.completedTaskCount,
      `${p.percentOfTotal}%`,
    ]),
  ];
  const projectWs = XLSX.utils.aoa_to_sheet(projectAoa);
  XLSX.utils.book_append_sheet(wb, projectWs, 'Project Breakdown');

  // 5. Sheet: Work Sessions
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const projMap = new Map(projects.map((p) => [p.id, p]));
  const scopedEntries = entries
    .filter((e) => {
      if (e.status !== 'completed') return false;
      const datePart = e.startedAt ? e.startedAt.slice(0, 10) : dateRange.start;
      return datePart >= dateRange.start && datePart <= dateRange.end;
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const sessionsAoa = [
    ['Session Date', 'Task Title', 'Project Name', 'Entry Type', 'Started At', 'Ended At', 'Duration', 'Duration (Seconds)', 'Notes'],
    ...scopedEntries.map((e) => {
      const task = e.taskId ? taskMap.get(e.taskId) : undefined;
      const proj = e.projectId ? projMap.get(e.projectId) : undefined;
      return [
        e.startedAt ? e.startedAt.slice(0, 10) : dateRange.start,
        task ? task.title : 'Unassigned Task',
        proj ? proj.name : 'No Project',
        e.entryType.toUpperCase(),
        e.startedAt || '',
        e.endedAt || '',
        formatDuration(e.durationSeconds),
        e.durationSeconds,
        e.notes || '',
      ];
    }),
  ];
  const sessionsWs = XLSX.utils.aoa_to_sheet(sessionsAoa);
  XLSX.utils.book_append_sheet(wb, sessionsWs, 'Work Sessions');

  return wb;
}

/**
 * Triggers a client-side file download of CSV content in browser.
 */
export function downloadCSVFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a client-side file download of XLSX content in browser.
 */
export function downloadWorkbookFile(wb: XLSX.WorkBook, filename: string): void {
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    // Fallback to direct SheetJS writeFile if Blob creation encounters an issue
    console.warn('Falling back to XLSX.writeFile:', err);
    XLSX.writeFile(wb, filename);
  }
}

export type WorkOverviewPeriod =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'all_time'
  | 'custom';

export interface WorkOverviewOptions {
  period: WorkOverviewPeriod;
  tasks: readonly Task[];
  timeEntries: readonly TimeEntry[];
  activeTimer?: ActiveTimerState | null;
  activeElapsedSeconds?: number;
  customRange?: { start: string; end: string };
  timezone?: string;
  now?: Date;
}

export interface WorkOverviewMetrics {
  period: WorkOverviewPeriod;
  dateRange: DateRange | null;
  rangeLabel: string;
  trackedSeconds: number;
  savedSeconds: number;
  liveSeconds: number;
  isTimerRunningInPeriod: boolean;
  completedTasksCount: number;
  remainingTasksCount: number;
  totalTasksCount: number;
  completionRatio: number;
}

/**
 * Calculates work productivity metrics for the Dashboard Work Overview card.
 * Handles Today, This Week (Mon-Sun), This Month, All Time, and Custom Range.
 * Reconciles strictly with Reports page midnight-split session totals and
 * respects the single active timer invariant without double-counting.
 */
export function calculateWorkOverviewMetrics(
  options: WorkOverviewOptions
): WorkOverviewMetrics {
  const {
    period,
    tasks,
    timeEntries,
    activeTimer = null,
    activeElapsedSeconds = 0,
    customRange,
    timezone = 'Asia/Kolkata',
    now = new Date(),
  } = options;

  const todayIso = getDateISOInTimezone(now, timezone);

  // 1. Determine date range & display label
  let dateRange: DateRange | null = null;
  let rangeLabel = 'Today';

  if (period === 'all_time') {
    dateRange = null;
    rangeLabel = 'All Time';
  } else if (period === 'today') {
    dateRange = { start: todayIso, end: todayIso };
    rangeLabel = 'Today';
  } else if (period === 'this_week') {
    const [y, m, d] = todayIso.split('-').map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = anchor.getUTCDay(); // 0 = Sun, 1 = Mon...
    const distToMon = (dayOfWeek + 6) % 7;
    const mon = new Date(Date.UTC(y, m - 1, d - distToMon, 12, 0, 0));
    const sun = new Date(Date.UTC(y, m - 1, d - distToMon + 6, 12, 0, 0));
    const start = mon.toISOString().slice(0, 10);
    const end = sun.toISOString().slice(0, 10);
    dateRange = { start, end };
    rangeLabel = 'This Week';
  } else if (period === 'this_month') {
    const [y, m] = todayIso.split('-').map(Number);
    const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDayNum = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
    dateRange = { start: firstDay, end: lastDay };
    rangeLabel = 'This Month';
  } else if (period === 'custom') {
    const start = customRange?.start || todayIso;
    const end = customRange?.end || start;
    dateRange = start <= end ? { start, end } : { start: end, end: start };
    rangeLabel = `${dateRange.start} – ${dateRange.end}`;
  }

  // 2. Tracked time calculation with midnight attribution
  let savedSeconds = 0;
  if (period === 'all_time') {
    savedSeconds = timeEntries.reduce((sum, e) => {
      if (e.status !== 'completed') return sum;
      return sum + Math.max(0, Math.floor(e.durationSeconds));
    }, 0);
  } else if (dateRange) {
    for (const entry of timeEntries) {
      if (entry.status !== 'completed') continue;
      const slices = splitSessionByDay(entry, dateRange, timezone);
      for (const slice of slices) {
        if (slice.date >= dateRange.start && slice.date <= dateRange.end) {
          savedSeconds += slice.seconds;
        }
      }
    }
  }

  // 3. Live active timer elapsed time
  // Paused timers must not accumulate time.
  // Running timer elapsed time is included once if today falls in the period.
  const isRunning = activeTimer?.status === 'running';
  const isTodayInPeriod =
    period === 'all_time' ||
    (dateRange !== null &&
      todayIso >= dateRange.start &&
      todayIso <= dateRange.end);

  const isTimerRunningInPeriod = isRunning && isTodayInPeriod;
  const liveSeconds = isTimerRunningInPeriod ? Math.max(0, Math.floor(activeElapsedSeconds)) : 0;
  const trackedSeconds = savedSeconds + liveSeconds;

  // 4. Completed & Remaining Task Counts
  let completedTasksCount = 0;
  let remainingTasksCount = 0;

  if (period === 'all_time') {
    completedTasksCount = tasks.filter(
      (t) => !t.isArchived && t.status === 'completed'
    ).length;
    // For All Time: Total incomplete tasks, including Inbox tasks
    remainingTasksCount = tasks.filter(
      (t) => !t.isArchived && t.status !== 'completed'
    ).length;
  } else if (dateRange) {
    for (const t of tasks) {
      if (t.isArchived) continue;

      if (t.status === 'completed') {
        // Count tasks whose completed_at falls within the selected period
        let taskCompletedDate: string | null = null;
        if (t.completedAt) {
          taskCompletedDate = getDateISOInTimezone(new Date(t.completedAt), timezone);
        } else if (t.scheduledDate) {
          taskCompletedDate = t.scheduledDate;
        } else if (t.updatedAt) {
          taskCompletedDate = getDateISOInTimezone(new Date(t.updatedAt), timezone);
        }

        if (
          taskCompletedDate &&
          taskCompletedDate >= dateRange.start &&
          taskCompletedDate <= dateRange.end
        ) {
          completedTasksCount += 1;
        }
      } else {
        // Remaining tasks: count incomplete tasks scheduled within that period
        if (
          t.scheduledDate !== null &&
          t.scheduledDate >= dateRange.start &&
          t.scheduledDate <= dateRange.end
        ) {
          remainingTasksCount += 1;
        }
      }
    }
  }

  const totalTasksCount = completedTasksCount + remainingTasksCount;
  const completionRatio = totalTasksCount > 0 ? completedTasksCount / totalTasksCount : 0;

  return {
    period,
    dateRange,
    rangeLabel,
    trackedSeconds,
    savedSeconds,
    liveSeconds,
    isTimerRunningInPeriod,
    completedTasksCount,
    remainingTasksCount,
    totalTasksCount,
    completionRatio,
  };
}
