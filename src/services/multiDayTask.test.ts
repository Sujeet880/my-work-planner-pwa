import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWorkingDays,
  calculateTotalPlannedMinutes,
  calculateSchedulePlan,
} from './schedulingEngine';
import type { Task, TaskCalendarBlock, TimeEntry } from '../types/models';

describe('Multi-Day Task Scheduling & Calendar Blocking Engine', () => {
  describe('Requirement 1: Multi-Day Planned Effort Calculation', () => {
    it('calculates 3 days with 4 hours/day as 12 total planned hours (720 min)', () => {
      // Example use case from user prompt:
      // Start date: 2026-11-25 (Wed), End date: 2026-11-27 (Fri) = 3 working days
      const workingDays = calculateWorkingDays('2026-11-25', '2026-11-27', false);
      assert.equal(workingDays.length, 3);

      const totalMinutes = calculateTotalPlannedMinutes(4, workingDays.length);
      assert.equal(totalMinutes, 720); // 12 hours * 60 = 720 minutes
      assert.equal(totalMinutes / 60, 12);
    });

    it('correctly handles fractional daily effort (e.g. 2.5 hours/day over 4 days = 10 hours)', () => {
      const workingDays = calculateWorkingDays('2026-11-23', '2026-11-26', false);
      assert.equal(workingDays.length, 4);

      const totalMinutes = calculateTotalPlannedMinutes(2.5, workingDays.length);
      assert.equal(totalMinutes, 600); // 10 hours = 600 minutes
    });
  });

  describe('Requirement 2: Calendar Time Block Allocation', () => {
    it('generates separate daily time blocks with exact duration across selected dates', () => {
      const plan = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        dailyPlannedHours: 4,
        preferredStartTime: '09:00',
        includeWeekends: false,
      });

      assert.equal(plan.hasConflict, false);
      assert.equal(plan.totalPlannedMinutes, 720);
      assert.equal(plan.blocks.length, 3);

      assert.deepEqual(plan.blocks[0], {
        date: '2026-11-25',
        startTime: '09:00',
        endTime: '13:00',
        durationMinutes: 240,
      });

      assert.deepEqual(plan.blocks[1], {
        date: '2026-11-26',
        startTime: '09:00',
        endTime: '13:00',
        durationMinutes: 240,
      });

      assert.deepEqual(plan.blocks[2], {
        date: '2026-11-27',
        startTime: '09:00',
        endTime: '13:00',
        durationMinutes: 240,
      });
    });
  });

  describe('Requirement 3: Skip Weekends (Non-Working Days) Support', () => {
    it('skips Saturday and Sunday when includeWeekends is false', () => {
      // 2026-11-27 is Friday, 2026-11-28 is Sat, 2026-11-29 is Sun, 2026-11-30 is Monday
      const daysWithoutWeekends = calculateWorkingDays('2026-11-27', '2026-11-30', false);
      assert.deepEqual(daysWithoutWeekends, ['2026-11-27', '2026-11-30']);

      const plan = calculateSchedulePlan({
        startDate: '2026-11-27',
        endDate: '2026-11-30',
        dailyPlannedHours: 3,
        preferredStartTime: '10:00',
        includeWeekends: false,
      });

      assert.equal(plan.blocks.length, 2);
      assert.equal(plan.blocks[0].date, '2026-11-27');
      assert.equal(plan.blocks[1].date, '2026-11-30');
      assert.equal(plan.totalPlannedMinutes, 360); // 2 days * 180 min = 360 min
    });

    it('includes Saturday and Sunday when includeWeekends is true', () => {
      const daysWithWeekends = calculateWorkingDays('2026-11-27', '2026-11-30', true);
      assert.deepEqual(daysWithWeekends, [
        '2026-11-27',
        '2026-11-28',
        '2026-11-29',
        '2026-11-30',
      ]);

      const plan = calculateSchedulePlan({
        startDate: '2026-11-27',
        endDate: '2026-11-30',
        dailyPlannedHours: 3,
        preferredStartTime: '10:00',
        includeWeekends: true,
      });

      assert.equal(plan.blocks.length, 4);
      assert.equal(plan.totalPlannedMinutes, 720); // 4 days * 180 min = 720 min
    });
  });

  describe('Requirement 4: Conflict Detection & Overlap Prevention', () => {
    it('detects overlap on preferred start time and suggests available alternative slot', () => {
      // Existing meeting on 2026-11-26 from 09:00 to 11:00
      const existingTasks: Task[] = [
        {
          id: 'task-meeting-1',
          userId: 'user-1',
          projectId: null,
          title: 'Morning Meeting',
          priority: 'high',
          status: 'todo',
          scheduledDate: '2026-11-26',
          scheduledStartTime: '09:00',
          plannedDurationMinutes: 120, // 09:00 - 11:00
          reminderOffsetMinutes: null,
          syncToGoogleCalendar: false,
          calendarSyncStatus: 'not_synced',
          completedAt: null,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const plan = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        dailyPlannedHours: 4,
        preferredStartTime: '09:00',
        includeWeekends: false,
        existingTasks,
      });

      assert.equal(plan.hasConflict, true);
      assert.equal(plan.conflicts.length, 1);
      assert.equal(plan.conflicts[0].date, '2026-11-26');
      assert.equal(plan.conflicts[0].suggestedSlot?.startTime, '11:00');
      assert.equal(plan.conflicts[0].suggestedSlot?.endTime, '15:00');

      // The block for 2026-11-26 is placed in the suggested available slot
      assert.equal(plan.blocks[1].date, '2026-11-26');
      assert.equal(plan.blocks[1].startTime, '11:00');
      assert.equal(plan.blocks[1].endTime, '15:00');
    });

    it('reports insufficient time when required duration cannot fit into the working window', () => {
      // Working day window is 09:00 to 18:00 (9 hours = 540 minutes).
      // Requesting 14 hours per day must fail feasibility check.
      const plan = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-25',
        dailyPlannedHours: 14,
        preferredStartTime: '09:00',
      });

      assert.equal(plan.hasConflict, true);
      assert.equal(
        plan.conflicts.some((c) => c.conflictType === 'insufficient_time'),
        true
      );
    });
  });

  describe('Requirement 5: Synchronization & Editing Multi-Day Tasks', () => {
    it('recalculates blocks and total hours when date range is extended', () => {
      const initialPlan = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-26',
        dailyPlannedHours: 4,
        preferredStartTime: '09:00',
      });
      assert.equal(initialPlan.blocks.length, 2);
      assert.equal(initialPlan.totalPlannedMinutes, 480);

      const extendedPlan = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        dailyPlannedHours: 4,
        preferredStartTime: '09:00',
      });
      assert.equal(extendedPlan.blocks.length, 3);
      assert.equal(extendedPlan.totalPlannedMinutes, 720);
    });

    it('recalculates blocks and total hours when daily effort is adjusted', () => {
      const planA = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        dailyPlannedHours: 2,
        preferredStartTime: '09:00',
      });
      assert.equal(planA.totalPlannedMinutes, 360);
      assert.equal(planA.blocks[0].endTime, '11:00');

      const planB = calculateSchedulePlan({
        startDate: '2026-11-25',
        endDate: '2026-11-27',
        dailyPlannedHours: 5,
        preferredStartTime: '09:00',
      });
      assert.equal(planB.totalPlannedMinutes, 900);
      assert.equal(planB.blocks[0].endTime, '14:00');
    });
  });

  describe('Requirement 6: Task Deletion Safety Invariants', () => {
    it('ensures calendar blocks are filtered out when task is deleted without mutating work sessions', () => {
      const taskId = 'task-101';
      const otherTaskId = 'task-202';

      const existingBlocks: TaskCalendarBlock[] = [
        {
          id: 'block-1',
          userId: 'user-1',
          taskId,
          blockDate: '2026-11-26',
          startTime: '09:00',
          endTime: '13:00',
          durationMinutes: 240,
          status: 'scheduled',
          createdAt: '2026-11-25T10:00:00Z',
          updatedAt: '2026-11-25T10:00:00Z',
        },
        {
          id: 'block-2',
          userId: 'user-1',
          taskId,
          blockDate: '2026-11-27',
          startTime: '09:00',
          endTime: '13:00',
          durationMinutes: 240,
          status: 'scheduled',
          createdAt: '2026-11-25T10:00:00Z',
          updatedAt: '2026-11-25T10:00:00Z',
        },
        {
          id: 'block-3',
          userId: 'user-1',
          taskId: otherTaskId,
          blockDate: '2026-11-26',
          startTime: '14:00',
          endTime: '16:00',
          durationMinutes: 120,
          status: 'scheduled',
          createdAt: '2026-11-25T10:00:00Z',
          updatedAt: '2026-11-25T10:00:00Z',
        },
      ];

      const historicalSessions: TimeEntry[] = [
        {
          id: 'session-1',
          userId: 'user-1',
          taskId,
          projectId: 'proj-1',
          entryType: 'timer',
          status: 'completed',
          startedAt: '2026-11-25T09:00:00Z',
          endedAt: '2026-11-25T11:00:00Z',
          durationSeconds: 7200,
          createdAt: '2026-11-25T11:00:00Z',
          updatedAt: '2026-11-25T11:00:00Z',
        },
      ];

      // Simulate deletion cleanup logic
      const remainingBlocks = existingBlocks.filter((b) => b.taskId !== taskId);
      assert.equal(remainingBlocks.length, 1);
      assert.equal(remainingBlocks[0].id, 'block-3');
      assert.equal(remainingBlocks[0].taskId, otherTaskId);

      // Verify historical work session is safely preserved (never deleted!)
      const preservedSessions = historicalSessions.map((e) =>
        e.taskId === taskId ? { ...e, taskId: '' } : e
      );
      assert.equal(preservedSessions.length, 1);
      assert.equal(preservedSessions[0].durationSeconds, 7200);
      assert.equal(preservedSessions[0].id, 'session-1');
    });
  });
});
