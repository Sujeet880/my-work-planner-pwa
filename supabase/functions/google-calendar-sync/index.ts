// supabase/functions/google-calendar-sync/index.ts
// Processes pending Google Calendar sync jobs for authenticated users and background dispatchers

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken } from '../_shared/crypto.ts';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  formatCalendarEvent,
  listGoogleCalendarEvents,
  refreshGoogleAccessToken,
  updateGoogleCalendarEvent,
  type GoogleEventPayload,
} from '../_shared/google.ts';

interface SyncJobRow {
  id: string;
  user_id: string;
  task_id: string | null;
  google_calendar_id: string | null;
  google_event_id: string | null;
  operation: 'upsert' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface EventMappingRow {
  id: string;
  user_id: string;
  task_id: string;
  google_calendar_id: string;
  google_event_id: string;
  sync_status: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

interface DbTaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  planned_duration_minutes: number | null;
  is_archived: boolean;
  calendar_sync_status: string | null;
  sync_to_google_calendar: boolean | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  const encryptionKey =
    Deno.env.get('ENCRYPTION_KEY') ||
    googleClientSecret ||
    'default-fallback-key-for-my-work-planner-32';

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Authenticate Request
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    let callingUserId: string | null = null;
    let isServiceRole = Boolean(supabaseServiceKey && token === supabaseServiceKey);

    if (!isServiceRole) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (base64.length % 4) {
            base64 += '=';
          }
          const payload = JSON.parse(atob(base64));
          if (payload.role === 'service_role') {
            isServiceRole = true;
          }
        }
      } catch {
        // Continue to user token verification
      }
    }

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Non-JSON or empty body is acceptable
      }
    }

    if (isServiceRole) {
      // Service role invocation (e.g. background dispatcher or admin trigger)
      callingUserId = (body.userId as string) || null;
    } else {
      // User JWT verification
      const {
        data: { user },
        error: userError,
      } = await adminClient.auth.getUser(token);

      if (userError || !user) {
        console.error('Sync auth verification failed:', userError?.message);
        return new Response(
          JSON.stringify({
            error: `Unauthorized: ${userError?.message || 'Invalid or expired Supabase session'}`,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      callingUserId = user.id;
    }

    // -------------------------------------------------------------
    // AUDIT & CLEANUP ACTIONS
    // -------------------------------------------------------------
    if (body.action === 'audit_google_calendar' || body.action === 'clean_qa_events') {
      const targetUserId = callingUserId || (body.userId as string);
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'User ID required for audit/cleanup' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokenRow } = await adminClient
        .from('google_calendar_tokens')
        .select('encrypted_refresh_token')
        .eq('user_id', targetUserId)
        .single();

      if (!tokenRow?.encrypted_refresh_token) {
        return new Response(JSON.stringify({ error: 'Google Calendar is not connected.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshToken = await decryptToken(tokenRow.encrypted_refresh_token, encryptionKey);
      const { access_token } = await refreshGoogleAccessToken(
        refreshToken,
        googleClientId,
        googleClientSecret
      );

      const googleEvents = await listGoogleCalendarEvents(access_token, 'primary');
      const { data: rawDbTasks } = await adminClient.from('tasks').select('*').eq('user_id', targetUserId);
      const { data: rawDbMappings } = await adminClient
        .from('google_calendar_event_mappings')
        .select('*')
        .eq('user_id', targetUserId);

      const dbTasks = (rawDbTasks as DbTaskRow[]) || [];
      const dbMappings = (rawDbMappings as EventMappingRow[]) || [];

      const mappingByEventId = new Map<string, EventMappingRow>(
        dbMappings.map((m) => [m.google_event_id, m])
      );
      const mappingByTaskId = new Map<string, EventMappingRow>(
        dbMappings.map((m) => [m.task_id, m])
      );
      const taskById = new Map<string, DbTaskRow>(
        dbTasks.map((t) => [t.id, t])
      );

      const classified = googleEvents.map((ev) => {
        const mapping = mappingByEventId.get(ev.id);
        const task = mapping?.task_id ? taskById.get(mapping.task_id) : undefined;
        let classification = 'unmapped_external';

        if (mapping && task) {
          classification = 'genuine_mapped';
        } else if (ev.summary?.startsWith('QA Task') || ev.summary?.startsWith('Debug task')) {
          classification = 'orphan_qa_test';
        } else if (ev.summary === 'Youtube Video' || ev.summary === 'test task' || ev.summary === 'Test again') {
          // If summary matches genuine task but event ID doesn't match active mapping
          const mappedForTask = Array.from(mappingByTaskId.values()).find(
            (m) => taskById.get(m.task_id)?.title === ev.summary
          );
          if (mappedForTask && mappedForTask.google_event_id !== ev.id) {
            classification = 'orphan_duplicate';
          } else if (mappedForTask && mappedForTask.google_event_id === ev.id) {
            classification = 'genuine_mapped';
          }
        }

        return {
          id: ev.id,
          summary: ev.summary,
          start: ev.start,
          end: ev.end,
          classification,
          mappingTaskId: mapping?.task_id || null,
        };
      });

      if (body.action === 'audit_google_calendar') {
        return new Response(
          JSON.stringify({
            success: true,
            totalGoogleEvents: googleEvents.length,
            events: classified,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.action === 'clean_qa_events') {
        const toDelete = classified.filter(
          (c) => c.classification === 'orphan_qa_test' || c.classification === 'orphan_duplicate'
        );
        const deletedSummaries: string[] = [];

        for (const item of toDelete) {
          try {
            await deleteGoogleCalendarEvent(access_token, 'primary', item.id);
            deletedSummaries.push(`${item.summary} (${item.id})`);
          } catch (delErr) {
            console.warn(`Failed to delete orphan event ${item.id}:`, delErr);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            deletedCount: deletedSummaries.length,
            deletedSummaries,
            remainingEvents: classified.length - deletedSummaries.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const retryFailed = body.retryFailed === true;

    // If retryFailed is requested, reset failed jobs back to pending
    if (retryFailed && callingUserId) {
      await adminClient
        .from('google_calendar_sync_jobs')
        .update({
          status: 'pending',
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', callingUserId)
        .eq('status', 'failed');
    }

    // 2. Query Pending Jobs (scoped to user if callingUserId present, else batch of 50)
    let jobsQuery = adminClient
      .from('google_calendar_sync_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (callingUserId) {
      jobsQuery = jobsQuery.eq('user_id', callingUserId);
    }

    const { data: rawJobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      throw new Error(`Failed to query sync jobs: ${jobsError.message}`);
    }

    const jobs = (rawJobs as SyncJobRow[]) || [];

    if (jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processedCount: 0, message: 'No pending sync jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group jobs by user_id to cache and reuse tokens efficiently
    const jobsByUser: Record<string, SyncJobRow[]> = {};
    for (const job of jobs) {
      if (!jobsByUser[job.user_id]) {
        jobsByUser[job.user_id] = [];
      }
      jobsByUser[job.user_id].push(job);
    }

    let totalSucceeded = 0;
    let totalFailed = 0;

    // Process each user's jobs
    for (const [userId, userJobs] of Object.entries(jobsByUser)) {
      // Retrieve user's stored refresh token
      const { data: tokenRow } = await adminClient
        .from('google_calendar_tokens')
        .select('encrypted_refresh_token')
        .eq('user_id', userId)
        .single();

      if (!tokenRow?.encrypted_refresh_token) {
        await adminClient
          .from('google_calendar_sync_jobs')
          .update({
            status: 'failed',
            last_error: 'Google Calendar is not connected.',
            updated_at: new Date().toISOString(),
          })
          .in(
            'id',
            userJobs.map((j) => j.id)
          );
        totalFailed += userJobs.length;
        continue;
      }

      // Decrypt refresh token & refresh access token
      let accessToken = '';
      try {
        const refreshToken = await decryptToken(tokenRow.encrypted_refresh_token, encryptionKey);
        const refreshed = await refreshGoogleAccessToken(
          refreshToken,
          googleClientId,
          googleClientSecret
        );
        accessToken = refreshed.access_token;
      } catch (refreshErr: unknown) {
        const errMsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        if (errMsg.includes('TOKEN_REVOKED')) {
          await adminClient
            .from('google_calendar_connections')
            .update({
              status: 'needs_reauth',
              last_error: 'Google authorization was revoked or expired. Please reconnect.',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
        }

        await adminClient
          .from('google_calendar_sync_jobs')
          .update({
            status: 'failed',
            last_error: `Google token refresh failed: ${errMsg}`,
            updated_at: new Date().toISOString(),
          })
          .in(
            'id',
            userJobs.map((j) => j.id)
          );

        totalFailed += userJobs.length;
        continue;
      }

      // Fetch user profile preferences (timezone, default duration)
      const { data: profile } = await adminClient
        .from('profiles')
        .select('timezone, default_event_duration_minutes')
        .eq('id', userId)
        .single();

      const userTimezone = profile?.timezone || 'Asia/Kolkata';
      const defaultDuration = profile?.default_event_duration_minutes || 60;

      // Process each job sequentially
      for (const job of userJobs) {
        await adminClient
          .from('google_calendar_sync_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        try {
          const calendarId = job.google_calendar_id || 'primary';

          // -------------------------------------------------------------
          // OPERATION: DELETE
          // -------------------------------------------------------------
          if (job.operation === 'delete') {
            let eventId = job.google_event_id;
            if (!eventId && job.task_id) {
              const { data: mapping } = await adminClient
                .from('google_calendar_event_mappings')
                .select('google_event_id')
                .eq('user_id', userId)
                .eq('task_id', job.task_id)
                .eq('google_calendar_id', calendarId)
                .maybeSingle();
              eventId = mapping?.google_event_id;
            }

            if (eventId) {
              await deleteGoogleCalendarEvent(accessToken, calendarId, eventId);
              await adminClient
                .from('google_calendar_event_mappings')
                .delete()
                .eq('user_id', userId)
                .eq('google_event_id', eventId);
            }

            if (job.task_id) {
              await adminClient
                .from('tasks')
                .update({
                  calendar_sync_status: 'not_synced',
                  sync_to_google_calendar: false,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.task_id)
                .eq('user_id', userId);
            }

            await adminClient
              .from('google_calendar_sync_jobs')
              .update({
                status: 'completed',
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            totalSucceeded++;
            continue;
          }

          // -------------------------------------------------------------
          // OPERATION: UPSERT
          // -------------------------------------------------------------
          if (job.operation === 'upsert') {
            // Idempotency Rule: If job has no task_id, the task was deleted before sync.
            // Never create orphan events on Google Calendar!
            if (!job.task_id) {
              await adminClient
                .from('google_calendar_sync_jobs')
                .update({
                  status: 'completed',
                  last_error: 'Skipped: task was removed before sync',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);
              totalSucceeded++;
              continue;
            }

            const { data: rawFreshTask } = await adminClient
              .from('tasks')
              .select('*')
              .eq('id', job.task_id)
              .eq('user_id', userId)
              .maybeSingle();

            const freshTask = rawFreshTask as DbTaskRow | null;

            // If task no longer exists in database, do not create or update remote event
            if (!freshTask) {
              await adminClient
                .from('google_calendar_sync_jobs')
                .update({
                  status: 'completed',
                  last_error: 'Skipped: task does not exist in database',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);
              totalSucceeded++;
              continue;
            }

            const taskData = {
              title: freshTask.title,
              description: freshTask.description,
              scheduled_date: freshTask.scheduled_date,
              scheduled_start_time: freshTask.scheduled_start_time,
              planned_duration_minutes: freshTask.planned_duration_minutes,
              is_archived: freshTask.is_archived,
            };

            // Case E: If task has no scheduled date (Inbox) or is archived, delete remote event
            if (!taskData.scheduled_date || taskData.is_archived) {
              const { data: existingMapping } = await adminClient
                .from('google_calendar_event_mappings')
                .select('google_event_id')
                .eq('user_id', userId)
                .eq('task_id', job.task_id)
                .maybeSingle();

              if (existingMapping?.google_event_id) {
                await deleteGoogleCalendarEvent(
                  accessToken,
                  calendarId,
                  existingMapping.google_event_id
                );
                await adminClient
                  .from('google_calendar_event_mappings')
                  .delete()
                  .eq('user_id', userId)
                  .eq('task_id', job.task_id);
              }

              await adminClient
                .from('tasks')
                .update({
                  calendar_sync_status: 'not_synced',
                  sync_to_google_calendar: false,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.task_id)
                .eq('user_id', userId);

              await adminClient
                .from('google_calendar_sync_jobs')
                .update({
                  status: 'completed',
                  last_error: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);

              totalSucceeded++;
              continue;
            }

            // Construct Google Event Payload (Cases A, B, C, D)
            const eventPayload = formatCalendarEvent(taskData, userTimezone, defaultDuration);
            if (!eventPayload) {
              await adminClient
                .from('google_calendar_sync_jobs')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', job.id);
              totalSucceeded++;
              continue;
            }

            // Deterministic Google Event ID based on canonical Task UUID (RFC2938 base32hex: [a-v0-9])
            const taskId = job.task_id as string;
            const deterministicEventId = `mwp${taskId.replace(/-/g, '').toLowerCase()}`;

            const extendedPayload: GoogleEventPayload = {
              ...eventPayload,
              extendedProperties: {
                private: {
                  myWorkPlannerTaskId: taskId,
                  myWorkPlannerUserId: userId,
                },
              },
            };

            // Check if mapping exists
            let existingEventId = job.google_event_id;
            if (!existingEventId) {
              const { data: mapping } = await adminClient
                .from('google_calendar_event_mappings')
                .select('google_event_id')
                .eq('user_id', userId)
                .eq('task_id', job.task_id)
                .eq('google_calendar_id', calendarId)
                .maybeSingle();
              existingEventId = mapping?.google_event_id;
            }

            let remoteEventId = existingEventId;
            if (existingEventId) {
              try {
                // Update existing event via PATCH
                await updateGoogleCalendarEvent(
                  accessToken,
                  calendarId,
                  existingEventId,
                  extendedPayload
                );
              } catch (updateErr: unknown) {
                const errMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
                if (errMsg.includes('404') || errMsg.includes('410')) {
                  // Event was deleted externally in Google Calendar; recreate it with deterministic ID
                  const created = await createGoogleCalendarEvent(accessToken, calendarId, {
                    ...extendedPayload,
                    id: deterministicEventId,
                  });
                  remoteEventId = created.id || deterministicEventId;
                } else {
                  throw updateErr;
                }
              }
            } else {
              // Create new event with deterministic ID to prevent duplicates
              const created = await createGoogleCalendarEvent(accessToken, calendarId, {
                ...extendedPayload,
                id: deterministicEventId,
              });

              if (created.alreadyExists) {
                // Event already exists with this ID in Google Calendar; update it instead of duplicating
                await updateGoogleCalendarEvent(
                  accessToken,
                  calendarId,
                  deterministicEventId,
                  extendedPayload
                );
                remoteEventId = deterministicEventId;
              } else {
                remoteEventId = created.id;
              }
            }

            // Upsert mapping into google_calendar_event_mappings
            if (remoteEventId) {
              const { error: mapErr } = await adminClient.from('google_calendar_event_mappings').upsert(
                {
                  user_id: userId,
                  task_id: job.task_id,
                  google_calendar_id: calendarId,
                  google_event_id: remoteEventId,
                  sync_status: 'synced',
                  last_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,task_id,google_calendar_id' }
              );
              if (mapErr) {
                console.error('Error recording event mapping:', mapErr);
              }
            }

            // Mark task as synced
            await adminClient
              .from('tasks')
              .update({
                calendar_sync_status: 'synced',
                sync_to_google_calendar: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.task_id)
              .eq('user_id', userId);

            // Mark job completed
            await adminClient
              .from('google_calendar_sync_jobs')
              .update({
                status: 'completed',
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);

            totalSucceeded++;
          }
        } catch (jobErr: unknown) {
          totalFailed++;
          const errorMessage = jobErr instanceof Error ? jobErr.message : String(jobErr);
          console.error(`Sync job ${job.id} failed:`, errorMessage);

          const nextRetry = (job.retry_count || 0) + 1;
          const isMaxExceeded = nextRetry >= (job.max_retries || 5);

          await adminClient
            .from('google_calendar_sync_jobs')
            .update({
              status: isMaxExceeded ? 'failed' : 'pending',
              retry_count: nextRetry,
              last_error: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          if (job.task_id && isMaxExceeded) {
            await adminClient
              .from('tasks')
              .update({
                calendar_sync_status: 'failed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.task_id);
          }
        }
      }

      // Update last_sync_at on connection
      await adminClient
        .from('google_calendar_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount: jobs.length,
        succeededCount: totalSucceeded,
        failedCount: totalFailed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('google-calendar-sync error:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
