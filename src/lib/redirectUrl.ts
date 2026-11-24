/**
 * Centralized, Environment-Aware Redirect URL Strategy
 * Ensures production uses https://my-work-planner-pwa.vercel.app
 * while local development continues to use http://localhost:3000.
 */

const PRODUCTION_DOMAIN = 'https://my-work-planner-pwa.vercel.app';
const LOCAL_DEV_DOMAIN = 'http://localhost:3000';

/**
 * Returns the canonical base URL for the current runtime environment.
 * In the browser, dynamically evaluates window.location.origin to match the active host.
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;

    // Localhost / loopback check
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    ) {
      return origin;
    }

    // Production Vercel or preview domains
    if (window.location.hostname.includes('vercel.app')) {
      return origin;
    }

    return origin;
  }

  // Server / build-time fallback
  const envBase =
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_APP_BASE_URL
      : undefined) ??
    (typeof process !== 'undefined' ? process.env?.VITE_APP_BASE_URL : undefined);

  if (envBase && typeof envBase === 'string' && envBase.trim().length > 0) {
    const trimmed = envBase.trim();
    // Prevent baking localhost into production builds
    if (process.env.NODE_ENV === 'production' && trimmed.includes('localhost')) {
      return PRODUCTION_DOMAIN;
    }
    return trimmed;
  }

  return PRODUCTION_DOMAIN;
}

/**
 * Returns the canonical Auth Callback URL for Magic Links, OAuth, and OTP confirmations.
 */
export function getAuthCallbackUrl(): string {
  return `${getAppBaseUrl()}/auth/callback`;
}

/**
 * Returns the canonical Password Reset URL for password recovery emails.
 */
export function getPasswordResetUrl(): string {
  return `${getAppBaseUrl()}/auth/reset-password`;
}

/**
 * Returns the canonical invitation acceptance URL for a given raw token.
 */
export function getInvitationUrl(rawToken: string): string {
  return `${getAppBaseUrl()}/invite/${rawToken}`;
}
