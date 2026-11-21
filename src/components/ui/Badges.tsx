import {
  AlertCircle,
  Bell,
  CalendarOff,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import type {
  CalendarSyncStatus,
  TaskPriority,
  TaskStatus,
  TimeEntryType,
} from '../../types/models';

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, { bg: string; text: string; dot: string; label: string }> = {
    high: {
      bg: 'bg-[#FCE8E9]',
      text: 'text-[#C2414B]',
      dot: 'bg-[#C2414B]',
      label: 'High',
    },
    medium: {
      bg: 'bg-[#FEF3E2]',
      text: 'text-[#B7791F]',
      dot: 'bg-[#B7791F]',
      label: 'Medium',
    },
    low: {
      bg: 'bg-[#F0F2F5]',
      text: 'text-[#667085]',
      dot: 'bg-[#98A2B3]',
      label: 'Low',
    },
  };
  const cfg = styles[priority];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export function StatusBadge({
  status,
  isOverdue = false,
  timerState,
}: {
  status: TaskStatus;
  isOverdue?: boolean;
  timerState?: 'running' | 'paused' | 'recovering' | null;
}) {
  if (timerState === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F65F6] whitespace-nowrap animate-pulse">
        <PlayCircle className="h-3 w-3" aria-hidden="true" />
        Running
      </span>
    );
  }
  if (timerState === 'paused') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#B7791F] whitespace-nowrap">
        <PauseCircle className="h-3 w-3" aria-hidden="true" />
        Paused
      </span>
    );
  }
  if (isOverdue && status !== 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FCE8E9] px-2.5 py-0.5 text-[11px] font-semibold text-[#C2414B] whitespace-nowrap">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Overdue
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#16845B] whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Completed
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F65F6] whitespace-nowrap">
        <Clock className="h-3 w-3" aria-hidden="true" />
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085] whitespace-nowrap">
      To Do
    </span>
  );
}

export function EntryTypeBadge({ type }: { type: TimeEntryType }) {
  if (type === 'timer') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F65F6] whitespace-nowrap">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Automatic
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085] whitespace-nowrap">
      Manual
    </span>
  );
}

export function CalendarSyncBadge({ status }: { status: CalendarSyncStatus }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#16845B] whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Synced
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#B7791F] whitespace-nowrap">
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Pending
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FCE8E9] px-2.5 py-0.5 text-[11px] font-semibold text-[#C2414B] whitespace-nowrap">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Sync Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085] whitespace-nowrap">
      <CalendarOff className="h-3 w-3" aria-hidden="true" />
      Not Synced
    </span>
  );
}

export function ProjectLabel({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7E8B9B] whitespace-nowrap">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate max-w-[140px]">{name}</span>
    </span>
  );
}

export function ReminderBadge({ offsetMinutes }: { offsetMinutes: number | null }) {
  if (offsetMinutes === null || offsetMinutes === undefined) {
    return null;
  }
  const label = offsetMinutes === 0 ? 'Reminder at start' : `Reminder ${offsetMinutes}m before`;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F65F6] whitespace-nowrap">
      <Bell className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
