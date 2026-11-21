import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWorkOverviewMetrics,
  calculateDailyAggregations,
  getDateISOInTimezone,
  splitSessionByDay,
} from './reportService';
import type { Task, TimeEntry, ActiveTimerState } from '../types/models';

describe('Work Overview with Time Filters — Test Suite', () => {
  const fixedNow = new Date('2026-11-21T10:30:00.000Z'); // Saturday, Nov 21, 2026 (16:00 IST)
  const timezone = 'Asia/Kolkata';

  // Sample tasks
  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      userId: 'user-1',
      projectId: 'proj-1',
      title: 'Complete Milestone 9 docs',
      priority: 'high',
      status: 'completed',
      scheduledDate: '2026-11-21',
      scheduledStartTime: '09:00',
      plannedDurationMinutes: 60,
      reminderOffsetMinutes: 15,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: '2026-11-21T06:00:00.000Z', // 11:30 AM IST on Nov 21
      isArchived: false,
      createdAt: '2026-11-21T05:00:00.000Z',
      updatedAt: '2026-11-21T06:00:00.000Z',
    },
    {
      id: 'task-2',
      userId: 'user-1',
      projectId: 'proj-1',
      title: 'Dashboard Work Overview update',
      priority: 'high',
      status: 'in_progress',
      scheduledDate: '2026-11-21',
      scheduledStartTime: '14:00',
      plannedDurationMinutes: 90,
      reminderOffsetMinutes: 15,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: null,
      isArchived: false,
      createdAt: '2026-11-21T05:00:00.000Z',
      updatedAt: '2026-11-21T05:00:00.000Z',
    },
    {
      id: 'task-3',
      userId: 'user-1',
      projectId: null,
      title: 'Review weekly analytics',
      priority: 'medium',
      status: 'completed',
      scheduledDate: '2026-11-18', // Wednesday of this week
      scheduledStartTime: null,
      plannedDurationMinutes: 45,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: '2026-11-18T10:00:00.000Z',
      isArchived: false,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 'task-4',
      userId: 'user-1',
      projectId: null,
      title: 'Upcoming Sunday maintenance',
      priority: 'low',
      status: 'todo',
      scheduledDate: '2026-11-22', // Sunday of this week
      scheduledStartTime: '11:00',
      plannedDurationMinutes: 30,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: null,
      isArchived: false,
      createdAt: '2026-11-20T08:00:00.000Z',
      updatedAt: '2026-11-20T08:00:00.000Z',
    },
    {
      id: 'task-5',
      userId: 'user-1',
      projectId: null,
      title: 'Previous month project wrap-up',
      priority: 'medium',
      status: 'completed',
      scheduledDate: '2026-10-25', // Last month
      scheduledStartTime: null,
      plannedDurationMinutes: 120,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: '2026-10-25T14:00:00.000Z',
      isArchived: false,
      createdAt: '2026-10-25T08:00:00.000Z',
      updatedAt: '2026-10-25T14:00:00.000Z',
    },
    {
      id: 'task-inbox',
      userId: 'user-1',
      projectId: null,
      title: 'Unscheduled inbox idea',
      priority: 'low',
      status: 'todo',
      scheduledDate: null, // Unscheduled Inbox task
      scheduledStartTime: null,
      plannedDurationMinutes: null,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: null,
      isArchived: false,
      createdAt: '2026-11-15T08:00:00.000Z',
      updatedAt: '2026-11-15T08:00:00.000Z',
    },
  ];

  // Sample work sessions (automatic & manual)
  const sampleTimeEntries: TimeEntry[] = [
    {
      id: 'session-1',
      userId: 'user-1',
      taskId: 'task-1',
      projectId: 'proj-1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-21T05:00:00.000Z', // Today (IST 10:30 - 11:30)
      endedAt: '2026-11-21T06:00:00.000Z',
      durationSeconds: 3600, // 1h
      createdAt: '2026-11-21T06:00:00.000Z',
      updatedAt: '2026-11-21T06:00:00.000Z',
    },
    {
      id: 'session-2',
      userId: 'user-1',
      taskId: 'task-3',
      projectId: null,
      entryType: 'manual', // Manual entry
      status: 'completed',
      startedAt: '2026-11-18T09:00:00.000Z', // Wednesday
      endedAt: '2026-11-18T09:45:00.000Z',
      durationSeconds: 2700, // 45m
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 'session-3',
      userId: 'user-1',
      taskId: 'task-5',
      projectId: null,
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-10-25T12:00:00.000Z', // October (last month)
      endedAt: '2026-10-25T14:00:00.000Z',
      durationSeconds: 7200, // 2h
      createdAt: '2026-10-25T14:00:00.000Z',
      updatedAt: '2026-10-25T14:00:00.000Z',
    },
  ];

  it('1. Today Filter: Computes metrics for the current calendar day', () => {
    const metrics = calculateWorkOverviewMetrics({
      period: 'today',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: null,
      activeElapsedSeconds: 0,
      timezone,
      now: fixedNow,
    });

    assert.equal(metrics.period, 'today');
    assert.deepEqual(metrics.dateRange, { start: '2026-11-21', end: '2026-11-21' });
    // Tracked time today: session-1 (3600s = 1h)
    assert.equal(metrics.trackedSeconds, 3600);
    assert.equal(metrics.savedSeconds, 3600);
    assert.equal(metrics.liveSeconds, 0);
    // Task-1 completed today
    assert.equal(metrics.completedTasksCount, 1);
    // Task-2 remaining scheduled today
    assert.equal(metrics.remainingTasksCount, 1);
    // Total today = 2 (1 completed, 1 remaining)
    assert.equal(metrics.totalTasksCount, 2);
    assert.equal(metrics.completionRatio, 0.5);
  });

  it('2. This Week Filter: Computes Monday through Sunday metrics', () => {
    // Current week of Nov 21, 2026 is Mon Nov 16 to Sun Nov 22
    const metrics = calculateWorkOverviewMetrics({
      period: 'this_week',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: null,
      activeElapsedSeconds: 0,
      timezone,
      now: fixedNow,
    });

    assert.equal(metrics.period, 'this_week');
    assert.deepEqual(metrics.dateRange, { start: '2026-11-16', end: '2026-11-22' });
    // Tracked time this week: session-1 (3600s) + session-2 (2700s) = 6300s
    assert.equal(metrics.trackedSeconds, 6300);
    // Completed this week: task-1 (Nov 21) + task-3 (Nov 18) = 2
    assert.equal(metrics.completedTasksCount, 2);
    // Remaining scheduled this week: task-2 (Nov 21) + task-4 (Nov 22) = 2
    assert.equal(metrics.remainingTasksCount, 2);
    // Total = 4
    assert.equal(metrics.totalTasksCount, 4);
    assert.equal(metrics.completionRatio, 0.5);
  });

  it('3. This Month Filter: Computes calendar month metrics', () => {
    // November 2026: 2026-11-01 to 2026-11-30
    const metrics = calculateWorkOverviewMetrics({
      period: 'this_month',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: null,
      activeElapsedSeconds: 0,
      timezone,
      now: fixedNow,
    });

    assert.equal(metrics.period, 'this_month');
    assert.deepEqual(metrics.dateRange, { start: '2026-11-01', end: '2026-11-30' });
    // Tracked time in November: 3600s + 2700s = 6300s (excludes Oct session-3)
    assert.equal(metrics.trackedSeconds, 6300);
    // Completed in Nov: task-1, task-3 = 2
    assert.equal(metrics.completedTasksCount, 2);
    // Remaining in Nov: task-2, task-4 = 2
    assert.equal(metrics.remainingTasksCount, 2);
    assert.equal(metrics.totalTasksCount, 4);
  });

  it('4. All Time Filter: Computes cumulative account-level totals including Inbox tasks', () => {
    const metrics = calculateWorkOverviewMetrics({
      period: 'all_time',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: null,
      activeElapsedSeconds: 0,
      timezone,
      now: fixedNow,
    });

    assert.equal(metrics.period, 'all_time');
    assert.equal(metrics.dateRange, null);
    assert.equal(metrics.rangeLabel, 'All Time');
    // Total tracked time across all sessions: 3600 + 2700 + 7200 = 13500s (3h 45m)
    assert.equal(metrics.trackedSeconds, 13500);
    assert.equal(metrics.savedSeconds, 13500);
    // Total completed tasks: task-1, task-3, task-5 = 3
    assert.equal(metrics.completedTasksCount, 3);
    // Total incomplete tasks: task-2, task-4, PLUS task-inbox (unscheduled Inbox task) = 3
    assert.equal(metrics.remainingTasksCount, 3);
    assert.equal(metrics.totalTasksCount, 6);
    assert.equal(metrics.completionRatio, 0.5);
  });

  it('5. Custom Range Filter: Calculates strictly within user-specified date bounds', () => {
    // Custom range: Nov 17 to Nov 19
    const metrics = calculateWorkOverviewMetrics({
      period: 'custom',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: null,
      activeElapsedSeconds: 0,
      customRange: { start: '2026-11-17', end: '2026-11-19' },
      timezone,
      now: fixedNow,
    });

    assert.equal(metrics.period, 'custom');
    assert.deepEqual(metrics.dateRange, { start: '2026-11-17', end: '2026-11-19' });
    // Tracked time in range: session-2 (Nov 18, 2700s)
    assert.equal(metrics.trackedSeconds, 2700);
    // Completed in range: task-3 (completed Nov 18) = 1
    assert.equal(metrics.completedTasksCount, 1);
    // Remaining in range: 0 (task-2 is Nov 21, task-4 is Nov 22)
    assert.equal(metrics.remainingTasksCount, 0);
    assert.equal(metrics.totalTasksCount, 1);
    assert.equal(metrics.completionRatio, 1.0);
  });

  it('6. Custom Range Auto-Inversion: Corrects inverted start and end dates', () => {
    const metrics = calculateWorkOverviewMetrics({
      period: 'custom',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: null,
      activeElapsedSeconds: 0,
      customRange: { start: '2026-11-25', end: '2026-11-20' }, // Inverted
      timezone,
      now: fixedNow,
    });

    assert.deepEqual(metrics.dateRange, { start: '2026-11-20', end: '2026-11-25' });
  });

  it('7. Live Running Timer: Includes live elapsed seconds in active period without double-counting', () => {
    const activeTimerRunning: ActiveTimerState = {
      taskId: 'task-2',
      status: 'running',
      startedAtMs: fixedNow.getTime() - 600 * 1000, // 10 min ago
      accumulatedBeforeSegmentSeconds: 300,
      sessionStartedAtIso: fixedNow.toISOString(),
    };

    const metricsToday = calculateWorkOverviewMetrics({
      period: 'today',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: activeTimerRunning,
      activeElapsedSeconds: 900, // 15 mins live
      timezone,
      now: fixedNow,
    });

    assert.equal(metricsToday.isTimerRunningInPeriod, true);
    assert.equal(metricsToday.liveSeconds, 900);
    // Saved: 3600s + Live: 900s = 4500s
    assert.equal(metricsToday.trackedSeconds, 4500);

    // If viewing a historical custom range that does NOT include today:
    const metricsPast = calculateWorkOverviewMetrics({
      period: 'custom',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: activeTimerRunning,
      activeElapsedSeconds: 900,
      customRange: { start: '2026-11-01', end: '2026-11-10' },
      timezone,
      now: fixedNow,
    });

    // Today is NOT in range, so active live timer is NOT added to past range
    assert.equal(metricsPast.isTimerRunningInPeriod, false);
    assert.equal(metricsPast.liveSeconds, 0);
  });

  it('8. Paused Timer: Paused timers must NOT accumulate time', () => {
    const activeTimerPaused: ActiveTimerState = {
      taskId: 'task-2',
      status: 'paused',
      startedAtMs: fixedNow.getTime(),
      accumulatedBeforeSegmentSeconds: 300,
      sessionStartedAtIso: fixedNow.toISOString(),
    };

    const metrics = calculateWorkOverviewMetrics({
      period: 'today',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      activeTimer: activeTimerPaused,
      activeElapsedSeconds: 300,
      timezone,
      now: fixedNow,
    });

    // Paused timer is NOT running
    assert.equal(metrics.isTimerRunningInPeriod, false);
    assert.equal(metrics.liveSeconds, 0);
    assert.equal(metrics.trackedSeconds, 3600); // Only saved sessions
  });

  it('9. Midnight Crossing & Timezone Boundaries: Splits session correctly across local days', () => {
    // Session starting 23:45 IST on Nov 20, ending 00:30 IST on Nov 21 (45m total = 2700s)
    // 23:45 IST = 18:15 UTC. 00:30 IST = 19:00 UTC.
    const midnightEntry: TimeEntry = {
      id: 'session-midnight',
      userId: 'user-1',
      taskId: 'task-1',
      projectId: null,
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-20T18:15:00.000Z',
      endedAt: '2026-11-20T19:00:00.000Z',
      durationSeconds: 2700,
      createdAt: '2026-11-20T19:00:00.000Z',
      updatedAt: '2026-11-20T19:00:00.000Z',
    };

    const slices = splitSessionByDay(midnightEntry, { start: '2026-11-20', end: '2026-11-21' }, 'Asia/Kolkata');
    assert.equal(slices.length, 2);
    // Slice 1: 15 mins on Nov 20 = 900s
    assert.equal(slices[0].date, '2026-11-20');
    assert.equal(slices[0].seconds, 900);
    // Slice 2: 30 mins on Nov 21 = 1800s
    assert.equal(slices[1].date, '2026-11-21');
    assert.equal(slices[1].seconds, 1800);

    // Verify when checking "Today" (Nov 21 in Asia/Kolkata):
    const metricsToday = calculateWorkOverviewMetrics({
      period: 'today',
      tasks: [],
      timeEntries: [midnightEntry],
      timezone: 'Asia/Kolkata',
      now: fixedNow,
    });

    // Only the 1800s belonging to Nov 21 is counted for Today
    assert.equal(metricsToday.savedSeconds, 1800);
    assert.equal(metricsToday.trackedSeconds, 1800);
  });

  it('10. Reports Page Reconciliation: Total tracked time matches calculateDailyAggregations exactly', () => {
    const range = { start: '2026-11-16', end: '2026-11-22' };
    const overviewMetrics = calculateWorkOverviewMetrics({
      period: 'custom',
      tasks: sampleTasks,
      timeEntries: sampleTimeEntries,
      customRange: range,
      timezone,
      now: fixedNow,
    });

    const dailyAggregations = calculateDailyAggregations(sampleTimeEntries, range, timezone);
    const reportsTotal = dailyAggregations.reduce((sum, d) => sum + d.seconds, 0);

    assert.equal(overviewMetrics.savedSeconds, reportsTotal);
  });

  it('11. Empty Data State: Handles zero records gracefully without division by zero or errors', () => {
    const metrics = calculateWorkOverviewMetrics({
      period: 'today',
      tasks: [],
      timeEntries: [],
      activeTimer: null,
      activeElapsedSeconds: 0,
      timezone,
      now: fixedNow,
    });

    assert.equal(metrics.trackedSeconds, 0);
    assert.equal(metrics.savedSeconds, 0);
    assert.equal(metrics.liveSeconds, 0);
    assert.equal(metrics.completedTasksCount, 0);
    assert.equal(metrics.remainingTasksCount, 0);
    assert.equal(metrics.totalTasksCount, 0);
    assert.equal(metrics.completionRatio, 0);
  });
});
