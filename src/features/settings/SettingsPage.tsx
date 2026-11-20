import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Calendar,
  Download,
  Globe,
  Shield,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { DateFormatPreference, TimeFormatPreference } from '../../types/models';
import { PWAInstallButton } from '../../components/pwa/PWAInstallButton';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, Select } from '../../components/ui/Field';

export function SettingsPage() {
  const { isSupabaseConfigured, env } = useAuth();
  const { profile, calendarConnection, updateProfilePreferences } = useWorkspace();

  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
    } catch {
      // Ignore permission prompt errors in restricted iframe environments
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
          System / Configuration
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202531]">Settings</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Configure regional defaults, browser reminder capabilities, calendar integration, and PWA installation.
        </p>
      </div>

      <div className="space-y-5">
        {/* 1. Account & Authentication Status */}
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667085]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#202531]">Account &amp; Access</h2>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Private single-owner workspace authenticated via Supabase Email Magic Link.
                </p>
              </div>
            </div>
            <span className="rounded-md bg-[#FEF3E2] px-2.5 py-1 text-xs font-medium text-[#B7791F] whitespace-nowrap">
              {isSupabaseConfigured ? 'Configured' : 'Setup Pending (M1)'}
            </span>
          </div>

          <div className="mt-4 rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3.5 text-xs text-[#667085] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Supabase Environment</span>
              <span className="font-medium text-[#202531]">
                {isSupabaseConfigured
                  ? 'Connected'
                  : `Missing: ${env.missingClientVars.join(', ')}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Current Mode</span>
              <span className="font-medium text-[#202531]">
                {isSupabaseConfigured ? 'Authenticated Session' : 'Milestone 0 Local Shell Preview'}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <Link
              to="/sign-in"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4968D6] hover:underline"
            >
              <span>Inspect Sign-In Screen</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* 2. General Preferences */}
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667085]">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202531]">General Preferences</h2>
              <p className="mt-0.5 text-xs text-[#667085]">
                Timezone defaults to Asia/Kolkata per PRD and can be updated anytime.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {/* 3. Notifications (Honest Browser Capability Detection) */}
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667085]">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#202531]">Task Reminders</h2>
                <p className="mt-0.5 text-xs text-[#667085]">
                  In-app alerts work across all platforms. Browser notifications depend on device
                  and permission support.
                </p>
              </div>
            </div>

            <span className="rounded-md bg-[#F0F2F5] px-2.5 py-1 text-xs font-medium text-[#667085] capitalize self-start">
              Browser Permission: {notificationPermission}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-[#667085]">
              Mobile browsers and iOS Safari may restrict background notifications unless the app is
              installed to the Home Screen and granted permission. Full reminder scheduling arrives
              in Milestone 7.
            </p>
            {notificationPermission === 'default' && (
              <Button variant="secondary" size="sm" onClick={() => void handleRequestNotifications()}>
                Check Browser Permission
              </Button>
            )}
          </div>
        </section>

        {/* 4. Integrations (Google Calendar One-Way Sync) */}
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDF1FF] text-[#4968D6]">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[#202531]">Google Calendar</h2>
                  <span className="rounded-md bg-[#F0F2F5] px-2 py-0.5 text-xs font-medium text-[#667085]">
                    {calendarConnection.isConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#667085]">
                  One-way sync from My Work Planner to your selected Google Calendar (Milestone 6).
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
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667085]">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#202531]">Data &amp; Export</h2>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Structured Excel (.xlsx) and CSV (.csv) exports of tasks and saved time logs are
                  available from Reports in Milestone 5.
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

        {/* 6. App & Installation (PWA) */}
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667085]">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#202531]">
                  App &amp; Installation (PWA)
                </h2>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Install My Work Planner on desktop or mobile home screen. Requires network
                  connectivity for live Supabase and calendar operations.
                </p>
              </div>
            </div>

            <PWAInstallButton />
          </div>
        </section>
      </div>
    </div>
  );
}
