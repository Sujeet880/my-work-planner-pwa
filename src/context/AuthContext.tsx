import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getClientEnvConfig, type ClientEnvConfig } from '../lib/env';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { Profile } from '../types/models';
import { validateEmailFormat } from '../lib/timeMath';

export interface AuthContextValue {
  env: ClientEnvConfig;
  isSupabaseConfigured: boolean;
  isAuthenticated: boolean;
  isMilestone0Preview: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userEmail: string | null;
  error: string | null;
  signInWithMagicLink: (
    email: string,
    redirectTo?: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const env = useMemo(() => getClientEnvConfig(), []);
  const supabase = useMemo(() => getSupabaseBrowserClient(), [env.isSupabaseConfigured]);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(env.isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  // Helper to fetch user profile from public.profiles table
  const fetchUserProfile = async (userId: string, userEmail: string): Promise<Profile | null> => {
    if (!supabase) return null;
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('Could not load user profile from database:', profileErr.message);
        return null;
      }

      if (data) {
        return {
          id: data.id,
          email: data.email || userEmail,
          fullName: data.full_name || '',
          timezone: data.timezone || 'Asia/Kolkata',
          dateFormat: (data.date_format as Profile['dateFormat']) || 'DD/MM/YYYY',
          timeFormat: (data.time_format as Profile['timeFormat']) || '12h',
          defaultEventDurationMinutes: data.default_event_duration_minutes ?? 60,
          defaultReminderOffsetMinutes: data.default_reminder_offset_minutes ?? 15,
          notificationsEnabled: data.notifications_enabled ?? true,
          defaultCalendarSyncEnabled: data.default_calendar_sync_enabled ?? false,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }

      // If no profile found (e.g. right after first sign-in before trigger runs), create default
      const defaultProfile = {
        id: userId,
        email: userEmail,
        full_name: '',
        timezone: 'Asia/Kolkata',
        date_format: 'DD/MM/YYYY',
        time_format: '12h',
        default_event_duration_minutes: 60,
        default_reminder_offset_minutes: 15,
        notifications_enabled: true,
        default_calendar_sync_enabled: false,
      };

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .insert(defaultProfile)
        .select()
        .single();

      if (!insertErr && created) {
        return {
          id: created.id,
          email: created.email || userEmail,
          fullName: created.full_name || '',
          timezone: created.timezone,
          dateFormat: created.date_format as Profile['dateFormat'],
          timeFormat: created.time_format as Profile['timeFormat'],
          defaultEventDurationMinutes: created.default_event_duration_minutes,
          defaultReminderOffsetMinutes: created.default_reminder_offset_minutes ?? 15,
          notificationsEnabled: created.notifications_enabled,
          defaultCalendarSyncEnabled: created.default_calendar_sync_enabled,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };
      }
      return null;
    } catch (err) {
      console.warn('Error resolving profile:', err);
      return null;
    }
  };

  // Refresh profile action
  const refreshProfile = async () => {
    if (user) {
      const p = await fetchUserProfile(user.id, user.email || '');
      if (p) setProfile(p);
    }
  };

  // 1. Initial Session Hydration & Subscription
  useEffect(() => {
    if (!supabase || !env.isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // A. Read persisted session from storage
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error: sessionErr }) => {
        if (!isMounted) return;

        if (sessionErr) {
          setError(sessionErr.message);
          setIsLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const userProf = await fetchUserProfile(
            initialSession.user.id,
            initialSession.user.email || ''
          );
          if (isMounted && userProf) {
            setProfile(userProf);
          }
        }

        setIsLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Session initialization failed');
          setIsLoading(false);
        }
      });

    // B. Subscribe to auth state changes (sign-in, token refresh, sign-out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (newSession?.user) {
          const userProf = await fetchUserProfile(
            newSession.user.id,
            newSession.user.email || ''
          );
          if (isMounted && userProf) {
            setProfile(userProf);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setSession(null);
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, env.isSupabaseConfigured]);

  // 2. Email Magic Link Request (Passwordless OTP)
  const signInWithMagicLink = async (
    email: string,
    redirectTo?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);

    const validationErr = validateEmailFormat(email);
    if (validationErr) {
      setError(validationErr);
      return { success: false, error: validationErr };
    }

    if (!supabase || !env.isSupabaseConfigured) {
      const msg =
        'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env to enable Magic Link sign-in.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      const callbackUrl = redirectTo ?? `${env.appBaseUrl}/auth/callback`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: callbackUrl,
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setError(otpError.message);
        return { success: false, error: otpError.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send magic link';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // 3. Sign Out Action
  const signOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign-out error:', err);
      }
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setError(null);
  };

  const clearError = () => setError(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      env,
      isSupabaseConfigured: env.isSupabaseConfigured,
      isAuthenticated: Boolean(session),
      isMilestone0Preview: !env.isSupabaseConfigured,
      isLoading,
      user,
      session,
      profile,
      userEmail: user?.email ?? null,
      error,
      signInWithMagicLink,
      signOut,
      refreshProfile,
      clearError,
    }),
    [env, session, user, profile, isLoading, error]
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
