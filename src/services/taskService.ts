import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type {
  CalendarSyncStatus,
  Task,
  TaskFormValues,
  TaskPriority,
  TaskStatus,
} from '../types/models';
import type { Database } from '../types/database.types';
import { calendarService } from './calendarService';
import { reminderService } from './reminderService';

type TaskRow = Database['public']['Tables']['tasks']['Row'];

/**
 * Maps a database task row into the application domain model.
 */
export function mapTaskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    scheduledDate: row.scheduled_date,
    scheduledStartTime: row.scheduled_start_time,
    plannedDurationMinutes: row.planned_duration_minutes,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    syncToGoogleCalendar: row.sync_to_google_calendar,
    calendarSyncStatus: row.calendar_sync_status as CalendarSyncStatus,
    completedAt: row.completed_at,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const taskService = {
  /**
   * Fetches all tasks belonging to the authenticated user.
   */
  async fetchTasks(userId: string): Promise<{ data: Task[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: (data ?? []).map(mapTaskFromRow),
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch tasks',
      };
    }
  },

  /**
   * Creates a new task in Supabase for the authenticated user.
   */
  async createTask(
    userId: string,
    values: TaskFormValues
  ): Promise<{ data: Task | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    const trimmedTitle = values.title.trim();
    if (!trimmedTitle) {
      return { data: null, error: 'Task title is required' };
    }

    const scheduledDate = values.scheduledDate.trim() || null;
    const scheduledStartTime = scheduledDate && values.scheduledStartTime.trim()
      ? values.scheduledStartTime.trim()
      : null;

    const plannedMinutes = values.plannedDurationMinutes.trim()
      ? Math.max(1, parseInt(values.plannedDurationMinutes, 10) || 0)
      : null;

    const reminderOffset = values.reminderOffsetMinutes.trim()
      ? parseInt(values.reminderOffsetMinutes, 10) || null
      : null;

    const shouldSyncCalendar = values.syncToGoogleCalendar ?? Boolean(scheduledDate);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: trimmedTitle,
          description: values.description.trim() || null,
          project_id: values.projectId || null,
          priority: values.priority,
          status: 'todo',
          scheduled_date: scheduledDate,
          scheduled_start_time: scheduledStartTime,
          planned_duration_minutes: plannedMinutes,
          reminder_offset_minutes: reminderOffset,
          sync_to_google_calendar: shouldSyncCalendar,
          calendar_sync_status: shouldSyncCalendar && scheduledDate ? 'pending' : 'not_synced',
          completed_at: null,
          is_archived: false,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const task = data ? mapTaskFromRow(data) : null;
      if (task) {
        if (task.syncToGoogleCalendar && task.scheduledDate) {
          calendarService.queueSyncJob(task.id, 'upsert', task).catch((err) => {
            console.warn('Calendar sync job enqueue warning:', err);
          });
        } else if (!task.scheduledDate) {
          // Moved to inbox (Case E) - remove from Google Calendar
          calendarService.queueSyncJob(task.id, 'delete').catch((err) => {
            console.warn('Calendar delete sync enqueue warning:', err);
          });
        }
      }

      if (task && task.reminderOffsetMinutes !== null && task.scheduledDate) {
        reminderService
          .syncReminderOnTaskChange(task, {
            customReminderTime: values.reminderCustomTime,
          })
          .catch((err) => {
            console.warn('Reminder sync warning:', err);
          });
      }

      return {
        data: task,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to create task',
      };
    }
  },

  /**
   * Updates an existing task for the authenticated user.
   */
  async updateTask(
    userId: string,
    taskId: string,
    values: TaskFormValues
  ): Promise<{ data: Task | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    const trimmedTitle = values.title.trim();
    if (!trimmedTitle) {
      return { data: null, error: 'Task title is required' };
    }

    const scheduledDate = values.scheduledDate.trim() || null;
    const scheduledStartTime = scheduledDate && values.scheduledStartTime.trim()
      ? values.scheduledStartTime.trim()
      : null;

    const plannedMinutes = values.plannedDurationMinutes.trim()
      ? Math.max(1, parseInt(values.plannedDurationMinutes, 10) || 0)
      : null;

    const reminderOffset = values.reminderOffsetMinutes.trim()
      ? parseInt(values.reminderOffsetMinutes, 10) || null
      : null;

    const shouldSyncCalendar = values.syncToGoogleCalendar ?? Boolean(scheduledDate);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: trimmedTitle,
          description: values.description.trim() || null,
          project_id: values.projectId || null,
          priority: values.priority,
          scheduled_date: scheduledDate,
          scheduled_start_time: scheduledStartTime,
          planned_duration_minutes: plannedMinutes,
          reminder_offset_minutes: reminderOffset,
          sync_to_google_calendar: shouldSyncCalendar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const task = data ? mapTaskFromRow(data) : null;
      if (task) {
        if (task.syncToGoogleCalendar && task.scheduledDate) {
          calendarService.queueSyncJob(task.id, 'upsert', task).catch((err) => {
            console.warn('Calendar sync job enqueue warning:', err);
          });
        } else if (!task.scheduledDate) {
          // Moved to inbox (Case E) - remove from Google Calendar
          calendarService.queueSyncJob(task.id, 'delete').catch((err) => {
            console.warn('Calendar delete sync enqueue warning:', err);
          });
        }
      }

      if (task && task.reminderOffsetMinutes !== null && task.scheduledDate) {
        reminderService
          .syncReminderOnTaskChange(task, {
            customReminderTime: values.reminderCustomTime,
          })
          .catch((err) => {
            console.warn('Reminder sync warning:', err);
          });
      }

      return {
        data: task,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to update task',
      };
    }
  },

  /**
   * Toggles task completion state between 'todo' and 'completed'.
   */
  async toggleTaskCompletion(
    userId: string,
    taskId: string,
    currentStatus: TaskStatus
  ): Promise<{ data: Task | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    const nextStatus: TaskStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    const nowIso = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: nextStatus,
          completed_at: nextStatus === 'completed' ? nowIso : null,
          updated_at: nowIso,
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const task = data ? mapTaskFromRow(data) : null;
      if (task) {
        if (task.syncToGoogleCalendar && task.scheduledDate) {
          calendarService.queueSyncJob(task.id, 'upsert', task).catch((err) => {
            console.warn('Calendar sync job enqueue warning:', err);
          });
        } else if (!task.scheduledDate) {
          // Moved to inbox (Case E) - remove from Google Calendar
          calendarService.queueSyncJob(task.id, 'delete').catch((err) => {
            console.warn('Calendar delete sync enqueue warning:', err);
          });
        }
      }

      if (task && task.reminderOffsetMinutes !== null && task.scheduledDate) {
        reminderService
          .syncReminderOnTaskChange(task)
          .catch((err) => {
            console.warn('Reminder sync warning:', err);
          });
      }

      return {
        data: task,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to toggle task completion',
      };
    }
  },

  /**
   * Schedules a task to a specific date (or moves it to Inbox if date is null).
   */
  async scheduleTask(
    userId: string,
    taskId: string,
    dateIso: string | null
  ): Promise<{ data: Task | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    const nowIso = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          scheduled_date: dateIso,
          // Clearing date clears start time (Rule 4)
          scheduled_start_time: dateIso ? undefined : null,
          updated_at: nowIso,
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const task = data ? mapTaskFromRow(data) : null;
      if (task) {
        if (task.syncToGoogleCalendar && task.scheduledDate) {
          calendarService.queueSyncJob(task.id, 'upsert', task).catch((err) => {
            console.warn('Calendar sync job enqueue warning:', err);
          });
        } else if (!task.scheduledDate) {
          // Moved to inbox (Case E) - remove from Google Calendar
          calendarService.queueSyncJob(task.id, 'delete').catch((err) => {
            console.warn('Calendar delete sync enqueue warning:', err);
          });
        }
      }

      if (task && task.reminderOffsetMinutes !== null && task.scheduledDate) {
        reminderService
          .syncReminderOnTaskChange(task)
          .catch((err) => {
            console.warn('Reminder sync warning:', err);
          });
      }

      return {
        data: task,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to schedule task',
      };
    }
  },

  /**
   * Archives or unarchives a task.
   */
  async archiveTask(
    userId: string,
    taskId: string,
    isArchived: boolean = true
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      if (isArchived) {
        // Remove from Google Calendar if archived (Case E)
        calendarService.queueSyncJob(taskId, 'delete').catch((err) => {
          console.warn('Calendar delete sync enqueue warning on archive:', err);
        });
      }

      const { error } = await supabase
        .from('tasks')
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      if (!isArchived) {
        // If unarchiving, retrieve task to re-sync if scheduled
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .eq('user_id', userId)
          .single();
        const task = data ? mapTaskFromRow(data) : null;
        if (task && task.syncToGoogleCalendar && task.scheduledDate) {
          calendarService.queueSyncJob(task.id, 'upsert', task).catch((err) => {
            console.warn('Calendar sync job enqueue warning on unarchive:', err);
          });
        }
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to archive task',
      };
    }
  },

  /**
   * Deletes a task from the database.
   * Work sessions are safely preserved via ON DELETE SET NULL on task_id.
   */
  async deleteTask(
    userId: string,
    taskId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      // Queue remote calendar deletion before deleting task from database
      await calendarService.queueSyncJob(taskId, 'delete').catch((err) => {
        console.warn('Calendar delete sync enqueue warning:', err);
      });

      // Cancel any pending reminders
      await reminderService.cancelReminder(taskId).catch((err) => {
        console.warn('Reminder cancellation warning:', err);
      });

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete task',
      };
    }
  },
};
