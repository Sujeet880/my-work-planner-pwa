import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnvConfig } from './env';

/**
 * Server-only privileged Supabase client factory.
 * Reserved for authenticated API routes and background operations in Milestones 1–6.
 * Never import this module in frontend code under src/.
 */
export function createSupabaseServerClient(): SupabaseClient | null {
  const env = getServerEnvConfig();
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    return null;
  }

  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
