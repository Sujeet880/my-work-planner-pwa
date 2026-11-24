import { getAppBaseUrl } from './redirectUrl';

export interface ClientEnvConfig {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  appBaseUrl: string;
  vapidPublicKey: string | null;
  isSupabaseConfigured: boolean;
  missingClientVars: string[];
}

function readEnvValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Safely validates browser-safe VITE_* environment variables.
 * Never expects or reads server secrets (SUPABASE_SECRET_KEY, GOOGLE_CLIENT_SECRET).
 */
export function getClientEnvConfig(): ClientEnvConfig {
  const supabaseUrl = readEnvValue(
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_SUPABASE_URL
      : undefined) ??
      (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined)
  );
  const supabasePublishableKey = readEnvValue(
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      : undefined) ??
      (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined)
  );
  const appBaseUrl = getAppBaseUrl();

  const vapidPublicKey = readEnvValue(
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_VAPID_PUBLIC_KEY
      : undefined) ??
      (typeof process !== 'undefined' ? process.env?.VITE_VAPID_PUBLIC_KEY : undefined)
  );

  const missingClientVars: string[] = [];
  if (!supabaseUrl) missingClientVars.push('VITE_SUPABASE_URL');
  if (!supabasePublishableKey) missingClientVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');

  return {
    supabaseUrl,
    supabasePublishableKey,
    appBaseUrl,
    vapidPublicKey,
    isSupabaseConfigured: missingClientVars.length === 0,
    missingClientVars,
  };
}
