import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Lock,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { validateEmailFormat } from '../../lib/timeMath';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Input } from '../../components/ui/Field';

export function SignInPage() {
  const { isSupabaseConfigured, isAuthenticated, signInWithMagicLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(fromPath || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateEmailFormat(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isSupabaseConfigured) {
      setError(
        'Supabase is not configured yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env to enable real magic link authentication.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      if (fromPath) {
        sessionStorage.setItem('auth_redirect_to', fromPath);
      }
      const res = await signInWithMagicLink(email);
      if (res.success) {
        setSentSuccess(true);
        setResendCooldown(60);
      } else {
        setError(res.error || 'Failed to send magic link. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await signInWithMagicLink(email);
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
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#1A1F2C]">
            My Work Planner
          </h1>
          <p className="mt-1 text-sm text-[#7E8B9B]">
            Private personal workspace for daily planning and time tracking
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] backdrop-blur-2xl sm:p-9">
          {!sentSuccess ? (
            /* State 1: Magic Link Request Form */
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#1A1F2C]">Sign in with Magic Link</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#7E8B9B]">
                  Enter your email address to receive a secure passwordless sign-in link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FieldWrapper
                  id="signin-email"
                  label="Email Address"
                  required
                  error={error ?? undefined}
                >
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA6B8]"
                      aria-hidden="true"
                    />
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="you@example.com"
                      hasError={Boolean(error)}
                      className="pl-10"
                    />
                  </div>
                </FieldWrapper>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  disabled={!email.trim() || isSubmitting}
                  className="w-full shadow-[0_4px_14px_rgba(47,101,246,0.35)]"
                >
                  Send Magic Link
                </Button>
              </form>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#F5C2C7] bg-[#FCE8E9] p-3 text-xs leading-relaxed text-[#C2414B]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!isSupabaseConfigured && (
                <div className="mt-6 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1F2C]">
                    <Lock className="h-3.5 w-3.5 text-[#7E8B9B]" />
                    <span>Supabase Configuration Notice</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#7E8B9B]">
                    Supabase credentials are not configured in this environment yet. Configure{' '}
                    <code className="text-[#2F65F6] font-semibold">VITE_SUPABASE_URL</code> and{' '}
                    <code className="text-[#2F65F6] font-semibold">VITE_SUPABASE_PUBLISHABLE_KEY</code>{' '}
                    in your hosting platform settings (e.g., Vercel Project Settings) or local{' '}
                    <code className="text-[#1A1F2C]">.env</code> to activate real Supabase Magic Link
                    authentication.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* State 2: Check Your Email Confirmation */
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6] shadow-sm">
                <CheckCircle2 className="h-7 w-7 stroke-[2.5]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#1A1F2C]">Check your email</h2>
                <p className="mt-2 text-xs leading-relaxed text-[#7E8B9B]">
                  We sent a secure magic sign-in link to:
                </p>
                <div className="mt-1.5 inline-block rounded-full bg-[#EDF2FE] px-3.5 py-1 text-xs font-bold text-[#2F65F6]">
                  {email}
                </div>
              </div>

              <p className="text-xs text-[#7E8B9B] leading-relaxed">
                Click the link in the email to open your personal workspace. You can close this
                window once signed in.
              </p>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-[#F5C2C7] bg-[#FCE8E9] p-3 text-left text-xs leading-relaxed text-[#C2414B]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isSubmitting}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend Link in ${resendCooldown}s`
                      : 'Resend Magic Link'}
                  </span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setSentSuccess(false);
                    setError(null);
                  }}
                  className="w-full text-xs font-semibold text-[#7E8B9B] hover:text-[#1A1F2C] py-1 cursor-pointer transition-colors"
                >
                  Use a different email address
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#9AA6B8]">
          Private single-owner application · No third-party tracking
        </p>
      </div>
    </div>
  );
}
