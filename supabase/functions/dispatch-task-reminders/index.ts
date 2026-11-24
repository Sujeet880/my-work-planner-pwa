// supabase/functions/dispatch-task-reminders/index.ts
// Server-side Web Push dispatcher for scheduled task reminders and test notifications.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { buildPushPayload } from 'https://esm.sh/@block65/webcrypto-web-push@2.0.0';
import { corsHeaders } from '../_shared/cors.ts';

interface PushPayload {
  [key: string]: unknown;
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@myworkplanner.local';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase service configuration is incomplete' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys are not configured on the server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Optional user token verification
    let callingUserId: string | null = null;
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      const { data: userData } = await adminClient.auth.getUser(token);
      if (userData?.user) {
        callingUserId = userData.user.id;
      }
    }

    let requestBody: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch {
        // Empty or non-JSON body is acceptable for scheduled ping
      }
    }

    const isTest = Boolean(requestBody.test);

    // Helper: Send a web push notification to a specific subscription
    async function sendPush(
      subscription: { id: string; endpoint: string; p256dh_key: string; auth_key: string },
      payload: PushPayload
    ): Promise<{ success: boolean; statusCode: number }> {
      try {
        const sub = {
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        };

        const vapidKeys = {
          subject: vapidSubject,
          publicKey: vapidPublicKey,
          privateKey: vapidPrivateKey,
        };

        const pushData = await buildPushPayload(
          {
            data: payload as any,
            options: { ttl: 86400, urgency: 'high' },
          },
          sub,
          vapidKeys
        );

        const pushRes = await fetch(subscription.endpoint, {
          method: 'POST',
          headers: pushData.headers,
          body: pushData.body,
        });

        if (pushRes.status === 404 || pushRes.status === 410) {
          // Subscription has expired or was unsubscribed at the push service: remove stale subscription
          console.log(`Removing expired subscription: ${subscription.id} (${pushRes.status})`);
          await adminClient.from('push_subscriptions').delete().eq('id', subscription.id);
          return { success: false, statusCode: pushRes.status };
        }

        if (pushRes.ok) {
          await adminClient
            .from('push_subscriptions')
            .update({ last_success_at: new Date().toISOString() })
            .eq('id', subscription.id);
          return { success: true, statusCode: pushRes.status };
        }

        return { success: false, statusCode: pushRes.status };
      } catch (err) {
        console.error(`Failed to dispatch push to subscription ${subscription.id}:`, err);
        return { success: false, statusCode: 500 };
      }
    }

    // MODE 1: Direct Test Notification
    if (isTest) {
      if (!callingUserId) {
        return new Response(
          JSON.stringify({ error: 'Authentication required for test notification' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: subs, error: subsErr } = await adminClient
        .from('push_subscriptions')
        .select('id, endpoint, p256dh_key, auth_key')
        .eq('user_id', callingUserId);

      if (subsErr || !subs || subs.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'No active push subscriptions found for this account. Enable notifications in Settings first.',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const testPayload: PushPayload = {
        title: '🔔 Test Notification',
        body: 'Push notifications are working perfectly on this device!',
        tag: 'test-notification',
        data: {
          url: '/settings',
          type: 'test',
        },
      };

      let sentCount = 0;
      for (const sub of subs) {
        const result = await sendPush(sub, testPayload);
        if (result.success) sentCount++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Test notification sent to ${sentCount} device(s)`,
          sentCount,
          totalSubscriptions: subs.length,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MODE 2: Scheduled Dispatcher for Due Reminders
    const nowIso = new Date().toISOString();
    const { data: dueReminders, error: dueErr } = await adminClient
      .from('task_reminders')
      .select(`
        id,
        user_id,
        task_id,
        remind_at,
        attempt_count,
        tasks (
          id,
          title,
          scheduled_date,
          scheduled_start_time,
          status,
          is_archived
        )
      `)
      .eq('status', 'scheduled')
      .lte('remind_at', nowIso)
      .limit(50);

    if (dueErr) {
      console.error('Error fetching due reminders:', dueErr);
      return new Response(
        JSON.stringify({ error: dueErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processedCount: 0, sentCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    let sentCount = 0;

    for (const reminder of dueReminders) {
      processedCount++;
      const task = Array.isArray(reminder.tasks) ? reminder.tasks[0] : reminder.tasks;

      // Ineligible task checks
      if (!task || task.status === 'completed' || task.is_archived || !task.scheduled_date) {
        await adminClient
          .from('task_reminders')
          .update({
            status: 'cancelled',
            last_error: 'Task completed, archived, or unscheduled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);
        continue;
      }

      // Fetch user's push subscriptions
      const { data: userSubs } = await adminClient
        .from('push_subscriptions')
        .select('id, endpoint, p256dh_key, auth_key')
        .eq('user_id', reminder.user_id);

      const reminderPayload: PushPayload = {
        title: 'Task Reminder',
        body: task.scheduled_start_time
          ? `Upcoming: ${task.title} (at ${task.scheduled_start_time})`
          : `Scheduled for today: ${task.title}`,
        tag: `task-${task.id}`,
        data: {
          taskId: task.id,
          url: `/tasks/${task.id}`,
        },
      };

      let delivered = false;
      if (userSubs && userSubs.length > 0) {
        for (const sub of userSubs) {
          const res = await sendPush(sub, reminderPayload);
          if (res.success) {
            delivered = true;
            sentCount++;
          }
        }
      }

      // Mark reminder as sent (or failed if attempts exceed threshold)
      await adminClient
        .from('task_reminders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempt_count: (reminder.attempt_count || 0) + 1,
          last_error: userSubs && userSubs.length > 0
            ? delivered ? null : 'All subscription endpoints failed'
            : 'No active push subscriptions for user',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reminder.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount,
        sentCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unhandled dispatch error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
