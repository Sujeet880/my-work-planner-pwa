import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Info, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { validateEmailFormat } from '../../lib/timeMath';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Input } from '../../components/ui/Field';

export function SignInPage() {
  const { isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const validationError = validateEmailFormat(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    if (!isSupabaseConfigured) {
      setFeedback(
        'Supabase Auth is not connected yet (Milestone 0). Real Magic Link sign-in will be enabled in Milestone 1 once Supabase credentials are configured.'
      );
      return;
    }

    setFeedback('Supabase client ready. Magic Link dispatch will be wired in Milestone 1.');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F7F9] px-4 py-10">
      <div className="w-full max-w-[420px]">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4968D6] text-white shadow-[0_2px_6px_rgba(73,104,214,0.25)]">
            <CheckSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#202531]">
            My Work Planner
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Private personal workspace for daily planning and time tracking
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[#202531]">Sign in with Magic Link</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#667085]">
              Enter your authorized owner email address to receive a one-time sign-in link. Public
              registration is disabled.
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
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]"
                  aria-hidden="true"
                />
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="you@example.com"
                  hasError={Boolean(error)}
                  className="pl-9"
                />
              </div>
            </FieldWrapper>

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Send Magic Link
            </Button>
          </form>

          {feedback && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#E4E7EC] bg-[#EDF1FF]/70 p-3 text-xs leading-relaxed text-[#202531]"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4968D6]" />
              <span>{feedback}</span>
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="mt-5 rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#202531]">
                <Lock className="h-3.5 w-3.5 text-[#667085]" />
                <span>Milestone 0 Configuration Notice</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#667085]">
                External Supabase Auth credentials are intentionally not configured in Milestone 0.
                Once approved in Milestone 1, all application routes will require an authenticated
                owner session.
              </p>
              <Link
                to="/dashboard"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#4968D6] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Milestone 0 Shell Preview</span>
              </Link>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[#98A2B3]">
          Private single-owner application · No third-party tracking
        </p>
      </div>
    </div>
  );
}
