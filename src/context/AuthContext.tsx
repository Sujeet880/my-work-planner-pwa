import React, { createContext, useContext, useMemo } from 'react';
import { getClientEnvConfig, type ClientEnvConfig } from '../lib/env';

export interface AuthContextValue {
  env: ClientEnvConfig;
  isSupabaseConfigured: boolean;
  /**
   * True only when a real Supabase authenticated session exists (Milestone 1+).
   * Never fabricated in Milestone 0.
   */
  isAuthenticated: boolean;
  /**
   * Transparent Milestone 0 preview flag so the owner can inspect the full
   * application shell and layouts before Supabase provisioning is approved.
   */
  isMilestone0Preview: boolean;
  userEmail: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const env = useMemo(() => getClientEnvConfig(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      env,
      isSupabaseConfigured: env.isSupabaseConfigured,
      isAuthenticated: false,
      isMilestone0Preview: !env.isSupabaseConfigured,
      userEmail: null,
    }),
    [env]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
