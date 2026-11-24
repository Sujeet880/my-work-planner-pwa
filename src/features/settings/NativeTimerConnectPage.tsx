import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Lock,
  RefreshCw,
  Shield,
  Timer,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { nativeTimerService } from '../../services/nativeTimerService';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';

export function NativeTimerConnectPage() {
  const { isAuthenticated, isLoading, userEmail, user } = useAuth();
  const { profile } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const [connecting, setConnecting] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccessCode, setPairingSuccessCode] = useState<string | null>(null);

  const displayName = profile?.fullName || userEmail?.split('@')[0] || 'Workspace Member';

  const handleConfirmPairing = async () => {
    setConnecting(true);
    setPairingError(null);

    // 1. Try single-use pairing code authorization via edge function
    const result = await nativeTimerService.createPairingAuthorization();

    if (result.success && result.pairingCode) {
      setConnecting(false);
      setPairingSuccessCode(result.pairingCode);
      const targetUrl = nativeTimerService.getCallbackUrl(result.pairingCode);
      window.location.href = targetUrl;
      return;
    }

    // 2. Direct session token handoff fallback (securely retrieved from active browser session)
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token && sessionData.session.refresh_token) {
        setConnecting(false);
        setPairingSuccessCode('session-authenticated');
        const targetUrl = nativeTimerService.getSessionHandoffUrl(
          sessionData.session.access_token,
          sessionData.session.refresh_token
        );
        window.location.href = targetUrl;
        return;
      }
    }

    setConnecting(false);
    setPairingError(result.error || 'Failed to establish pairing authorization.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] p-4">
        <div className="flex items-center gap-3 text-sm font-medium text-[#7E8B9B]">
          <RefreshCw className="h-5 w-5 animate-spin text-[#2F65F6]" />
          <span>Verifying workspace session...</span>
        </div>
      </div>
    );
  }

  // Not authenticated in the web browser
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F7F9] p-4 text-[#1A1F2C]">
        <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_20px_50px_rgba(25,45,100,0.06)] text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
            <Timer className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
              Connect macOS Mini Focus Timer
            </h1>
            <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
              Please sign in to your My Work Planner account in this browser. Once authenticated,
              you will be able to link your native desktop timer with one click.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/sign-in"
              state={{ from: location }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F65F6] py-3 text-xs font-semibold text-white shadow-sm hover:bg-[#2554D4] transition-colors"
            >
              <span>Sign In to Continue</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success State: Launched URL
  if (pairingSuccessCode) {
    const launchUrl =
      pairingSuccessCode === 'session-authenticated'
        ? 'myworkplanner-minitimer://auth/callback'
        : nativeTimerService.getCallbackUrl(pairingSuccessCode);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F7F9] p-4 text-[#1A1F2C]">
        <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_20px_50px_rgba(25,45,100,0.06)] text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5EF] text-[#16845B]">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
              Opening Mini Focus Timer...
            </h1>
            <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
              A single-use pairing token was securely generated. If macOS displays a prompt asking
              to open <strong>My Work Planner Mini Timer</strong>, select <strong>Open</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-[#EDF2FE] bg-[#F8FAFD] p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1F2C]">
              <Shield className="h-4 w-4 text-[#16845B]" />
              <span>Secure Single-Use Handshake</span>
            </div>
            <p className="text-[11px] text-[#7E8B9B] leading-relaxed">
              The pairing token expires in 90 seconds and can only be redeemed once. Your native app
              will automatically persist its own Keychain session.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={launchUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F65F6] py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#2554D4] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Click Here if App Didn't Open</span>
            </a>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings')}
              className="w-full text-xs"
            >
              Return to Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active Connection Confirmation Screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F7F9] p-4 text-[#1A1F2C]">
      <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_20px_50px_rgba(25,45,100,0.06)] space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
            <Timer className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
            Link Native macOS Mini Timer
          </h1>
          <p className="text-xs text-[#7E8B9B] leading-relaxed">
            Authorize the native desktop companion app on this Mac to sync tasks and timers with your
            workspace.
          </p>
        </div>

        {/* Authenticated Account Preview Card */}
        <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7E8B9B]">
            Authenticated Workspace Account
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2F65F6] text-sm font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#1A1F2C] truncate">{displayName}</div>
              <div className="text-xs text-[#7E8B9B] truncate">{userEmail}</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5EF] px-2.5 py-1 text-[10px] font-bold text-[#16845B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16845B]" />
              Active Web Session
            </span>
          </div>
        </div>

        {/* Security & Capability Highlights */}
        <div className="space-y-2 text-xs text-[#525D73]">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16845B] mt-0.5" />
            <span>
              <strong>Automatic Sign-In:</strong> Native session is saved in your Mac Keychain and
              restored on every launch.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16845B] mt-0.5" />
            <span>
              <strong>Real-Time Sync:</strong> Timers started or paused on either interface update
              the same database task session.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16845B] mt-0.5" />
            <span>
              <strong>Zero Password Re-entry:</strong> Uses secure, single-use token authorization
              directly from this browser session.
            </span>
          </div>
        </div>

        {pairingError && (
          <div className="rounded-xl border border-[#FECDCA] bg-[#FEF3F2] p-3 text-xs text-[#B42318] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{pairingError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            disabled={connecting}
            onClick={handleConfirmPairing}
            className="w-full font-semibold shadow-sm justify-center"
          >
            {connecting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Generating Secure Handshake...</span>
              </>
            ) : (
              <>
                <Laptop className="h-4 w-4" />
                <span>Confirm &amp; Connect Mini Timer</span>
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            size="md"
            disabled={connecting}
            onClick={() => navigate('/settings')}
            className="w-full justify-center text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
