import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  calculateSavedWorkSeconds,
  formatDuration,
  getLocalDateISO,
} from '../../lib/timeMath';
import type { TimeEntryType } from '../../types/models';
import { ActiveTimerCard } from '../../components/timer/ActiveTimerCard';
import { EntryTypeBadge, ProjectLabel } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Field';

export function TimeTrackerPage() {
  const {
    tasks,
    projects,
    timeEntries,
    activeElapsedSeconds,
    openManualEntryModal,
    deleteTimeEntry,
  } = useWorkspace();

  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TimeEntryType>('all');

  const todayIso = getLocalDateISO();
  const completedEntries = useMemo(
    () => timeEntries.filter((e) => e.status === 'completed'),
    [timeEntries]
  );

  const savedTodaySeconds = useMemo(
    () =>
      calculateSavedWorkSeconds(
        completedEntries.filter((e) => e.startedAt.startsWith(todayIso))
      ),
    [completedEntries, todayIso]
  );

  const liveTodayTotalSeconds = savedTodaySeconds + activeElapsedSeconds;

  const filteredEntries = useMemo(() => {
    return completedEntries
      .filter((e) => (projectFilter === 'all' ? true : e.projectId === projectFilter))
      .filter((e) => (typeFilter === 'all' ? true : e.entryType === typeFilter))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [completedEntries, projectFilter, typeFilter]);

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">
            Time Tracker
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            Track focused task sessions in real-time or log completed work manually.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E9ECF5] bg-white text-[#1A1F2C] shadow-sm hover:bg-[#F8FAFD] transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#2F65F6] ring-2 ring-white" />
          </button>

          <button
            type="button"
            onClick={() => openManualEntryModal(null)}
            className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_6px_20px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Manual Entry</span>
          </button>
        </div>
      </div>

      {/* Hero Active Timer Card */}
      <ActiveTimerCard showRecoveryToggle />

      {/* 3 Metric Cards Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
            Saved Work Today
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-[#1A1F2C] tabular-nums-strict">
            {formatDuration(savedTodaySeconds)}
          </div>
          <p className="mt-1 text-xs text-[#7E8B9B]">
            Completed timer &amp; manual sessions
          </p>
        </div>

        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
            Current Active Session
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-[#2F65F6] tabular-nums-strict">
            {formatDuration(activeElapsedSeconds, true)}
          </div>
          <p className="mt-1 text-xs text-[#7E8B9B]">
            Live uncommitted elapsed time
          </p>
        </div>

        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
            Live Total Today
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-[#1A1F2C] tabular-nums-strict">
            {formatDuration(liveTodayTotalSeconds)}
          </div>
          <p className="mt-1 text-xs text-[#7E8B9B]">
            Saved work + live running timer
          </p>
        </div>
      </div>

      {/* Work Sessions History Section */}
      <section className="rounded-[28px] border border-white/80 bg-white/85 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-[#F0F3F9] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1A1F2C]">Recent Work Sessions</h2>
            <p className="mt-0.5 text-xs text-[#7E8B9B] tabular-nums-strict">
              Showing {filteredEntries.length} saved session{filteredEntries.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              aria-label="Filter sessions by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-9.5 rounded-xl border-[#E9ECF5] bg-[#F8FAFD] text-xs font-semibold w-auto min-w-[140px]"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter sessions by entry type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | TimeEntryType)}
              className="h-9.5 rounded-xl border-[#E9ECF5] bg-[#F8FAFD] text-xs font-semibold w-auto min-w-[130px]"
            >
              <option value="all">All Types</option>
              <option value="timer">Automatic Timer</option>
              <option value="manual">Manual Entry</option>
            </Select>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Clock className="h-6 w-6 text-[#7E8B9B]" />}
              title="No saved work sessions found"
              description="Stop an active timer or log a manual work session to view history."
              action={
                <Button variant="primary" size="sm" onClick={() => openManualEntryModal(null)}>
                  <Plus className="h-4 w-4" />
                  <span>Add Manual Entry</span>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[#F0F3F9]">
            {filteredEntries.map((entry) => {
              const task = tasks.find((t) => t.id === entry.taskId);
              const project = projects.find((p) => p.id === entry.projectId);
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F9FAFD]/70 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {task ? (
                        <Link
                          to={`/tasks/${task.id}`}
                          className="text-sm font-semibold text-[#1A1F2C] hover:text-[#2F65F6] transition-colors"
                        >
                          {task.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-[#7E8B9B]">Archived task</span>
                      )}
                      <EntryTypeBadge type={entry.entryType} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7E8B9B]">
                      {project && <ProjectLabel name={project.name} color={project.color} />}
                      <span className="tabular-nums-strict font-medium">
                        {entry.startedAt.slice(0, 10)} · {entry.startedAt.slice(11, 16)}
                        {entry.endedAt ? `–${entry.endedAt.slice(11, 16)}` : ''}
                      </span>
                      {entry.notes && <span className="truncate max-w-md">{entry.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-bold text-[#1A1F2C] tabular-nums-strict">
                      {formatDuration(entry.durationSeconds)}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete work session"
                      onClick={() => deleteTimeEntry(entry.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#98A2B3] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
