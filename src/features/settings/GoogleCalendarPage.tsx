import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, CalendarOff, Info, Lock } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../../components/ui/Button';

export function GoogleCalendarPage() {
  const { calendarConnection } = useWorkspace();

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#7E8B9B]">
        <Link to="/settings" className="inline-flex items-center gap-1.5 font-medium hover:text-[#1A1F2C] transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span>Settings</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#1A1F2C]">Google Calendar Integration</span>
      </div>

      {/* Header Card */}
      <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 sm:p-7 shadow-[0_8px_25px_rgba(25,45,100,0.03)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6] shadow-sm">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-[#1A1F2C]">
                  Google Calendar
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F7FD] px-3 py-1 text-xs font-semibold text-[#7E8B9B]">
                  <CalendarOff className="h-3.5 w-3.5" />
                  {calendarConnection.isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#7E8B9B]">
                One-Way Synchronization: My Work Planner → Google Calendar
              </p>
            </div>
          </div>

          <Button variant="secondary" disabled title="Google OAuth configuration arrives in Milestone 6" className="rounded-full">
            Connect Google Calendar (M6)
          </Button>
        </div>

        {/* One-Way Sync Notice */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#2F65F6]/20 bg-[#EDF2FE]/60 p-4 text-xs leading-relaxed text-[#1A1F2C]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2F65F6]" />
          <div>
            <p className="font-semibold text-[#1A1F2C]">
              My Work Planner is the authoritative source of truth
            </p>
            <p className="mt-1 text-[#7E8B9B]">
              Scheduled tasks are pushed one-way from My Work Planner into your selected Google
              Calendar. Edits made directly inside Google Calendar do not modify tasks in My Work
              Planner.
            </p>
          </div>
        </div>
      </section>

      {/* Event Mapping Rules (PRD §10.2) */}
      <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 sm:p-7 shadow-[0_8px_25px_rgba(25,45,100,0.03)]">
        <h2 className="text-lg font-semibold text-[#1A1F2C]">Scheduled Task Mapping Rules</h2>
        <ul className="mt-4 space-y-3 text-sm text-[#7E8B9B]">
          <li className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2F65F6]" />
            <span>
              <strong className="font-semibold text-[#1A1F2C]">Unscheduled Inbox tasks:</strong>{' '}
              Never synced to Google Calendar until assigned a scheduled date.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2F65F6]" />
            <span>
              <strong className="font-semibold text-[#1A1F2C]">Date only (no start time):</strong>{' '}
              Created as an all-day event on that date.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2F65F6]" />
            <span>
              <strong className="font-semibold text-[#1A1F2C]">Date + Start Time + Planned Duration:</strong>{' '}
              Created as a timed event using the exact planned duration.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2F65F6]" />
            <span>
              <strong className="font-semibold text-[#1A1F2C]">Date + Start Time (no duration):</strong>{' '}
              Created as a timed event using your default event duration (60 minutes).
            </span>
          </li>
        </ul>
      </section>

      {/* External Setup Notice */}
      <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]">
        <div className="flex items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F7FD] text-[#7E8B9B]">
            <Lock className="h-4 w-4" />
          </div>
          <div className="text-xs leading-relaxed text-[#7E8B9B]">
            <p className="font-semibold text-[#1A1F2C]">External Authorization Required (Milestone 6)</p>
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
