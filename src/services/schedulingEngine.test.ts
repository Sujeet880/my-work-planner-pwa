import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWorkingDays,
  calculateTotalPlannedMinutes,
  calculateSchedulePlan,
  intervalsOverlap,
  findAvailableSlot,
  timeStringToMinutes,
  minutesToTimeString,
  isWeekend,
} from './schedulingEngine';
import type { Task, TaskCalendarBlock } from '../types/models';

describe('Multi-Day Scheduling Engine — Working Days & Math', () => {
  it('Scenario 1 & 2: Correctly calculates 3 working days and 12 total planned hours', () => {
    // 26 Nov 2026 (Thursday) to 28 Nov 2026 (Saturday)
    // If including weekends or weekdays: 2026-11-24 (Tue) to 2026-11-26 (Thu) is 3 business days
    const days = calculateWorkingDays('2026-11-24', '2026-11-26', false);
    assert.deepEqual(days, ['2026-11-24', '2026-11-25', '2026-11-26']);
    assert.equal(days.length, 3);

    const totalMinutes = calculateTotalPlannedMinutes(4, days.length);
    assert.equal(totalMinutes, 720); // 12 hours * 60 = 720
    assert.equal(totalMinutes / 60, 12);
  });

  it('Excludes weekends by default when includeWeekends is false', () => {
    // 2026-11-27 (Friday) to 2026-11-30 (Monday)
    // Friday (27), Saturday (28), Sunday (29), Monday (30)
    const weekdaysOnly = calculateWorkingDays('2026-11-27', '2026-11-30', false);
    assert.deepEqual(weekdaysOnly, ['2026-11-27', '2026-11-30']);
    assert.equal(weekdaysOnly.length, 2);

    const withWeekends = calculateWorkingDays('2026-11-27', '2026-11-30', true);
    assert.deepEqual(withWeekends, ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']);
    assert.equal(withWeekends.length, 4);
  });

  it('Handles single day scheduling cleanly', () => {
    const days = calculateWorkingDays('2026-11-25', '2026-11-25', false);
    assert.deepEqual(days, ['2026-11-25']);
    assert.equal(days.length, 1);

    const totalMinutes = calculateTotalPlannedMinutes(3.5, days.length);
    assert.equal(totalMinutes, 210); // 3.5 hours = 210 min
  });

  it('Converts time strings and minutes accurately', () => {
    assert.equal(timeStringToMinutes('09:00'), 540);
    assert.equal(timeStringToMinutes('13:30'), 810);
    assert.equal(minutesToTimeString(540), '09:00');
    assert.equal(minutesToTimeString(810), '13:30');
  });

  it('Correctly identifies weekends', () => {
    assert.equal(isWeekend('2026-11-28'), true); // Saturday
    assert.equal(isWeekend('2026-11-29'), true); // Sunday
    assert.equal(isWeekend('2026-11-27'), false); // Friday
    assert.equal(isWeekend('2026-11-30'), false); // Monday
  });
});

describe('Multi-Day Scheduling Engine — Conflict Detection & Slot Allocation', () => {
  it('Scenario 3 & 4: Generates separate 4-hour calendar blocks for each scheduled date linked to task', () => {
    const result = calculateSchedulePlan({
      startDate: '2026-11-24',
      endDate: '2026-11-26',
      dailyPlannedHours: 4,
      preferredStartTime: '09:00',
      includeWeekends: false,
    });

    assert.equal(result.hasConflict, false);
    assert.equal(result.workingDays.length, 3);
    assert.equal(result.totalPlannedMinutes, 720);
    assert.equal(result.blocks.length, 3);

    assert.deepEqual(result.blocks[0], {
      date: '2026-11-24',
      startTime: '09:00',
      endTime: '13:00',
      durationMinutes: 240,
    });
    assert.deepEqual(result.blocks[1], {
      date: '2026-11-25',
      startTime: '09:00',
      endTime: '13:00',
      durationMinutes: 240,
    });
    assert.deepEqual(result.blocks[2], {
      date: '2026-11-26',
      startTime: '09:00',
      endTime: '13:00',
      durationMinutes: 240,
    });
  });

  it('Scenario 5 & 6: Detects conflict when existing event overlaps preferred time and suggests alternative slot', () => {
    // Existing task on 2026-11-25 from 09:00 to 11:00
    const existingTasks: Task[] = [
      {
        id: 'task-existing-1',
        userId: 'user-1',
        projectId: null,
        title: 'Team Standup & Review',
        priority: 'high',
        status: 'todo',
        scheduledDate: '2026-11-25',
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

    const result = calculateSchedulePlan({
      startDate: '2026-11-24',
      endDate: '2026-11-26',
      dailyPlannedHours: 4,
      preferredStartTime: '09:00',
      existingTasks,
    });

    assert.equal(result.hasConflict, true);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].date, '2026-11-25');
    assert.equal(result.conflicts[0].conflictType, 'overlap');
    assert.equal(result.conflicts[0].conflictingTitle, 'Team Standup & Review');
    assert.ok(result.conflicts[0].suggestedSlot !== null);
    // Suggested slot starts after existing task (at 11:00)
    assert.equal(result.conflicts[0].suggestedSlot?.startTime, '11:00');
    assert.equal(result.conflicts[0].suggestedSlot?.endTime, '15:00');
  });

  it('Detects insufficient available time when working day cannot fit requested hours', () => {
    // Existing blocks occupy 09:00 - 16:00 (7 hours). Working window is 09:00 - 18:00 (9 hours).
    // Only 2 hours remaining in the day.
    const existingBlocks: TaskCalendarBlock[] = [
      {
        id: 'block-1',
        userId: 'user-1',
        taskId: 'task-other',
        blockDate: '2026-11-25',
        startTime: '09:00',
        endTime: '16:00',
        durationMinutes: 420,
        status: 'scheduled',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const result = calculateSchedulePlan({
      startDate: '2026-11-25',
      endDate: '2026-11-25',
      dailyPlannedHours: 4, // Requests 4 hours, but only 2 hours available
      preferredStartTime: '09:00',
      existingBlocks,
    });

    assert.equal(result.hasConflict, true);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0].conflictType, 'insufficient_time');
    assert.equal(result.conflicts[0].availableMinutes, 120); // 2 hours
    assert.ok(result.conflicts[0].message.includes('only 2h 0m are available'));
  });

  it('findAvailableSlot finds earliest gap in occupied intervals', () => {
    const occupied = [
      { startMinutes: 540, endMinutes: 660 }, // 09:00 - 11:00
      { startMinutes: 720, endMinutes: 840 }, // 12:00 - 14:00
    ];

    // Gap between 11:00 (660) and 12:00 (720) is 60 min. If we request 90 min:
    const slot90 = findAvailableSlot(occupied, 90, 540, 1080);
    // Gap 11:00-12:00 is only 60m, so it should place after 14:00 (840)
    assert.deepEqual(slot90, { startMinutes: 840, endMinutes: 930 }); // 14:00 - 15:30

    // If we request 60 min, it should fit in the 11:00-12:00 gap:
    const slot60 = findAvailableSlot(occupied, 60, 540, 1080);
    assert.deepEqual(slot60, { startMinutes: 660, endMinutes: 720 }); // 11:00 - 12:00
  });
});
