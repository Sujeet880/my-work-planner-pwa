import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Input } from '../../components/ui/Field';

export function ResetPasswordPage() {
  const { updatePassword, signOut, isSupabaseConfigured, user, userEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveryValid, setIsRecoveryValid] = useState<boolean | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // 1. Inspect URL parameters and Supabase auth state for recovery validity
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isSupabaseConfigured) {
      setIsRecoveryValid(false);
      setRecoveryError('Authentication service is not configured.');
      return;
    }

    // Check URL hash and search params for Supabase recovery errors or tokens
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);

    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');

    if (errorDesc || errorCode) {
      setIsRecoveryValid(false);
      setRecoveryError(
        errorDesc
          ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
          : 'This password reset link is invalid or has expired.'
      );
      return;
    }

    // Check if URL hash indicates type=recovery or code in search
    const hasRecoveryToken =
      hashParams.get('type') === 'recovery' ||
      hashParams.get('access_token') !== null ||
      searchParams.get('code') !== null;

    // Listen for PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && hasRecoveryToken)) {
        setIsRecoveryValid(true);
        setRecoveryError(null);
      }
    });

    // Verify existing session if token was already exchanged
    supabase.auth.getSession().then(({ data: { session }, error: sessionErr }) => {
      if (sessionErr) {
        setIsRecoveryValid(false);
        setRecoveryError(sessionErr.message);
        return;
      }

      if (session || hasRecoveryToken) {
        setIsRecoveryValid(true);
        setRecoveryError(null);
      } else {
        // No session and no recovery tokens present in URL
        setIsRecoveryValid(false);
        setRecoveryError('No active password recovery session found. Please request a new reset link.');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isSupabaseConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate form submissions
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('New Password and Confirm Password do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const emailForLogin = userEmail || user?.email || '';

      // 1. Update password using Supabase Auth updateUser
      const res = await updatePassword(password);

      if (!res.success) {
        // Do NOT sign out if update failed
        setError(res.error || 'Failed to update password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // 2. Only sign out after password update succeeds (local scope prevents revoking other sessions)
      try {
        await signOut({ scope: 'local' });
      } catch (signOutErr) {
        console.warn('Sign out cleanup warning:', signOutErr);
      }

      // 3. Clear any temporary hash/token from browser address bar
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // 4. Redirect to login page with passwordReset=success and prefilled email
      // Do NOT automatically open Dashboard or Client Portal
      const emailQuery = emailForLogin ? `&email=${encodeURIComponent(emailForLogin)}` : '';
      navigate(`/sign-in?passwordReset=success${emailQuery}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FD] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(59,102,245,0.12),rgba(255,255,255,0))] px-4 py-12">
      <div className="w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#1E40AF] via-[#3B82F6] to-[#818CF8] shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.22),0_10px_25px_rgba(47,101,246,0.35)]">
            <div className="absolute top-1.5 left-2.5 h-4 w-4 rounded-full bg-white/50 blur-[0.8px]" />
            <Lock className="h-6 w-6 text-white stroke-[2.2]" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#1A1F2C]">
            Set New Password
          </h1>
          <p className="mt-1 text-sm text-[#7E8B9B]">
            Create a secure password for your My Work Planner account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] backdrop-blur-2xl sm:p-9">
          {isRecoveryValid === false ? (
            /* Invalid or Expired Recovery Link View */
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FCE8E9] text-[#C2414B]">
                <XCircle className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[#1A1F2C]">Invalid or Expired Link</h2>
              <p className="text-xs text-[#7E8B9B] leading-relaxed">
                {recoveryError ||
                  'This password reset link is invalid or has already expired. Password reset links can only be used once.'}
              </p>
              <div className="pt-3 border-t border-[#F0F2F5] flex flex-col gap-2">
                <Link
                  to="/auth/forgot-password"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2F65F6] py-2.5 text-xs font-semibold text-white shadow-md hover:bg-[#2554DB] transition-all"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Request New Reset Link</span>
                </Link>
                <Link
                  to="/sign-in"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#7E8B9B] hover:text-[#1A1F2C] transition-colors py-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Active Password Reset Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldWrapper id="reset-password" label="New Password" required helperText="Minimum 6 characters">
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                    disabled={isSubmitting}
                    className="pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B9B] hover:text-[#1A1F2C]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FieldWrapper>

              <FieldWrapper id="reset-confirm-password" label="Confirm New Password" required>
                <div className="relative">
                  <Input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isSubmitting}
                    className="pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B9B] hover:text-[#1A1F2C]"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FieldWrapper>

              {error && (
                <div className="rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !password || !confirmPassword}
                className="w-full py-2.5 text-xs font-semibold shadow-md"
              >
                {isSubmitting ? 'Updating Password...' : 'Save New Password'}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/sign-in"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7E8B9B] hover:text-[#1A1F2C] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
