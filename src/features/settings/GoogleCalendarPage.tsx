import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  Lock,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { calendarService } from '../../services/calendarService';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export function GoogleCalendarPage() {
  const {
    calendarConnection,
    refreshCalendarStatus,
    retryCalendarSync,
    isSyncingCalendar,
  } = useWorkspace();

  const { isAuthenticated, user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Handle URL query parameters from OAuth callback redirect
  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam) {
      setConnectError(`OAuth callback error: ${decodeURIComponent(errorParam)}`);
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
  }, [errorParam, searchParams, setSearchParams]);

  // Strict verification: verify actual connection record in DB before claiming connected
  useEffect(() => {
    if (connectedParam === 'true') {
      setIsVerifying(true);
      const next = new URLSearchParams(searchParams);
      next.delete('connected');
      setSearchParams(next, { replace: true });

      const verifyStatus = async () => {
        try {
          if (user?.id) {
            const res = await calendarService.getIntegrationStatus(user.id);
            if (res.data?.isConnected && res.data.status === 'connected') {
              await refreshCalendarStatus();
              setVerificationNotice({
                type: 'success',
                message: `Google Calendar connected successfully! Account: ${res.data.accountEmail || 'Primary Account'}. One-way sync is active.`,
              });
            } else {
              setVerificationNotice({
                type: 'error',
                message:
                  res.error ||
                  'Could not verify an active Google Calendar connection in the database. Please try connecting again.',
              });
            }
          } else {
            await refreshCalendarStatus();
          }
        } catch (err) {
          setVerificationNotice({
            type: 'error',
            message: err instanceof Error ? err.message : 'Failed to verify connection status.',
          });
        } finally {
          setIsVerifying(false);
        }
      };

      verifyStatus();
    }
  }, [connectedParam, refreshCalendarStatus, searchParams, setSearchParams, user?.id]);

  const handleConnect = async () => {
    setConnectError(null);
    setVerificationNotice(null);

    if (!isAuthenticated) {
      setConnectError(
        'Please sign in to your My Work Planner account before connecting Google Calendar.'
      );
      return;
    }

    setIsConnecting(true);
    try {
      const res = await calendarService.getAuthorizationUrl();
      if (res.error || !res.url) {
        setConnectError(
          res.error ||
            'Server-side Google OAuth is not configured on the server. Please verify your Supabase Edge Function secrets.'
        );
        setIsConnecting(false);
        return;
      }
      // Redirect to Google OAuth consent screen
      window.location.href = res.url;
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : 'Failed to initiate Google Calendar connection'
      );
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await calendarService.disconnect();
      await refreshCalendarStatus();
      setDisconnectModalOpen(false);
      setVerificationNotice(null);
    } catch (err) {
      console.error('Failed to disconnect Google Calendar:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected =
    !isVerifying &&
    calendarConnection.isConnected &&
    calendarConnection.status === 'connected';

  const needsReauth = calendarConnection.status === 'needs_reauth';

  return (
    <div className="space-y-7 max-w-4xl mx-auto">
      {/* Breadcrumb: Settings -> Integrations -> Google Calendar */}
      <div className="flex items-center gap-2 text-sm text-[#7E8B9B]">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 font-medium hover:text-[#1A1F2C] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Settings</span>
        </Link>
        <span>/</span>
        <span className="text-[#7E8B9B]">Integrations</span>
        <span>/</span>
        <span className="font-semibold text-[#1A1F2C]">Google Calendar</span>
      </div>

      {/* Verification in Progress Banner */}
      {isVerifying && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#2F65F6]/20 bg-[#EDF2FE] p-4 text-xs font-semibold text-[#2F65F6] shadow-sm animate-in fade-in duration-200">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#2F65F6]" />
          <div>
            <p className="font-bold text-[#2F65F6]">Verifying Google Calendar Connection...</p>
            <p className="mt-0.5 font-normal text-[#2F65F6]/85">
              Confirming server-side token exchange and database connection record.
            </p>
          </div>
        </div>
      )}

      {/* Verification Notice (Success / Error) */}
      {verificationNotice && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-xs font-semibold shadow-sm animate-in fade-in duration-200 ${
            verificationNotice.type === 'success'
              ? 'border-[#16845B]/20 bg-[#E8F5EF] text-[#16845B]'
              : 'border-[#C2414B]/20 bg-[#FCE8E9] text-[#C2414B]'
          }`}
        >
          {verificationNotice.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16845B]" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#C2414B]" />
          )}
          <div>
            <p
              className={`font-bold ${
                verificationNotice.type === 'success' ? 'text-[#16845B]' : 'text-[#C2414B]'
              }`}
            >
              {verificationNotice.type === 'success'
                ? 'Google Calendar Connected'
                : 'Connection Verification Notice'}
            </p>
            <p
              className={`mt-0.5 font-normal ${
                verificationNotice.type === 'success' ? 'text-[#16845B]/85' : 'text-[#C2414B]/85'
              }`}
            >
              {verificationNotice.message}
            </p>
          </div>
        </div>
      )}

      {/* Connection / Flow Error Banner */}
      {connectError && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#C2414B]/20 bg-[#FCE8E9] p-4 text-xs font-semibold text-[#C2414B] shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#C2414B]" />
          <div>
            <p className="font-bold text-[#C2414B]">Connection Error</p>
            <p className="mt-0.5 font-normal text-[#C2414B]/85">{connectError}</p>
          </div>
        </div>
      )}

      {/* Re-auth Required Banner */}
      {needsReauth && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#B7791F]/20 bg-[#FEF3E2] p-4 text-xs font-semibold text-[#B7791F] shadow-sm animate-in fade-in duration-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B7791F]" />
          <div>
            <p className="font-bold text-[#B7791F]">Authorization Expired or Revoked</p>
            <p className="mt-0.5 font-normal text-[#B7791F]/85">
              Your Google Calendar token has expired or was revoked in your Google Account settings.
              Please click Connect Google Calendar below to re-authorize.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRIMARY CONNECTION & SYNCHRONIZATION CONTROLS */}
      {/* ========================================================================= */}
      <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 sm:p-8 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        {/* Top Header Row with Status Badge */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E9ECF5]/80">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                isConnected
                  ? 'bg-[#E8F5EF] text-[#16845B]'
                  : 'bg-[#EDF2FE] text-[#2F65F6]'
              }`}
            >
              {isConnected ? (
                <CalendarCheck className="h-6 w-6" />
              ) : (
                <Calendar className="h-6 w-6" />
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1F2C]">
                Google Calendar
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#7E8B9B]">
                Strict One-Way Synchronization: My Work Planner → Google Calendar
              </p>
            </div>
          </div>

          <div>
            {isVerifying ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF2FE] px-3.5 py-1 text-xs font-semibold text-[#2F65F6]">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Checking Connection...
              </span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EF] px-3.5 py-1 text-xs font-semibold text-[#16845B]">
                <span className="h-2 w-2 rounded-full bg-[#16845B] animate-pulse" />
                Connected
              </span>
            ) : needsReauth ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-3.5 py-1 text-xs font-semibold text-[#B7791F]">
                <AlertTriangle className="h-3.5 w-3.5" />
                Action Required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F7FD] px-3.5 py-1 text-xs font-semibold text-[#7E8B9B]">
                <CalendarOff className="h-3.5 w-3.5" />
                Not Connected
              </span>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* DISCONNECTED STATE: PROMINENT CTA */}
        {/* --------------------------------------------------------------------- */}
        {!isConnected && (
          <div className="pt-7 text-center sm:text-left">
            <div className="flex flex-col items-center sm:items-start max-w-xl">
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting || isVerifying}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#2F65F6] px-8 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_6px_20px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_8px_25px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="h-5 w-5" />
                    <span>Connect Google Calendar</span>
                  </>
                )}
              </button>

              <p className="mt-3.5 text-sm font-medium text-[#7E8B9B] text-center sm:text-left leading-relaxed">
                Connect your Google account to automatically add your scheduled My Work Planner
                tasks to Google Calendar.
              </p>

              {!isAuthenticated && (
                <div className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-[#B7791F]/20 bg-[#FEF3E2] p-3.5 text-xs text-[#B7791F]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-[#B7791F]" />
                    <span>You are in Preview Mode. Sign in to connect your live Google account.</span>
                  </div>
                  <Link
                    to="/sign-in"
                    className="inline-flex items-center gap-1 rounded-full bg-[#B7791F] px-3 py-1 font-semibold text-white hover:bg-[#975A16] transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[#2F65F6]/20 bg-[#EDF2FE]/60 p-4 text-xs leading-relaxed text-[#1A1F2C]">
              <div>
                <p className="font-bold text-[#1A1F2C]">
                  One-Way Synchronization Policy
                </p>
                <p className="mt-1 text-[#7E8B9B]">
                  My Work Planner is your authoritative source of truth. Scheduled tasks are pushed
                  strictly one-way to Google Calendar. Changes, edits, or deletions made inside
                  Google Calendar never alter tasks in My Work Planner.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* CONNECTED STATE: METRICS, ACCOUNT EMAIL & ACTIONS */}
        {/* --------------------------------------------------------------------- */}
        {isConnected && (
          <div className="pt-6 space-y-6">
            {/* Account Details & Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-[#F8FAFD] border border-[#E9ECF5]">
              <div>
                <span className="text-xs font-medium text-[#7E8B9B] block">Connected Account</span>
                <span className="text-sm font-bold text-[#1A1F2C] block mt-0.5">
                  {calendarConnection.accountEmail || 'Google Account Connected'}
                </span>
                <span className="text-[11px] text-[#7E8B9B] block mt-0.5">
                  Calendar: {calendarConnection.selectedCalendarName || 'Primary Calendar'}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => retryCalendarSync()}
                  disabled={isSyncingCalendar}
                  className="rounded-full text-xs font-semibold"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1.5 ${isSyncingCalendar ? 'animate-spin' : ''}`}
                  />
                  <span>{isSyncingCalendar ? 'Syncing...' : 'Sync Now'}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setDisconnectModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-[#C2414B]/30 bg-[#FCE8E9]/60 px-4 py-1.5 text-xs font-semibold text-[#C2414B] hover:bg-[#FCE8E9] transition-colors cursor-pointer"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>

            {/* Sync Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 text-xs">
              <div>
                <span className="text-[#7E8B9B] font-medium block">Last Synchronized</span>
                <span className="font-semibold text-[#1A1F2C] mt-0.5 block">
                  {calendarConnection.lastSyncedAt
                    ? new Date(calendarConnection.lastSyncedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Just now'}
                </span>
              </div>
              <div>
                <span className="text-[#7E8B9B] font-medium block">Active Synced Events</span>
                <span className="font-semibold text-[#16845B] mt-0.5 block tabular-nums-strict">
                  {calendarConnection.syncedTasksCount ?? 0} events
                </span>
              </div>
              <div>
                <span className="text-[#7E8B9B] font-medium block">Pending Sync Jobs</span>
                <span className="font-semibold text-[#2F65F6] mt-0.5 block tabular-nums-strict">
                  {calendarConnection.pendingJobsCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[#7E8B9B] font-medium block">Failed Sync Jobs</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`font-semibold tabular-nums-strict ${
                      (calendarConnection.failedJobsCount ?? 0) > 0
                        ? 'text-[#C2414B]'
                        : 'text-[#7E8B9B]'
                    }`}
                  >
                    {calendarConnection.failedJobsCount ?? 0}
                  </span>
                  {(calendarConnection.failedJobsCount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => retryCalendarSync()}
                      className="text-[11px] font-bold text-[#2F65F6] underline hover:text-[#2554DB] cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* One-Way Sync Policy Reminder */}
            <div className="flex items-start gap-3 rounded-2xl border border-[#16845B]/20 bg-[#E8F5EF]/60 p-4 text-xs leading-relaxed text-[#1A1F2C]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16845B]" />
              <div>
                <p className="font-bold text-[#16845B]">One-Way Active Synchronization</p>
                <p className="mt-1 text-[#7E8B9B]">
                  Scheduled tasks in My Work Planner are automatically synchronized to your Google
                  Calendar. Task completion preserves events without modifying your calendar.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Disconnect Modal */}
      <Modal
        open={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        title="Disconnect Google Calendar?"
        description="Disconnecting will halt future automatic synchronization. Previously created Google Calendar events will remain untouched in your Google Calendar."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setDisconnectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Confirm Disconnect'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#7E8B9B] leading-relaxed">
          In accordance with our strict one-way policy, disconnecting stops synchronization without
          deleting your existing calendar events. You can reconnect at any time.
        </p>
      </Modal>
    </div>
  );
}
