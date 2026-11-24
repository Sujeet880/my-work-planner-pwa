import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { validateEmailFormat } from '../../lib/timeMath';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Input } from '../../components/ui/Field';

/**
 * Maps raw Supabase Auth and network error messages into friendly, user-facing explanations.
 */
export function formatAuthError(errorMsg?: string): string {
  if (!errorMsg) return 'Invalid email or password.';
  const lower = errorMsg.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please check your inbox for the confirmation email.';
  }
  if (
    lower.includes('too many') ||
    lower.includes('rate limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Too many login attempts. Please wait a moment before trying again.';
  }
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection')
  ) {
    return 'Network connection problem. Please verify your internet connection and try again.';
  }
  if (lower.includes('service unavailable') || lower.includes('503') || lower.includes('502')) {
    return 'Authentication service is temporarily unavailable. Please try again in a few moments.';
  }
  if (lower.includes('user not found')) {
    return 'No account found with this email address.';
  }
  return errorMsg;
}

export function SignInPage() {
  const {
    isSupabaseConfigured,
    isAuthenticated,
    isOwner,
    isClient,
    signInWithPassword,
    signInWithMagicLink,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Mode: 'password' (default) vs 'magic_link'
  const [authMode, setAuthMode] = useState<'password' | 'magic_link'>('password');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const isPasswordResetSuccess = searchParams.get('passwordReset') === 'success';

  // Read returnTo or email query params
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
    const modeParam = searchParams.get('mode');
    if (modeParam === 'magic_link') {
      setAuthMode('magic_link');
    } else if (modeParam === 'password') {
      setAuthMode('password');
    }
    if (isPasswordResetSuccess) {
      setAuthMode('password');
    }
  }, [searchParams, isPasswordResetSuccess]);

  // Handle post-auth redirect & stale recovery session cleanup
  useEffect(() => {
    // If arriving with passwordReset=success and an active session exists on initial mount,
    // clear it locally so user can authenticate fresh with their newly created password.
    if (isPasswordResetSuccess && isAuthenticated) {
      signOut({ scope: 'local' });
      return;
    }

    // Direct visit redirect for already authenticated users
    if (isAuthenticated && !isPasswordResetSuccess) {
      const returnTo = searchParams.get('returnTo');
      const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      const target = returnTo || fromPath;

      if (target) {
        navigate(target, { replace: true });
      } else if (isClient && !isOwner) {
        navigate('/portal', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isOwner, isClient, navigate, location.state, searchParams, isPasswordResetSuccess, signOut]);

  // Resend cooldown timer for magic link
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submit
    setError(null);

    const validationError = validateEmailFormat(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError(
        'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signInWithPassword(email, password, rememberMe);
      if (!res.success) {
        setError(formatAuthError(res.error));
      } else {
        // Successful login: perform immediate role-based navigation!
        const returnTo = searchParams.get('returnTo');
        const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
        const target = returnTo || fromPath;

        if (target) {
          navigate(target, { replace: true });
        } else if (res.role === 'client') {
          navigate('/portal', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateEmailFormat(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isSupabaseConfigured) {
      setError(
        'Supabase is not configured yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signInWithMagicLink(email, undefined, rememberMe);
      if (res.success) {
        setMagicLinkSent(true);
        setResendCooldown(60);
      } else {
        setError(res.error || 'Failed to send magic link. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendMagicLink = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await signInWithMagicLink(email, undefined, rememberMe);
      if (res.success) {
        setResendCooldown(60);
      } else {
        setError(res.error || 'Failed to resend magic link.');
      }
    } finally {
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
            <CheckSquare className="h-7 w-7 text-white stroke-[2.2]" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#1A1F2C]">
            My Work Planner
          </h1>
          <p className="mt-1 text-sm text-[#7E8B9B]">
            Personal workspace &amp; secure client project portal
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] backdrop-blur-2xl sm:p-9">
          {/* Password Reset Success Notice */}
          {isPasswordResetSuccess && (
            <div className="mb-6 rounded-2xl border border-[#BDE8C8] bg-[#EAF7EE] p-4 text-xs text-[#16845B] flex items-start gap-2.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Password Reset Successful</p>
                <p className="text-[#344054]">
                  Your password has been reset successfully. Please sign in with your new password.
                </p>
              </div>
            </div>
          )}

          {/* Dual Mode Switcher */}
          <div className="mb-6 flex rounded-2xl bg-[#F0F4FA] p-1 border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setError(null);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                authMode === 'password'
                  ? 'bg-white text-[#1A1F2C] shadow-sm'
                  : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
              }`}
            >
              Email &amp; Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic_link');
                setError(null);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                authMode === 'magic_link'
                  ? 'bg-white text-[#1A1F2C] shadow-sm'
                  : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
              }`}
            >
              Magic Link
            </button>
          </div>

          {authMode === 'password' ? (
            /* TAB 1: Email + Password Sign In */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <FieldWrapper id="signin-email" label="Email Address" required>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7E8B9B]" />
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    className="pl-10 text-sm"
                  />
                </div>
              </FieldWrapper>

              <FieldWrapper id="signin-password" label="Password" required>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7E8B9B]" />
                  <Input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="pl-10 pr-10 text-sm"
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

              {/* Remember Me Checkbox & Forgot Password Link */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#475467]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                  <span>Remember me</span>
                </label>

                <Link
                  to="/auth/forgot-password"
                  className="font-semibold text-[#2F65F6] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full py-2.5 text-xs font-semibold shadow-md"
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          ) : !magicLinkSent ? (
            /* TAB 2: Magic Link Request Form */
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
              <p className="text-xs text-[#7E8B9B] leading-relaxed mb-2">
                Enter your email address to receive a secure, one-click passwordless sign-in link.
              </p>

              <FieldWrapper id="signin-magic-email" label="Email Address" required>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7E8B9B]" />
                  <Input
                    id="signin-magic-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    className="pl-10 text-sm"
                  />
                </div>
              </FieldWrapper>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#475467]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>

              {error && (
                <div className="rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full py-2.5 text-xs font-semibold shadow-md"
              >
                {isSubmitting ? 'Sending Magic Link...' : 'Send Magic Link'}
              </Button>
            </form>
          ) : (
            /* Magic Link Sent Confirmation */
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF7EE] text-[#16845B]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[#1A1F2C]">Magic Link Sent!</h2>
              <p className="text-xs text-[#7E8B9B] leading-relaxed">
                We sent a secure sign-in link to <strong className="text-[#1A1F2C]">{email}</strong>.
                Click the link in the email to sign in instantly.
              </p>

              <div className="pt-3 border-t border-[#F0F2F5] space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={resendCooldown > 0 || isSubmitting}
                  onClick={handleResendMagicLink}
                  className="w-full text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : 'Resend Magic Link'}
                  </span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setMagicLinkSent(false);
                    setError(null);
                  }}
                  className="text-xs font-semibold text-[#7E8B9B] hover:text-[#1A1F2C] transition-colors"
                >
                  Use a different email or sign in with password
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security / Privacy Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[#7E8B9B]">
          <Shield className="h-4 w-4 text-[#2F65F6]" />
          <span>PostgreSQL Row-Level Security &amp; End-to-End Encrypted Auth</span>
        </div>
      </div>
    </div>
  );
}
