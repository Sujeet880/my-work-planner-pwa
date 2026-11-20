import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSavedWorkSeconds,
  calculateActiveSessionSeconds,
  calculateLiveActualSeconds,
  calculateTimeVariance,
  formatDuration,
  formatClockHHMMSS,
  isTaskOverdue,
  validateTaskInput,
  validateManualTimeEntry,
  validateEmailFormat,
} from './timeMath';
import type { ActiveTimerState, TimeEntry } from '../types/models';

const sampleEntries: TimeEntry[] = [
  {
    id: 'e1',
    userId: 'u1',
    taskId: 't1',
    projectId: 'p1',
    entryType: 'timer',
    status: 'completed',
    startedAt: '2026-04-01T09:00:00.000Z',
    endedAt: '2026-04-01T09:45:00.000Z',
    durationSeconds: 2700, // 45m
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: '2026-04-01T09:45:00.000Z',
  },
  {
    id: 'e2',
    userId: 'u1',
    taskId: 't1',
    projectId: 'p1',
    entryType: 'manual',
    status: 'completed',
    startedAt: '2026-04-01T10:00:00.000Z',
    endedAt: '2026-04-01T10:30:00.000Z',
    durationSeconds: 1800, // 30m
    createdAt: '2026-04-01T10:30:00.000Z',
    updatedAt: '2026-04-01T10:30:00.000Z',
  },
  {
    id: 'e3',
    userId: 'u1',
    taskId: 't1',
    projectId: 'p1',
    entryType: 'timer',
    status: 'running', // must NOT be counted in saved work time
    startedAt: '2026-04-01T11:00:00.000Z',
    endedAt: null,
    durationSeconds: 999,
    createdAt: '2026-04-01T11:00:00.000Z',
    updatedAt: '2026-04-01T11:00:00.000Z',
  },
  {
    id: 'e4',
    userId: 'u1',
    taskId: 't2',
    projectId: 'p2',
    entryType: 'timer',
    status: 'completed',
    startedAt: '2026-04-01T12:00:00.000Z',
    endedAt: '2026-04-01T12:20:00.000Z',
    durationSeconds: 1200, // 20m
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:20:00.000Z',
  },
];

test('calculateSavedWorkSeconds sums only completed entries and prevents double-counting active ones', () => {
  assert.equal(calculateSavedWorkSeconds(sampleEntries, 't1'), 4500);
  assert.equal(calculateSavedWorkSeconds(sampleEntries, 't2'), 1200);
  assert.equal(calculateSavedWorkSeconds(sampleEntries), 5700);
});

test('calculateActiveSessionSeconds computes timestamp-driven elapsed time for running vs paused', () => {
  const runningTimer: ActiveTimerState = {
    taskId: 't1',
    status: 'running',
    startedAtMs: 1_000_000,
    accumulatedBeforeSegmentSeconds: 600,
    sessionStartedAtIso: '2026-04-01T11:00:00.000Z',
  };
  assert.equal(calculateActiveSessionSeconds(runningTimer, 1_125_000), 725);

  const pausedTimer: ActiveTimerState = {
    ...runningTimer,
    status: 'paused',
  };
  assert.equal(calculateActiveSessionSeconds(pausedTimer, 1_500_000), 600);
  assert.equal(calculateActiveSessionSeconds(null, 1_500_000), 0);
});

test('calculateLiveActualSeconds adds active session only to the active task', () => {
  const activeTimer: ActiveTimerState = {
    taskId: 't1',
    status: 'running',
    startedAtMs: 2_000_000,
    accumulatedBeforeSegmentSeconds: 300,
    sessionStartedAtIso: '2026-04-01T11:00:00.000Z',
  };
  // t1 saved (4500) + active (300 + 60) = 4860
  assert.equal(calculateLiveActualSeconds(sampleEntries, activeTimer, 't1', 2_060_000), 4860);
  // t2 saved (1200) + 0 = 1200
  assert.equal(calculateLiveActualSeconds(sampleEntries, activeTimer, 't2', 2_060_000), 1200);
});

test('calculateTimeVariance handles no estimate, under plan, on target, and over plan', () => {
  const noEst = calculateTimeVariance(null, 1800);
  assert.equal(noEst.status, 'no_estimate');
  assert.equal(noEst.deltaSeconds, null);
  assert.equal(noEst.label, 'No estimate');

  const under = calculateTimeVariance(120, 5400); // 2h planned, 1h 30m actual -> 30m under
  assert.equal(under.status, 'under_plan');
  assert.equal(under.label, '30m under plan');

  const onTarget = calculateTimeVariance(60, 3620); // within 60s
  assert.equal(onTarget.status, 'on_target');
  assert.equal(onTarget.label, 'On target');

  const over = calculateTimeVariance(60, 5400); // 1h planned, 1h 30m actual -> +30m over
  assert.equal(over.status, 'over_plan');
  assert.equal(over.label, '+30m over plan');
});

test('formatClockHHMMSS and formatDuration format accurately', () => {
  assert.equal(formatClockHHMMSS(0), '00:00:00');
  assert.equal(formatClockHHMMSS(5078), '01:24:38');
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(2700), '45m');
  assert.equal(formatDuration(5400), '1h 30m');
  assert.equal(formatDuration(3600), '1h 00m');
});

test('isTaskOverdue flags only uncompleted, unarchived tasks scheduled before today', () => {
  assert.equal(isTaskOverdue({ scheduledDate: '2026-04-01', status: 'todo', isArchived: false }, '2026-04-02'), true);
  assert.equal(isTaskOverdue({ scheduledDate: '2026-04-02', status: 'todo', isArchived: false }, '2026-04-02'), false);
  assert.equal(isTaskOverdue({ scheduledDate: '2026-04-01', status: 'completed', isArchived: false }, '2026-04-02'), false);
  assert.equal(isTaskOverdue({ scheduledDate: null, status: 'todo', isArchived: false }, '2026-04-02'), false);
});

test('validateTaskInput enforces required title, start-time-requires-date, and positive duration', () => {
  const emptyTitle = validateTaskInput({
    title: '   ',
    scheduledDate: '',
    scheduledStartTime: '',
    plannedDurationMinutes: '',
  });
  assert.ok(emptyTitle.title);

  const timeWithoutDate = validateTaskInput({
    title: 'Review contract',
    scheduledDate: '',
    scheduledStartTime: '14:00',
    plannedDurationMinutes: '60',
  });
  assert.ok(timeWithoutDate.scheduledStartTime);

  const badDuration = validateTaskInput({
    title: 'Review contract',
    scheduledDate: '2026-04-02',
    scheduledStartTime: '14:00',
    plannedDurationMinutes: '-15',
  });
  assert.ok(badDuration.plannedDurationMinutes);

  const validInbox = validateTaskInput({
    title: 'Draft onboarding notes',
    scheduledDate: '',
    scheduledStartTime: '',
    plannedDurationMinutes: '45',
  });
  assert.deepEqual(validInbox, {});
});

test('validateManualTimeEntry validates both duration and start/end time ranges', () => {
  const goodDuration = validateManualTimeEntry({
    taskId: 't1',
    date: '2026-04-02',
    inputMode: 'duration',
    durationMinutes: '45',
    startTime: '',
    endTime: '',
  });
  assert.deepEqual(goodDuration.errors, {});
  assert.equal(goodDuration.computedSeconds, 2700);

  const badRange = validateManualTimeEntry({
    taskId: 't1',
    date: '2026-04-02',
    inputMode: 'range',
    durationMinutes: '',
    startTime: '15:00',
    endTime: '14:30',
  });
  assert.ok(badRange.errors.endTime);
  assert.equal(badRange.computedSeconds, null);
});

test('validateEmailFormat rejects empty and invalid emails without bypassing validation', () => {
  assert.ok(validateEmailFormat(''));
  assert.ok(validateEmailFormat('not-an-email'));
  assert.equal(validateEmailFormat('owner@example.com'), null);
});
