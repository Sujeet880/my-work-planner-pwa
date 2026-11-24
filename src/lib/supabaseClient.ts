import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { getClientEnvConfig, type ClientEnvConfig } from './env';

let cachedClient: SupabaseClient<Database> | null = null;

const REMEMBER_ME_STORAGE_KEY = 'my_work_planner_remember_me';
export const AUTH_TOKEN_STORAGE_KEY = 'my_work_planner_auth_token';

/**
 * Persists the user's "Remember Me" preference.
 */
export function setRememberMePreference(remember: boolean): void {
  if (typeof window === 'undefined') return;
  if (remember) {
    localStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'true');
    sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
  } else {
    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    sessionStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'false');
  }
}

/**
 * Reads the current "Remember Me" preference (defaults to true).
 */
export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true;
  if (sessionStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'false') return false;
  return localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== 'false';
}

/**
 * Storage adapter dynamically respecting the "Remember Me" choice.
 * When Remember Me is enabled: persists to localStorage.
 * When Remember Me is disabled: stores strictly in sessionStorage (cleared on browser quit).
 */
const dynamicAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return getRememberMePreference()
      ? localStorage.getItem(key) ?? sessionStorage.getItem(key)
      : sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    if (getRememberMePreference()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

/**
 * Validates the current Vite environment configuration for Supabase.
 * Strictly checks for VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
 */
export function validateSupabaseConfig(): {
  isValid: boolean;
  config: ClientEnvConfig;
  missingVars: string[];
} {
  const config = getClientEnvConfig();
  return {
    isValid: config.isSupabaseConfigured,
    config,
    missingVars: config.missingClientVars,
  };
}

/**
 * Returns a singleton, typed browser Supabase client using createClient.
 * Reads environment variables exclusively through import.meta.env (via getClientEnvConfig).
 * Returns null cleanly if required environment variables are not configured.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const { isValid, config } = validateSupabaseConfig();
  if (!isValid || !config.supabaseUrl || !config.supabasePublishableKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_TOKEN_STORAGE_KEY,
        storage: dynamicAuthStorage,
      },
    });
  }

  return cachedClient;
}

/**
 * Convenience helper returning true if Supabase is fully configured.
 */
export function isSupabaseClientReady(): boolean {
  return validateSupabaseConfig().isValid;
}

/**
 * Performs a safe, non-destructive connection health check against the Supabase Auth endpoint.
 * Does not require any application tables to exist.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  latencyMs?: number;
}> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    const { missingVars } = validateSupabaseConfig();
    return {
      ok: false,
      message: `Supabase client is not configured. Missing variables in .env.local: ${missingVars.join(', ')}`,
    };
  }

  const start = Date.now();
  try {
    // getSession reads local storage and contacts Auth endpoint if token needs refresh
    const { error } = await client.auth.getSession();
    const latencyMs = Date.now() - start;

    if (error) {
      return {
        ok: false,
        message: `Supabase connection error: ${error.message}`,
        latencyMs,
      };
    }

    return {
      ok: true,
      message: 'Supabase client initialized and connected successfully.',
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown connection error',
      latencyMs,
    };
  }
}

/**
 * Singleton proxy export for convenient direct imports:
 * import { supabase } from '@/lib/supabaseClient';
 * Safe to import anywhere: warns if called before credentials are configured.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      console.warn(
        `[Supabase] Attempted to access property '${String(prop)}' before Supabase credentials are configured in .env.`
      );
      return undefined;
    }
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
