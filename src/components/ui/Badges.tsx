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

export function PriorityBadge({ priority }: { priority: TaskPriority | 'urgent' }) {
  const styles: Record<TaskPriority | 'urgent', { bg: string; text: string; dot: string; label: string }> = {
    urgent: {
      bg: 'bg-[#FCE8E9]',
      text: 'text-[#9B1C1C]',
      dot: 'bg-[#9B1C1C]',
      label: 'Urgent',
    },
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
  const cfg = styles[priority] || styles.medium;

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

export function ClientVisibilityBadge({ clientVisible }: { clientVisible?: boolean }) {
  if (clientVisible) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7EE] px-2.5 py-0.5 text-[11px] font-medium text-[#16845B] whitespace-nowrap border border-[#BDE8C8]">
        <CheckCircle2 className="h-3 w-3" />
        Client Visible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-[11px] font-medium text-[#7E8B9B] whitespace-nowrap border border-[#E9ECF5]">
      Internal Only
    </span>
  );
}

export function ClientProjectStatusBadge({
  status,
}: {
  status?: 'on_track' | 'at_risk' | 'delayed' | 'completed';
}) {
  const current = status || 'on_track';
  const styles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    on_track: {
      bg: 'bg-[#EAF7EE]',
      text: 'text-[#16845B]',
      dot: 'bg-[#16845B]',
      label: 'On Track',
    },
    at_risk: {
      bg: 'bg-[#FEF3E2]',
      text: 'text-[#B7791F]',
      dot: 'bg-[#B7791F]',
      label: 'At Risk',
    },
    delayed: {
      bg: 'bg-[#FCE8E9]',
      text: 'text-[#C2414B]',
      dot: 'bg-[#C2414B]',
      label: 'Delayed',
    },
    completed: {
      bg: 'bg-[#EDF2FE]',
      text: 'text-[#2F65F6]',
      dot: 'bg-[#2F65F6]',
      label: 'Completed',
    },
  };
  const cfg = styles[current] || styles.on_track;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export function MembershipStatusBadge({
  status,
}: {
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
}) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    accepted: {
      bg: 'bg-[#EAF7EE] text-[#16845B]',
      text: 'text-[#16845B]',
      label: 'Active Client',
    },
    pending: {
      bg: 'bg-[#FEF3E2] text-[#B7791F]',
      text: 'text-[#B7791F]',
      label: 'Pending Invite',
    },
    declined: {
      bg: 'bg-[#FCE8E9] text-[#C2414B]',
      text: 'text-[#C2414B]',
      label: 'Declined',
    },
    revoked: {
      bg: 'bg-[#F0F2F5] text-[#7E8B9B]',
      text: 'text-[#7E8B9B]',
      label: 'Revoked',
    },
  };
  const cfg = styles[status] || styles.pending;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${cfg.bg}`}
    >
      {cfg.label}
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

export function InvitationLifecycleBadge({
  isExpired,
  revokedAt,
  acceptedAt,
}: {
  isExpired?: boolean;
  revokedAt?: string | null;
  acceptedAt?: string | null;
}) {
  if (revokedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2.5 py-0.5 text-[11px] font-semibold text-[#7E8B9B] whitespace-nowrap">
        Revoked
      </span>
    );
  }
  if (acceptedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#16845B] whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" />
        Accepted
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-semibold text-[#475467] whitespace-nowrap">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#B7791F] whitespace-nowrap border border-[#FEE4E2]/40">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

export function InvitationDeliveryBadge({
  status,
  sentAt,
  error,
}: {
  status: 'queued' | 'sent' | 'failed';
  sentAt?: string | null;
  error?: string | null;
}) {
  if (status === 'sent') {
    return (
      <span
        title={sentAt ? `Dispatched at ${new Date(sentAt).toLocaleString()}` : 'Email dispatched successfully'}
        className="inline-flex items-center gap-1 rounded-full bg-[#E8F5EF] px-2 py-0.5 text-[10px] font-semibold text-[#16845B] whitespace-nowrap border border-[#BDE8C8]"
      >
        <CheckCircle2 className="h-3 w-3" />
        Email Sent
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        title={error || 'Email could not be delivered automatically'}
        className="inline-flex items-center gap-1 rounded-full bg-[#FCE8E9] px-2 py-0.5 text-[10px] font-semibold text-[#C2414B] whitespace-nowrap border border-[#FECDCA]"
      >
        <AlertCircle className="h-3 w-3" />
        Delivery Failed
      </span>
    );
  }
  return (
    <span
      title="Queued for dispatch"
      className="inline-flex items-center gap-1 rounded-full bg-[#EDF2FE] px-2 py-0.5 text-[10px] font-semibold text-[#2F65F6] whitespace-nowrap border border-[#D0E2FF]"
    >
      <Clock className="h-3 w-3" />
      Email Queued
    </span>
  );
}
