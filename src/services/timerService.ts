import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { ActiveTimerState, ManualTimeEntryInput, TimeEntry } from '../types/models';
import type { Database } from '../types/database.types';

type WorkSessionRow = Database['public']['Tables']['work_sessions']['Row'];
type ActiveTimerRow = Database['public']['Tables']['active_timers']['Row'];

/**
 * Maps a Supabase work_sessions row into the application domain TimeEntry.
 */
export function mapWorkSessionFromRow(row: WorkSessionRow): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id ?? '',
    projectId: row.project_id,
    entryType: row.entry_type === 'manual' ? 'manual' : 'timer',
    status: 'completed',
    startedAt: row.started_at || row.created_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a Supabase active_timers row into the application domain ActiveTimerState.
 */
export function mapActiveTimerFromRow(row: ActiveTimerRow): ActiveTimerState {
  const startedAtMs = row.segment_started_at
    ? new Date(row.segment_started_at).getTime()
    : Date.now();

  return {
    taskId: row.task_id,
    status: row.state as 'running' | 'paused',
    startedAtMs,
    accumulatedBeforeSegmentSeconds: 0,
    sessionStartedAtIso: row.segment_started_at || row.created_at,
  };
}

export const timerService = {
  /**
   * Fetches the single persistent active timer for the authenticated user.
   */
  async fetchActiveTimer(
    userId: string
  ): Promise<{ data: ActiveTimerState | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { data: null, error: error.message };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapActiveTimerFromRow(data), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch active timer',
      };
    }
  },

  /**
   * Fetches all saved work sessions for the authenticated user.
   * Optionally filtered by taskId.
   */
  async fetchWorkSessions(
    userId: string,
    taskId?: string
  ): Promise<{ data: TimeEntry[] | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      let query = supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: error.message };
      }

      return {
        data: (data || []).map(mapWorkSessionFromRow),
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to fetch work sessions',
      };
    }
  },

  /**
   * Starts or resumes a timer on a task using the atomic RPC rpc_start_timer.
   * Fallback to direct table mutation if the RPC function is not yet deployed.
   */
  async startTimer(
    taskId: string,
    userId: string
  ): Promise<{ data: ActiveTimerState | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      // 1. Try atomic RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_start_timer', {
        p_task_id: taskId,
      });

      if (!rpcError && rpcData) {
        const timerObj = (rpcData as { timer?: ActiveTimerRow })?.timer;
        if (timerObj) {
          return { data: mapActiveTimerFromRow(timerObj), error: null };
        }
      }

      // If error is not a "function does not exist" error, return it
      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('404')) {
        return { data: null, error: rpcError.message };
      }

      // 2. Client-side fallback for resilience
      const { data: existingTimer, error: fetchErr } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchErr) {
        return { data: null, error: fetchErr.message };
      }

      const nowIso = new Date().toISOString();

      if (existingTimer) {
        if (existingTimer.task_id === taskId) {
          if (existingTimer.state === 'paused') {
            const { data: updated, error: updateErr } = await supabase
              .from('active_timers')
              .update({
                state: 'running',
                segment_started_at: nowIso,
                updated_at: nowIso,
              })
              .eq('user_id', userId)
              .select('*')
              .single();

            if (updateErr) return { data: null, error: updateErr.message };
            return { data: mapActiveTimerFromRow(updated), error: null };
          }
          return { data: mapActiveTimerFromRow(existingTimer), error: null };
        } else {
          return {
            data: null,
            error: 'Another task timer is already active. Please switch or stop first.',
          };
        }
      }

      // Insert new active timer
      const { data: inserted, error: insertErr } = await supabase
        .from('active_timers')
        .insert({
          user_id: userId,
          task_id: taskId,
          state: 'running',
          segment_started_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();

      if (insertErr) {
        return { data: null, error: insertErr.message };
      }

      // Update task status to in_progress if currently todo
      await supabase
        .from('tasks')
        .update({ status: 'in_progress', updated_at: nowIso })
        .eq('id', taskId)
        .eq('user_id', userId)
        .eq('status', 'todo');

      return { data: mapActiveTimerFromRow(inserted), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to start timer',
      };
    }
  },

  /**
   * Pauses the currently running timer, calculating and saving the completed segment to work_sessions.
   */
  async pauseTimer(
    userId: string
  ): Promise<{
    data: ActiveTimerState | null;
    savedSession: TimeEntry | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, savedSession: null, error: 'Supabase client is not configured' };
    }

    try {
      // 1. Try atomic RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_pause_timer');

      if (!rpcError && rpcData) {
        const payload = rpcData as {
          timer?: ActiveTimerRow;
          session_id?: string;
          duration_seconds?: number;
        };
        let savedSession: TimeEntry | null = null;

        if (payload.session_id) {
          const { data: sessRow } = await supabase
            .from('work_sessions')
            .select('*')
            .eq('id', payload.session_id)
            .maybeSingle();

          if (sessRow) {
            savedSession = mapWorkSessionFromRow(sessRow);
          }
        }

        if (payload.timer) {
          return {
            data: mapActiveTimerFromRow(payload.timer),
            savedSession,
            error: null,
          };
        }
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('404')) {
        return { data: null, savedSession: null, error: rpcError.message };
      }

      // 2. Client-side fallback
      const { data: timer, error: timerErr } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (timerErr || !timer) {
        return {
          data: null,
          savedSession: null,
          error: timerErr ? timerErr.message : 'No active timer found to pause',
        };
      }

      if (timer.state === 'paused') {
        return { data: mapActiveTimerFromRow(timer), savedSession: null, error: null };
      }

      const now = new Date();
      const startedAt = timer.segment_started_at ? new Date(timer.segment_started_at) : now;
      const durationSeconds = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 1000));

      const { data: task } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', timer.task_id)
        .maybeSingle();

      const { data: sessRow, error: sessErr } = await supabase
        .from('work_sessions')
        .insert({
          user_id: userId,
          task_id: timer.task_id,
          project_id: task?.project_id ?? null,
          entry_type: 'automatic',
          session_date: now.toISOString().slice(0, 10),
          started_at: startedAt.toISOString(),
          ended_at: now.toISOString(),
          duration_seconds: durationSeconds,
          notes: 'Tracked via count-up timer',
        })
        .select('*')
        .single();

      if (sessErr) {
        return { data: null, savedSession: null, error: sessErr.message };
      }

      const { data: updatedTimer, error: updateErr } = await supabase
        .from('active_timers')
        .update({
          state: 'paused',
          segment_started_at: null,
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateErr) {
        return { data: null, savedSession: null, error: updateErr.message };
      }

      return {
        data: mapActiveTimerFromRow(updatedTimer),
        savedSession: sessRow ? mapWorkSessionFromRow(sessRow) : null,
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        savedSession: null,
        error: err instanceof Error ? err.message : 'Failed to pause timer',
      };
    }
  },

  /**
   * Resumes a paused timer with a fresh segment_started_at timestamp.
   */
  async resumeTimer(
    userId: string
  ): Promise<{ data: ActiveTimerState | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_resume_timer');

      if (!rpcError && rpcData) {
        const payload = rpcData as { timer?: ActiveTimerRow };
        if (payload.timer) {
          return { data: mapActiveTimerFromRow(payload.timer), error: null };
        }
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('404')) {
        return { data: null, error: rpcError.message };
      }

      // Fallback
      const nowIso = new Date().toISOString();
      const { data: updated, error: updateErr } = await supabase
        .from('active_timers')
        .update({
          state: 'running',
          segment_started_at: nowIso,
          updated_at: nowIso,
        })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateErr) {
        return { data: null, error: updateErr.message };
      }

      return { data: mapActiveTimerFromRow(updated), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to resume timer',
      };
    }
  },

  /**
   * Stops the active timer. If running, atomically persists the completed segment.
   */
  async stopTimer(
    userId: string
  ): Promise<{ success: boolean; savedSession: TimeEntry | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, savedSession: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_stop_timer');

      if (!rpcError && rpcData) {
        const payload = rpcData as {
          stopped?: boolean;
          session_saved?: boolean;
          session_id?: string;
        };
        let savedSession: TimeEntry | null = null;

        if (payload.session_id) {
          const { data: sessRow } = await supabase
            .from('work_sessions')
            .select('*')
            .eq('id', payload.session_id)
            .maybeSingle();

          if (sessRow) {
            savedSession = mapWorkSessionFromRow(sessRow);
          }
        }

        return { success: true, savedSession, error: null };
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('404')) {
        return { success: false, savedSession: null, error: rpcError.message };
      }

      // Fallback
      const { data: timer } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      let savedSession: TimeEntry | null = null;

      if (timer && timer.state === 'running' && timer.segment_started_at) {
        const now = new Date();
        const startedAt = new Date(timer.segment_started_at);
        const durationSeconds = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 1000));

        const { data: task } = await supabase
          .from('tasks')
          .select('project_id')
          .eq('id', timer.task_id)
          .maybeSingle();

        const { data: sessRow } = await supabase
          .from('work_sessions')
          .insert({
            user_id: userId,
            task_id: timer.task_id,
            project_id: task?.project_id ?? null,
            entry_type: 'automatic',
            session_date: now.toISOString().slice(0, 10),
            started_at: startedAt.toISOString(),
            ended_at: now.toISOString(),
            duration_seconds: durationSeconds,
            notes: 'Tracked via count-up timer',
          })
          .select('*')
          .single();

        if (sessRow) {
          savedSession = mapWorkSessionFromRow(sessRow);
        }
      }

      await supabase.from('active_timers').delete().eq('user_id', userId);
      return { success: true, savedSession, error: null };
    } catch (err) {
      return {
        success: false,
        savedSession: null,
        error: err instanceof Error ? err.message : 'Failed to stop timer',
      };
    }
  },

  /**
   * Switches timer to a new task: commits running segment on previous task and starts timer on new task.
   */
  async switchTimer(
    newTaskId: string,
    userId: string
  ): Promise<{
    data: ActiveTimerState | null;
    previousSession: TimeEntry | null;
    error: string | null;
  }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, previousSession: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_switch_timer', {
        p_new_task_id: newTaskId,
      });

      if (!rpcError && rpcData) {
        const payload = rpcData as {
          timer?: ActiveTimerRow;
          previous_session_saved?: boolean;
          previous_session_id?: string;
        };
        let previousSession: TimeEntry | null = null;

        if (payload.previous_session_id) {
          const { data: sessRow } = await supabase
            .from('work_sessions')
            .select('*')
            .eq('id', payload.previous_session_id)
            .maybeSingle();

          if (sessRow) {
            previousSession = mapWorkSessionFromRow(sessRow);
          }
        }

        if (payload.timer) {
          return {
            data: mapActiveTimerFromRow(payload.timer),
            previousSession,
            error: null,
          };
        }
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('404')) {
        return { data: null, previousSession: null, error: rpcError.message };
      }

      // Fallback: stop existing timer and start new
      const stopRes = await this.stopTimer(userId);
      const startRes = await this.startTimer(newTaskId, userId);

      return {
        data: startRes.data,
        previousSession: stopRes.savedSession,
        error: startRes.error,
      };
    } catch (err) {
      return {
        data: null,
        previousSession: null,
        error: err instanceof Error ? err.message : 'Failed to switch timer',
      };
    }
  },

  /**
   * Completes a task with an active timer: saves running segment, clears active timer, and marks task completed.
   */
  async completeTaskWithTimer(
    taskId: string,
    userId: string
  ): Promise<{ success: boolean; savedSession: TimeEntry | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, savedSession: null, error: 'Supabase client is not configured' };
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'rpc_complete_task_with_timer',
        {
          p_task_id: taskId,
        }
      );

      if (!rpcError && rpcData) {
        const payload = rpcData as {
          completed?: boolean;
          session_saved?: boolean;
          session_id?: string;
        };
        let savedSession: TimeEntry | null = null;

        if (payload.session_id) {
          const { data: sessRow } = await supabase
            .from('work_sessions')
            .select('*')
            .eq('id', payload.session_id)
            .maybeSingle();

          if (sessRow) {
            savedSession = mapWorkSessionFromRow(sessRow);
          }
        }

        return { success: true, savedSession, error: null };
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('404')) {
        return { success: false, savedSession: null, error: rpcError.message };
      }

      // Fallback
      const stopRes = await this.stopTimer(userId);
      const nowIso = new Date().toISOString();
      const { error: completeErr } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', taskId)
        .eq('user_id', userId);

      if (completeErr) {
        return { success: false, savedSession: stopRes.savedSession, error: completeErr.message };
      }

      return { success: true, savedSession: stopRes.savedSession, error: null };
    } catch (err) {
      return {
        success: false,
        savedSession: null,
        error: err instanceof Error ? err.message : 'Failed to complete task with timer',
      };
    }
  },

  /**
   * Adds a manual work session entry to work_sessions.
   */
  async addManualTimeEntry(
    userId: string,
    input: ManualTimeEntryInput & { computedSeconds: number; projectId?: string | null }
  ): Promise<{ data: TimeEntry | null; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { data: null, error: 'Supabase client is not configured' };
    }

    try {
      const startedAt = input.startTime
        ? `${input.date}T${input.startTime}:00`
        : `${input.date}T00:00:00`;
      const endedAt = input.endTime ? `${input.date}T${input.endTime}:00` : null;

      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: userId,
          task_id: input.taskId,
          project_id: input.projectId ?? null,
          entry_type: 'manual',
          session_date: input.date,
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: input.computedSeconds,
          notes: input.notes.trim() || null,
        })
        .select('*')
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: mapWorkSessionFromRow(data), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to add manual time entry',
      };
    }
  },

  /**
   * Deletes a work session entry.
   */
  async deleteWorkSession(
    userId: string,
    sessionId: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const { error } = await supabase
        .from('work_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete work session',
      };
    }
  },
};
