/**
 * Server-only environment configuration boundary.
 * This file must NEVER be imported by frontend code under src/.
 */

export interface ServerEnvConfig {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  supabaseSecretKey: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRedirectUri: string | null;
  appBaseUrl: string;
  allowedUserEmails: string[];
}

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getServerEnvConfig(): ServerEnvConfig {
  const rawAllowed = clean(process.env.ALLOWED_USER_EMAILS);
  const allowedUserEmails = rawAllowed
    ? rawAllowed
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    supabaseUrl: clean(process.env.SUPABASE_URL),
    supabasePublishableKey: clean(process.env.SUPABASE_PUBLISHABLE_KEY),
    supabaseSecretKey: clean(process.env.SUPABASE_SECRET_KEY),
    googleClientId: clean(process.env.GOOGLE_CLIENT_ID),
    googleClientSecret: clean(process.env.GOOGLE_CLIENT_SECRET),
    googleRedirectUri: clean(process.env.GOOGLE_REDIRECT_URI),
    appBaseUrl: clean(process.env.APP_BASE_URL) ?? 'http://localhost:3000',
    allowedUserEmails,
  };
}
