// supabase/functions/google-calendar-sync/index.ts
// Processes pending Google Calendar sync jobs for the authenticated user

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken } from '../_shared/crypto.ts';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  formatCalendarEvent,
  refreshGoogleAccessToken,
  updateGoogleCalendarEvent,
} from '../_shared/google.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || googleClientSecret || 'default-fallback-key-for-my-work-planner-32';

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
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

    const userId = user.id;

    // Optional body params (e.g. single taskId or retryFailed)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const retryFailed = body.retryFailed === true;

    // If retryFailed is requested, reset failed jobs back to pending
    if (retryFailed) {
      await adminClient
        .from('google_calendar_sync_jobs')
        .update({
          status: 'pending',
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('status', 'failed');
    }

    // Query pending jobs for this user
    const { data: jobs, error: jobsError } = await adminClient
      .from('google_calendar_sync_jobs')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(30);

    if (jobsError) {
      throw new Error(`Failed to query sync jobs: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processedCount: 0, message: 'No pending sync jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve user's stored refresh token
    const { data: tokenRow } = await adminClient
      .from('google_calendar_tokens')
      .select('encrypted_refresh_token')
      .eq('user_id', userId)
      .single();

    if (!tokenRow?.encrypted_refresh_token) {
      // User is not connected
      await adminClient
        .from('google_calendar_sync_jobs')
        .update({
          status: 'failed',
          last_error: 'Google Calendar is not connected.',
          updated_at: new Date().toISOString(),
        })
        .in(
          'id',
          jobs.map((j: { id: string }) => j.id)
        );

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Google Calendar is not connected.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt refresh token
    const refreshToken = await decryptToken(tokenRow.encrypted_refresh_token, encryptionKey);

    // Refresh Google access token
    let accessToken = '';
    try {
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
      throw new Error(`Google token refresh failed: ${errMsg}`);
    }

    // Fetch user profile preferences (timezone, default duration)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('timezone, default_event_duration_minutes')
      .eq('id', userId)
      .single();

    const userTimezone = profile?.timezone || 'Asia/Kolkata';
    const defaultDuration = profile?.default_event_duration_minutes || 60;

    let succeededCount = 0;
    let failedCount = 0;

    // Process each job sequentially to guarantee order
    for (const job of jobs) {
      // Mark job as processing
      await adminClient
        .from('google_calendar_sync_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', job.id);

      try {
        const calendarId = job.google_calendar_id || 'primary';

        if (job.operation === 'delete') {
          // Identify event ID
          let eventId = job.google_event_id;
          if (!eventId && job.task_id) {
            const { data: mapping } = await adminClient
              .from('google_calendar_event_mappings')
              .select('google_event_id')
              .eq('user_id', userId)
              .eq('task_id', job.task_id)
              .eq('google_calendar_id', calendarId)
              .single();
            eventId = mapping?.google_event_id;
          }

          if (eventId) {
            await deleteGoogleCalendarEvent(accessToken, calendarId, eventId);
            // Delete mapping record
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
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.task_id)
              .eq('user_id', userId);
          }

          // Mark job completed
          await adminClient
            .from('google_calendar_sync_jobs')
            .update({
              status: 'completed',
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          succeededCount++;
          continue;
        }

        // Operation: Upsert
        if (job.operation === 'upsert') {
          // Fetch current task state if task_id exists
          let taskData = job.payload;
          if (job.task_id) {
            const { data: freshTask } = await adminClient
              .from('tasks')
              .select('*')
              .eq('id', job.task_id)
              .eq('user_id', userId)
              .single();

            if (freshTask) {
              taskData = {
                title: freshTask.title,
                description: freshTask.description,
                scheduled_date: freshTask.scheduled_date,
                scheduled_start_time: freshTask.scheduled_start_time,
                planned_duration_minutes: freshTask.planned_duration_minutes,
                is_archived: freshTask.is_archived,
              };
            }
          }

          // Case E: If task is archived or unscheduled (moved to Inbox), delete remote event
          if (!taskData.scheduled_date || taskData.is_archived) {
            if (job.task_id) {
              const { data: existingMapping } = await adminClient
                .from('google_calendar_event_mappings')
                .select('google_event_id')
                .eq('user_id', userId)
                .eq('task_id', job.task_id)
                .single();

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

            succeededCount++;
            continue;
          }

          // Format event according to rules
          const eventPayload = formatCalendarEvent(taskData, userTimezone, defaultDuration);
          if (!eventPayload) {
            // No scheduled date -> complete without event
            await adminClient
              .from('google_calendar_sync_jobs')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .eq('id', job.id);
            succeededCount++;
            continue;
          }

          // Check if mapping exists
          let existingEventId = job.google_event_id;
          if (!existingEventId && job.task_id) {
            const { data: mapping } = await adminClient
              .from('google_calendar_event_mappings')
              .select('google_event_id')
              .eq('user_id', userId)
              .eq('task_id', job.task_id)
              .eq('google_calendar_id', calendarId)
              .single();
            existingEventId = mapping?.google_event_id;
          }

          let remoteEventId = existingEventId;
          if (existingEventId) {
            // Update existing event
            await updateGoogleCalendarEvent(
              accessToken,
              calendarId,
              existingEventId,
              eventPayload
            );
          } else {
            // Create new event
            const created = await createGoogleCalendarEvent(
              accessToken,
              calendarId,
              eventPayload
            );
            remoteEventId = created.id;

            // Insert mapping
            if (job.task_id && remoteEventId) {
              await adminClient.from('google_calendar_event_mappings').upsert(
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
            }
          }

          // Mark task as synced
          if (job.task_id) {
            await adminClient
              .from('tasks')
              .update({
                calendar_sync_status: 'synced',
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.task_id)
              .eq('user_id', userId);
          }

          // Mark job completed
          await adminClient
            .from('google_calendar_sync_jobs')
            .update({
              status: 'completed',
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          succeededCount++;
        }
      } catch (jobErr: unknown) {
        failedCount++;
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
            .eq('id', job.task_id)
            .eq('user_id', userId);
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

    return new Response(
      JSON.stringify({
        success: true,
        processedCount: jobs.length,
        succeededCount,
        failedCount,
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
