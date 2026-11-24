// supabase/functions/send-client-invitation/index.ts
// Server-side Edge Function for sending secure client collaboration invitations with delivery lifecycle tracking.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

interface InvitePayload {
  projectId: string;
  invitedEmail: string;
  personalMessage?: string;
  resend?: boolean;
  isCopyLinkOnly?: boolean;
}

// Generates a cryptographically secure random token (48 hex characters)
function generateSecureToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 token hashing
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const configuredBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://my-work-planner-pwa.vercel.app';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase server configuration is missing.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate caller using Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired user session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callingUser = userData.user;

    // 2. Parse request payload
    let payload: InvitePayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { projectId, invitedEmail, personalMessage, resend = false, isCopyLinkOnly = false } = payload;
    const cleanEmail = (invitedEmail || '').trim().toLowerCase();

    if (!projectId || !cleanEmail || !cleanEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid projectId and client email are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate secure token & hash (7-day expiry)
    const rawToken = generateSecureToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Create or update invitation atomically via database RPC
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const shouldIncrementResend = Boolean(resend && !isCopyLinkOnly);
    const isReissue = Boolean(resend || isCopyLinkOnly);

    const { data: rpcRes, error: rpcErr } = await userClient.rpc(
      'rpc_create_or_resend_invitation',
      {
        p_project_id: projectId,
        p_invited_email: cleanEmail,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_resend: isReissue,
        p_increment_resend: shouldIncrementResend,
      }
    );

    if (rpcErr || !rpcRes?.success) {
      return new Response(
        JSON.stringify({ error: rpcErr?.message || rpcRes?.error || 'Failed to register invitation.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invitationId = rpcRes.invitation_id;
    const projectName = rpcRes.project_name || 'Shared Project';
    const inviterName = callingUser.user_metadata?.full_name || callingUser.email || 'A team member';

    // 5. Construct canonical invitation URL
    const clientOrigin = req.headers.get('Origin') || req.headers.get('Referer') || '';
    let appBaseUrl = configuredBaseUrl;
    if (clientOrigin.includes('localhost:3000')) {
      appBaseUrl = 'http://localhost:3000';
    } else if (clientOrigin.includes('localhost:3001')) {
      appBaseUrl = 'http://localhost:3001';
    } else if (clientOrigin.includes('my-work-planner-pwa.vercel.app')) {
      appBaseUrl = 'https://my-work-planner-pwa.vercel.app';
    }

    const inviteLink = `${appBaseUrl}/invite/${rawToken}`;

    // 6. If request is ONLY to copy/generate link, return immediately without touching email delivery
    if (isCopyLinkOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          invitationId,
          invitedEmail: cleanEmail,
          projectName,
          rawToken,
          inviteLink,
          emailDelivery: 'queued',
          provider: 'copy_link_only',
          deliveryError: null,
          isCopyLinkOnly: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Check whether recipient already exists in Supabase Auth
    let isExistingAuthUser = false;
    try {
      const { data: authStatus } = await adminClient.rpc('rpc_check_auth_user_status', {
        p_email: cleanEmail,
      });
      if (authStatus && typeof authStatus === 'object' && authStatus.exists) {
        isExistingAuthUser = true;
      }
    } catch (checkErr) {
      console.warn('rpc_check_auth_user_status warning:', checkErr);
    }

    // 8. Email Dispatch Engine
    let emailDelivery: 'sent' | 'failed' = 'failed';
    let providerName = 'none';
    let providerMessageId: string | null = null;
    let deliveryError: string | null = null;

    // Path A: Dedicated Transactional Email API (Resend API)
    if (resendApiKey) {
      try {
        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#F4F7FD;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1F2C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background:#FFF;border-radius:24px;border:1px solid #E9ECF5;box-shadow:0 12px 35px rgba(25,45,100,0.06);overflow:hidden;text-align:left;">
        <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #F0F2F5;">
          <span style="font-size:18px;font-weight:700;color:#1A1F2C;">My Work Planner</span>
          <span style="font-size:12px;color:#7E8B9B;display:block;">Client Collaboration Portal</span>
        </td></tr>
        <tr><td style="padding:32px 36px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1F2C;">You've been invited to collaborate</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475467;">
            <strong>${inviterName}</strong> has invited you to collaborate on the project <strong>"${projectName}"</strong> in My Work Planner.
          </p>
          ${personalMessage ? `<div style="margin:16px 0;padding:14px 18px;background:#F8FAFD;border-left:3px solid #2F65F6;border-radius:8px;font-size:13px;color:#344054;"><em>"${personalMessage}"</em></div>` : ''}
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475467;">
            In the Client Portal, you can track deliverable progress, review milestones, and participate in project discussions.
          </p>
          <table border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
            <tr><td style="border-radius:14px;background:#2F65F6;text-align:center;">
              <a href="${inviteLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#FFF;text-decoration:none;border-radius:14px;background:#2F65F6;">
                Accept Project Invitation
              </a>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#7E8B9B;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteLink}" style="color:#2F65F6;word-break:break-all;">${inviteLink}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;background:#F8FAFD;border-top:1px solid #F0F2F5;font-size:11px;color:#9AA6B8;text-align:center;">
          My Work Planner &bull; Private Personal Productivity &amp; Client Collaboration
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const fromAddress = Deno.env.get('RESEND_FROM_EMAIL') || 'My Work Planner <notifications@myworkplanner.com>';

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromAddress,
            to: cleanEmail,
            subject: `You've been invited to collaborate on ${projectName}`,
            html: emailHtml,
          }),
        });

        const resendData = await resendResponse.json();
        if (resendResponse.ok && resendData?.id) {
          emailDelivery = 'sent';
          providerName = 'resend';
          providerMessageId = resendData.id;
        } else {
          deliveryError = resendData?.message || 'Resend API returned an error';
        }
      } catch (sendErr) {
        deliveryError = sendErr instanceof Error ? sendErr.message : 'Failed to reach email provider';
      }
    }

    // Path B: Supabase Auth Invitation for NEW users only
    if (emailDelivery !== 'sent') {
      if (isExistingAuthUser) {
        // User is already registered in Auth: do NOT call inviteUserByEmail
        emailDelivery = 'failed';
        providerName = 'none';
        deliveryError =
          'Recipient already has a registered account. Transactional email provider not configured in Supabase secrets (set RESEND_API_KEY). Share the secure link below directly.';
      } else {
        // Brand new user: use Supabase Auth inviteUserByEmail
        try {
          const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
            redirectTo: inviteLink,
            data: {
              project_name: projectName,
              inviter_name: inviterName,
            },
          });

          if (!inviteError) {
            emailDelivery = 'sent';
            providerName = 'supabase_auth';
            providerMessageId = `auth_invite_${Date.now()}`;
            deliveryError = null;
          } else {
            deliveryError = inviteError.message;
          }
        } catch (authSendErr) {
          deliveryError = authSendErr instanceof Error ? authSendErr.message : 'Supabase Auth invite failed';
        }
      }
    }

    // 9. Update delivery status in database
    await adminClient.rpc('rpc_update_invitation_delivery', {
      p_invitation_id: invitationId,
      p_status: emailDelivery,
      p_provider_message_id: providerMessageId,
      p_error: deliveryError,
    });

    return new Response(
      JSON.stringify({
        success: true,
        invitationId,
        invitedEmail: cleanEmail,
        projectName,
        rawToken,
        inviteLink,
        emailDelivery,
        provider: providerName,
        deliveryError,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (globalErr) {
    return new Response(
      JSON.stringify({ error: globalErr instanceof Error ? globalErr.message : 'Internal server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
