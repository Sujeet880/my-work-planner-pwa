import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, CalendarOff, Info, Lock } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../../components/ui/Button';

export function GoogleCalendarPage() {
  const { calendarConnection } = useWorkspace();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#667085]">
        <Link to="/settings" className="inline-flex items-center gap-1 hover:text-[#202531]">
          <ArrowLeft className="h-4 w-4" />
          <span>Settings</span>
        </Link>
        <span>/</span>
        <span className="font-medium text-[#202531]">Google Calendar Integration</span>
      </div>

      {/* Header Card */}
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF1FF] text-[#4968D6]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[#202531]">
                  Google Calendar
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F0F2F5] px-2.5 py-0.5 text-xs font-medium text-[#667085]">
                  <CalendarOff className="h-3.5 w-3.5" />
                  {calendarConnection.isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#667085]">
                One-Way Synchronization: My Work Planner → Google Calendar
              </p>
            </div>
          </div>

          <Button variant="secondary" disabled title="Google OAuth configuration arrives in Milestone 6">
            Connect Google Calendar (M6)
          </Button>
        </div>

        {/* One-Way Sync Notice */}
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#E4E7EC] bg-[#F6F7F9] p-4 text-xs leading-relaxed text-[#667085]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4968D6]" />
          <div>
            <p className="font-semibold text-[#202531]">
              My Work Planner is the authoritative source of truth
            </p>
            <p className="mt-1">
              Scheduled tasks are pushed one-way from My Work Planner into your selected Google
              Calendar. Edits made directly inside Google Calendar do not modify tasks in My Work
              Planner.
            </p>
          </div>
        </div>
      </section>

      {/* Event Mapping Rules (PRD §10.2) */}
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="text-base font-semibold text-[#202531]">Scheduled Task Mapping Rules</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-[#667085]">
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4968D6]" />
            <span>
              <strong className="font-medium text-[#202531]">Unscheduled Inbox tasks:</strong>{' '}
              Never synced to Google Calendar until assigned a scheduled date.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4968D6]" />
            <span>
              <strong className="font-medium text-[#202531]">Date only (no start time):</strong>{' '}
              Created as an all-day event on that date.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4968D6]" />
            <span>
              <strong className="font-medium text-[#202531]">Date + Start Time + Planned Duration:</strong>{' '}
              Created as a timed event using the exact planned duration.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4968D6]" />
            <span>
              <strong className="font-medium text-[#202531]">Date + Start Time (no duration):</strong>{' '}
              Created as a timed event using your default event duration (60 minutes).
            </span>
          </li>
        </ul>
      </section>

      {/* External Setup Notice */}
      <section className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" />
          <div className="text-xs leading-relaxed text-[#667085]">
            <p className="font-semibold text-[#202531]">External Authorization Required (Milestone 6)</p>
            <p className="mt-1">
              Google OAuth credentials (<code>GOOGLE_CLIENT_ID</code>,{' '}
              <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_REDIRECT_URI</code>) will be
              configured strictly on the server after owner approval in Milestone 6. No fake
              connection or simulated sync state is shown in Milestone 0.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
