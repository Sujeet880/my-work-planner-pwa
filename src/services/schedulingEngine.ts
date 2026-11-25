/**
 * My Work Planner — Scheduling Engine
 * Multi-Day Task Scheduling, Working Days Calculation, Time Interval Math,
 * and Conflict Detection with Available Slot Search.
 */

import type { Task, TaskCalendarBlock } from '../types/models';

export interface TimeInterval {
  startMinutes: number; // minutes from midnight (0 - 1440)
  endMinutes: number;   // minutes from midnight
  sourceId?: string;
  sourceTitle?: string;
  type?: 'task' | 'calendar_block' | 'event';
}

export interface DayOccupancy {
  date: string; // YYYY-MM-DD
  occupiedIntervals: TimeInterval[];
  totalOccupiedMinutes: number;
}

export interface ConflictDetail {
  date: string;
  requestedStart: string;
  requestedEnd: string;
  conflictType: 'overlap' | 'insufficient_time' | 'out_of_bounds';
  conflictingTitle?: string;
  conflictingTime?: string;
  availableMinutes: number;
  suggestedSlot?: { startTime: string; endTime: string } | null;
  message: string;
}

export interface ScheduleCalculationResult {
  hasConflict: boolean;
  workingDays: string[];
  totalPlannedMinutes: number;
  dailyDurationMinutes: number;
  conflicts: ConflictDetail[];
  blocks: Array<{
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }>;
}

export const DEFAULT_WORKING_START = '09:00';
export const DEFAULT_WORKING_END = '18:00';

/**
 * Converts HH:mm string to minutes from midnight (0 - 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.min(1439, Math.max(0, h * 60 + m));
}

/**
 * Converts minutes from midnight to HH:mm string format.
 */
export function minutesToTimeString(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.round(minutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Checks whether a given ISO date (YYYY-MM-DD) falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(dateIso: string): boolean {
  if (!dateIso) return false;
  const [y, m, d] = dateIso.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const day = dateObj.getUTCDay();
  return day === 0 || day === 6; // 0 = Sun, 6 = Sat
}

/**
 * Computes an ordered array of dates between startDate and endDate (inclusive).
 * Optionally excludes weekends (Saturday and Sunday).
 */
export function calculateWorkingDays(
  startDate: string,
  endDate?: string | null,
  includeWeekends: boolean = false
): string[] {
  if (!startDate) return [];
  const start = startDate.trim();
  const end = endDate && endDate.trim() ? endDate.trim() : start;

  if (start > end) {
    return isWeekend(start) && !includeWeekends ? [] : [start];
  }

  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);

  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));

  const days: string[] = [];
  while (cur <= last) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayOfWeek = cur.getUTCDay();
    const isWk = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWk || includeWeekends) {
      days.push(dateStr);
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return days;
}

/**
 * Calculates total planned minutes given daily hours and working day count.
 */
export function calculateTotalPlannedMinutes(
  dailyHours: number,
  workingDaysCount: number
): number {
  if (dailyHours <= 0 || workingDaysCount <= 0) return 0;
  return Math.round(dailyHours * 60 * workingDaysCount);
}

/**
 * Checks if two intervals overlap.
 * Overlap condition: startA < endB && endA > startB
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
}

/**
 * Merges and sorts overlapping or adjacent time intervals.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length <= 1) return [...intervals];
  const sorted = [...intervals].sort((a, b) => a.startMinutes - b.startMinutes);
  const merged: TimeInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, curr.endMinutes);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/**
 * Finds the first available slot of durationMinutes between workingStart and workingEnd.
 */
export function findAvailableSlot(
  occupied: TimeInterval[],
  durationMinutes: number,
  workingStartMinutes: number = 9 * 60,
  workingEndMinutes: number = 18 * 60
): { startMinutes: number; endMinutes: number } | null {
  const merged = mergeIntervals(occupied);

  let currentStart = workingStartMinutes;
  for (const block of merged) {
    // If the blocked interval is before our window, skip
    if (block.endMinutes <= currentStart) continue;

    // Check gap before this block
    const gap = Math.min(block.startMinutes, workingEndMinutes) - currentStart;
    if (gap >= durationMinutes) {
      return {
        startMinutes: currentStart,
        endMinutes: currentStart + durationMinutes,
      };
    }

    // Move search forward
    currentStart = Math.max(currentStart, block.endMinutes);
    if (currentStart >= workingEndMinutes) break;
  }

  // Check gap after last block until workingEnd
  if (workingEndMinutes - currentStart >= durationMinutes) {
    return {
      startMinutes: currentStart,
      endMinutes: currentStart + durationMinutes,
    };
  }

  return null;
}

/**
 * Compiles all occupied intervals on a specific date from existing tasks and calendar blocks.
 */
export function getOccupiedIntervalsForDate(
  dateIso: string,
  tasks: Task[],
  calendarBlocks: TaskCalendarBlock[],
  excludeTaskId?: string
): TimeInterval[] {
  const intervals: TimeInterval[] = [];

  // 1. Existing calendar blocks on this date
  for (const block of calendarBlocks) {
    if (block.blockDate === dateIso && block.taskId !== excludeTaskId) {
      const sm = timeStringToMinutes(block.startTime);
      const em = timeStringToMinutes(block.endTime);
      if (em > sm) {
        intervals.push({
          startMinutes: sm,
          endMinutes: em,
          sourceId: block.id,
          sourceTitle: `Scheduled Block (${minutesToTimeString(sm)} - ${minutesToTimeString(em)})`,
          type: 'calendar_block',
        });
      }
    }
  }

  // 2. Existing tasks scheduled on this date with start time
  for (const t of tasks) {
    if (
      t.id !== excludeTaskId &&
      !t.isArchived &&
      t.status !== 'completed' &&
      t.scheduledDate === dateIso &&
      t.scheduledStartTime
    ) {
      const sm = timeStringToMinutes(t.scheduledStartTime);
      const duration = t.plannedDurationMinutes && t.plannedDurationMinutes > 0
        ? t.plannedDurationMinutes
        : 60;
      const em = Math.min(1439, sm + duration);

      intervals.push({
        startMinutes: sm,
        endMinutes: em,
        sourceId: t.id,
        sourceTitle: t.title,
        type: 'task',
      });
    }
  }

  return intervals;
}

/**
 * Comprehensive Multi-Day Schedule Planning & Conflict Detection Engine.
 */
export function calculateSchedulePlan(params: {
  startDate: string;
  endDate?: string | null;
  dailyPlannedHours: number;
  preferredStartTime?: string | null;
  includeWeekends?: boolean;
  existingTasks?: Task[];
  existingBlocks?: TaskCalendarBlock[];
  excludeTaskId?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
}): ScheduleCalculationResult {
  const {
    startDate,
    endDate,
    dailyPlannedHours,
    preferredStartTime = DEFAULT_WORKING_START,
    includeWeekends = false,
    existingTasks = [],
    existingBlocks = [],
    excludeTaskId,
    workingHoursStart = DEFAULT_WORKING_START,
    workingHoursEnd = DEFAULT_WORKING_END,
  } = params;

  const workingDays = calculateWorkingDays(startDate, endDate, includeWeekends);
  const dailyDurationMinutes = Math.max(1, Math.round((dailyPlannedHours || 1) * 60));
  const totalPlannedMinutes = calculateTotalPlannedMinutes(dailyPlannedHours, workingDays.length);

  const workStartMin = timeStringToMinutes(workingHoursStart);
  const workEndMin = timeStringToMinutes(workingHoursEnd);
  const totalDailyWorkWindow = Math.max(0, workEndMin - workStartMin);

  const conflicts: ConflictDetail[] = [];
  const blocks: ScheduleCalculationResult['blocks'] = [];

  const baseStartTime = preferredStartTime && preferredStartTime.trim()
    ? preferredStartTime.trim()
    : workingHoursStart;
  const requestedStartMin = timeStringToMinutes(baseStartTime);
  const requestedEndMin = requestedStartMin + dailyDurationMinutes;

  for (const day of workingDays) {
    const occupied = getOccupiedIntervalsForDate(day, existingTasks, existingBlocks, excludeTaskId);
    const merged = mergeIntervals(occupied);

    // Calculate free minutes within the working hours window
    let occupiedInWindow = 0;
    for (const interval of merged) {
      const s = Math.max(workStartMin, interval.startMinutes);
      const e = Math.min(workEndMin, interval.endMinutes);
      if (e > s) {
        occupiedInWindow += (e - s);
      }
    }
    const availableMinutes = Math.max(0, totalDailyWorkWindow - occupiedInWindow);

    const requestedInterval: TimeInterval = {
      startMinutes: requestedStartMin,
      endMinutes: requestedEndMin,
    };

    // Check overlaps with requested interval
    const overlapping = occupied.filter((occ) => intervalsOverlap(requestedInterval, occ));

    if (dailyDurationMinutes > availableMinutes) {
      // Not enough hours in the entire working day
      const firstConflict = overlapping[0] || occupied[0];
      const conflictMsg = `On ${day}, only ${Math.floor(availableMinutes / 60)}h ${availableMinutes % 60}m are available within working hours (${workingHoursStart}–${workingHoursEnd}). Cannot fit ${dailyPlannedHours}h.`;
      
      conflicts.push({
        date: day,
        requestedStart: minutesToTimeString(requestedStartMin),
        requestedEnd: minutesToTimeString(requestedEndMin),
        conflictType: 'insufficient_time',
        conflictingTitle: firstConflict?.sourceTitle,
        conflictingTime: firstConflict ? `${minutesToTimeString(firstConflict.startMinutes)}–${minutesToTimeString(firstConflict.endMinutes)}` : undefined,
        availableMinutes,
        suggestedSlot: null,
        message: conflictMsg,
      });

      // Still provide block record for transparency
      blocks.push({
        date: day,
        startTime: minutesToTimeString(requestedStartMin),
        endTime: minutesToTimeString(requestedEndMin),
        durationMinutes: dailyDurationMinutes,
      });
    } else if (overlapping.length > 0) {
      // Overlap at preferred time, but day might have another slot available
      const altSlot = findAvailableSlot(occupied, dailyDurationMinutes, workStartMin, workEndMin);
      const firstOver = overlapping[0];
      const conflictMsg = `On ${day}, preferred time ${minutesToTimeString(requestedStartMin)}–${minutesToTimeString(requestedEndMin)} conflicts with "${firstOver.sourceTitle || 'another event'}" (${minutesToTimeString(firstOver.startMinutes)}–${minutesToTimeString(firstOver.endMinutes)}).`;

      conflicts.push({
        date: day,
        requestedStart: minutesToTimeString(requestedStartMin),
        requestedEnd: minutesToTimeString(requestedEndMin),
        conflictType: 'overlap',
        conflictingTitle: firstOver.sourceTitle,
        conflictingTime: `${minutesToTimeString(firstOver.startMinutes)}–${minutesToTimeString(firstOver.endMinutes)}`,
        availableMinutes,
        suggestedSlot: altSlot
          ? {
              startTime: minutesToTimeString(altSlot.startMinutes),
              endTime: minutesToTimeString(altSlot.endMinutes),
            }
          : null,
        message: conflictMsg,
      });

      // If an alternative slot was found, allocate it or keep requested with conflict flag
      blocks.push({
        date: day,
        startTime: altSlot ? minutesToTimeString(altSlot.startMinutes) : minutesToTimeString(requestedStartMin),
        endTime: altSlot ? minutesToTimeString(altSlot.endMinutes) : minutesToTimeString(requestedEndMin),
        durationMinutes: dailyDurationMinutes,
      });
    } else {
      // Clean slot without conflict
      blocks.push({
        date: day,
        startTime: minutesToTimeString(requestedStartMin),
        endTime: minutesToTimeString(requestedEndMin),
        durationMinutes: dailyDurationMinutes,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    workingDays,
    totalPlannedMinutes,
    dailyDurationMinutes,
    conflicts,
    blocks,
  };
}
