import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { Task, TaskReminder, ReminderStatus } from '../types/models';
import type { Database } from '../types/database.types';

type TaskReminderRow = Database['public']['Tables']['task_reminders']['Row'];

export function mapReminderFromRow(row: TaskReminderRow): TaskReminder {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    remindAt: row.remind_at,
    timezone: row.timezone,
    status: row.status as ReminderStatus,
    sentAt: row.sent_at,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CalculateReminderOptions {
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  reminderOffsetMinutes: number | null;
  customReminderTime?: string | null; // HH:mm for date-only tasks
  timezone?: string;
}

/**
 * Computes the target ISO timestamp for a task reminder.
 * Rules:
 * 1. Unscheduled tasks (Inbox) cannot have reminders -> returns null.
 * 2. If scheduledDate + scheduledStartTime exist:
 *    Calculates (scheduledDate + scheduledStartTime) minus reminderOffsetMinutes.
 * 3. If scheduledDate exists but scheduledStartTime is null (date-only task):
 *    Requires customReminderTime (explicit reminder time); NEVER defaults to midnight (00:00).
 *    If no customReminderTime provided, returns null.
 * 4. If reminderOffsetMinutes is null/undefined and no custom time: returns null.
 */
export function calculateReminderTime(options: CalculateReminderOptions): string | null {
  const { scheduledDate, scheduledStartTime, reminderOffsetMinutes, customReminderTime } = options;

  if (!scheduledDate) {
    return null;
  }

  // Case A: Date + Start Time
  if (scheduledStartTime) {
    if (reminderOffsetMinutes === null || reminderOffsetMinutes === undefined) {
      return null;
    }

    const [hours, minutes] = scheduledStartTime.split(':').map((num) => parseInt(num, 10));
    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    const isUtc = options.timezone === 'UTC';
    const timeString = isUtc ? `${scheduledDate}T${scheduledStartTime}:00Z` : `${scheduledDate}T${scheduledStartTime}:00`;
    const targetDate = new Date(timeString);
    if (isNaN(targetDate.getTime())) {
      return null;
    }

    // Subtract reminder offset minutes
    const reminderEpochMs = targetDate.getTime() - reminderOffsetMinutes * 60 * 1000;
    return new Date(reminderEpochMs).toISOString();
  }

  // Case B: Date-Only task -> requires explicit reminder time, never midnight!
  if (customReminderTime && customReminderTime.trim()) {
    const trimmedTime = customReminderTime.trim();
    const [hours, minutes] = trimmedTime.split(':').map((num) => parseInt(num, 10));
    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    const isUtc = options.timezone === 'UTC';
    const timeString = isUtc ? `${scheduledDate}T${trimmedTime}:00Z` : `${scheduledDate}T${trimmedTime}:00`;
    const targetDate = new Date(timeString);
    if (isNaN(targetDate.getTime())) {
      return null;
    }

    const offset = reminderOffsetMinutes ?? 0;
    const reminderEpochMs = targetDate.getTime() - offset * 60 * 1000;
    return new Date(reminderEpochMs).toISOString();
  }

  return null;
}

/**
 * Checks whether a reminder timestamp is in the future.
 */
export function isReminderInFuture(remindAtIso: string, referenceTimeMs: number = Date.now()): boolean {
  const remindTime = new Date(remindAtIso).getTime();
  return !isNaN(remindTime) && remindTime > referenceTimeMs;
}

export const reminderService = {
  /**
   * Fetches active or historical reminders for a task.
   */
  async fetchTaskReminder(
    taskId: string
  ): Promise<{ data: TaskReminder | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('task_reminders')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: data ? mapReminderFromRow(data) : null,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch reminder',
      };
    }
  },

  /**
   * Schedules or updates a reminder for a task via database RPC.
   */
  async scheduleReminder(
    taskId: string,
    remindAtIso: string,
    timezone: string = 'UTC'
  ): Promise<{ data: TaskReminder | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase.rpc('upsert_task_reminder', {
        p_task_id: taskId,
        p_remind_at: remindAtIso,
        p_timezone: timezone,
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: data ? mapReminderFromRow(data as TaskReminderRow) : null,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to schedule reminder',
      };
    }
  },

  /**
   * Cancels any scheduled reminder for a task.
   */
  async cancelReminder(taskId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase.rpc('cancel_task_reminder', {
        p_task_id: taskId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: Boolean(data), error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel reminder',
      };
    }
  },

  /**
   * Syncs reminder lifecycle during task creation, edit, rescheduling, reopen, or inbox move.
   */
  async syncReminderOnTaskChange(
    task: Task,
    options?: {
      previousTask?: Task | null;
      customReminderTime?: string | null;
      timezone?: string;
    }
  ): Promise<{ scheduled: boolean; error: string | null }> {
    // Rule 1: Completed, archived, or unscheduled tasks must not have active reminders
    if (task.status === 'completed' || task.isArchived || !task.scheduledDate) {
      await this.cancelReminder(task.id);
      return { scheduled: false, error: null };
    }

    // Rule 2: If task has no reminder offset, cancel any existing reminder
    if (task.reminderOffsetMinutes === null || task.reminderOffsetMinutes === undefined) {
      await this.cancelReminder(task.id);
      return { scheduled: false, error: null };
    }

    // Rule 3: Compute target reminder time
    const remindAtIso = calculateReminderTime({
      scheduledDate: task.scheduledDate,
      scheduledStartTime: task.scheduledStartTime,
      reminderOffsetMinutes: task.reminderOffsetMinutes,
      customReminderTime: options?.customReminderTime,
      timezone: options?.timezone,
    });

    if (!remindAtIso) {
      await this.cancelReminder(task.id);
      return { scheduled: false, error: null };
    }

    // Rule 4: Only schedule if target time is in the future
    if (!isReminderInFuture(remindAtIso)) {
      // If time has already passed, cancel existing scheduled reminder
      await this.cancelReminder(task.id);
      return { scheduled: false, error: null };
    }

    const { data, error } = await this.scheduleReminder(
      task.id,
      remindAtIso,
      options?.timezone || 'UTC'
    );

    return {
      scheduled: Boolean(data),
      error,
    };
  },
};
