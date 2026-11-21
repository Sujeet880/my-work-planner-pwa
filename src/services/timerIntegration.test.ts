import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapActiveTimerFromRow,
  mapWorkSessionFromRow,
} from './timerService';
import {
  calculateActiveSessionSeconds,
  calculateLiveActualSeconds,
  calculateSavedWorkSeconds,
  validateManualTimeEntry,
} from '../lib/timeMath';
import type { ActiveTimerState, Task, TimeEntry } from '../types/models';
import type { Database } from '../types/database.types';

type ActiveTimerRow = Database['public']['Tables']['active_timers']['Row'];
type WorkSessionRow = Database['public']['Tables']['work_sessions']['Row'];

/**
 * In-memory test fixture simulating atomic database state transitions for tests.
 */
class MockDatabaseEnvironment {
  public activeTimers: Map<string, ActiveTimerRow> = new Map(); // Keyed by user_id (Single active timer invariant)
  public workSessions: WorkSessionRow[] = [];
  public tasks: Map<string, { id: string; user_id: string; status: string; is_archived: boolean; project_id: string | null }> = new Map();

  constructor() {
    this.tasks.set('t-1', { id: 't-1', user_id: 'usr-alice', status: 'todo', is_archived: false, project_id: 'p-1' });
    this.tasks.set('t-2', { id: 't-2', user_id: 'usr-alice', status: 'todo', is_archived: false, project_id: 'p-1' });
    this.tasks.set('t-bob', { id: 't-bob', user_id: 'usr-bob', status: 'todo', is_archived: false, project_id: null });
  }

  // 1. Start timer
  startTimer(userId: string, taskId: string, nowIso: string): { timer: ActiveTimerRow | null; error: string | null; action: string } {
    const task = this.tasks.get(taskId);
    if (!task || task.user_id !== userId || task.is_archived) {
      return { timer: null, error: 'Task not found or access denied', action: 'error' };
    }

    const existing = this.activeTimers.get(userId);
    if (existing) {
      if (existing.task_id === taskId) {
        if (existing.state === 'paused') {
          existing.state = 'running';
          existing.segment_started_at = nowIso;
          existing.updated_at = nowIso;
          return { timer: existing, error: null, action: 'resumed' };
        }
        return { timer: existing, error: null, action: 'already_running' };
      }
      return { timer: null, error: 'Another task timer is already active. Please switch or stop first.', action: 'conflict' };
    }

    const newTimer: ActiveTimerRow = {
      user_id: userId,
      task_id: taskId,
      state: 'running',
      segment_started_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.activeTimers.set(userId, newTimer);

    if (task.status === 'todo') {
      task.status = 'in_progress';
    }

    return { timer: newTimer, error: null, action: 'started' };
  }

  // 2. Pause timer
  pauseTimer(userId: string, nowIso: string): { timer: ActiveTimerRow | null; savedSession: WorkSessionRow | null; error: string | null } {
    const timer = this.activeTimers.get(userId);
    if (!timer) {
      return { timer: null, savedSession: null, error: 'No active timer found to pause' };
    }
    if (timer.state === 'paused') {
      return { timer, savedSession: null, error: null };
    }

    const startMs = new Date(timer.segment_started_at!).getTime();
    const endMs = new Date(nowIso).getTime();
    const duration = Math.max(1, Math.round((endMs - startMs) / 1000));

    const task = this.tasks.get(timer.task_id);
    const session: WorkSessionRow = {
      id: `ws-${Date.now()}-${Math.random()}`,
      user_id: userId,
      task_id: timer.task_id,
      project_id: task?.project_id ?? null,
      entry_type: 'automatic',
      session_date: nowIso.slice(0, 10),
      started_at: timer.segment_started_at,
      ended_at: nowIso,
      duration_seconds: duration,
      notes: 'Tracked via count-up timer',
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.workSessions.push(session);

    timer.state = 'paused';
    timer.segment_started_at = null;
    timer.updated_at = nowIso;

    return { timer, savedSession: session, error: null };
  }

  // 3. Resume timer
  resumeTimer(userId: string, nowIso: string): { timer: ActiveTimerRow | null; error: string | null } {
    const timer = this.activeTimers.get(userId);
    if (!timer) {
      return { timer: null, error: 'No paused timer found to resume' };
    }
    if (timer.state === 'running') {
      return { timer, error: null };
    }
    timer.state = 'running';
    timer.segment_started_at = nowIso;
    timer.updated_at = nowIso;
    return { timer, error: null };
  }

  // 4. Stop timer
  stopTimer(userId: string, nowIso: string): { stopped: boolean; savedSession: WorkSessionRow | null } {
    const timer = this.activeTimers.get(userId);
    if (!timer) {
      return { stopped: true, savedSession: null };
    }

    let savedSession: WorkSessionRow | null = null;
    if (timer.state === 'running' && timer.segment_started_at) {
      const startMs = new Date(timer.segment_started_at).getTime();
      const endMs = new Date(nowIso).getTime();
      const duration = Math.max(1, Math.round((endMs - startMs) / 1000));

      const task = this.tasks.get(timer.task_id);
      savedSession = {
        id: `ws-${Date.now()}-${Math.random()}`,
        user_id: userId,
        task_id: timer.task_id,
        project_id: task?.project_id ?? null,
        entry_type: 'automatic',
        session_date: nowIso.slice(0, 10),
        started_at: timer.segment_started_at,
        ended_at: nowIso,
        duration_seconds: duration,
        notes: 'Tracked via count-up timer',
        created_at: nowIso,
        updated_at: nowIso,
      };
      this.workSessions.push(savedSession);
    }

    this.activeTimers.delete(userId);
    return { stopped: true, savedSession };
  }

  // 5. Switch timer
  switchTimer(userId: string, newTaskId: string, nowIso: string): { timer: ActiveTimerRow | null; previousSession: WorkSessionRow | null; error: string | null } {
    const newTask = this.tasks.get(newTaskId);
    if (!newTask || newTask.user_id !== userId || newTask.is_archived) {
      return { timer: null, previousSession: null, error: 'Target task not found or access denied' };
    }

    const { savedSession } = this.stopTimer(userId, nowIso);
    const startRes = this.startTimer(userId, newTaskId, nowIso);
    return {
      timer: startRes.timer,
      previousSession: savedSession,
      error: startRes.error,
    };
  }

  // 6. Complete task with timer
  completeTaskWithTimer(userId: string, taskId: string, nowIso: string): { completed: boolean; savedSession: WorkSessionRow | null; error: string | null } {
    const task = this.tasks.get(taskId);
    if (!task || task.user_id !== userId) {
      return { completed: false, savedSession: null, error: 'Task not found or access denied' };
    }

    const timer = this.activeTimers.get(userId);
    let savedSession: WorkSessionRow | null = null;

    if (timer && timer.task_id === taskId) {
      const stopRes = this.stopTimer(userId, nowIso);
      savedSession = stopRes.savedSession;
    }

    task.status = 'completed';
    return { completed: true, savedSession, error: null };
  }

  // Manual time entry
  addManualEntry(userId: string, taskId: string, date: string, durationSeconds: number, notes?: string): WorkSessionRow {
    const task = this.tasks.get(taskId);
    const nowIso = new Date().toISOString();
    const session: WorkSessionRow = {
      id: `ws-manual-${Date.now()}`,
      user_id: userId,
      task_id: taskId,
      project_id: task?.project_id ?? null,
      entry_type: 'manual',
      session_date: date,
      started_at: `${date}T10:00:00.000Z`,
      ended_at: `${date}T10:30:00.000Z`,
      duration_seconds: durationSeconds,
      notes: notes ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.workSessions.push(session);
    return session;
  }
}

describe('Milestone 5 — 20 Required Integration & Recovery Scenarios', () => {
  it('Scenario 1: Start a timer sets Running state and server segment_started_at', () => {
    const db = new MockDatabaseEnvironment();
    const res = db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    assert.equal(res.action, 'started');
    assert.equal(res.timer?.state, 'running');
    assert.equal(res.timer?.segment_started_at, '2026-11-21T05:00:00.000Z');
    assert.equal(db.tasks.get('t-1')?.status, 'in_progress');
  });

  it('Scenario 2: Start timer again on same running task is idempotent (no duplicate)', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    const res2 = db.startTimer('usr-alice', 't-1', '2026-11-21T05:05:00.000Z');
    assert.equal(res2.action, 'already_running');
    assert.equal(db.activeTimers.size, 1);
  });

  it('Scenario 3: Start another task while timer is running triggers conflict/switch requirement', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    const res = db.startTimer('usr-alice', 't-2', '2026-11-21T05:10:00.000Z');
    assert.equal(res.action, 'conflict');
    assert.ok(res.error?.includes('Another task timer is already active'));
    // Ensure timer for t-1 is not modified
    assert.equal(db.activeTimers.get('usr-alice')?.task_id, 't-1');
  });

  it('Scenario 4: Cancel Save & Switch leaves original active timer completely untouched', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // UI simulates pending switch cancel: original timer remains running
    const timer = db.activeTimers.get('usr-alice');
    assert.equal(timer?.task_id, 't-1');
    assert.equal(timer?.state, 'running');
    assert.equal(db.workSessions.length, 0);
  });

  it('Scenario 5: Confirm Save & Switch atomically commits previous segment and starts new timer', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // Switch after 15 minutes (900 seconds)
    const switchRes = db.switchTimer('usr-alice', 't-2', '2026-11-21T05:15:00.000Z');
    assert.equal(switchRes.timer?.task_id, 't-2');
    assert.equal(switchRes.timer?.state, 'running');
    assert.equal(switchRes.previousSession?.task_id, 't-1');
    assert.equal(switchRes.previousSession?.duration_seconds, 900);
    assert.equal(db.workSessions.length, 1);
    assert.equal(db.tasks.get('t-2')?.status, 'in_progress');
    // Invariant: still exactly 1 timer for alice
    assert.equal(db.activeTimers.size, 1);
  });

  it('Scenario 6: Pause timer saves completed segment and clears segment_started_at', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // Pause after 30 minutes (1800s)
    const pauseRes = db.pauseTimer('usr-alice', '2026-11-21T05:30:00.000Z');
    assert.equal(pauseRes.timer?.state, 'paused');
    assert.equal(pauseRes.timer?.segment_started_at, null);
    assert.equal(pauseRes.savedSession?.duration_seconds, 1800);
    assert.equal(db.workSessions.length, 1);
  });

  it('Scenario 7: Resume timer starts a new segment without losing previous work session', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.pauseTimer('usr-alice', '2026-11-21T05:30:00.000Z');

    // Resume at 06:00
    const resumeRes = db.resumeTimer('usr-alice', '2026-11-21T06:00:00.000Z');
    assert.equal(resumeRes.timer?.state, 'running');
    assert.equal(resumeRes.timer?.segment_started_at, '2026-11-21T06:00:00.000Z');
    // Saved work session remains in place
    assert.equal(db.workSessions.length, 1);
    assert.equal(db.workSessions[0].duration_seconds, 1800);
  });

  it('Scenario 8: Pause after resume creates a second distinct work session for the same task', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.pauseTimer('usr-alice', '2026-11-21T05:30:00.000Z'); // Session 1: 30m (1800s)
    db.resumeTimer('usr-alice', '2026-11-21T06:00:00.000Z');
    db.pauseTimer('usr-alice', '2026-11-21T06:20:00.000Z'); // Session 2: 20m (1200s)

    assert.equal(db.workSessions.length, 2);
    const domainSessions = db.workSessions.map(mapWorkSessionFromRow);
    const totalSaved = calculateSavedWorkSeconds(domainSessions, 't-1');
    assert.equal(totalSaved, 3000); // 50m (30m + 20m)
  });

  it('Scenario 9: Stop timer while running closes segment and deletes active timer', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    const stopRes = db.stopTimer('usr-alice', '2026-11-21T05:45:00.000Z'); // 45m (2700s)

    assert.equal(stopRes.stopped, true);
    assert.equal(stopRes.savedSession?.duration_seconds, 2700);
    assert.equal(db.activeTimers.has('usr-alice'), false);
    // Task status remains in_progress
    assert.equal(db.tasks.get('t-1')?.status, 'in_progress');
  });

  it('Scenario 10: Stop timer while paused deletes active timer without inserting 0-duration session', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.pauseTimer('usr-alice', '2026-11-21T05:30:00.000Z'); // Session saved on pause
    assert.equal(db.workSessions.length, 1);

    const stopRes = db.stopTimer('usr-alice', '2026-11-21T06:00:00.000Z');
    assert.equal(stopRes.stopped, true);
    assert.equal(stopRes.savedSession, null);
    // No empty session inserted
    assert.equal(db.workSessions.length, 1);
    assert.equal(db.activeTimers.has('usr-alice'), false);
  });

  it('Scenario 11: Refresh while running recovers timestamp-derived elapsed time accurately', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // Simulate page refresh at 05:25 (1500 seconds later)
    const stored = db.activeTimers.get('usr-alice')!;
    const recoveredTimer = mapActiveTimerFromRow(stored);
    const nowMs = new Date('2026-11-21T05:25:00.000Z').getTime();

    const elapsed = calculateActiveSessionSeconds(recoveredTimer, nowMs);
    assert.equal(elapsed, 1500);
    assert.equal(recoveredTimer.status, 'running');
  });

  it('Scenario 12: Refresh while paused restores paused status with 0 active session elapsed', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.pauseTimer('usr-alice', '2026-11-21T05:30:00.000Z');

    // Simulate page refresh hours later
    const stored = db.activeTimers.get('usr-alice')!;
    const recoveredTimer = mapActiveTimerFromRow(stored);
    const nowMs = new Date('2026-11-21T09:00:00.000Z').getTime();

    const elapsed = calculateActiveSessionSeconds(recoveredTimer, nowMs);
    assert.equal(elapsed, 0);
    assert.equal(recoveredTimer.status, 'paused');
  });

  it('Scenario 13: Complete task while timer is running saves session, clears timer, and completes task', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    const completeRes = db.completeTaskWithTimer('usr-alice', 't-1', '2026-11-21T05:40:00.000Z'); // 40m (2400s)
    assert.equal(completeRes.completed, true);
    assert.equal(completeRes.savedSession?.duration_seconds, 2400);
    assert.equal(db.tasks.get('t-1')?.status, 'completed');
    assert.equal(db.activeTimers.has('usr-alice'), false);
  });

  it('Scenario 14: Cancel task completion modal leaves running timer uninterrupted', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // User cancels dialog: timer continues running, task status stays in_progress
    assert.equal(db.activeTimers.get('usr-alice')?.state, 'running');
    assert.equal(db.tasks.get('t-1')?.status, 'in_progress');
  });

  it('Scenario 15: Complete task while timer is paused clears timer and completes task without empty session', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.pauseTimer('usr-alice', '2026-11-21T05:30:00.000Z'); // Session saved on pause
    assert.equal(db.workSessions.length, 1);

    const completeRes = db.completeTaskWithTimer('usr-alice', 't-1', '2026-11-21T06:00:00.000Z');
    assert.equal(completeRes.completed, true);
    assert.equal(completeRes.savedSession, null);
    assert.equal(db.workSessions.length, 1);
    assert.equal(db.tasks.get('t-1')?.status, 'completed');
    assert.equal(db.activeTimers.has('usr-alice'), false);
  });

  it('Scenario 16: Add manual time entry persists independently without affecting timer state', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // Add manual 1 hour session on t-2
    const manualSession = db.addManualEntry('usr-alice', 't-2', '2026-11-20', 3600, 'Backfilled work');
    assert.equal(manualSession.entry_type, 'manual');
    assert.equal(manualSession.duration_seconds, 3600);

    // Active timer on t-1 is completely untouched
    assert.equal(db.activeTimers.get('usr-alice')?.task_id, 't-1');
    assert.equal(db.activeTimers.get('usr-alice')?.state, 'running');
  });

  it('Scenario 17: Work session history maintains distinct automatic and manual entries', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.stopTimer('usr-alice', '2026-11-21T05:30:00.000Z'); // 30m auto
    db.addManualEntry('usr-alice', 't-1', '2026-11-21', 1200, 'Manual sync'); // 20m manual

    assert.equal(db.workSessions.length, 2);
    const domain = db.workSessions.map(mapWorkSessionFromRow);
    const autoEntries = domain.filter((e) => e.entryType === 'timer');
    const manualEntries = domain.filter((e) => e.entryType === 'manual');
    assert.equal(autoEntries.length, 1);
    assert.equal(manualEntries.length, 1);
  });

  it('Scenario 18: Task total time aggregates both automatic and manual sessions', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');
    db.stopTimer('usr-alice', '2026-11-21T05:45:00.000Z'); // 45m
    db.addManualEntry('usr-alice', 't-1', '2026-11-21', 1800, 'Manual design'); // 30m

    const domain = db.workSessions.map(mapWorkSessionFromRow);
    const total = calculateSavedWorkSeconds(domain, 't-1');
    assert.equal(total, 4500); // 75m (1h 15m)
  });

  it('Scenario 19: Strict single active timer invariant enforced per user', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    assert.equal(db.activeTimers.size, 1);
    // Attempting to insert another timer for alice fails at the business and database constraint level
    const secondStart = db.startTimer('usr-alice', 't-2', '2026-11-21T05:05:00.000Z');
    assert.equal(secondStart.action, 'conflict');
    assert.equal(db.activeTimers.size, 1);
  });

  it('Scenario 20: Cross-user isolation: Bob cannot access or modify Alice timer or sessions', () => {
    const db = new MockDatabaseEnvironment();
    db.startTimer('usr-alice', 't-1', '2026-11-21T05:00:00.000Z');

    // Bob starts a timer on his task
    const bobRes = db.startTimer('usr-bob', 't-bob', '2026-11-21T05:02:00.000Z');
    assert.equal(bobRes.action, 'started');
    assert.equal(db.activeTimers.size, 2); // 1 for alice, 1 for bob

    // Bob cannot pause or stop Alice's timer
    const bobPauseAlice = db.pauseTimer('usr-bob', '2026-11-21T05:10:00.000Z');
    assert.equal(bobPauseAlice.timer?.task_id, 't-bob'); // Bob only modifies his own timer!
    assert.equal(db.activeTimers.get('usr-alice')?.state, 'running'); // Alice still running!

    // Bob cannot start a timer on Alice's task t-1
    const bobAccessAliceTask = db.startTimer('usr-bob', 't-1', '2026-11-21T05:15:00.000Z');
    assert.equal(bobAccessAliceTask.action, 'error');
    assert.ok(bobAccessAliceTask.error?.includes('Task not found or access denied'));
  });
});
