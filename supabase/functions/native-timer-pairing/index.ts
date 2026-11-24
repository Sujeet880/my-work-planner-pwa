// supabase/functions/native-timer-pairing/index.ts
// Server-side Edge Function for pairing the web app session with the Native macOS Mini Focus Timer.
// Generates short-lived (90-second) single-use pairing codes and performs atomic token-hash exchange.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// 64-character cryptographically secure hex pairing code generator
function generatePairingCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash generator
async function hashPairingCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toLowerCase());
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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase server configuration is missing.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let payload: { action?: string; code?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = payload;

    // =========================================================================
    // Action A: Create Pairing Authorization (Called by Authenticated Web App)
    // =========================================================================
    if (action === 'create') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Authentication required to initiate pairing.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user || !userData.user.email) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired user session.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const user = userData.user;

      // 1. Generate 64-char single-use pairing code and SHA-256 hash
      const rawPairingCode = generatePairingCode();
      const codeHash = await hashPairingCode(rawPairingCode);

      // 2. Generate Supabase magiclink token for the existing user via Admin API
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        return new Response(
          JSON.stringify({
            error: linkErr?.message || 'Failed to generate secure authentication link.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenHash = linkData.properties.hashed_token;
      const expiresAt = new Date(Date.now() + 90 * 1000).toISOString(); // 90 seconds lifetime

      // 3. Atomically persist pairing record
      const { error: insertErr } = await adminClient.from('native_timer_pairing_codes').insert({
        user_id: user.id,
        code_hash: codeHash,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      if (insertErr) {
        return new Response(
          JSON.stringify({
            error: `Failed to register pairing code: ${insertErr.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return the unhashed raw pairing code strictly to the authenticated caller
      return new Response(
        JSON.stringify({
          success: true,
          pairingCode: rawPairingCode,
          expiresAt,
          userId: user.id,
          email: user.email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // Action B: Exchange Pairing Code (Called by Native macOS App)
    // =========================================================================
    if (action === 'exchange') {
      const code = (payload.code || '').trim().toLowerCase();
      if (!code || code.length < 32) {
        return new Response(
          JSON.stringify({ error: 'Valid pairing code is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const codeHash = await hashPairingCode(code);
      const nowIso = new Date().toISOString();

      // 1. Find unredeemed, unexpired pairing record
      const { data: pairingRow, error: findErr } = await adminClient
        .from('native_timer_pairing_codes')
        .select('id, user_id, token_hash, expires_at, redeemed_at')
        .eq('code_hash', codeHash)
        .is('redeemed_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle();

      if (findErr || !pairingRow) {
        return new Response(
          JSON.stringify({ error: 'Pairing code is invalid, expired, or already redeemed.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Mark code as redeemed atomically
      await adminClient
        .from('native_timer_pairing_codes')
        .update({ redeemed_at: nowIso })
        .eq('id', pairingRow.id)
        .is('redeemed_at', null);

      // 3. Resolve user identity and profile
      const { data: userRecord } = await adminClient.auth.admin.getUserById(pairingRow.user_id);
      const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', pairingRow.user_id)
        .maybeSingle();

      const userEmail = userRecord?.user?.email || profile?.email || '';
      const fullName = profile?.full_name || userEmail.split('@')[0] || 'User';

      return new Response(
        JSON.stringify({
          success: true,
          tokenHash: pairingRow.token_hash,
          userId: pairingRow.user_id,
          email: userEmail,
          fullName,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: '${action}'` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error in pairing exchange.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
