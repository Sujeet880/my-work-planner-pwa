import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportWorkbook,
  calculateDailyAggregations,
  calculateProjectReportRows,
  calculateReportSummary,
  calculateTaskReportRows,
  generateReportCSV,
  getReportDateRange,
  shiftAnchorDate,
  splitSessionByDay,
  formatReportRangeLabel,
} from './reportService';
import type { Project, Task, TimeEntry } from '../types/models';

describe('Milestone 6 — Report Date Ranges & Period Navigation', () => {
  it('Calculates daily date range correctly for today', () => {
    const anchor = new Date(2026, 10, 21); // Nov 21, 2026 (Saturday)
    const range = getReportDateRange('daily', anchor);
    assert.equal(range.start, '2026-11-21');
    assert.equal(range.end, '2026-11-21');
  });

  it('Calculates weekly date range starting on Monday and ending on Sunday (ISO 8601)', () => {
    // Nov 21, 2026 is Saturday
    // Monday of this week is Nov 16, 2026
    // Sunday of this week is Nov 22, 2026
    const anchor = new Date(2026, 10, 21);
    const range = getReportDateRange('weekly', anchor);
    assert.equal(range.start, '2026-11-16');
    assert.equal(range.end, '2026-11-22');
  });

  it('Calculates weekly date range when anchor date is Sunday', () => {
    // Nov 22, 2026 is Sunday
    const anchor = new Date(2026, 10, 22);
    const range = getReportDateRange('weekly', anchor);
    assert.equal(range.start, '2026-11-16');
    assert.equal(range.end, '2026-11-22');
  });

  it('Calculates weekly date range when anchor date is Monday', () => {
    // Nov 16, 2026 is Monday
    const anchor = new Date(2026, 10, 16);
    const range = getReportDateRange('weekly', anchor);
    assert.equal(range.start, '2026-11-16');
    assert.equal(range.end, '2026-11-22');
  });

  it('Calculates monthly date range from 1st to last day of month', () => {
    const anchor = new Date(2026, 10, 21); // November (30 days)
    const range = getReportDateRange('monthly', anchor);
    assert.equal(range.start, '2026-11-01');
    assert.equal(range.end, '2026-11-30');
  });

  it('Handles custom date range and self-corrects inverted dates', () => {
    const normal = getReportDateRange('custom', new Date(), '2026-11-05', '2026-11-15');
    assert.equal(normal.start, '2026-11-05');
    assert.equal(normal.end, '2026-11-15');

    const inverted = getReportDateRange('custom', new Date(), '2026-11-20', '2026-11-10');
    assert.equal(inverted.start, '2026-11-10');
    assert.equal(inverted.end, '2026-11-20');
  });

  it('Shifts anchor date forward and backward across period types', () => {
    const anchor = new Date(2026, 10, 21); // Nov 21, 2026

    // Daily next -> Nov 22
    const nextDay = shiftAnchorDate(anchor, 'daily', 'next');
    assert.equal(nextDay.getDate(), 22);

    // Daily prev -> Nov 20
    const prevDay = shiftAnchorDate(anchor, 'daily', 'prev');
    assert.equal(prevDay.getDate(), 20);

    // Weekly next -> Nov 28
    const nextWeek = shiftAnchorDate(anchor, 'weekly', 'next');
    assert.equal(nextWeek.getDate(), 28);

    // Monthly next -> Dec 21
    const nextMonth = shiftAnchorDate(anchor, 'monthly', 'next');
    assert.equal(nextMonth.getMonth(), 11); // December
  });

  it('Formats human-readable report range labels correctly', () => {
    const dailyLabel = formatReportRangeLabel('daily', { start: '2026-11-21', end: '2026-11-21' });
    assert.ok(dailyLabel.includes('Saturday') && dailyLabel.includes('Nov 21'));

    const weeklyLabel = formatReportRangeLabel('weekly', { start: '2026-11-16', end: '2026-11-22' });
    assert.ok(weeklyLabel.includes('Nov 16') && weeklyLabel.includes('Nov 22'));

    const monthlyLabel = formatReportRangeLabel('monthly', { start: '2026-11-01', end: '2026-11-30' });
    assert.equal(monthlyLabel, 'November 2026');
  });
});

describe('Milestone 6 — Midnight Splitting & Daily Aggregation', () => {
  it('Keeps standard same-day session in single day slice', () => {
    const entry: TimeEntry = {
      id: 'e1',
      userId: 'u1',
      taskId: 't1',
      projectId: 'p1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-21T04:00:00.000Z',
      endedAt: '2026-11-21T05:30:00.000Z',
      durationSeconds: 5400, // 90m
      createdAt: '2026-11-21T05:30:00.000Z',
      updatedAt: '2026-11-21T05:30:00.000Z',
    };

    const slices = splitSessionByDay(entry, { start: '2026-11-16', end: '2026-11-22' });
    assert.equal(slices.length, 1);
    assert.equal(slices[0].seconds, 5400);
  });

  it('Splits a session spanning across local midnight into two separate day allocations', () => {
    // Suppose a session starts at 11:45 PM on Nov 20 and ends at 00:30 AM on Nov 21 (45 minutes = 2700s)
    // In local time:
    const startLocal = new Date(2026, 10, 20, 23, 45, 0); // 15 mins before midnight
    const endLocal = new Date(2026, 10, 21, 0, 30, 0);   // 30 mins after midnight

    const entry: TimeEntry = {
      id: 'e-midnight',
      userId: 'u1',
      taskId: 't1',
      projectId: 'p1',
      entryType: 'timer',
      status: 'completed',
      startedAt: startLocal.toISOString(),
      endedAt: endLocal.toISOString(),
      durationSeconds: 2700, // 45m total
      createdAt: endLocal.toISOString(),
      updatedAt: endLocal.toISOString(),
    };

    const slices = splitSessionByDay(entry, { start: '2026-11-16', end: '2026-11-22' });
    assert.equal(slices.length, 2);
    // Slice 1: 15 mins = 900s on 2026-11-20
    assert.equal(slices[0].date, '2026-11-20');
    assert.equal(slices[0].seconds, 900);
    // Slice 2: 30 mins = 1800s on 2026-11-21
    assert.equal(slices[1].date, '2026-11-21');
    assert.equal(slices[1].seconds, 1800);
    // Sum matches exactly without loss
    assert.equal(slices[0].seconds + slices[1].seconds, 2700);
  });

  it('Populates all days of the period in calculateDailyAggregations with zeros for empty days', () => {
    const range = { start: '2026-11-16', end: '2026-11-22' }; // 7 days (Mon-Sun)
    const entry: TimeEntry = {
      id: 'e1',
      userId: 'u1',
      taskId: 't1',
      projectId: 'p1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-18T10:00:00.000Z',
      endedAt: '2026-11-18T11:00:00.000Z',
      durationSeconds: 3600, // 1h on Wednesday
      createdAt: '2026-11-18T11:00:00.000Z',
      updatedAt: '2026-11-18T11:00:00.000Z',
    };

    const daily = calculateDailyAggregations([entry], range);
    assert.equal(daily.length, 7);

    // Wednesday Nov 18 has 3600s
    const wed = daily.find((d) => d.date === '2026-11-18')!;
    assert.equal(wed.seconds, 3600);
    assert.equal(wed.sessionCount, 1);

    // Tuesday Nov 17 has 0s
    const tue = daily.find((d) => d.date === '2026-11-17')!;
    assert.equal(tue.seconds, 0);
    assert.equal(tue.sessionCount, 0);
  });
});

describe('Milestone 6 — Task & Project Aggregation and Reconciled Totals', () => {
  const mockProjects: Project[] = [
    { id: 'p1', userId: 'u1', name: 'Alpha Client', color: '#2F65F6', isArchived: false, createdAt: '', updatedAt: '' },
    { id: 'p2', userId: 'u1', name: 'Beta Redesign', color: '#16845B', isArchived: false, createdAt: '', updatedAt: '' },
  ];

  const mockTasks: Task[] = [
    {
      id: 't1',
      userId: 'u1',
      projectId: 'p1',
      title: 'Setup Database Migration',
      priority: 'high',
      status: 'completed',
      scheduledDate: '2026-11-18',
      scheduledStartTime: '09:00',
      plannedDurationMinutes: 60, // 3600s planned
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: '2026-11-18T11:00:00.000Z',
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't2',
      userId: 'u1',
      projectId: 'p1',
      title: 'Review RLS Security',
      priority: 'medium',
      status: 'in_progress',
      scheduledDate: '2026-11-19',
      scheduledStartTime: '14:00',
      plannedDurationMinutes: 45, // 2700s planned
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: null,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't3-no-proj',
      userId: 'u1',
      projectId: null,
      title: 'Personal Weekly Planning',
      priority: 'low',
      status: 'completed',
      scheduledDate: '2026-11-20',
      scheduledStartTime: null,
      plannedDurationMinutes: null, // No estimate
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: '2026-11-20T17:00:00.000Z',
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockEntries: TimeEntry[] = [
    {
      id: 'e1',
      userId: 'u1',
      taskId: 't1',
      projectId: 'p1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-18T09:00:00.000Z',
      endedAt: '2026-11-18T10:15:00.000Z',
      durationSeconds: 4500, // 75m actual (15m over plan)
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'e2',
      userId: 'u1',
      taskId: 't2',
      projectId: 'p1',
      entryType: 'manual',
      status: 'completed',
      startedAt: '2026-11-19T14:00:00.000Z',
      endedAt: '2026-11-19T14:30:00.000Z',
      durationSeconds: 1800, // 30m actual (15m under plan)
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'e3',
      userId: 'u1',
      taskId: 't3-no-proj',
      projectId: null,
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-20T16:00:00.000Z',
      endedAt: '2026-11-20T16:45:00.000Z',
      durationSeconds: 2700, // 45m actual
      createdAt: '',
      updatedAt: '',
    },
  ];

  const range = { start: '2026-11-16', end: '2026-11-22' };

  it('Calculates Task Report Rows with accurate planned vs actual variance', () => {
    const taskRows = calculateTaskReportRows(mockTasks, mockProjects, mockEntries, range);
    assert.equal(taskRows.length, 3);

    // Task 1: 3600s planned, 4500s actual -> over plan
    const t1Row = taskRows.find((r) => r.taskId === 't1')!;
    assert.equal(t1Row.actualSeconds, 4500);
    assert.equal(t1Row.plannedSeconds, 3600);
    assert.equal(t1Row.varianceStatus, 'over_plan');
    assert.equal(t1Row.varianceLabel, '+15m over plan');

    // Task 2: 2700s planned, 1800s actual -> under plan
    const t2Row = taskRows.find((r) => r.taskId === 't2')!;
    assert.equal(t2Row.actualSeconds, 1800);
    assert.equal(t2Row.plannedSeconds, 2700);
    assert.equal(t2Row.varianceStatus, 'under_plan');
    assert.equal(t2Row.varianceLabel, '15m under plan');

    // Task 3: No estimate
    const t3Row = taskRows.find((r) => r.taskId === 't3-no-proj')!;
    assert.equal(t3Row.actualSeconds, 2700);
    assert.equal(t3Row.plannedSeconds, null);
    assert.equal(t3Row.varianceStatus, 'no_estimate');
  });

  it('Calculates Project Report Rows including unassigned "No Project" work', () => {
    const taskRows = calculateTaskReportRows(mockTasks, mockProjects, mockEntries, range);
    const projRows = calculateProjectReportRows(mockProjects, taskRows, mockEntries, range);

    assert.equal(projRows.length, 2); // Alpha Client + No Project

    const alpha = projRows.find((p) => p.projectName === 'Alpha Client')!;
    assert.equal(alpha.actualSeconds, 4500 + 1800); // 6300s
    assert.equal(alpha.taskCount, 2);
    assert.equal(alpha.completedTaskCount, 1);

    const noProj = projRows.find((p) => p.projectName === 'No Project')!;
    assert.equal(noProj.actualSeconds, 2700);
    assert.equal(noProj.taskCount, 1);
    assert.equal(noProj.completedTaskCount, 1);

    // Sum of percentages equals 100%
    const totalPct = projRows.reduce((sum, r) => sum + r.percentOfTotal, 0);
    assert.equal(totalPct, 100);
  });

  it('Calculates Report Summary metrics and guarantees reconciliation', () => {
    const taskRows = calculateTaskReportRows(mockTasks, mockProjects, mockEntries, range);
    const summary = calculateReportSummary(mockEntries, taskRows, range);

    // Total tracked seconds = 4500 + 1800 + 2700 = 9000s (2h 30m)
    assert.equal(summary.totalTrackedSeconds, 9000);
    assert.equal(summary.formattedTotalTracked, '2h 30m');

    // Total planned = 3600 + 2700 = 6300s (105m)
    assert.equal(summary.totalPlannedSeconds, 6300);
    assert.equal(summary.completedTasksCount, 2);
    assert.equal(summary.totalTasksWorkedCount, 3);
  });
});

describe('Milestone 6 — CSV & Multi-Sheet Excel Export', () => {
  const mockProjects: Project[] = [
    { id: 'p1', userId: 'u1', name: 'Alpha, Inc.', color: '#2F65F6', isArchived: false, createdAt: '', updatedAt: '' },
  ];

  const mockTasks: Task[] = [
    {
      id: 't1',
      userId: 'u1',
      projectId: 'p1',
      title: 'Fix "Quotes" & Commas, Testing',
      priority: 'high',
      status: 'completed',
      scheduledDate: '2026-11-18',
      scheduledStartTime: '09:00',
      plannedDurationMinutes: 60,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: '2026-11-18T11:00:00.000Z',
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockEntries: TimeEntry[] = [
    {
      id: 'e1',
      userId: 'u1',
      taskId: 't1',
      projectId: 'p1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-18T09:00:00.000Z',
      endedAt: '2026-11-18T10:00:00.000Z',
      durationSeconds: 3600,
      notes: 'Line 1\nLine 2 with "double quotes" and ,commas,',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const range = { start: '2026-11-16', end: '2026-11-22' };

  it('Generates RFC 4180 compliant CSV string escaping quotes, commas, and line breaks', () => {
    const csv = generateReportCSV(mockEntries, mockTasks, mockProjects, range);
    assert.ok(csv.includes('"Session Date","Task Title"'));
    // Escaped title with quotes
    assert.ok(csv.includes('"Fix ""Quotes"" & Commas, Testing"'));
    // Escaped project with comma
    assert.ok(csv.includes('"Alpha, Inc."'));
    // Escaped multi-line notes with quotes
    assert.ok(csv.includes('""double quotes"" and ,commas,'));
  });

  it('Builds Excel Workbook containing all 5 required structured sheets', () => {
    const taskRows = calculateTaskReportRows(mockTasks, mockProjects, mockEntries, range);
    const projRows = calculateProjectReportRows(mockProjects, taskRows, mockEntries, range);
    const daily = calculateDailyAggregations(mockEntries, range);
    const summary = calculateReportSummary(mockEntries, taskRows, range);

    const wb = buildReportWorkbook(
      summary,
      daily,
      taskRows,
      projRows,
      mockEntries,
      mockTasks,
      mockProjects,
      'weekly',
      range
    );

    assert.deepEqual(wb.SheetNames, [
      'Summary',
      'Daily Breakdown',
      'Task Breakdown',
      'Project Breakdown',
      'Work Sessions',
    ]);

    // Check Summary sheet content
    const summarySheet = wb.Sheets['Summary'];
    assert.ok(summarySheet);

    // Check Work Sessions sheet content
    const sessionsSheet = wb.Sheets['Work Sessions'];
    assert.ok(sessionsSheet);
  });
});
