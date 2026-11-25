import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type {
  CalendarSyncStatus,
  Task,
  TaskCalendarBlock,
  TaskFormValues,
  TaskPriority,
  TaskStatus,
} from '../types/models';
import type { Database } from '../types/database.types';
import { calendarService } from './calendarService';
import { reminderService } from './reminderService';
import {
  calculateSchedulePlan,
  calculateTotalPlannedMinutes,
  calculateWorkingDays,
} from './schedulingEngine';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type CalendarBlockRow = Database['public']['Tables']['task_calendar_blocks']['Row'];

/**
 * Maps a database calendar block row into the domain model.
 */
export function mapCalendarBlockFromRow(row: CalendarBlockRow): TaskCalendarBlock {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    blockDate: row.block_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : '09:00',
    endTime: row.end_time ? row.end_time.slice(0, 5) : '10:00',
    durationMinutes: row.duration_minutes,
    status: (row.status as TaskCalendarBlock['status']) || 'scheduled',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    scheduledEndDate: (row as any).scheduled_end_date ?? null,
    scheduledStartTime: row.scheduled_start_time,
    dailyPlannedMinutes: (row as any).daily_planned_minutes ?? null,
    includeWeekends: Boolean((row as any).include_weekends),
    plannedDurationMinutes: row.planned_duration_minutes,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    syncToGoogleCalendar: row.sync_to_google_calendar,
    calendarSyncStatus: row.calendar_sync_status as CalendarSyncStatus,
    clientVisible: row.client_visible ?? false,
    remainingEstimateMinutes: row.remaining_estimate_minutes,
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
    const scheduledEndDate = values.scheduledEndDate?.trim() || null;
    const isMultiDay = Boolean(scheduledDate && scheduledEndDate && scheduledEndDate > scheduledDate);
    const includeWeekends = Boolean(values.includeWeekends);
    const scheduledStartTime = scheduledDate && values.scheduledStartTime.trim()
      ? values.scheduledStartTime.trim()
      : null;

    let dailyPlannedMinutes: number | null = null;
    let plannedMinutes: number | null = null;

    if (isMultiDay && scheduledDate && values.dailyPlannedHours) {
      const dailyHours = parseFloat(values.dailyPlannedHours) || 0;
      dailyPlannedMinutes = Math.max(1, Math.round(dailyHours * 60));
      const workingDays = calculateWorkingDays(scheduledDate, scheduledEndDate, includeWeekends);
      plannedMinutes = calculateTotalPlannedMinutes(dailyHours, workingDays.length);
    } else if (values.plannedDurationMinutes.trim()) {
      plannedMinutes = Math.max(1, parseInt(values.plannedDurationMinutes, 10) || 0);
      dailyPlannedMinutes = plannedMinutes;
    }

    const reminderOffset = values.reminderOffsetMinutes.trim()
      ? parseInt(values.reminderOffsetMinutes, 10) || null
      : null;

    const remainingEstimate = values.remainingEstimateMinutes?.trim()
      ? Math.max(0, parseInt(values.remainingEstimateMinutes, 10) || 0)
      : null;

    const shouldSyncCalendar = values.syncToGoogleCalendar ?? Boolean(scheduledDate);

    try {
      const insertPayload: any = {
        user_id: userId,
        title: trimmedTitle,
        description: values.description.trim() || null,
        project_id: values.projectId || null,
        priority: values.priority,
        status: 'todo',
        scheduled_date: scheduledDate,
        scheduled_start_time: scheduledStartTime,
        planned_duration_minutes: plannedMinutes,
        remaining_estimate_minutes: remainingEstimate,
        reminder_offset_minutes: reminderOffset,
        sync_to_google_calendar: shouldSyncCalendar,
        calendar_sync_status: shouldSyncCalendar && scheduledDate ? 'pending' : 'not_synced',
        client_visible: values.projectId ? Boolean(values.clientVisible) : false,
        completed_at: null,
        is_archived: false,
        sort_order: 0,
      };

      if (isMultiDay || values.scheduledEndDate) {
        insertPayload.scheduled_end_date = isMultiDay ? scheduledEndDate : null;
      }
      if (dailyPlannedMinutes !== null) {
        insertPayload.daily_planned_minutes = dailyPlannedMinutes;
      }
      if (includeWeekends) {
        insertPayload.include_weekends = includeWeekends;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        if (error.code === '42703' || error.message.includes('scheduled_end_date')) {
          return {
            data: null,
            error: 'Database migration required: column tasks.scheduled_end_date does not exist. Please run migration 20261125000016 in the Supabase SQL editor.',
          };
        }
        return { data: null, error: error.message };
      }

      const task = data ? mapTaskFromRow(data) : null;
      if (task) {
        // Automatically allocate calendar time blocks for scheduled dates
        if (task.scheduledDate) {
          const plan = calculateSchedulePlan({
            startDate: task.scheduledDate,
            endDate: task.scheduledEndDate || task.scheduledDate,
            dailyPlannedHours: task.dailyPlannedMinutes ? task.dailyPlannedMinutes / 60 : (task.plannedDurationMinutes ? task.plannedDurationMinutes / 60 : 1),
            preferredStartTime: task.scheduledStartTime || '09:00',
            includeWeekends: task.includeWeekends,
          });

          if (plan.blocks.length > 0) {
            const syncRes = await taskService.syncTaskCalendarBlocks(
              userId,
              task.id,
              plan.blocks.map((b) => ({
                blockDate: b.date,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
              }))
            );
            if (syncRes.error) {
              console.error('Calendar blocks failed to save:', syncRes.error);
              return {
                data: task,
                error: `Task created, but calendar blocks could not be saved: ${syncRes.error}`,
              };
            }
          }
        }

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
    const scheduledEndDate = values.scheduledEndDate?.trim() || null;
    const isMultiDay = Boolean(scheduledDate && scheduledEndDate && scheduledEndDate > scheduledDate);
    const includeWeekends = Boolean(values.includeWeekends);
    const scheduledStartTime = scheduledDate && values.scheduledStartTime.trim()
      ? values.scheduledStartTime.trim()
      : null;

    let dailyPlannedMinutes: number | null = null;
    let plannedMinutes: number | null = null;

    if (isMultiDay && scheduledDate && values.dailyPlannedHours) {
      const dailyHours = parseFloat(values.dailyPlannedHours) || 0;
      dailyPlannedMinutes = Math.max(1, Math.round(dailyHours * 60));
      const workingDays = calculateWorkingDays(scheduledDate, scheduledEndDate, includeWeekends);
      plannedMinutes = calculateTotalPlannedMinutes(dailyHours, workingDays.length);
    } else if (values.plannedDurationMinutes.trim()) {
      plannedMinutes = Math.max(1, parseInt(values.plannedDurationMinutes, 10) || 0);
      dailyPlannedMinutes = plannedMinutes;
    }

    const reminderOffset = values.reminderOffsetMinutes.trim()
      ? parseInt(values.reminderOffsetMinutes, 10) || null
      : null;

    const remainingEstimate = values.remainingEstimateMinutes !== undefined
      ? (values.remainingEstimateMinutes.trim() ? Math.max(0, parseInt(values.remainingEstimateMinutes, 10) || 0) : null)
      : undefined;

    const shouldSyncCalendar = values.syncToGoogleCalendar ?? Boolean(scheduledDate);

    try {
      const updatePayload: Record<string, any> = {
        title: trimmedTitle,
        description: values.description.trim() || null,
        project_id: values.projectId || null,
        priority: values.priority,
        scheduled_date: scheduledDate,
        scheduled_end_date: isMultiDay ? scheduledEndDate : null,
        daily_planned_minutes: dailyPlannedMinutes,
        include_weekends: includeWeekends,
        scheduled_start_time: scheduledStartTime,
        planned_duration_minutes: plannedMinutes,
        reminder_offset_minutes: reminderOffset,
        sync_to_google_calendar: shouldSyncCalendar,
        client_visible: values.projectId ? Boolean(values.clientVisible) : false,
        updated_at: new Date().toISOString(),
      };

      if (values.status) {
        updatePayload.status = values.status;
        if (values.status === 'completed') {
          updatePayload.completed_at = new Date().toISOString();
        } else {
          updatePayload.completed_at = null;
        }
      }

      if (remainingEstimate !== undefined) {
        updatePayload.remaining_estimate_minutes = remainingEstimate;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updatePayload as any)
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const task = data ? mapTaskFromRow(data) : null;
      if (task) {
        // Automatically synchronize calendar time blocks for task
        if (task.scheduledDate) {
          const plan = calculateSchedulePlan({
            startDate: task.scheduledDate,
            endDate: task.scheduledEndDate || task.scheduledDate,
            dailyPlannedHours: task.dailyPlannedMinutes ? task.dailyPlannedMinutes / 60 : (task.plannedDurationMinutes ? task.plannedDurationMinutes / 60 : 1),
            preferredStartTime: task.scheduledStartTime || '09:00',
            includeWeekends: task.includeWeekends,
          });

          const syncRes = await taskService.syncTaskCalendarBlocks(
            userId,
            task.id,
            plan.blocks.map((b) => ({
              blockDate: b.date,
              startTime: b.startTime,
              endTime: b.endTime,
              durationMinutes: b.durationMinutes,
            }))
          );
          if (syncRes.error) {
            console.error('Calendar blocks failed to sync on update:', syncRes.error);
            return {
              data: task,
              error: `Task updated, but calendar blocks could not be saved: ${syncRes.error}`,
            };
          }
        } else {
          // Moved to inbox -> clear calendar blocks
          const syncRes = await taskService.syncTaskCalendarBlocks(userId, task.id, []);
          if (syncRes.error) {
            console.error('Calendar blocks failed to clear on inbox move:', syncRes.error);
            return {
              data: task,
              error: `Task updated, but calendar blocks could not be cleared: ${syncRes.error}`,
            };
          }
        }

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
        // Automatically synchronize calendar time blocks for task
        if (task.scheduledDate) {
          const plan = calculateSchedulePlan({
            startDate: task.scheduledDate,
            endDate: task.scheduledEndDate || task.scheduledDate,
            dailyPlannedHours: task.dailyPlannedMinutes ? task.dailyPlannedMinutes / 60 : (task.plannedDurationMinutes ? task.plannedDurationMinutes / 60 : 1),
            preferredStartTime: task.scheduledStartTime || '09:00',
            includeWeekends: task.includeWeekends,
          });

          const syncRes = await taskService.syncTaskCalendarBlocks(
            userId,
            task.id,
            plan.blocks.map((b) => ({
              blockDate: b.date,
              startTime: b.startTime,
              endTime: b.endTime,
              durationMinutes: b.durationMinutes,
            }))
          );
          if (syncRes.error) {
            console.error('Calendar blocks failed to sync on update:', syncRes.error);
            return {
              data: task,
              error: `Task updated, but calendar blocks could not be saved: ${syncRes.error}`,
            };
          }
        } else {
          // Moved to inbox -> clear calendar blocks
          const syncRes = await taskService.syncTaskCalendarBlocks(userId, task.id, []);
          if (syncRes.error) {
            console.error('Calendar blocks failed to clear on inbox move:', syncRes.error);
            return {
              data: task,
              error: `Task updated, but calendar blocks could not be cleared: ${syncRes.error}`,
            };
          }
        }

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
        // Automatically synchronize calendar time blocks for task
        if (task.scheduledDate) {
          const plan = calculateSchedulePlan({
            startDate: task.scheduledDate,
            endDate: task.scheduledEndDate || task.scheduledDate,
            dailyPlannedHours: task.dailyPlannedMinutes ? task.dailyPlannedMinutes / 60 : (task.plannedDurationMinutes ? task.plannedDurationMinutes / 60 : 1),
            preferredStartTime: task.scheduledStartTime || '09:00',
            includeWeekends: task.includeWeekends,
          });

          const syncRes = await taskService.syncTaskCalendarBlocks(
            userId,
            task.id,
            plan.blocks.map((b) => ({
              blockDate: b.date,
              startTime: b.startTime,
              endTime: b.endTime,
              durationMinutes: b.durationMinutes,
            }))
          );
          if (syncRes.error) {
            console.error('Calendar blocks failed to sync on update:', syncRes.error);
            return {
              data: task,
              error: `Task updated, but calendar blocks could not be saved: ${syncRes.error}`,
            };
          }
        } else {
          // Moved to inbox -> clear calendar blocks
          const syncRes = await taskService.syncTaskCalendarBlocks(userId, task.id, []);
          if (syncRes.error) {
            console.error('Calendar blocks failed to clear on inbox move:', syncRes.error);
            return {
              data: task,
              error: `Task updated, but calendar blocks could not be cleared: ${syncRes.error}`,
            };
          }
        }

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
   * When archived, calendar blocks and future reminders are cleaned up while preserving
   * historical completed work sessions and time tracking records.
   * When unarchived, future calendar blocks are restored without duplicate blocks.
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
        // 1. Remove calendar blocks for this task so it clears from active schedule
        await supabase
          .from('task_calendar_blocks')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', userId);

        // 2. Queue remote Google Calendar deletion
        calendarService.queueSyncJob(taskId, 'delete').catch((err) => {
          console.warn('Calendar delete sync enqueue warning on archive:', err);
        });

        // 3. Cancel any pending reminders
        reminderService.cancelReminder(taskId).catch((err) => {
          console.warn('Reminder cancellation warning on archive:', err);
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
        // If unarchiving, retrieve task to re-generate calendar blocks and re-sync calendar if scheduled
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .eq('user_id', userId)
          .single();
        const task = data ? mapTaskFromRow(data) : null;
        if (task && task.scheduledDate) {
          const plan = calculateSchedulePlan({
            startDate: task.scheduledDate,
            endDate: task.scheduledEndDate || task.scheduledDate,
            dailyPlannedHours: task.dailyPlannedMinutes ? task.dailyPlannedMinutes / 60 : (task.plannedDurationMinutes ? task.plannedDurationMinutes / 60 : 1),
            preferredStartTime: task.scheduledStartTime || '09:00',
            includeWeekends: task.includeWeekends,
          });
          if (plan.blocks.length > 0) {
            await taskService.syncTaskCalendarBlocks(
              userId,
              task.id,
              plan.blocks.map((b) => ({
                blockDate: b.date,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
              }))
            );
          }
          if (task.syncToGoogleCalendar) {
            calendarService.queueSyncJob(task.id, 'upsert', task).catch((err) => {
              console.warn('Calendar sync job enqueue warning on unarchive:', err);
            });
          }
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
   * Associated calendar blocks and remote calendar events are cleaned up.
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
      // 1. Queue remote calendar deletion before deleting task from database
      await calendarService.queueSyncJob(taskId, 'delete').catch((err) => {
        console.warn('Calendar delete sync enqueue warning:', err);
      });

      // 2. Cancel any pending reminders
      await reminderService.cancelReminder(taskId).catch((err) => {
        console.warn('Reminder cancellation warning:', err);
      });

      // 3. Delete task calendar blocks
      await supabase
        .from('task_calendar_blocks')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

      // 4. Delete the task
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

  /**
   * Fetches all calendar blocks belonging to the authenticated user.
   * Returns explicit database error if query fails, never suppresses with empty result.
   */
  async fetchCalendarBlocks(
    userId: string
  ): Promise<{ data: TaskCalendarBlock[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('task_calendar_blocks')
        .select('*')
        .eq('user_id', userId)
        .order('block_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: (data ?? []).map(mapCalendarBlockFromRow),
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch calendar blocks',
      };
    }
  },

  /**
   * Replaces or updates calendar blocks for a specific task.
   * Safely captures existing blocks for rollback if insert fails.
   */
  async syncTaskCalendarBlocks(
    userId: string,
    taskId: string,
    blocks: Array<{
      blockDate: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
    }>
  ): Promise<{ data: TaskCalendarBlock[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      // 1. Fetch existing blocks first to allow safe recovery if insert fails
      const { data: existingRows } = await supabase
        .from('task_calendar_blocks')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', userId);

      // If blocks are empty, delete existing blocks
      if (blocks.length === 0) {
        if (existingRows && existingRows.length > 0) {
          const { error: delErr } = await supabase
            .from('task_calendar_blocks')
            .delete()
            .eq('task_id', taskId)
            .eq('user_id', userId);
          if (delErr) {
            return { data: null, error: `Failed to remove calendar blocks: ${delErr.message}` };
          }
        }
        return { data: [], error: null };
      }

      // 2. Delete existing blocks for this task
      const { error: deleteError } = await supabase
        .from('task_calendar_blocks')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

      if (deleteError) {
        return {
          data: null,
          error: `Failed to clear existing calendar blocks: ${deleteError.message}`,
        };
      }

      // 3. Insert new blocks
      const insertRows = blocks.map((b) => ({
        user_id: userId,
        task_id: taskId,
        block_date: b.blockDate,
        start_time: b.startTime,
        end_time: b.endTime,
        duration_minutes: b.durationMinutes,
        status: 'scheduled',
      }));

      const { data, error: insertError } = await supabase
        .from('task_calendar_blocks')
        .insert(insertRows)
        .select();

      if (insertError) {
        // Recovery: if existingRows was present, attempt to restore them
        if (existingRows && existingRows.length > 0) {
          try {
            await supabase.from('task_calendar_blocks').insert(existingRows);
          } catch {
            // ignore rollback error
          }
        }
        return {
          data: null,
          error: `Failed to save new calendar blocks: ${insertError.message}`,
        };
      }

      return {
        data: (data ?? []).map(mapCalendarBlockFromRow),
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Error syncing task calendar blocks',
      };
    }
  },
};
