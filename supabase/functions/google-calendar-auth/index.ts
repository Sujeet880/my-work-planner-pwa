// supabase/functions/google-calendar-auth/index.ts
// Handles Google OAuth 2.0 flow: authorization URL generation, OAuth callback, status check, and disconnection.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createOAuthState, decryptToken, encryptToken, verifyOAuthState } from '../_shared/crypto.ts';
import {
  exchangeCodeForTokens,
  getGoogleAccountEmail,
  revokeGoogleToken,
} from '../_shared/google.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  // Read environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  const googleRedirectUri =
    Deno.env.get('GOOGLE_REDIRECT_URI') ||
    `${supabaseUrl}/functions/v1/google-calendar-auth/callback`;
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || googleClientSecret || 'default-fallback-key-for-my-work-planner-32';
  const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:3000';

  // Admin client for secure token operations
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // -------------------------------------------------------------
    // ROUTE 1: OAuth Callback (GET /callback or path ending in /callback)
    // -------------------------------------------------------------
    if (pathname.endsWith('/callback') || url.searchParams.has('code')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const errorParam = url.searchParams.get('error');

      if (errorParam) {
        console.warn('OAuth consent error from Google:', errorParam);
        return Response.redirect(
          `${appBaseUrl}/settings/google-calendar?error=${encodeURIComponent(errorParam)}`,
          302
        );
      }

      if (!code || !state) {
        return Response.redirect(
          `${appBaseUrl}/settings/google-calendar?error=missing_code_or_state`,
          302
        );
      }

      // Verify OAuth state token
      const statePayload = await verifyOAuthState(state, encryptionKey);
      if (!statePayload || !statePayload.userId) {
        console.error('Invalid or expired OAuth state');
        return Response.redirect(
          `${appBaseUrl}/settings/google-calendar?error=invalid_or_expired_state`,
          302
        );
      }

      const userId = statePayload.userId;

      // Exchange code for tokens
      let tokenResponse;
      try {
        tokenResponse = await exchangeCodeForTokens(
          code,
          googleClientId,
          googleClientSecret,
          googleRedirectUri
        );
      } catch (err) {
        console.error('Failed to exchange code for tokens:', err);
        return Response.redirect(
          `${appBaseUrl}/settings/google-calendar?error=token_exchange_failed`,
          302
        );
      }

      const { access_token, refresh_token, expires_in } = tokenResponse;

      // Fetch user email from Google
      let googleEmail: string | null = null;
      try {
        googleEmail = await getGoogleAccountEmail(access_token);
      } catch (err) {
        console.warn('Failed to fetch user email from Google:', err);
      }

      // Encrypt and persist tokens using service_role admin client
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

      if (refresh_token) {
        const encryptedRefresh = await encryptToken(refresh_token, encryptionKey);
        const encryptedAccess = await encryptToken(access_token, encryptionKey);

        const { error: tokenError } = await adminClient
          .from('google_calendar_tokens')
          .upsert({
            user_id: userId,
            encrypted_refresh_token: encryptedRefresh,
            encrypted_access_token: encryptedAccess,
            access_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          });

        if (tokenError) {
          console.error('Failed to store encrypted tokens:', tokenError);
          return Response.redirect(
            `${appBaseUrl}/settings/google-calendar?error=token_storage_failed`,
            302
          );
        }
      } else {
        // Re-connection where Google didn't return a new refresh_token
        // Update access token without wiping existing refresh token
        const encryptedAccess = await encryptToken(access_token, encryptionKey);
        await adminClient
          .from('google_calendar_tokens')
          .update({
            encrypted_access_token: encryptedAccess,
            access_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }

      // Upsert connection metadata
      const { error: connError } = await adminClient
        .from('google_calendar_connections')
        .upsert({
          user_id: userId,
          status: 'connected',
          google_account_email: googleEmail,
          google_calendar_id: 'primary',
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        });

      if (connError) {
        console.error('Failed to upsert connection status:', connError);
      }

      // Enqueue initial sync for existing scheduled tasks (Rule 9: First Connection)
      const { data: scheduledTasks } = await adminClient
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .not('scheduled_date', 'is', null);

      if (scheduledTasks && scheduledTasks.length > 0) {
        for (const task of scheduledTasks) {
          await adminClient.rpc('queue_calendar_sync_job', {
            p_task_id: task.id,
            p_operation: 'upsert',
            p_payload: {
              title: task.title,
              description: task.description,
              scheduled_date: task.scheduled_date,
              scheduled_start_time: task.scheduled_start_time,
              planned_duration_minutes: task.planned_duration_minutes,
            },
            p_calendar_id: 'primary',
            p_user_id: userId,
          });
        }

        // Trigger immediate background sync
        fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }).catch((err) => console.warn('Initial sync trigger error:', err));
      }

      // Redirect user back to application with success flag
      return Response.redirect(
        `${appBaseUrl}/settings/google-calendar?connected=true`,
        302
      );
    }

    // -------------------------------------------------------------
    // Authenticate user via JWT for non-callback operations
    // -------------------------------------------------------------
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
      console.error('User auth verification failed:', userError?.message);
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action');

    // -------------------------------------------------------------
    // ROUTE 2: Get Authorization URL
    // -------------------------------------------------------------
    if (action === 'get-auth-url') {
      if (!googleClientId) {
        return new Response(
          JSON.stringify({
            error: 'Google OAuth is not configured on the server (missing GOOGLE_CLIENT_ID)',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate signed, expiring state token tied to this user
      const state = await createOAuthState(user.id, encryptionKey);

      const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' ');

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(googleClientId)}` +
        `&redirect_uri=${encodeURIComponent(googleRedirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(state)}`;

      return new Response(
        JSON.stringify({
          url: authUrl,
          redirectUri: googleRedirectUri,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ROUTE 3: Disconnect Google Calendar
    // -------------------------------------------------------------
    if (action === 'disconnect') {
      // Optional: attempt Google revoke if access token exists
      const { data: tokenRow } = await adminClient
        .from('google_calendar_tokens')
        .select('encrypted_refresh_token')
        .eq('user_id', user.id)
        .single();

      if (tokenRow?.encrypted_refresh_token) {
        try {
          const refreshToken = await decryptToken(tokenRow.encrypted_refresh_token, encryptionKey);
          await revokeGoogleToken(refreshToken);
        } catch (revokeErr) {
          console.warn('Revocation attempt warning:', revokeErr);
        }
      }

      // Atomically disconnect in database
      const { error: rpcError } = await userClient.rpc('disconnect_google_calendar');
      if (rpcError) {
        throw new Error(rpcError.message);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Google Calendar disconnected successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ROUTE 4: Status Check
    // -------------------------------------------------------------
    if (action === 'status') {
      const { data, error } = await userClient.rpc('get_calendar_integration_status');
      if (error) throw new Error(error.message);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('google-calendar-auth error:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
