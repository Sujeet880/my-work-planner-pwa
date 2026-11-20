import {
  AlertCircle,
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
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cfg.bg} ${cfg.text}`}
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
      <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF1FF] px-2 py-0.5 text-xs font-medium text-[#4968D6] whitespace-nowrap">
        <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Running
      </span>
    );
  }
  if (timerState === 'paused') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3E2] px-2 py-0.5 text-xs font-medium text-[#B7791F] whitespace-nowrap">
        <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Paused
      </span>
    );
  }
  if (isOverdue && status !== 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#FCE8E9] px-2 py-0.5 text-xs font-medium text-[#C2414B] whitespace-nowrap">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Overdue
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#E8F5EF] px-2 py-0.5 text-xs font-medium text-[#16845B] whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Completed
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF1FF] px-2 py-0.5 text-xs font-medium text-[#3574B8] whitespace-nowrap">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#F0F2F5] px-2 py-0.5 text-xs font-medium text-[#667085] whitespace-nowrap">
      To Do
    </span>
  );
}

export function EntryTypeBadge({ type }: { type: TimeEntryType }) {
  if (type === 'timer') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF1FF] px-2 py-0.5 text-xs font-medium text-[#4968D6] whitespace-nowrap">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Automatic
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#F0F2F5] px-2 py-0.5 text-xs font-medium text-[#667085] whitespace-nowrap">
      Manual
    </span>
  );
}

export function CalendarSyncBadge({ status }: { status: CalendarSyncStatus }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#E8F5EF] px-2 py-0.5 text-xs font-medium text-[#16845B] whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Synced
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3E2] px-2 py-0.5 text-xs font-medium text-[#B7791F] whitespace-nowrap">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Pending
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#FCE8E9] px-2 py-0.5 text-xs font-medium text-[#C2414B] whitespace-nowrap">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Sync Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#F0F2F5] px-2 py-0.5 text-xs font-medium text-[#667085] whitespace-nowrap">
      <CalendarOff className="h-3.5 w-3.5" aria-hidden="true" />
      Not Synced
    </span>
  );
}

export function ProjectLabel({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#667085] whitespace-nowrap">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate max-w-[140px]">{name}</span>
    </span>
  );
}
