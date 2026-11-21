import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapActiveTimerFromRow,
  mapWorkSessionFromRow,
} from './timerService';
import type { Database } from '../types/database.types';
import {
  calculateActiveSessionSeconds,
  calculateLiveActualSeconds,
  calculateSavedWorkSeconds,
  calculateTimeVariance,
  formatClockHHMMSS,
  formatDuration,
  validateManualTimeEntry,
} from '../lib/timeMath';
import type { ActiveTimerState, TimeEntry } from '../types/models';

type WorkSessionRow = Database['public']['Tables']['work_sessions']['Row'];
type ActiveTimerRow = Database['public']['Tables']['active_timers']['Row'];

describe('Milestone 5 — Persistent Timer & Work Session Domain Layer', () => {
  it('mapActiveTimerFromRow maps database row correctly to ActiveTimerState domain model', () => {
    const row: ActiveTimerRow = {
      user_id: 'usr-123',
      task_id: 'tsk-456',
      state: 'running',
      segment_started_at: '2026-11-21T05:00:00.000Z',
      created_at: '2026-11-21T04:30:00.000Z',
      updated_at: '2026-11-21T05:00:00.000Z',
    };

    const domain = mapActiveTimerFromRow(row);
    assert.equal(domain.taskId, 'tsk-456');
    assert.equal(domain.status, 'running');
    assert.equal(domain.startedAtMs, new Date('2026-11-21T05:00:00.000Z').getTime());
    assert.equal(domain.accumulatedBeforeSegmentSeconds, 0);
    assert.equal(domain.sessionStartedAtIso, '2026-11-21T05:00:00.000Z');
  });

  it('mapActiveTimerFromRow handles paused state with null segment_started_at', () => {
    const row: ActiveTimerRow = {
      user_id: 'usr-123',
      task_id: 'tsk-456',
      state: 'paused',
      segment_started_at: null,
      created_at: '2026-11-21T04:30:00.000Z',
      updated_at: '2026-11-21T05:15:00.000Z',
    };

    const domain = mapActiveTimerFromRow(row);
    assert.equal(domain.taskId, 'tsk-456');
    assert.equal(domain.status, 'paused');
    assert.equal(domain.accumulatedBeforeSegmentSeconds, 0);
    assert.equal(domain.sessionStartedAtIso, '2026-11-21T04:30:00.000Z');
  });

  it('mapWorkSessionFromRow maps database snake_case row to TimeEntry domain model', () => {
    const row: WorkSessionRow = {
      id: 'ws-789',
      user_id: 'usr-123',
      task_id: 'tsk-456',
      project_id: 'proj-1',
      entry_type: 'automatic',
      session_date: '2026-11-21',
      started_at: '2026-11-21T05:00:00.000Z',
      ended_at: '2026-11-21T05:30:00.000Z',
      duration_seconds: 1800,
      notes: 'Tracked via count-up timer',
      created_at: '2026-11-21T05:30:00.000Z',
      updated_at: '2026-11-21T05:30:00.000Z',
    };

    const domain = mapWorkSessionFromRow(row);
    assert.equal(domain.id, 'ws-789');
    assert.equal(domain.userId, 'usr-123');
    assert.equal(domain.taskId, 'tsk-456');
    assert.equal(domain.projectId, 'proj-1');
    assert.equal(domain.entryType, 'timer');
    assert.equal(domain.status, 'completed');
    assert.equal(domain.durationSeconds, 1800);
    assert.equal(domain.notes, 'Tracked via count-up timer');
  });

  it('mapWorkSessionFromRow handles manual entries and nullable tasks', () => {
    const row: WorkSessionRow = {
      id: 'ws-manual-1',
      user_id: 'usr-123',
      task_id: null, // Task was deleted; historical log preserved!
      project_id: null,
      entry_type: 'manual',
      session_date: '2026-11-21',
      started_at: null,
      ended_at: null,
      duration_seconds: 3600,
      notes: 'Manual client sync',
      created_at: '2026-11-21T06:00:00.000Z',
      updated_at: '2026-11-21T06:00:00.000Z',
    };

    const domain = mapWorkSessionFromRow(row);
    assert.equal(domain.id, 'ws-manual-1');
    assert.equal(domain.taskId, '');
    assert.equal(domain.entryType, 'manual');
    assert.equal(domain.status, 'completed');
    assert.equal(domain.durationSeconds, 3600);
    assert.equal(domain.notes, 'Manual client sync');
  });
});

describe('Milestone 5 — Time Calculation Rules & Integrity', () => {
  const baseSessions: TimeEntry[] = [
    {
      id: 's1',
      userId: 'usr-1',
      taskId: 'task-1',
      projectId: 'proj-1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-21T02:00:00.000Z',
      endedAt: '2026-11-21T02:45:00.000Z',
      durationSeconds: 2700, // 45m
      createdAt: '2026-11-21T02:45:00.000Z',
      updatedAt: '2026-11-21T02:45:00.000Z',
    },
    {
      id: 's2',
      userId: 'usr-1',
      taskId: 'task-1',
      projectId: 'proj-1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-21T03:00:00.000Z',
      endedAt: '2026-11-21T03:30:00.000Z',
      durationSeconds: 1800, // 30m
      createdAt: '2026-11-21T03:30:00.000Z',
      updatedAt: '2026-11-21T03:30:00.000Z',
    },
    {
      id: 's3',
      userId: 'usr-1',
      taskId: 'task-1',
      projectId: 'proj-1',
      entryType: 'manual',
      status: 'completed',
      startedAt: '2026-11-21T04:00:00.000Z',
      endedAt: '2026-11-21T04:20:00.000Z',
      durationSeconds: 1200, // 20m
      createdAt: '2026-11-21T04:20:00.000Z',
      updatedAt: '2026-11-21T04:20:00.000Z',
    },
    {
      id: 's4-other',
      userId: 'usr-1',
      taskId: 'task-2',
      projectId: 'proj-1',
      entryType: 'timer',
      status: 'completed',
      startedAt: '2026-11-21T01:00:00.000Z',
      endedAt: '2026-11-21T01:15:00.000Z',
      durationSeconds: 900, // 15m
      createdAt: '2026-11-21T01:15:00.000Z',
      updatedAt: '2026-11-21T01:15:00.000Z',
    },
  ];

  it('Calculates Saved Work Time strictly summing completed sessions for task-1 (1h 35m)', () => {
    // 2700 + 1800 + 1200 = 5700 seconds (95 minutes = 1h 35m)
    const saved = calculateSavedWorkSeconds(baseSessions, 'task-1');
    assert.equal(saved, 5700);
    assert.equal(formatDuration(saved), '1h 35m');
  });

  it('Current Active Session accumulates elapsed time ONLY when running', () => {
    const startedMs = 1700000000000;
    const runningTimer: ActiveTimerState = {
      taskId: 'task-1',
      status: 'running',
      startedAtMs: startedMs,
      accumulatedBeforeSegmentSeconds: 0,
      sessionStartedAtIso: new Date(startedMs).toISOString(),
    };

    // 10 minutes later (600 seconds)
    const activeElapsed = calculateActiveSessionSeconds(runningTimer, startedMs + 600000);
    assert.equal(activeElapsed, 600);
    assert.equal(formatClockHHMMSS(activeElapsed), '00:10:00');

    // When paused, Current Active Session is 0
    const pausedTimer: ActiveTimerState = {
      ...runningTimer,
      status: 'paused',
    };
    const pausedElapsed = calculateActiveSessionSeconds(pausedTimer, startedMs + 600000);
    assert.equal(pausedElapsed, 0);
  });

  it('Live Actual = Saved Work Time + Current Active Session without double counting', () => {
    const startedMs = 1700000000000;
    const runningTimer: ActiveTimerState = {
      taskId: 'task-1',
      status: 'running',
      startedAtMs: startedMs,
      accumulatedBeforeSegmentSeconds: 0,
      sessionStartedAtIso: new Date(startedMs).toISOString(),
    };

    // Saved is 5700s, running session is 300s (5m)
    const liveActual = calculateLiveActualSeconds(baseSessions, runningTimer, 'task-1', startedMs + 300000);
    assert.equal(liveActual, 5700 + 300);
    assert.equal(formatDuration(liveActual), '1h 40m');

    // For task-2, running timer on task-1 does NOT affect task-2 live actual
    const task2Live = calculateLiveActualSeconds(baseSessions, runningTimer, 'task-2', startedMs + 300000);
    assert.equal(task2Live, 900); // 15m
  });

  it('Planned vs Actual difference handles under, on-target, over-plan, and no-estimate', () => {
    // Planned 2 hours (120 minutes = 7200s), actual 5700s -> under plan by 25m
    const varianceUnder = calculateTimeVariance(120, 5700);
    assert.equal(varianceUnder.status, 'under_plan');
    assert.equal(varianceUnder.deltaSeconds, -1500);
    assert.equal(varianceUnder.label, '25m under plan');

    // Planned 95m (5700s), actual 5700s -> on target
    const varianceTarget = calculateTimeVariance(95, 5700);
    assert.equal(varianceTarget.status, 'on_target');
    assert.equal(varianceTarget.label, 'On target');

    // Planned 1 hour (60 minutes = 3600s), actual 5700s -> over plan by 35m
    const varianceOver = calculateTimeVariance(60, 5700);
    assert.equal(varianceOver.status, 'over_plan');
    assert.equal(varianceOver.deltaSeconds, 2100);
    assert.equal(varianceOver.label, '+35m over plan');

    // No planned estimate
    const varianceNone = calculateTimeVariance(null, 5700);
    assert.equal(varianceNone.status, 'no_estimate');
    assert.equal(varianceNone.label, 'No estimate');
  });

  it('Manual Time Entry validates positive whole minutes and range bounds', () => {
    // Valid duration mode
    const validDuration = validateManualTimeEntry({
      taskId: 'task-1',
      date: '2026-11-21',
      inputMode: 'duration',
      durationMinutes: '45',
      startTime: '',
      endTime: '',
    });
    assert.deepEqual(validDuration.errors, {});
    assert.equal(validDuration.computedSeconds, 2700);

    // Invalid negative duration
    const invalidNegative = validateManualTimeEntry({
      taskId: 'task-1',
      date: '2026-11-21',
      inputMode: 'duration',
      durationMinutes: '-10',
      startTime: '',
      endTime: '',
    });
    assert.equal(invalidNegative.errors.durationMinutes, 'Enter a positive duration in minutes.');
    assert.equal(invalidNegative.computedSeconds, null);

    // Valid range mode
    const validRange = validateManualTimeEntry({
      taskId: 'task-1',
      date: '2026-11-21',
      inputMode: 'range',
      durationMinutes: '',
      startTime: '10:00',
      endTime: '11:15',
    });
    assert.deepEqual(validRange.errors, {});
    assert.equal(validRange.computedSeconds, 4500); // 75 minutes = 4500s

    // Invalid range where end <= start
    const invalidRange = validateManualTimeEntry({
      taskId: 'task-1',
      date: '2026-11-21',
      inputMode: 'range',
      durationMinutes: '',
      startTime: '14:00',
      endTime: '13:30',
    });
    assert.equal(invalidRange.errors.endTime, 'End time must be later than start time.');
  });
});
