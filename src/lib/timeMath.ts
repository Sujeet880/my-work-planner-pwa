import type { ActiveTimerState, Task, TimeEntry } from '../types/models';

export interface TimeVarianceResult {
  plannedSeconds: number | null;
  actualSeconds: number;
  deltaSeconds: number | null;
  status: 'no_estimate' | 'under_plan' | 'on_target' | 'over_plan';
  label: string;
}

export interface ValidationErrors {
  [field: string]: string;
}

/**
 * Sums all saved (completed) work time entries for a task.
 * Strictly ignores running/paused entries so live time is never double-counted.
 */
export function calculateSavedWorkSeconds(
  timeEntries: readonly TimeEntry[],
  taskId?: string
): number {
  return timeEntries.reduce((total, entry) => {
    if (entry.status !== 'completed') return total;
    if (taskId && entry.taskId !== taskId) return total;
    const safeSeconds = Number.isFinite(entry.durationSeconds)
      ? Math.max(0, Math.floor(entry.durationSeconds))
      : 0;
    return total + safeSeconds;
  }, 0);
}

/**
 * Calculates elapsed seconds for the current active timer session from timestamps.
 * Never relies on client interval increments so tab throttling or reload stays accurate.
 */
export function calculateActiveSessionSeconds(
  activeTimer: ActiveTimerState | null,
  nowMs: number = Date.now()
): number {
  if (!activeTimer) return 0;
  const base = Math.max(0, Math.floor(activeTimer.accumulatedBeforeSegmentSeconds));
  if (activeTimer.status === 'paused' || activeTimer.status === 'recovering') {
    return base;
  }
  const segmentDelta = Math.max(0, Math.floor((nowMs - activeTimer.startedAtMs) / 1000));
  return base + segmentDelta;
}

/**
 * Calculates live actual time for a task without double counting:
 * Live Actual = Saved Work Time + (Current Active Session if this task is active)
 */
export function calculateLiveActualSeconds(
  timeEntries: readonly TimeEntry[],
  activeTimer: ActiveTimerState | null,
  taskId: string,
  nowMs: number = Date.now()
): number {
  const saved = calculateSavedWorkSeconds(timeEntries, taskId);
  const active =
    activeTimer && activeTimer.taskId === taskId
      ? calculateActiveSessionSeconds(activeTimer, nowMs)
      : 0;
  return saved + active;
}

/**
 * Compares Planned Duration (minutes) against Actual Tracked Seconds.
 * When a task has no planned estimate, explicitly returns 'no_estimate' instead of fabricated variance.
 */
export function calculateTimeVariance(
  plannedDurationMinutes: number | null,
  actualSeconds: number
): TimeVarianceResult {
  const safeActual = Math.max(0, Math.floor(actualSeconds));
  if (plannedDurationMinutes === null || plannedDurationMinutes <= 0) {
    return {
      plannedSeconds: null,
      actualSeconds: safeActual,
      deltaSeconds: null,
      status: 'no_estimate',
      label: 'No estimate',
    };
  }

  const plannedSeconds = Math.round(plannedDurationMinutes * 60);
  const deltaSeconds = safeActual - plannedSeconds;

  // Within ±60 seconds counts as On target
  if (Math.abs(deltaSeconds) < 60) {
    return {
      plannedSeconds,
      actualSeconds: safeActual,
      deltaSeconds: 0,
      status: 'on_target',
      label: 'On target',
    };
  }

  if (deltaSeconds > 0) {
    return {
      plannedSeconds,
      actualSeconds: safeActual,
      deltaSeconds,
      status: 'over_plan',
      label: `+${formatDuration(deltaSeconds)} over plan`,
    };
  }

  return {
    plannedSeconds,
    actualSeconds: safeActual,
    deltaSeconds,
    status: 'under_plan',
    label: `${formatDuration(Math.abs(deltaSeconds))} under plan`,
  };
}

/**
 * Formats seconds into human-readable duration (e.g., "1h 25m", "45m", "0m").
 */
export function formatDuration(totalSeconds: number, includeSecondsWhenShort = false): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  if (safe === 0) return '0m';

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h 00m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return includeSecondsWhenShort ? `${seconds}s` : '< 1m';
}

/**
 * Formats seconds strictly as HH:MM:SS for count-up timer displays.
 */
export function formatClockHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Returns local calendar date in YYYY-MM-DD format.
 */
export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-DD and HH:mm in the specified IANA timezone (defaults to runtime local timezone).
 */
export function getDateTimeInTimezone(
  date: Date = new Date(),
  timezone?: string
): { dateIso: string; timeHHMM: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      ...(timezone ? { timeZone: timezone } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hour = getPart('hour');
    const minute = getPart('minute');
    if (hour === '24') hour = '00';
    if (year && month && day && hour && minute) {
      return {
        dateIso: `${year}-${month}-${day}`,
        timeHHMM: `${hour}:${minute}`,
      };
    }
  } catch {
    // Fallback to runtime local timezone if timezone string is unsupported
  }

  return {
    dateIso: getLocalDateISO(date),
    timeHHMM: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

/**
 * Determines whether a calendar block is a future scheduled commitment
 * using the user's local timezone and the block's actual start time.
 */
export function isFutureCalendarBlock(
  block: {
    blockDate?: string;
    block_date?: string;
    startTime?: string;
    start_time?: string;
    status?: string;
  },
  now: Date = new Date(),
  timezone?: string
): boolean {
  if (block.status && block.status !== 'scheduled') return false;
  const blockDate = block.blockDate ?? block.block_date ?? '';
  const startTime = (block.startTime ?? block.start_time ?? '00:00').slice(0, 5);
  if (!blockDate) return false;

  const { dateIso: todayIso, timeHHMM } = getDateTimeInTimezone(now, timezone);
  if (blockDate > todayIso) return true;
  if (blockDate < todayIso) return false;
  return startTime > timeHHMM;
}

/**
 * Determines whether a task is overdue relative to today's YYYY-MM-DD date.
 * Completed, archived, and unscheduled Inbox tasks are never overdue.
 */
export function isTaskOverdue(task: Pick<Task, 'scheduledDate' | 'status' | 'isArchived'>, todayIso: string): boolean {
  if (task.status === 'completed' || task.isArchived || !task.scheduledDate) {
    return false;
  }
  return task.scheduledDate < todayIso;
}

/**
 * Validates Task create/edit inputs according to PRD Section 8.
 */
export function validateTaskInput(input: {
  title: string;
  scheduledDate: string;
  scheduledStartTime: string;
  plannedDurationMinutes: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const trimmedTitle = input.title.trim();

  if (!trimmedTitle) {
    errors.title = 'Task title is required.';
  } else if (trimmedTitle.length > 200) {
    errors.title = 'Task title must be 200 characters or fewer.';
  }

  if (input.scheduledStartTime.trim() && !input.scheduledDate.trim()) {
    errors.scheduledStartTime = 'Scheduled start time requires a scheduled date.';
  }

  if (input.plannedDurationMinutes.trim()) {
    const parsed = Number(input.plannedDurationMinutes);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      errors.plannedDurationMinutes = 'Planned duration must be a positive whole number of minutes.';
    } else if (parsed > 1440) {
      errors.plannedDurationMinutes = 'Planned duration cannot exceed 1,440 minutes (24 hours).';
    }
  }

  return errors;
}

/**
 * Validates manual time entry input according to PRD Section 9.5.
 */
export function validateManualTimeEntry(input: {
  taskId: string;
  date: string;
  inputMode: 'duration' | 'range';
  durationMinutes: string;
  startTime: string;
  endTime: string;
}): { errors: ValidationErrors; computedSeconds: number | null } {
  const errors: ValidationErrors = {};

  if (!input.taskId.trim()) {
    errors.taskId = 'Select a task for this work session.';
  }

  if (!input.date.trim()) {
    errors.date = 'Work date is required.';
  }

  if (input.inputMode === 'duration') {
    const mins = Number(input.durationMinutes);
    if (!input.durationMinutes.trim() || !Number.isFinite(mins) || mins <= 0) {
      errors.durationMinutes = 'Enter a positive duration in minutes.';
      return { errors, computedSeconds: null };
    }
    if (mins > 1440) {
      errors.durationMinutes = 'Duration cannot exceed 1,440 minutes (24 hours).';
      return { errors, computedSeconds: null };
    }
    return { errors, computedSeconds: Math.round(mins * 60) };
  }

  // Range mode
  if (!input.startTime.trim()) {
    errors.startTime = 'Start time is required.';
  }
  if (!input.endTime.trim()) {
    errors.endTime = 'End time is required.';
  }
  if (input.startTime && input.endTime) {
    const [sh, sm] = input.startTime.split(':').map(Number);
    const [eh, em] = input.endTime.split(':').map(Number);
    const startTotal = sh * 60 + sm;
    const endTotal = eh * 60 + em;
    if (endTotal <= startTotal) {
      errors.endTime = 'End time must be later than start time.';
      return { errors, computedSeconds: null };
    }
    return { errors, computedSeconds: (endTotal - startTotal) * 60 };
  }

  return { errors, computedSeconds: null };
}

/**
 * Validates email format for Magic Link Sign-In form.
 */
export function validateEmailFormat(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Enter your authorized email address.';
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return 'Enter a valid email address (for example, name@domain.com).';
  }
  return null;
}
