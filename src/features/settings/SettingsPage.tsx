import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  Monitor,
  Send,
  Shield,
  Smartphone,
  Sparkles,
  Timer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { DateFormatPreference, TimeFormatPreference } from '../../types/models';
import { PWAInstallButton } from '../../components/pwa/PWAInstallButton';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Select } from '../../components/ui/Field';
import { pushService } from '../../services/pushService';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function SettingsPage() {
  const { isSupabaseConfigured, isAuthenticated, userEmail, user, signOut, env } = useAuth();
  const { profile, calendarConnection, updateProfilePreferences, toast } = useWorkspace();
  const { isInstalled } = usePWAInstall();

  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [isTestingPush, setIsTestingPush] = useState<boolean>(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  // Sync push subscription status on mount and when permission changes
  useEffect(() => {
    let isMounted = true;
    if (user?.id) {
      pushService.checkSubscriptionStatus(user.id).then((status) => {
        if (isMounted) {
          setNotificationPermission(status.permission);
          setIsPushSubscribed(status.isSubscribed);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleEnablePush = async () => {
    if (!user?.id) {
      setPushStatusMessage('Sign in is required to enable push notifications.');
      return;
    }

    const vapidKey = env.vapidPublicKey;
    if (!vapidKey) {
      setPushStatusMessage('VAPID public key is not configured.');
      return;
    }

    setIsSubscribing(true);
    setPushStatusMessage(null);
    try {
      const res = await pushService.subscribe(user.id, vapidKey);
      if (res.success) {
        setIsPushSubscribed(true);
        setNotificationPermission('granted');
        setPushStatusMessage('Push notifications successfully enabled on this device.');
      } else {
        setPushStatusMessage(`Failed to enable push: ${res.error}`);
        if (typeof window !== 'undefined' && 'Notification' in window) {
          setNotificationPermission(Notification.permission);
        }
      }
    } catch (err) {
      setPushStatusMessage(err instanceof Error ? err.message : 'Subscription error');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDisablePush = async () => {
    if (!user?.id) return;
    setIsSubscribing(true);
    setPushStatusMessage(null);
    try {
      const res = await pushService.unsubscribe(user.id);
      if (res.success) {
        setIsPushSubscribed(false);
        setPushStatusMessage('Push notifications disabled for this device.');
      } else {
        setPushStatusMessage(`Failed to unsubscribe: ${res.error}`);
      }
    } catch (err) {
      setPushStatusMessage(err instanceof Error ? err.message : 'Unsubscribe error');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsTestingPush(true);
    setPushStatusMessage(null);
    try {
      const res = await pushService.sendTestNotification();
      if (res.success) {
        setPushStatusMessage('Test notification sent! Check your device notifications.');
      } else {
        setPushStatusMessage(`Test notification failed: ${res.error || res.message}`);
      }
    } catch (err) {
      setPushStatusMessage(err instanceof Error ? err.message : 'Failed to invoke test push');
    } finally {
      setIsTestingPush(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">Settings</h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            Configure regional defaults, task reminders, Web Push notifications, Google Calendar, and PWA installation.
          </p>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E9ECF5] bg-white text-[#1A1F2C] shadow-sm hover:bg-[#F8FAFD] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Bell className="h-4 w-4" />
          {isPushSubscribed && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#16845B] ring-2 ring-white" />
          )}
        </button>
      </div>

      <div className="space-y-6">
        {/* 1. Account & Authentication Status */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1F2C]">Account &amp; Access</h2>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  Private single-owner workspace authenticated via Supabase Email Magic Link.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#E8F5EF] px-3 py-1 text-xs font-semibold text-[#16845B] whitespace-nowrap">
              {isSupabaseConfigured ? 'Configured' : 'Setup Pending'}
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 text-xs text-[#7E8B9B] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">Supabase Environment</span>
              <span className="font-semibold text-[#1A1F2C]">
                {isSupabaseConfigured ? 'Connected' : `Missing: ${env.missingClientVars.join(', ')}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">Current Mode</span>
              <span className="font-semibold text-[#1A1F2C]">
                {isAuthenticated
                  ? `Authenticated (${userEmail})`
                  : isSupabaseConfigured
                    ? 'Unauthenticated'
                    : 'Supabase Not Configured'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            {isAuthenticated ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={signOut}
                className="text-xs"
              >
                Sign Out of Workspace
              </Button>
            ) : (
              <Link
                to="/sign-in"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline"
              >
                <span>Go to Sign-In Screen</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </section>

        {/* 2. General Preferences */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1A1F2C]">General Preferences</h2>
              <p className="mt-0.5 text-xs text-[#7E8B9B]">
                Timezone defaults to Asia/Kolkata per PRD and persists to your Supabase profile.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldWrapper id="pref-timezone" label="Time Zone">
              <Select
                id="pref-timezone"
                value={profile.timezone}
                onChange={(e) => updateProfilePreferences({ timezone: e.target.value })}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+05:30)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
              </Select>
            </FieldWrapper>

            <FieldWrapper id="pref-date-format" label="Date Format">
              <Select
                id="pref-date-format"
                value={profile.dateFormat}
                onChange={(e) =>
                  updateProfilePreferences({
                    dateFormat: e.target.value as DateFormatPreference,
                  })
                }
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </FieldWrapper>

            <FieldWrapper id="pref-time-format" label="Time Format">
              <Select
                id="pref-time-format"
                value={profile.timeFormat}
                onChange={(e) =>
                  updateProfilePreferences({
                    timeFormat: e.target.value as TimeFormatPreference,
                  })
                }
              >
                <option value="12h">12-hour (e.g., 2:30 PM)</option>
                <option value="24h">24-hour (e.g., 14:30)</option>
              </Select>
            </FieldWrapper>

            <FieldWrapper
              id="pref-default-duration"
              label="Default Calendar Event Duration"
              helperText="Fallback duration when a timed task has no planned duration."
            >
              <Select
                id="pref-default-duration"
                value={String(profile.defaultEventDurationMinutes)}
                onChange={(e) =>
                  updateProfilePreferences({
                    defaultEventDurationMinutes: Number(e.target.value),
                  })
                }
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes (Default)</option>
                <option value="90">90 minutes</option>
              </Select>
            </FieldWrapper>
          </div>
        </section>

        {/* 3. Task Reminders & Web Push Notifications */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1F2C]">Reminders &amp; Push Notifications</h2>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  Configured with VAPID Web Push (RFC 8292). Receive reminders even when the app tab is closed.
                </p>
              </div>
            </div>

            {/* Permission Badge */}
            <div className="self-start sm:self-auto">
              {notificationPermission === 'granted' && isPushSubscribed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EF] px-3 py-1 text-xs font-semibold text-[#16845B]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Push Active
                </span>
              ) : notificationPermission === 'denied' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FCE8E9] px-3 py-1 text-xs font-semibold text-[#C2414B]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Permission Denied
                </span>
              ) : notificationPermission === 'unsupported' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F2F5] px-3 py-1 text-xs font-semibold text-[#667085]">
                  Unsupported on Browser
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-3 py-1 text-xs font-semibold text-[#B7791F]">
                  Setup Required
                </span>
              )}
            </div>
          </div>

          {/* Default Lead Time Preference */}
          <div className="mt-5 border-t border-[#F0F3F9] pt-5">
            <div className="max-w-md">
              <FieldWrapper
                id="pref-default-reminder-offset"
                label="Default Reminder Lead Time"
                helperText="Pre-selected reminder offset when creating newly scheduled tasks."
              >
                <Select
                  id="pref-default-reminder-offset"
                  value={String(profile.defaultReminderOffsetMinutes ?? 15)}
                  onChange={(e) =>
                    updateProfilePreferences({
                      defaultReminderOffsetMinutes: Number(e.target.value),
                    })
                  }
                >
                  <option value="0">At start time (0 min)</option>
                  <option value="5">5 minutes before</option>
                  <option value="10">10 minutes before</option>
                  <option value="15">15 minutes before (Default)</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before (60 min)</option>
                </Select>
              </FieldWrapper>
            </div>
          </div>

          {/* Action Panel */}
          <div className="mt-5 rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-[#1A1F2C]">Device Push Subscription</p>
                <p className="text-xs text-[#7E8B9B]">
                  {isPushSubscribed
                    ? 'This browser is subscribed to push reminders dispatched via Edge Functions.'
                    : 'Enable push notifications to receive real-time alerts before task start times.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {isPushSubscribed ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleSendTestNotification()}
                      disabled={isTestingPush}
                      className="text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isTestingPush ? 'Sending...' : 'Test Notification'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDisablePush()}
                      disabled={isSubscribing}
                      className="text-xs text-[#7E8B9B] hover:text-[#C2414B]"
                    >
                      Disable Push
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleEnablePush()}
                    disabled={isSubscribing || notificationPermission === 'denied'}
                    className="text-xs"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>{isSubscribing ? 'Subscribing...' : 'Enable Push Notifications'}</span>
                  </Button>
                )}
              </div>
            </div>

            {pushStatusMessage && (
              <div className="rounded-xl border border-[#EDF2FE] bg-white p-3 text-xs font-medium text-[#2F65F6]">
                {pushStatusMessage}
              </div>
            )}
          </div>
        </section>

        {/* 4. Integrations (Google Calendar One-Way Sync) */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#1A1F2C]">Google Calendar</h2>
                  <span className="rounded-full bg-[#F4F7FD] px-2.5 py-0.5 text-xs font-semibold text-[#7E8B9B]">
                    {calendarConnection.isConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  One-way sync from My Work Planner to your selected Google Calendar.
                </p>
              </div>
            </div>

            <Link to="/settings/google-calendar">
              <Button variant="secondary" size="sm">
                <span>Configure Integration</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* 5. Data & Export */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1F2C]">Data &amp; Export</h2>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  Structured Excel (.xlsx) and CSV (.csv) exports of tasks and saved time logs are
                  available from Reports.
                </p>
              </div>
            </div>

            <Link to="/reports">
              <Button variant="secondary" size="sm">
                Go to Reports
              </Button>
            </Link>
          </div>
        </section>

        {/* 6. App & Installation (Progressive Web App) */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1F2C]">App &amp; Installation (PWA)</h2>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  Install My Work Planner on desktop or mobile for a fast, full-screen native experience.
                </p>
              </div>
            </div>

            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EF] px-3 py-1 text-xs font-semibold text-[#16845B]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Installed as Standalone App
              </span>
            ) : (
              <PWAInstallButton />
            )}
          </div>

          {/* Multi-Platform Install Guidance Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Chrome / Edge / Chromium */}
            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
                  <Laptop className="h-4 w-4 text-[#2F65F6]" />
                  <span>Chrome / Edge</span>
                </div>
                <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
                  Use the one-click install button above or click the Install icon in your browser address bar.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
                <span className="text-[11px] font-semibold text-[#2F65F6]">Native Install Prompt</span>
              </div>
            </div>

            {/* Safari macOS */}
            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
                  <Laptop className="h-4 w-4 text-[#7E8B9B]" />
                  <span>Safari (macOS)</span>
                </div>
                <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
                  Click <strong>File</strong> in the top menu bar, then choose <strong>Add to Dock...</strong> to open as an independent app.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
                <span className="text-[11px] font-semibold text-[#7E8B9B]">macOS Sonoma 14+</span>
              </div>
            </div>

            {/* iOS / iPadOS Safari */}
            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
                  <Smartphone className="h-4 w-4 text-[#2F65F6]" />
                  <span>iOS Safari (iPhone/iPad)</span>
                </div>
                <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
                  Tap the <strong>Share</strong> button in Safari toolbar, scroll down and tap <strong>Add to Home Screen</strong>.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
                <span className="text-[11px] font-semibold text-[#2F65F6]">Required for Web Push on iOS</span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Native macOS Companion — Mini Focus Timer */}
        <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#1A1F2C]">Native macOS Mini Focus Timer</h2>
                  <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-xs font-semibold text-[#2F65F6]">
                    macOS Companion
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#7E8B9B]">
                  Lightweight, floating native macOS timer chip that stays pinned above all workspaces, full-screen apps, Figma, Chrome, and IDEs.
                </p>
              </div>
            </div>

            <a
              href="myworkplanner-minitimer://open"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F65F6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#2554D4] transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Launch Mini Timer</span>
            </a>
          </div>

          {/* Feature Highlights */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
                  <Monitor className="h-4 w-4 text-[#2F65F6]" />
                  <span>Floating Chip (NSPanel)</span>
                </div>
                <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
                  Stays visible over any active window (VS Code, Chrome, Figma) and across all macOS Spaces without stealing focus.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
                <span className="text-[11px] font-semibold text-[#2F65F6]">Non-Activating Window Level</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
                  <Shield className="h-4 w-4 text-[#16845B]" />
                  <span>Atomic PostgreSQL Sync</span>
                </div>
                <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
                  Single source of truth. Calls the same atomic database RPCs (rpc_start_timer, rpc_pause_timer, rpc_stop_timer).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
                <span className="text-[11px] font-semibold text-[#16845B]">Zero Desynchronization</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
                  <Laptop className="h-4 w-4 text-[#7E8B9B]" />
                  <span>Menu Bar Companion</span>
                </div>
                <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
                  Persistent system status item in your macOS top menu bar displaying live elapsed time and quick pause/resume actions.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
                <span className="text-[11px] font-semibold text-[#7E8B9B]">macOS 14.0+ Universal</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#EDF2FE] bg-[#F8FAFD] p-3 text-xs text-[#7E8B9B] flex items-center justify-between">
            <span>
              Application bundle located in <code>native/MyWorkPlannerMiniTimer/dist/MyWorkPlannerMiniTimer.app</code>.
            </span>
            <span className="font-medium text-[#2F65F6]">Custom URI: myworkplanner-minitimer://</span>
          </div>
        </section>
      </div>
    </div>
  );
}
