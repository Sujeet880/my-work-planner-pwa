import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Plus, Trash2 } from 'lucide-react';
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
import { MetricCard } from '../../components/ui/MetricCard';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
            Workspace / Time Tracking
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202531]">
            Time Tracker
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Track one active task session at a time or record manual work sessions cleanly.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={() => openManualEntryModal(null)}>
          <Plus className="h-4 w-4" />
          <span>Add Manual Entry</span>
        </Button>
      </div>

      {/* Prominent Global Active Timer Card (includes Idle / Running / Paused / Recovering states) */}
      <ActiveTimerCard showRecoveryToggle />

      {/* Reconciled Breakdown Cards (Saved + Active = Live Total) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <MetricCard
          label="Saved Work Today"
          value={formatDuration(savedTodaySeconds)}
          subtext="Completed timer & manual entries"
        />
        <MetricCard
          label="Current Active Session"
          value={formatDuration(activeElapsedSeconds, true)}
          subtext="Not yet committed to saved totals"
          accentValue
        />
        <MetricCard
          label="Live Total Today"
          value={formatDuration(liveTodayTotalSeconds)}
          subtext="Saved work + current active session"
        />
      </div>

      {/* Work Sessions History */}
      <section className="rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#E4E7EC] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-[#202531]">Recent Work Sessions</h2>
            <p className="text-xs text-[#667085] tabular-nums-strict">
              Showing {filteredEntries.length} saved session
              {filteredEntries.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter sessions by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-auto min-w-[140px]"
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
              className="w-auto min-w-[130px]"
            >
              <option value="all">All Types</option>
              <option value="timer">Automatic Timer</option>
              <option value="manual">Manual Entry</option>
            </Select>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No saved work sessions found"
              description="Stop an active timer or log a manual work session to populate history."
              action={
                <Button variant="primary" size="sm" onClick={() => openManualEntryModal(null)}>
                  <Plus className="h-4 w-4" />
                  <span>Add Manual Entry</span>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[#F0F2F5]">
            {filteredEntries.map((entry) => {
              const task = tasks.find((t) => t.id === entry.taskId);
              const project = projects.find((p) => p.id === entry.projectId);
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {task ? (
                        <Link
                          to={`/tasks/${task.id}`}
                          className="text-sm font-medium text-[#202531] hover:text-[#4968D6]"
                        >
                          {task.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-[#667085]">Archived task</span>
                      )}
                      <EntryTypeBadge type={entry.entryType} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#667085]">
                      {project && <ProjectLabel name={project.name} color={project.color} />}
                      <span className="tabular-nums-strict">
                        {entry.startedAt.slice(0, 10)} · {entry.startedAt.slice(11, 16)}
                        {entry.endedAt ? `–${entry.endedAt.slice(11, 16)}` : ''}
                      </span>
                      {entry.notes && <span className="truncate max-w-md">{entry.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-semibold text-[#202531] tabular-nums-strict">
                      {formatDuration(entry.durationSeconds)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove session for ${task?.title ?? 'task'}`}
                      onClick={() => deleteTimeEntry(entry.id)}
                      className="px-2 text-[#98A2B3] hover:text-[#C2414B]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
