import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';

export function AuthCallbackPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const targetRedirect = sessionStorage.getItem('auth_redirect_to') || '/dashboard';

    // 1. If already authenticated via onAuthStateChange, navigate immediately
    if (isAuthenticated) {
      sessionStorage.removeItem('auth_redirect_to');
      navigate(targetRedirect, { replace: true });
      return;
    }

    // 2. Check for error parameters in query string or hash fragment
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);

    const queryError = urlParams.get('error') || hashParams.get('error');
    const queryErrorDesc =
      urlParams.get('error_description') || hashParams.get('error_description');

    if (queryError || queryErrorDesc) {
      setErrorMsg(
        queryErrorDesc
          ? decodeURIComponent(queryErrorDesc.replace(/\+/g, ' '))
          : 'The authentication link is invalid or has expired. Please request a new one.'
      );
      setIsProcessing(false);
      return;
    }

    // 3. Handle PKCE code exchange if present
    const code = urlParams.get('code');
    const supabase = getSupabaseBrowserClient();

    if (code && supabase) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            setErrorMsg(error.message);
            setIsProcessing(false);
          } else {
            // Clean URL and redirect to destination
            window.history.replaceState({}, document.title, window.location.pathname);
            sessionStorage.removeItem('auth_redirect_to');
            navigate(targetRedirect, { replace: true });
          }
        })
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Authentication exchange failed');
          setIsProcessing(false);
        });
      return;
    }

    // 4. Fallback timer if hash tokens are being processed by supabase-js
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        setIsProcessing(false);
        setErrorMsg('Authentication timed out or link is expired. Please try signing in again.');
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate, searchParams]);

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
          <p className="mt-1 text-sm text-[#7E8B9B]">Authenticating your personal workspace</p>
        </div>

        {/* Callback Card */}
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] backdrop-blur-2xl sm:p-9 text-center">
          {isProcessing ? (
            <div className="space-y-4 py-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6] animate-pulse">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-[#1A1F2C]">Verifying your sign-in link...</h2>
              <p className="text-xs text-[#7E8B9B] max-w-sm mx-auto leading-relaxed">
                Establishing a secure encrypted session for your personal workspace. You will be
                redirected shortly.
              </p>
            </div>
          ) : errorMsg ? (
            <div className="space-y-5 py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FCE8E9] text-[#C2414B]">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1A1F2C]">Authentication Failed</h2>
                <p className="mt-1.5 text-xs text-[#C2414B] leading-relaxed max-w-sm mx-auto">
                  {errorMsg}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => navigate('/sign-in', { replace: true })}
                className="w-full flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Sign In</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5EF] text-[#16845B]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-[#1A1F2C]">Session Verified</h2>
              <p className="text-xs text-[#7E8B9B]">Redirecting to your workspace...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
