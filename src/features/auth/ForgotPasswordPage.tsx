import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { validateEmailFormat } from '../../lib/timeMath';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Input } from '../../components/ui/Field';

export function ForgotPasswordPage() {
  const { isSupabaseConfigured, resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationErr = validateEmailFormat(email);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordForEmail(email);
      if (res.success) {
        setSentSuccess(true);
      } else {
        setError(res.error || 'Failed to send password reset email.');
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
            <KeyRound className="h-6 w-6 text-white stroke-[2.2]" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#1A1F2C]">
            Reset Password
          </h1>
          <p className="mt-1 text-sm text-[#7E8B9B]">
            Enter your email to receive a password reset link
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] backdrop-blur-2xl sm:p-9">
          {sentSuccess ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF7EE] text-[#16845B]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[#1A1F2C]">Check your email</h2>
              <p className="text-xs text-[#7E8B9B] leading-relaxed">
                We sent a secure password reset link to <strong className="text-[#1A1F2C]">{email}</strong>.
                Click the link in the email to choose a new password.
              </p>
              <div className="pt-3 border-t border-[#F0F2F5]">
                <Link
                  to="/sign-in"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldWrapper id="forgot-email" label="Account Email Address" required>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7E8B9B]" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    autoFocus
                    required
                    className="pl-10 text-sm"
                  />
                </div>
              </FieldWrapper>

              {error && (
                <div className="rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-start gap-2">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full py-2.5 text-xs font-semibold shadow-md"
              >
                {isSubmitting ? 'Sending Reset Link...' : 'Send Password Reset Link'}
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
