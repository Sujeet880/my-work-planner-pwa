/**
 * My Work Planner — Native Mini Timer Pairing Service
 * Handles secure account linking between the authenticated web session and the macOS Native Mini Timer.
 */

import { getSupabaseBrowserClient } from '../lib/supabaseClient';

export interface NativeTimerPairingResult {
  success: boolean;
  pairingCode?: string;
  expiresAt?: string;
  error?: string;
}

export const nativeTimerService = {
  /**
   * Generates a registered custom callback URL for the native application.
   */
  getCallbackUrl(pairingCode: string): string {
    const cleanCode = encodeURIComponent(pairingCode.trim());
    return `myworkplanner-minitimer://auth/callback?code=${cleanCode}`;
  },

  /**
   * Generates a direct authenticated session handoff callback URL for the native application.
   * Enables seamless account linking using the active web session tokens.
   */
  getSessionHandoffUrl(accessToken: string, refreshToken: string): string {
    const encAccess = encodeURIComponent(accessToken.trim());
    const encRefresh = encodeURIComponent(refreshToken.trim());
    return `myworkplanner-minitimer://auth/callback#access_token=${encAccess}&refresh_token=${encRefresh}&token_type=bearer`;
  },

  /**
   * Validates pairing code format (64-character hexadecimal string).
   */
  isValidPairingCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim();
    return clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean);
  },

  /**
   * Requests a secure single-use pairing authorization from the server Edge Function.
   */
  async createPairingAuthorization(): Promise<NativeTimerPairingResult> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured.' };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        return { success: false, error: 'Active user session is required.' };
      }

      const { data, error } = await supabase.functions.invoke('native-timer-pairing', {
        body: { action: 'create' },
      });

      if (error || !data?.pairingCode) {
        return {
          success: false,
          error: error?.message || data?.error || 'Failed to generate pairing authorization.',
        };
      }

      return {
        success: true,
        pairingCode: data.pairingCode,
        expiresAt: data.expiresAt,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unexpected error during pairing authorization request.',
      };
    }
  },
};
