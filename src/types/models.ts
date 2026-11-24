export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export type TimeEntryType = 'timer' | 'manual';

export type TimeEntryStatus = 'running' | 'paused' | 'completed';

export type CalendarSyncStatus = 'not_synced' | 'synced' | 'pending' | 'failed';

export type DateFormatPreference = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export type TimeFormatPreference = '12h' | '24h';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export type TaskViewTab = 'today' | 'upcoming' | 'inbox' | 'all' | 'completed';

export type ReminderStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed';

export interface TaskReminder {
  id: string;
  userId: string;
  taskId: string;
  remindAt: string;
  timezone: string;
  status: ReminderStatus;
  sentAt: string | null;
  attemptCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string | null;
  createdAt: string;
  lastSuccessAt?: string | null;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  timezone: string; // Default: Asia/Kolkata
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  defaultEventDurationMinutes: number; // Default: 60
  defaultReminderOffsetMinutes: number; // Default: 15
  notificationsEnabled: boolean;
  defaultCalendarSyncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  clientName?: string | null;
  description?: string;
  color: string;
  isArchived: boolean;
  targetCompletionDate?: string | null;
  clientShareEnabled?: boolean;
  clientViewTimeTracking?: boolean;
  clientViewRemainingEstimate?: boolean;
  clientViewTaskDates?: boolean;
  clientAllowComments?: boolean;
  clientProjectStatus?: 'on_track' | 'at_risk' | 'delayed' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  scheduledDate: string | null; // YYYY-MM-DD or null (Inbox)
  scheduledStartTime: string | null; // HH:mm or null (requires scheduledDate)
  plannedDurationMinutes: number | null; // Positive integer or null
  remainingEstimateMinutes?: number | null;
  reminderOffsetMinutes: number | null; // e.g., 15, 30, 60, or null
  syncToGoogleCalendar: boolean;
  calendarSyncStatus: CalendarSyncStatus;
  clientVisible?: boolean;
  completedAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  taskId: string;
  projectId: string | null;
  entryType: TimeEntryType;
  status: TimeEntryStatus;
  startedAt: string; // ISO timestamp
  endedAt: string | null; // ISO timestamp when completed
  durationSeconds: number; // Persisted duration for completed/manual entries
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveTimerState {
  taskId: string;
  status: 'running' | 'paused' | 'recovering';
  startedAtMs: number; // Epoch ms when active segment began
  accumulatedBeforeSegmentSeconds: number; // Seconds accrued before current running segment
  sessionStartedAtIso: string; // Original start timestamp of this session
}

export interface CalendarConnection {
  isConfigured: boolean;
  isConnected: boolean;
  provider: 'google';
  accountEmail: string | null;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  status?: 'connected' | 'disconnected' | 'error' | 'needs_reauth';
  lastError?: string | null;
  pendingJobsCount?: number;
  failedJobsCount?: number;
  syncedTasksCount?: number;
}

export interface TaskFormValues {
  title: string;
  description: string;
  projectId: string | null;
  priority: TaskPriority;
  status?: TaskStatus;
  scheduledDate: string;
  scheduledStartTime: string;
  plannedDurationMinutes: string;
  remainingEstimateMinutes?: string;
  reminderOffsetMinutes: string;
  reminderCustomTime?: string;
  syncToGoogleCalendar: boolean;
  clientVisible?: boolean;
}

export interface ManualTimeEntryInput {
  taskId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: string;
  inputMode: 'duration' | 'range';
  notes: string;
}
