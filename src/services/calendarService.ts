// src/services/calendarService.ts
// Client service for Google Calendar One-Way Integration (My Work Planner -> Google Calendar)

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { CalendarConnection, Task } from '../types/models';

/**
 * Safely parses Supabase Edge Function errors (FunctionsHttpError, FunctionsRelayError, FunctionsFetchError).
 * Extracts status and server response body without logging sensitive tokens or credentials.
 */
export async function parseEdgeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const errorJson = await error.context.json();
      if (errorJson?.error) return errorJson.error;
      if (errorJson?.message) return errorJson.message;
      if (typeof errorJson === 'string') return errorJson;
    } catch {
      try {
        const text = await error.context.text();
        if (text) return text;
      } catch {
        // ignore fallback
      }
    }
    const status = error.context.status;
    return `Edge Function error (${status || 'non-2xx'})`;
  }

  if (error instanceof FunctionsRelayError) {
    return `Edge Function relay error: ${error.message}`;
  }

  if (error instanceof FunctionsFetchError) {
    return `Network error connecting to Edge Function: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown Edge Function error';
}

export interface CalendarIntegrationStatus {
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'needs_reauth';
  accountEmail: string | null;
  calendarId: string;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingJobsCount: number;
  failedJobsCount: number;
  syncedTasksCount: number;
}

export interface GoogleEventPayload {
  summary: string;
  description?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
}

/**
 * Formats a task into a Google Calendar event payload according to Cases A, B, C, D, E.
 */
export function formatCalendarEvent(
  task: {
    title: string;
    description?: string | null;
    scheduledDate: string | null;
    scheduledStartTime?: string | null;
    plannedDurationMinutes?: number | null;
  },
  timezone: string = 'Asia/Kolkata',
  defaultDurationMinutes: number = 60
): GoogleEventPayload | null {
  // Case E: No Scheduled Date -> Unscheduled task remains in Inbox, no event
  if (!task.scheduledDate) {
    return null;
  }

  const summary = task.title.trim();
  const description = task.description ? task.description.trim() : undefined;

  // Case A: Date only (no start time) -> All-day event with exclusive next day end
  if (!task.scheduledStartTime) {
    const [y, m, d] = task.scheduledDate.split('-').map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nextD = String(nextDate.getDate()).padStart(2, '0');
    const endDateIso = `${nextY}-${nextM}-${nextD}`;

    return {
      summary,
      description,
      start: { date: task.scheduledDate },
      end: { date: endDateIso },
    };
  }

  // Case B, C, D: Timed event
  const startTime = task.scheduledStartTime.slice(0, 5); // HH:mm
  const [sh, sm] = startTime.split(':').map(Number);

  // Case C (planned duration) vs Case D (default 60 min)
  const durationMinutes =
    task.plannedDurationMinutes && task.plannedDurationMinutes > 0
      ? task.plannedDurationMinutes
      : defaultDurationMinutes > 0
        ? defaultDurationMinutes
        : 60;

  const totalStartMinutes = sh * 60 + sm;
  const totalEndMinutes = totalStartMinutes + durationMinutes;

  const endH = Math.floor(totalEndMinutes / 60) % 24;
  const endM = totalEndMinutes % 60;
  const daysAdded = Math.floor(totalEndMinutes / 1440);

  const [y, m, d] = task.scheduledDate.split('-').map(Number);
  const endDateObj = new Date(y, m - 1, d + daysAdded);
  const endY = endDateObj.getFullYear();
  const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDateObj.getDate()).padStart(2, '0');

  const startIso = `${task.scheduledDate}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
  const endIso = `${endY}-${endMonth}-${endDay}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

  return {
    summary,
    description,
    start: {
      dateTime: startIso,
      timeZone: timezone,
    },
    end: {
      dateTime: endIso,
      timeZone: timezone,
    },
  };
}

export const calendarService = {
  /**
   * Fetches real Google Calendar integration status for the user via Postgres RPC.
   */
  async getIntegrationStatus(userId: string): Promise<{
    data: CalendarIntegrationStatus | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase.rpc('get_calendar_integration_status');
      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: data as unknown as CalendarIntegrationStatus,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch calendar status',
      };
    }
  },

  /**
   * Initiates Google OAuth flow by fetching authorization URL from server-side Edge Function.
   */
  async getAuthorizationUrl(): Promise<{
    url: string | null;
    redirectUri: string | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { url: null, redirectUri: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'get-auth-url' },
      });

      if (error) {
        const errorDetail = await parseEdgeFunctionError(error);
        return { url: null, redirectUri: null, error: errorDetail };
      }

      if (data?.error) {
        return { url: null, redirectUri: null, error: data.error };
      }

      return {
        url: data.url,
        redirectUri: data.redirectUri,
        error: null,
      };
    } catch (err) {
      const errorDetail = await parseEdgeFunctionError(err);
      return {
        url: null,
        redirectUri: null,
        error: errorDetail,
      };
    }
  },

  /**
   * Disconnects Google Calendar account and halts future synchronization.
   */
  async disconnect(): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      // Call edge function to revoke Google token if possible
      await supabase.functions
        .invoke('google-calendar-auth', {
          body: { action: 'disconnect' },
        })
        .catch(async (err) => {
          const detail = await parseEdgeFunctionError(err);
          console.warn('Revoke warning:', detail);
        });

      // Disconnect locally in database via RPC
      const { error } = await supabase.rpc('disconnect_google_calendar');
      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      const detail = await parseEdgeFunctionError(err);
      return {
        success: false,
        error: detail,
      };
    }
  },

  /**
   * Enqueues an atomic sync job for a task in the transactional outbox table.
   */
  async queueSyncJob(
    taskId: string,
    operation: 'upsert' | 'delete',
    payload?: Partial<Task>
  ): Promise<{ jobId: string | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { jobId: null, error: 'Supabase client is not configured' };
    }

    try {
      const taskPayload = payload
        ? {
            title: payload.title,
            description: payload.description,
            scheduled_date: payload.scheduledDate,
            scheduled_start_time: payload.scheduledStartTime,
            planned_duration_minutes: payload.plannedDurationMinutes,
          }
        : {};

      const { data, error } = await supabase.rpc('queue_calendar_sync_job', {
        p_task_id: taskId,
        p_operation: operation,
        p_payload: taskPayload,
        p_calendar_id: 'primary',
      });

      if (error) {
        return { jobId: null, error: error.message };
      }

      // Background trigger edge function to process immediately without blocking
      this.triggerSync().catch((err) => console.warn('Background sync trigger:', err));

      return { jobId: data, error: null };
    } catch (err) {
      return {
        jobId: null,
        error: err instanceof Error ? err.message : 'Failed to queue sync job',
      };
    }
  },

  /**
   * Triggers the server-side edge function to process pending sync jobs.
   */
  async triggerSync(options?: { retryFailed?: boolean }): Promise<{
    success: boolean;
    processedCount?: number;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { retryFailed: options?.retryFailed ?? false },
      });

      if (error) {
        const detail = await parseEdgeFunctionError(error);
        return { success: false, error: detail };
      }

      return {
        success: data?.success ?? false,
        processedCount: data?.processedCount ?? 0,
        error: data?.error ?? null,
      };
    } catch (err) {
      const detail = await parseEdgeFunctionError(err);
      return {
        success: false,
        error: detail,
      };
    }
  },
};
