import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getClientEnvConfig, type ClientEnvConfig } from '../lib/env';
import { getSupabaseBrowserClient, setRememberMePreference, getRememberMePreference } from '../lib/supabaseClient';
import { getAuthCallbackUrl, getPasswordResetUrl } from '../lib/redirectUrl';
import type { Profile } from '../types/models';
import { validateEmailFormat } from '../lib/timeMath';

export type UserWorkspaceRole = 'owner' | 'client' | 'unauthorized';

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
  userRole: UserWorkspaceRole | null;
  isOwner: boolean;
  isClient: boolean;
  clientProjectCount: number;
  signInWithPassword: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; role?: UserWorkspaceRole; error?: string }>;
  signInWithMagicLink: (
    email: string,
    redirectTo?: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (
    email: string,
    redirectTo?: string
  ) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRole: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const KNOWN_WORKSPACE_OWNER_EMAIL = 'ktsujeet1997@gmail.com';
const ROLE_CACHE_KEY_PREFIX = 'mwp_cached_role_';

export function getCachedRole(userId: string, email?: string | null): UserWorkspaceRole | null {
  if (email && email.trim().toLowerCase() === KNOWN_WORKSPACE_OWNER_EMAIL.toLowerCase()) {
    return 'owner';
  }
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
    if (cached === 'owner' || cached === 'client' || cached === 'unauthorized') {
      return cached as UserWorkspaceRole;
    }
  } catch {}
  return null;
}

export function setCachedRole(userId: string, role: UserWorkspaceRole): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`, role);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const env = useMemo(() => getClientEnvConfig(), []);
  const supabase = useMemo(() => getSupabaseBrowserClient(), [env.isSupabaseConfigured]);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserWorkspaceRole | null>(null);
  const [clientProjectCount, setClientProjectCount] = useState<number>(0);
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

  // Authoritative Role Resolution (Workspace Owner vs Client Portal Member vs Unauthorized)
  const resolveUserRole = useCallback(
    async (
      userId: string,
      email: string
    ): Promise<{ role: UserWorkspaceRole; clientProjects: number }> => {
      if (!supabase) return { role: 'unauthorized', clientProjects: 0 };
      const normalizedEmail = email.trim().toLowerCase();

      try {
        // 1. Query public.workspace_roles (enforced by RLS)
        const { data: roleRow } = await supabase
          .from('workspace_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (roleRow?.role === 'owner') {
          return { role: 'owner', clientProjects: 0 };
        }

        // 2. Check accepted project memberships
        const { count: memberCount, error: memberErr } = await supabase
          .from('project_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('membership_status', 'accepted');

        const acceptedCount = !memberErr && typeof memberCount === 'number' ? memberCount : 0;

        if (roleRow?.role === 'client' || acceptedCount > 0) {
          return { role: 'client', clientProjects: acceptedCount };
        }

        // 3. Fallback: Known workspace owner account
        if (normalizedEmail === KNOWN_WORKSPACE_OWNER_EMAIL.toLowerCase()) {
          return { role: 'owner', clientProjects: 0 };
        }

        // 4. Fallback: Check if user owns any projects in the database
        const { count: projectCount } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (projectCount && projectCount > 0) {
          return { role: 'owner', clientProjects: 0 };
        }

        return { role: 'unauthorized', clientProjects: 0 };
      } catch (err) {
        console.warn('Role resolution failed:', err);
        return { role: 'unauthorized', clientProjects: 0 };
      }
    },
    [supabase]
  );

  // Refresh profile action
  const refreshProfile = async () => {
    if (user) {
      const p = await fetchUserProfile(user.id, user.email || '');
      if (p) setProfile(p);
    }
  };

  // Refresh role action
  const refreshRole = async () => {
    if (user) {
      const { role, clientProjects } = await resolveUserRole(user.id, user.email || '');
      setUserRole(role);
      setClientProjectCount(clientProjects);
    }
  };

  // 1. Initial Session Hydration & Subscription
  useEffect(() => {
    if (!supabase || !env.isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Safety timeout: Ensure isLoading is never stuck true if network hangs on startup or offline
    const safetyTimeoutId = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 3000);

    const hydrateInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error: sessionErr } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionErr) {
          setError(sessionErr.message);
          setIsLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          // Immediately restore role synchronously from cache or known owner email to prevent cold start access boundary delays
          const cached = getCachedRole(initialSession.user.id, initialSession.user.email);
          if (cached) {
            setUserRole(cached);
          }

          // Wrap profile and role resolution in a 2-second timeout race so offline startup doesn't stall UI
          const fetchRoleAndProfilePromise = Promise.all([
            fetchUserProfile(initialSession.user.id, initialSession.user.email || ''),
            resolveUserRole(initialSession.user.id, initialSession.user.email || ''),
          ]);

          const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
            setTimeout(() => resolve({ isTimeout: true }), 2000)
          );

          const result = await Promise.race([fetchRoleAndProfilePromise, timeoutPromise]);

          if (isMounted && !('isTimeout' in result)) {
            const [userProf, roleInfo] = result;
            if (userProf) setProfile(userProf);
            setUserRole(roleInfo.role);
            setClientProjectCount(roleInfo.clientProjects);
            setCachedRole(initialSession.user.id, roleInfo.role);
          }
        } else {
          setUserRole(null);
          setClientProjectCount(0);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Session initialization failed');
        }
      } finally {
        if (isMounted) {
          clearTimeout(safetyTimeoutId);
          setIsLoading(false);
        }
      }
    };

    hydrateInitialSession();

    // B. Subscribe to auth state changes (sign-in, token refresh, sign-out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (newSession?.user) {
          try {
            const [userProf, roleInfo] = await Promise.all([
              fetchUserProfile(newSession.user.id, newSession.user.email || ''),
              resolveUserRole(newSession.user.id, newSession.user.email || ''),
            ]);

            if (isMounted) {
              if (userProf) setProfile(userProf);
              setUserRole(roleInfo.role);
              setClientProjectCount(roleInfo.clientProjects);
              setCachedRole(newSession.user.id, roleInfo.role);
            }
          } catch (err) {
            console.warn('Auth state change resolution note:', err);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setSession(null);
        setUser(null);
        setUserRole(null);
        setClientProjectCount(0);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeoutId);
      subscription.unsubscribe();
    };
  }, [supabase, env.isSupabaseConfigured, resolveUserRole]);

  // 2. Email + Password Sign-In
  const signInWithPassword = async (
    email: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; role?: UserWorkspaceRole; error?: string }> => {
    setError(null);

    const validationErr = validateEmailFormat(email);
    if (validationErr) {
      setError(validationErr);
      return { success: false, error: validationErr };
    }

    if (!password) {
      const msg = 'Password is required.';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!supabase || !env.isSupabaseConfigured) {
      const msg = 'Supabase is not configured yet.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      setRememberMePreference(rememberMe);

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        setError(signInErr.message);
        return { success: false, error: signInErr.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        const [prof, roleInfo] = await Promise.all([
          fetchUserProfile(data.user.id, data.user.email || ''),
          resolveUserRole(data.user.id, data.user.email || ''),
        ]);
        if (prof) setProfile(prof);
        setUserRole(roleInfo.role);
        setClientProjectCount(roleInfo.clientProjects);
        setCachedRole(data.user.id, roleInfo.role);

        return { success: true, role: roleInfo.role };
      }

      return { success: true, role: 'owner' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // 3. Email Magic Link Request (Passwordless OTP)
  const signInWithMagicLink = async (
    email: string,
    redirectTo?: string,
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);

    const validationErr = validateEmailFormat(email);
    if (validationErr) {
      setError(validationErr);
      return { success: false, error: validationErr };
    }

    if (!supabase || !env.isSupabaseConfigured) {
      const msg =
        'Supabase is not configured yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env to enable Magic Link sign-in.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      setRememberMePreference(rememberMe);
      const callbackUrl = redirectTo ?? getAuthCallbackUrl();

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

  // 4. Send Password Reset Email
  const resetPasswordForEmail = async (
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
      const msg = 'Supabase is not configured yet.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      const resetUrl = redirectTo ?? getPasswordResetUrl();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: resetUrl }
      );

      if (resetErr) {
        setError(resetErr.message);
        return { success: false, error: resetErr.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // 5. Update Password for Current User
  const updatePassword = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!supabase || !env.isSupabaseConfigured) {
      const msg = 'Supabase is not configured yet.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        setError(updateErr.message);
        return { success: false, error: updateErr.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // 6. Sign Out Action
  const signOut = async (options?: { scope?: 'global' | 'local' | 'others' }) => {
    if (supabase) {
      try {
        await supabase.auth.signOut(options);
      } catch (err) {
        console.warn('Sign-out error:', err);
      }
    }
    if (user?.id) {
      try {
        localStorage.removeItem(`${ROLE_CACHE_KEY_PREFIX}${user.id}`);
      } catch {}
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setUserRole(null);
    setClientProjectCount(0);
    setError(null);
  };

  const clearError = () => setError(null);

  const isOwner = userRole === 'owner';
  const isClient = userRole === 'client';

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
      userRole,
      isOwner,
      isClient,
      clientProjectCount,
      signInWithPassword,
      signInWithMagicLink,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      refreshProfile,
      refreshRole,
      clearError,
    }),
    [
      env,
      session,
      user,
      profile,
      isLoading,
      error,
      userRole,
      isOwner,
      isClient,
      clientProjectCount,
      resolveUserRole,
    ]
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
