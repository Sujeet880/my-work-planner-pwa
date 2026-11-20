import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getClientEnvConfig } from './env';

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a configured browser Supabase client when VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY are set. Returns null cleanly in Milestone 0
 * before external Supabase provisioning is approved by the owner.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = getClientEnvConfig();
  if (!config.isSupabaseConfigured || !config.supabaseUrl || !config.supabasePublishableKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return cachedClient;
}

export function isSupabaseClientReady(): boolean {
  return getClientEnvConfig().isSupabaseConfigured;
}
