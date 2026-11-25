import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import {
  calculateActiveSessionSeconds,
  getLocalDateISO,
} from '../lib/timeMath';
import { projectService, type SaveProjectInput } from '../services/projectService';
import { taskService } from '../services/taskService';
import { timerService } from '../services/timerService';
import { calendarService } from '../services/calendarService';
import { calculateSchedulePlan } from '../services/schedulingEngine';
import type {
  ActiveTimerState,
  CalendarConnection,
  Profile,
  Project,
  Task,
  TaskCalendarBlock,
  TaskFormValues,
  TimeEntry,
} from '../types/models';
import type { Database } from '../types/database.types';

const INITIAL_EMPTY_PROFILE: Profile = {
  id: '',
  email: '',
  fullName: '',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  defaultEventDurationMinutes: 60,
  defaultReminderOffsetMinutes: 15,
  notificationsEnabled: true,
  defaultCalendarSyncEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const INITIAL_EMPTY_CALENDAR_CONNECTION: CalendarConnection = {
  isConfigured: false,
  isConnected: false,
  provider: 'google',
  accountEmail: null,
  selectedCalendarId: null,
  selectedCalendarName: null,
  syncEnabled: false,
  lastSyncedAt: null,
};

export interface PendingTimerSwitch {
  targetTaskId: string;
}

export interface PendingCompleteWithTimer {
  taskId: string;
}

export interface ToastNotice {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export interface WorkspaceContextValue {
  // Domain data
  profile: Profile;
  calendarConnection: CalendarConnection;
  refreshCalendarStatus: () => Promise<void>;
  retryCalendarSync: () => Promise<void>;
  isSyncingCalendar: boolean;
  projects: Project[];
  tasks: Task[];
  calendarBlocks: TaskCalendarBlock[];
  refreshCalendarBlocks: () => Promise<void>;
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimerState | null;
  nowMs: number;
  activeElapsedSeconds: number;
  activeTask: Task | null;

  // Loading & refresh state
  isLoadingData: boolean;
  refreshData: () => Promise<void>;

  // Drawers & Modals (TaskFormModal)
  taskDrawerOpen: boolean;
  taskModalOpen: boolean;
  editingTask: Task | null;
  taskDrawerDefaultDate: string | null;
  openCreateTaskDrawer: (defaultDate?: string | null) => void;
  openCreateTaskModal: (defaultDate?: string | null) => void;
  openEditTaskDrawer: (task: Task) => void;
  openEditTaskModal: (task: Task) => void;
  closeTaskDrawer: () => void;
  closeTaskModal: () => void;

  manualEntryModalOpen: boolean;
  manualEntryDefaultTaskId: string | null;
  openManualEntryModal: (defaultTaskId?: string | null) => void;
  closeManualEntryModal: () => void;

  // Delete task confirmation modal
  deleteTaskModalOpen: boolean;
  taskPendingDelete: Task | null;
  requestDeleteTask: (task: Task) => void;
  closeDeleteTaskModal: () => void;
  confirmDeleteTask: () => void;

  // Confirmation dialog states
  pendingSwitch: PendingTimerSwitch | null;
  cancelTimerSwitch: () => void;
  confirmSaveAndSwitch: () => void;

  pendingCompleteWithTimer: PendingCompleteWithTimer | null;
  cancelCompleteWithTimer: () => void;
  confirmStopSaveAndComplete: () => void;

  // Search
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Task actions
  saveTask: (values: TaskFormValues, existingTaskId?: string) => Task;
  toggleTaskCompletion: (taskId: string) => void;
  archiveTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  scheduleTaskToDate: (taskId: string, dateIso: string | null) => void;

  // Project actions
  saveProject: (input: SaveProjectInput) => void;
  toggleArchiveProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;

  // Timer actions
  startTaskTimer: (taskId: string) => void;
  pauseActiveTimer: () => void;
  resumeActiveTimer: () => void;
  stopAndSaveActiveTimer: () => void;
  toggleRecoveringPreview: () => void;

  // Time entry actions
  addManualTimeEntry: (input: {
    taskId: string;
    date: string;
    durationSeconds: number;
    startTime?: string;
    endTime?: string;
    notes?: string;
  }) => void;
  deleteTimeEntry: (entryId: string) => void;

  // Profile preferences
  updateProfilePreferences: (patch: Partial<Profile>) => void;

  // Toast notices
  toast: ToastNotice | null;
  dismissToast: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile: authProfile, isAuthenticated, isSupabaseConfigured } = useAuth();

  const [profile, setProfile] = useState<Profile>(INITIAL_EMPTY_PROFILE);
  const [calendarConnection, setCalendarConnection] = useState<CalendarConnection>(INITIAL_EMPTY_CALENDAR_CONNECTION);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<TaskCalendarBlock[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Modals & Drawers
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDrawerDefaultDate, setTaskDrawerDefaultDate] = useState<string | null>(null);

  const [deleteTaskModalOpen, setDeleteTaskModalOpen] = useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);

  const [manualEntryModalOpen, setManualEntryModalOpen] = useState(false);
  const [manualEntryDefaultTaskId, setManualEntryDefaultTaskId] = useState<string | null>(null);

  const [pendingSwitch, setPendingSwitch] = useState<PendingTimerSwitch | null>(null);
  const [pendingCompleteWithTimer, setPendingCompleteWithTimer] =
    useState<PendingCompleteWithTimer | null>(null);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastNotice | null>(null);

  const showToast = useCallback((message: string, tone: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({
      id: `toast-${Date.now()}`,
      message,
      tone,
    });
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Synchronize profile from AuthContext when available
  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  // Load real tasks, projects, timer, work sessions and calendar status when authenticated
  const loadUserData = useCallback(
    async (userId: string) => {
      setIsLoadingData(true);
      try {
        const [tasksRes, projectsRes, timerRes, sessionsRes, calendarRes, blocksRes] = await Promise.all([
          taskService.fetchTasks(userId),
          projectService.fetchProjects(userId),
          timerService.fetchActiveTimer(userId),
          timerService.fetchWorkSessions(userId),
          calendarService.getIntegrationStatus(userId),
          taskService.fetchCalendarBlocks(userId),
        ]);

        if (tasksRes.error) {
          showToast(`Could not load tasks from database: ${tasksRes.error}`, 'warning');
        } else if (tasksRes.data) {
          setTasks(tasksRes.data);
        }

        if (projectsRes.error) {
          showToast(`Could not load projects from database: ${projectsRes.error}`, 'warning');
        } else if (projectsRes.data) {
          setProjects(projectsRes.data);
        }

        if (blocksRes.data) {
          setCalendarBlocks(blocksRes.data);
        }

        if (timerRes.error) {
          console.warn('Could not load active timer:', timerRes.error);
        } else {
          setActiveTimer(timerRes.data);
          setNowMs(Date.now());
        }

        if (sessionsRes.error) {
          showToast(`Could not load work sessions: ${sessionsRes.error}`, 'warning');
        } else if (sessionsRes.data) {
          setTimeEntries(sessionsRes.data);
        }

        if (calendarRes.data) {
          setCalendarConnection({
            isConfigured: true,
            isConnected: calendarRes.data.isConnected,
            provider: 'google',
            accountEmail: calendarRes.data.accountEmail,
            selectedCalendarId: calendarRes.data.calendarId,
            selectedCalendarName: 'Primary Google Calendar',
            syncEnabled: calendarRes.data.isConnected,
            lastSyncedAt: calendarRes.data.lastSyncAt,
            status: calendarRes.data.status,
            lastError: calendarRes.data.lastError,
            pendingJobsCount: calendarRes.data.pendingJobsCount,
            failedJobsCount: calendarRes.data.failedJobsCount,
            syncedTasksCount: calendarRes.data.syncedTasksCount,
          });
        }
      } catch (err) {
        console.error('Error loading workspace data:', err);
        showToast('Could not load workspace data from database.', 'warning');
      } finally {
        setIsLoadingData(false);
      }
    },
    [showToast]
  );

  // Initial and reactive data hydration
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadUserData(user.id);
    } else {
      // Clear data on logout or unauthenticated session to prevent data leakage.
      // Production must NEVER substitute fake, sample, or dummy preview data.
      setTasks([]);
      setCalendarBlocks([]);
      setProjects([]);
      setTimeEntries([]);
      setActiveTimer(null);
      setCalendarConnection(INITIAL_EMPTY_CALENDAR_CONNECTION);
    }
  }, [isAuthenticated, user?.id, loadUserData]);

  const refreshCalendarBlocks = useCallback(async () => {
    const currentUserId = user?.id || profile.id;
    if (!currentUserId) return;
    const res = await taskService.fetchCalendarBlocks(currentUserId);
    if (res.data) {
      setCalendarBlocks(res.data);
    }
  }, [profile.id, user?.id]);

  const refreshData = useCallback(async () => {
    if (user?.id) {
      await loadUserData(user.id);
    }
  }, [loadUserData, user?.id]);

  // Tick every 1 second only while timer is running; elapsed time itself is always timestamp-derived
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== 'running') return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  const activeElapsedSeconds = useMemo(
    () => calculateActiveSessionSeconds(activeTimer, nowMs),
    [activeTimer, nowMs]
  );

  const activeTask = useMemo(
    () => (activeTimer ? tasks.find((t) => t.id === activeTimer.taskId) ?? null : null),
    [activeTimer, tasks]
  );

  const openCreateTaskDrawer = useCallback((defaultDate: string | null = getLocalDateISO()) => {
    setEditingTask(null);
    setTaskDrawerDefaultDate(defaultDate);
    setTaskDrawerOpen(true);
  }, []);

  const openEditTaskDrawer = useCallback((task: Task) => {
    setEditingTask(task);
    setTaskDrawerDefaultDate(task.scheduledDate);
    setTaskDrawerOpen(true);
  }, []);

  const closeTaskDrawer = useCallback(() => {
    setTaskDrawerOpen(false);
    setEditingTask(null);
  }, []);

  const openManualEntryModal = useCallback((defaultTaskId: string | null = null) => {
    setManualEntryDefaultTaskId(defaultTaskId);
    setManualEntryModalOpen(true);
  }, []);

  const closeManualEntryModal = useCallback(() => {
    setManualEntryModalOpen(false);
    setManualEntryDefaultTaskId(null);
  }, []);

  // Internal helper: commits active timer session as a completed time entry (for client-side preview)
  const commitActiveTimerSession = useCallback(
    (timer: ActiveTimerState) => {
      const elapsed = calculateActiveSessionSeconds(timer, Date.now());
      const task = tasks.find((t) => t.id === timer.taskId);
      const nowIso = new Date().toISOString();

      if (elapsed > 0) {
        const savedEntry: TimeEntry = {
          id: `te-${Date.now()}`,
          userId: user?.id || profile.id,
          taskId: timer.taskId,
          projectId: task?.projectId ?? null,
          entryType: 'timer',
          status: 'completed',
          startedAt: timer.sessionStartedAtIso || new Date(timer.startedAtMs).toISOString(),
          endedAt: nowIso,
          durationSeconds: elapsed,
          notes: 'Tracked via count-up timer',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setTimeEntries((prev) => [savedEntry, ...prev]);
      }
      setActiveTimer(null);
    },
    [profile.id, tasks, user?.id]
  );

  const resumeActiveTimer = useCallback(() => {
    if (!activeTimer || (activeTimer.status !== 'paused' && activeTimer.status !== 'recovering'))
      return;
    const prevTimer = activeTimer;
    const now = Date.now();
    setActiveTimer({
      ...activeTimer,
      status: 'running',
      startedAtMs: now,
    });
    setNowMs(now);

    if (isAuthenticated && user?.id) {
      timerService.resumeTimer(user.id).then((res) => {
        if (res.error) {
          showToast(`Could not resume timer: ${res.error}`, 'warning');
          setActiveTimer(prevTimer);
        } else if (res.data) {
          setActiveTimer(res.data);
        }
      });
    }

    showToast('Timer resumed.', 'info');
  }, [activeTimer, isAuthenticated, showToast, user?.id]);

  const startTaskTimer = useCallback(
    (taskId: string) => {
      if (activeTimer && activeTimer.taskId === taskId) {
        if (activeTimer.status === 'paused' || activeTimer.status === 'recovering') {
          resumeActiveTimer();
        }
        return;
      }

      if (activeTimer && activeTimer.taskId !== taskId) {
        setPendingSwitch({ targetTaskId: taskId });
        return;
      }

      const prevTimer = activeTimer;
      const prevTasks = [...tasks];
      const now = Date.now();
      const newTimer: ActiveTimerState = {
        taskId,
        status: 'running',
        startedAtMs: now,
        accumulatedBeforeSegmentSeconds: 0,
        sessionStartedAtIso: new Date(now).toISOString(),
      };
      setNowMs(now);
      setActiveTimer(newTimer);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === 'todo'
            ? { ...t, status: 'in_progress', updatedAt: new Date().toISOString() }
            : t
        )
      );

      if (isAuthenticated && user?.id) {
        timerService.startTimer(taskId, user.id).then((res) => {
          if (res.error) {
            showToast(`Could not start timer: ${res.error}`, 'warning');
            setActiveTimer(prevTimer);
            setTasks(prevTasks);
          } else if (res.data) {
            setActiveTimer(res.data);
          }
        });
      }

      showToast('Timer started.', 'success');
    },
    [activeTimer, isAuthenticated, resumeActiveTimer, showToast, tasks, user?.id]
  );

  const pauseActiveTimer = useCallback(() => {
    if (!activeTimer || activeTimer.status !== 'running') return;
    const now = Date.now();
    const prevTimer = activeTimer;
    const prevEntries = [...timeEntries];
    const task = tasks.find((t) => t.id === activeTimer.taskId);
    const currentSegmentSeconds = Math.max(1, Math.floor((now - activeTimer.startedAtMs) / 1000));
    const nowIso = new Date(now).toISOString();

    const optimisticSession: TimeEntry = {
      id: `temp-${now}`,
      userId: user?.id || profile.id,
      taskId: activeTimer.taskId,
      projectId: task?.projectId ?? null,
      entryType: 'timer',
      status: 'completed',
      startedAt: activeTimer.sessionStartedAtIso || new Date(activeTimer.startedAtMs).toISOString(),
      endedAt: nowIso,
      durationSeconds: currentSegmentSeconds,
      notes: 'Tracked via count-up timer',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setActiveTimer({
      ...activeTimer,
      status: 'paused',
      startedAtMs: now,
      accumulatedBeforeSegmentSeconds: 0,
    });
    setTimeEntries((prev) => [optimisticSession, ...prev]);
    setNowMs(now);

    if (isAuthenticated && user?.id) {
      timerService.pauseTimer(user.id).then((res) => {
        if (res.error) {
          showToast(`Could not pause timer: ${res.error}`, 'warning');
          setActiveTimer(prevTimer);
          setTimeEntries(prevEntries);
        } else {
          if (res.data) setActiveTimer(res.data);
          if (res.savedSession) {
            setTimeEntries((prev) => [
              res.savedSession!,
              ...prev.filter((e) => e.id !== optimisticSession.id),
            ]);
          }
        }
      });
    }

    showToast('Timer paused.', 'info');
  }, [activeTimer, isAuthenticated, profile.id, showToast, tasks, timeEntries, user?.id]);

  const stopAndSaveActiveTimer = useCallback(() => {
    if (!activeTimer) return;
    const prevTimer = activeTimer;
    const prevEntries = [...timeEntries];
    const now = Date.now();
    const task = tasks.find((t) => t.id === activeTimer.taskId);
    let optimisticSession: TimeEntry | null = null;

    if (activeTimer.status === 'running') {
      const elapsed = Math.max(1, Math.floor((now - activeTimer.startedAtMs) / 1000));
      const nowIso = new Date(now).toISOString();
      optimisticSession = {
        id: `temp-${now}`,
        userId: user?.id || profile.id,
        taskId: activeTimer.taskId,
        projectId: task?.projectId ?? null,
        entryType: 'timer',
        status: 'completed',
        startedAt: activeTimer.sessionStartedAtIso || new Date(activeTimer.startedAtMs).toISOString(),
        endedAt: nowIso,
        durationSeconds: elapsed,
        notes: 'Tracked via count-up timer',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setTimeEntries((prev) => [optimisticSession!, ...prev]);
    }

    setActiveTimer(null);

    if (isAuthenticated && user?.id) {
      timerService.stopTimer(user.id).then((res) => {
        if (res.error) {
          showToast(`Could not stop timer: ${res.error}`, 'warning');
          setActiveTimer(prevTimer);
          setTimeEntries(prevEntries);
        } else if (res.savedSession && optimisticSession) {
          setTimeEntries((prev) => [
            res.savedSession!,
            ...prev.filter((e) => e.id !== optimisticSession!.id),
          ]);
        }
      });
    }

    showToast('Time entry saved.', 'success');
  }, [activeTimer, isAuthenticated, profile.id, showToast, tasks, timeEntries, user?.id]);

  const confirmSaveAndSwitch = useCallback(() => {
    if (!pendingSwitch) return;
    const { targetTaskId } = pendingSwitch;
    const prevTimer = activeTimer;
    const prevEntries = [...timeEntries];
    const prevTasks = [...tasks];
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    let optimisticPrevSession: TimeEntry | null = null;
    if (activeTimer && activeTimer.status === 'running') {
      const prevTask = tasks.find((t) => t.id === activeTimer.taskId);
      const elapsed = Math.max(1, Math.floor((now - activeTimer.startedAtMs) / 1000));
      optimisticPrevSession = {
        id: `temp-${now}`,
        userId: user?.id || profile.id,
        taskId: activeTimer.taskId,
        projectId: prevTask?.projectId ?? null,
        entryType: 'timer',
        status: 'completed',
        startedAt: activeTimer.sessionStartedAtIso || new Date(activeTimer.startedAtMs).toISOString(),
        endedAt: nowIso,
        durationSeconds: elapsed,
        notes: 'Tracked via count-up timer',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setTimeEntries((prev) => [optimisticPrevSession!, ...prev]);
    }

    setNowMs(now);
    setActiveTimer({
      taskId: targetTaskId,
      status: 'running',
      startedAtMs: now,
      accumulatedBeforeSegmentSeconds: 0,
      sessionStartedAtIso: nowIso,
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === targetTaskId && t.status === 'todo'
          ? { ...t, status: 'in_progress', updatedAt: nowIso }
          : t
      )
    );
    setPendingSwitch(null);

    if (isAuthenticated && user?.id) {
      timerService.switchTimer(targetTaskId, user.id).then((res) => {
        if (res.error) {
          showToast(`Could not switch timer: ${res.error}`, 'warning');
          setActiveTimer(prevTimer);
          setTimeEntries(prevEntries);
          setTasks(prevTasks);
        } else {
          if (res.data) setActiveTimer(res.data);
          if (res.previousSession && optimisticPrevSession) {
            setTimeEntries((prev) => [
              res.previousSession!,
              ...prev.filter((e) => e.id !== optimisticPrevSession!.id),
            ]);
          }
        }
      });
    }

    showToast('Saved previous timer session and switched to new task.', 'success');
  }, [activeTimer, isAuthenticated, pendingSwitch, profile.id, showToast, tasks, timeEntries, user?.id]);

  const toggleRecoveringPreview = useCallback(() => {
    if (!activeTimer) {
      const firstActive = tasks.find((t) => !t.isArchived && t.status !== 'completed');
      if (!firstActive) {
        showToast('No active tasks available to attach timer preview.', 'warning');
        return;
      }
      const now = Date.now();
      setActiveTimer({
        taskId: firstActive.id,
        status: 'recovering',
        startedAtMs: now,
        accumulatedBeforeSegmentSeconds: 2700,
        sessionStartedAtIso: new Date(now - 2700000).toISOString(),
      });
      showToast('Active timer crash recovery preview activated.', 'info');
      return;
    }

    if (activeTimer.status === 'recovering') {
      setActiveTimer({
        ...activeTimer,
        status: 'running',
        startedAtMs: Date.now(),
      });
      showToast('Recovered timer restored to running state.', 'success');
    } else {
      setActiveTimer({
        ...activeTimer,
        status: 'recovering',
      });
      showToast('Switched to crash-recovery preview state.', 'info');
    }
  }, [activeTimer, showToast, tasks]);

  const saveTask = useCallback(
    (values: TaskFormValues, existingTaskId?: string): Task => {
      const nowIso = new Date().toISOString();
      const currentUserId = user?.id || profile.id;
      const scheduledDate = values.scheduledDate.trim() || null;
      const scheduledStartTime =
        scheduledDate && values.scheduledStartTime.trim()
          ? values.scheduledStartTime.trim()
          : null;
      const reminderOffset =
        scheduledDate && values.reminderOffsetMinutes.trim()
          ? parseInt(values.reminderOffsetMinutes, 10) || null
          : null;

      const shouldSync = Boolean(scheduledDate && (values.syncToGoogleCalendar ?? true));

      const isMultiDay = Boolean(
        values.isMultiDay ||
        (values.scheduledEndDate && values.scheduledDate && values.scheduledEndDate > values.scheduledDate)
      );
      const scheduledEndDate = isMultiDay ? (values.scheduledEndDate?.trim() || null) : null;
      const dailyPlannedMinutes = isMultiDay && values.dailyPlannedHours?.trim()
        ? Math.round(parseFloat(values.dailyPlannedHours) * 60)
        : null;
      const includeWeekends = values.includeWeekends ?? false;

      let plannedMinutes = values.plannedDurationMinutes?.trim()
        ? Math.max(1, parseInt(values.plannedDurationMinutes, 10) || 0)
        : null;

      if (isMultiDay && scheduledDate && scheduledEndDate && dailyPlannedMinutes) {
        const plan = calculateSchedulePlan({
          startDate: scheduledDate,
          endDate: scheduledEndDate,
          dailyPlannedHours: dailyPlannedMinutes / 60,
          preferredStartTime: scheduledStartTime || '09:00',
          includeWeekends,
        });
        plannedMinutes = plan.totalPlannedMinutes;
      }

      if (existingTaskId) {
        const prevTask = tasks.find((t) => t.id === existingTaskId);
        const taskStatus = values.status || prevTask?.status || 'todo';
        const updatedTask: Task = {
          id: existingTaskId,
          userId: currentUserId,
          projectId: values.projectId || null,
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          priority: values.priority,
          status: taskStatus,
          scheduledDate,
          scheduledEndDate,
          dailyPlannedMinutes,
          includeWeekends,
          scheduledStartTime,
          plannedDurationMinutes: plannedMinutes,
          remainingEstimateMinutes: values.remainingEstimateMinutes?.trim()
            ? Math.max(0, parseInt(values.remainingEstimateMinutes, 10) || 0)
            : (prevTask?.remainingEstimateMinutes ?? null),
          reminderOffsetMinutes: reminderOffset,
          syncToGoogleCalendar: shouldSync,
          calendarSyncStatus: shouldSync ? 'pending' : 'not_synced',
          clientVisible: values.projectId ? Boolean(values.clientVisible) : false,
          completedAt: taskStatus === 'completed' ? (prevTask?.completedAt || nowIso) : null,
          isArchived: prevTask?.isArchived || false,
          createdAt: prevTask?.createdAt || nowIso,
          updatedAt: nowIso,
        };

        setTasks((prev) => prev.map((t) => (t.id === existingTaskId ? updatedTask : t)));

        // Optimistically update calendar blocks
        if (scheduledDate) {
          const plan = calculateSchedulePlan({
            startDate: scheduledDate,
            endDate: scheduledEndDate || scheduledDate,
            dailyPlannedHours: dailyPlannedMinutes ? dailyPlannedMinutes / 60 : (plannedMinutes ? plannedMinutes / 60 : 1),
            preferredStartTime: scheduledStartTime || '09:00',
            includeWeekends,
          });
          const optimisticBlocks: TaskCalendarBlock[] = plan.blocks.map((b, idx) => ({
            id: `temp-block-${existingTaskId}-${idx}-${Date.now()}`,
            userId: currentUserId,
            taskId: existingTaskId,
            blockDate: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            durationMinutes: b.durationMinutes,
            status: 'scheduled',
            createdAt: nowIso,
            updatedAt: nowIso,
          }));
          setCalendarBlocks((prev) => [
            ...prev.filter((b) => b.taskId !== existingTaskId),
            ...optimisticBlocks,
          ]);
        } else {
          setCalendarBlocks((prev) => prev.filter((b) => b.taskId !== existingTaskId));
        }

        if (isAuthenticated && user?.id) {
          taskService.updateTask(user.id, existingTaskId, values).then((res) => {
            if (res.error) {
              showToast(`Error updating task: ${res.error}`, 'warning');
              if (prevTask) {
                setTasks((prev) => prev.map((t) => (t.id === existingTaskId ? prevTask : t)));
              }
            } else if (res.data) {
              setTasks((prev) => prev.map((t) => (t.id === existingTaskId ? res.data! : t)));
              refreshCalendarBlocks();
            }
          });
        }

        showToast('Task updated.', 'success');
        return updatedTask;
      }

      // Create new task
      const tempId = `task-${Date.now()}`;
      const newTask: Task = {
        id: tempId,
        userId: currentUserId,
        projectId: values.projectId || null,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        priority: values.priority,
        status: values.status || 'todo',
        scheduledDate,
        scheduledEndDate,
        dailyPlannedMinutes,
        includeWeekends,
        scheduledStartTime,
        plannedDurationMinutes: plannedMinutes,
        remainingEstimateMinutes: values.remainingEstimateMinutes?.trim()
          ? Math.max(0, parseInt(values.remainingEstimateMinutes, 10) || 0)
          : null,
        reminderOffsetMinutes: reminderOffset,
        syncToGoogleCalendar: shouldSync,
        calendarSyncStatus: shouldSync ? 'pending' : 'not_synced',
        clientVisible: values.projectId ? Boolean(values.clientVisible) : false,
        completedAt: values.status === 'completed' ? nowIso : null,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setTasks((prev) => [newTask, ...prev]);

      // Optimistically allocate calendar blocks for new task
      if (scheduledDate) {
        const plan = calculateSchedulePlan({
          startDate: scheduledDate,
          endDate: scheduledEndDate || scheduledDate,
          dailyPlannedHours: dailyPlannedMinutes ? dailyPlannedMinutes / 60 : (plannedMinutes ? plannedMinutes / 60 : 1),
          preferredStartTime: scheduledStartTime || '09:00',
          includeWeekends,
        });
        const optimisticBlocks: TaskCalendarBlock[] = plan.blocks.map((b, idx) => ({
          id: `temp-block-${tempId}-${idx}-${Date.now()}`,
          userId: currentUserId,
          taskId: tempId,
          blockDate: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          durationMinutes: b.durationMinutes,
          status: 'scheduled',
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
        setCalendarBlocks((prev) => [...prev, ...optimisticBlocks]);
      }

      if (isAuthenticated && user?.id) {
        taskService.createTask(user.id, values).then((res) => {
          if (res.error) {
            showToast(`Error creating task: ${res.error}`, 'warning');
            setTasks((prev) => prev.filter((t) => t.id !== tempId));
            setCalendarBlocks((prev) => prev.filter((b) => b.taskId !== tempId));
          } else if (res.data) {
            setTasks((prev) => prev.map((t) => (t.id === tempId ? res.data! : t)));
            refreshCalendarBlocks();
          }
        });
      }

      showToast('Task created.', 'success');
      return newTask;
    },
    [isAuthenticated, profile.id, refreshCalendarBlocks, showToast, tasks, user?.id]
  );

  const toggleTaskCompletion = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      // Business Rule: If task is active on timer, intercept with confirmation modal
      if (activeTimer && activeTimer.taskId === taskId && target.status !== 'completed') {
        setPendingCompleteWithTimer({ taskId });
        return;
      }

      const nextStatus = target.status === 'completed' ? 'todo' : 'completed';
      const nowIso = new Date().toISOString();

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: nextStatus,
                completedAt: nextStatus === 'completed' ? nowIso : null,
                updatedAt: nowIso,
              }
            : t
        )
      );

      if (isAuthenticated && user?.id) {
        taskService.toggleTaskCompletion(user.id, taskId, target.status).then((res) => {
          if (res.error) {
            showToast(`Error updating status: ${res.error}`, 'warning');
            setTasks((prev) => prev.map((t) => (t.id === taskId ? target : t)));
          } else if (res.data) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? res.data! : t)));
          }
        });
      }

      showToast(
        nextStatus === 'completed' ? 'Task completed.' : 'Task reopened to To Do.',
        'success'
      );
    },
    [activeTimer, isAuthenticated, showToast, tasks, user?.id]
  );

  const confirmStopSaveAndComplete = useCallback(() => {
    if (!pendingCompleteWithTimer) return;
    const { taskId } = pendingCompleteWithTimer;
    const prevTimer = activeTimer;
    const prevEntries = [...timeEntries];
    const prevTasks = [...tasks];
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    let optimisticPrevSession: TimeEntry | null = null;
    if (activeTimer && activeTimer.taskId === taskId && activeTimer.status === 'running') {
      const task = tasks.find((t) => t.id === taskId);
      const elapsed = Math.max(1, Math.floor((now - activeTimer.startedAtMs) / 1000));
      optimisticPrevSession = {
        id: `temp-${now}`,
        userId: user?.id || profile.id,
        taskId,
        projectId: task?.projectId ?? null,
        entryType: 'timer',
        status: 'completed',
        startedAt: activeTimer.sessionStartedAtIso || new Date(activeTimer.startedAtMs).toISOString(),
        endedAt: nowIso,
        durationSeconds: elapsed,
        notes: 'Tracked via count-up timer',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setTimeEntries((prev) => [optimisticPrevSession!, ...prev]);
    }

    if (activeTimer?.taskId === taskId) {
      setActiveTimer(null);
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed', completedAt: nowIso, updatedAt: nowIso }
          : t
      )
    );
    setPendingCompleteWithTimer(null);

    if (isAuthenticated && user?.id) {
      timerService.completeTaskWithTimer(taskId, user.id).then((res) => {
        if (res.error) {
          showToast(`Error completing task: ${res.error}`, 'warning');
          setActiveTimer(prevTimer);
          setTimeEntries(prevEntries);
          setTasks(prevTasks);
        } else if (res.savedSession && optimisticPrevSession) {
          setTimeEntries((prev) => [
            res.savedSession!,
            ...prev.filter((e) => e.id !== optimisticPrevSession!.id),
          ]);
        }
      });
    }

    showToast('Active session saved and task marked completed.', 'success');
  }, [activeTimer, isAuthenticated, pendingCompleteWithTimer, profile.id, showToast, tasks, timeEntries, user?.id]);

  const archiveTask = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (activeTimer?.taskId === taskId) {
        commitActiveTimerSession(activeTimer);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, isArchived: true, updatedAt: new Date().toISOString() } : t
        )
      );

      if (isAuthenticated && user?.id) {
        taskService.archiveTask(user.id, taskId, true).then((res) => {
          if (res.error) {
            showToast(`Error archiving task: ${res.error}`, 'warning');
            if (target) {
              setTasks((prev) => prev.map((t) => (t.id === taskId ? target : t)));
            }
          }
        });
      }

      showToast('Task archived. Historical time logs remain preserved.', 'info');
    },
    [activeTimer, commitActiveTimerSession, isAuthenticated, showToast, tasks, user?.id]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      const prevTasks = [...tasks];
      const prevBlocks = [...calendarBlocks];
      if (activeTimer?.taskId === taskId) {
        setActiveTimer(null);
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setCalendarBlocks((prev) => prev.filter((b) => b.taskId !== taskId));
      // Invariant: historical work sessions are NEVER deleted when a task is deleted!
      // They remain associated or disassociated with empty taskId for reports.
      setTimeEntries((prev) =>
        prev.map((e) => (e.taskId === taskId ? { ...e, taskId: '' } : e))
      );

      if (isAuthenticated && user?.id) {
        taskService.deleteTask(user.id, taskId).then((res) => {
          if (res.error) {
            showToast(`Error deleting task: ${res.error}`, 'warning');
            setTasks(prevTasks);
            setCalendarBlocks(prevBlocks);
          }
        });
      }

      showToast('Task permanently deleted. Historical work sessions preserved.', 'warning');
    },
    [activeTimer, calendarBlocks, isAuthenticated, showToast, tasks, user?.id]
  );

  const requestDeleteTask = useCallback((task: Task) => {
    setTaskPendingDelete(task);
    setDeleteTaskModalOpen(true);
  }, []);

  const closeDeleteTaskModal = useCallback(() => {
    setDeleteTaskModalOpen(false);
    setTaskPendingDelete(null);
  }, []);

  const confirmDeleteTask = useCallback(() => {
    if (!taskPendingDelete) return;
    const id = taskPendingDelete.id;
    deleteTask(id);
    setDeleteTaskModalOpen(false);
    setTaskPendingDelete(null);
  }, [deleteTask, taskPendingDelete]);

  const scheduleTaskToDate = useCallback(
    (taskId: string, dateIso: string | null) => {
      const target = tasks.find((t) => t.id === taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                scheduledDate: dateIso,
                scheduledStartTime: dateIso ? t.scheduledStartTime : null,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );

      if (isAuthenticated && user?.id) {
        taskService.scheduleTask(user.id, taskId, dateIso).then((res) => {
          if (res.error) {
            showToast(`Error scheduling task: ${res.error}`, 'warning');
            if (target) {
              setTasks((prev) => prev.map((t) => (t.id === taskId ? target : t)));
            }
          } else if (res.data) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? res.data! : t)));
          }
        });
      }

      showToast(dateIso ? `Task scheduled for ${dateIso}.` : 'Task moved to Inbox.', 'success');
    },
    [isAuthenticated, showToast, tasks, user?.id]
  );

  const saveProject = useCallback(
    (input: SaveProjectInput) => {
      const nowIso = new Date().toISOString();
      const currentUserId = user?.id || profile.id;

      if (input.id) {
        const prevProject = projects.find((p) => p.id === input.id);
        const updatedProject: Project = {
          id: input.id,
          userId: currentUserId,
          name: input.name.trim(),
          description: input.description?.trim() || undefined,
          color: input.color,
          isArchived: prevProject?.isArchived ?? false,
          createdAt: prevProject?.createdAt ?? nowIso,
          updatedAt: nowIso,
        };

        setProjects((prev) => prev.map((p) => (p.id === input.id ? updatedProject : p)));

        if (isAuthenticated && user?.id) {
          projectService.updateProject(user.id, input.id, input).then((res) => {
            if (res.error) {
              showToast(`Error updating project: ${res.error}`, 'warning');
              if (prevProject) {
                setProjects((prev) => prev.map((p) => (p.id === input.id ? prevProject : p)));
              }
            } else if (res.data) {
              setProjects((prev) => prev.map((p) => (p.id === input.id ? res.data! : p)));
            }
          });
        }

        showToast('Project updated.', 'success');
        return;
      }

      // New project
      const tempId = `proj-${Date.now()}`;
      const nextProject: Project = {
        id: tempId,
        userId: currentUserId,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        color: input.color,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setProjects((prev) => [...prev, nextProject]);

      if (isAuthenticated && user?.id) {
        projectService.createProject(user.id, input).then((res) => {
          if (res.error) {
            showToast(`Error creating project: ${res.error}`, 'warning');
            setProjects((prev) => prev.filter((p) => p.id !== tempId));
          } else if (res.data) {
            setProjects((prev) => prev.map((p) => (p.id === tempId ? res.data! : p)));
          }
        });
      }

      showToast('Project created.', 'success');
    },
    [isAuthenticated, profile.id, projects, showToast, user?.id]
  );

  const toggleArchiveProject = useCallback(
    (projectId: string) => {
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;

      const nextArchived = !target.isArchived;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, isArchived: nextArchived, updatedAt: new Date().toISOString() }
            : p
        )
      );

      if (isAuthenticated && user?.id) {
        projectService.toggleArchiveProject(user.id, projectId, nextArchived).then((res) => {
          if (res.error) {
            showToast(`Error updating project: ${res.error}`, 'warning');
            setProjects((prev) => prev.map((p) => (p.id === projectId ? target : p)));
          }
        });
      }

      showToast('Project archive status updated.', 'info');
    },
    [isAuthenticated, projects, showToast, user?.id]
  );

  const deleteProject = useCallback(
    (projectId: string) => {
      const prevProjects = [...projects];
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      // Safely disassociate tasks from the deleted project
      setTasks((prev) =>
        prev.map((t) => (t.projectId === projectId ? { ...t, projectId: null } : t))
      );

      if (isAuthenticated && user?.id) {
        projectService.deleteProject(user.id, projectId).then((res) => {
          if (res.error) {
            showToast(`Error deleting project: ${res.error}`, 'warning');
            setProjects(prevProjects);
          }
        });
      }

      showToast('Project deleted.', 'warning');
    },
    [isAuthenticated, projects, showToast, user?.id]
  );

  const addManualTimeEntry = useCallback(
    (input: {
      taskId: string;
      date: string;
      durationSeconds: number;
      startTime?: string;
      endTime?: string;
      notes?: string;
    }) => {
      const task = tasks.find((t) => t.id === input.taskId);
      const startIso = input.startTime
        ? `${input.date}T${input.startTime}:00.000Z`
        : `${input.date}T09:00:00.000Z`;
      const endIso = input.endTime
        ? `${input.date}T${input.endTime}:00.000Z`
        : new Date(Date.parse(startIso) + input.durationSeconds * 1000).toISOString();
      const nowIso = new Date().toISOString();
      const tempId = `te-${Date.now()}`;

      const entry: TimeEntry = {
        id: tempId,
        userId: user?.id || profile.id,
        taskId: input.taskId,
        projectId: task?.projectId ?? null,
        entryType: 'manual',
        status: 'completed',
        startedAt: startIso,
        endedAt: endIso,
        durationSeconds: input.durationSeconds,
        notes: input.notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setTimeEntries((prev) => [entry, ...prev]);

      if (isAuthenticated && user?.id) {
        timerService
          .addManualTimeEntry(user.id, {
            taskId: input.taskId,
            date: input.date,
            inputMode: 'duration',
            durationMinutes: String(Math.round(input.durationSeconds / 60)),
            startTime: input.startTime || '',
            endTime: input.endTime || '',
            notes: input.notes || '',
            computedSeconds: input.durationSeconds,
            projectId: task?.projectId,
          })
          .then((res) => {
            if (res.error) {
              showToast(`Error saving manual time entry: ${res.error}`, 'warning');
              setTimeEntries((prev) => prev.filter((e) => e.id !== tempId));
            } else if (res.data) {
              setTimeEntries((prev) => [res.data!, ...prev.filter((e) => e.id !== tempId)]);
            }
          });
      }

      showToast('Manual time entry added.', 'success');
    },
    [isAuthenticated, profile.id, showToast, tasks, user?.id]
  );

  const deleteTimeEntry = useCallback(
    (entryId: string) => {
      const prevEntries = [...timeEntries];
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));

      if (isAuthenticated && user?.id) {
        timerService.deleteWorkSession(user.id, entryId).then((res) => {
          if (res.error) {
            showToast(`Could not delete session: ${res.error}`, 'warning');
            setTimeEntries(prevEntries);
          }
        });
      }

      showToast('Work session removed.', 'info');
    },
    [isAuthenticated, showToast, timeEntries, user?.id]
  );

  const updateProfilePreferences = useCallback(
    async (patch: Partial<Profile>) => {
      setProfile((prev) => ({
        ...prev,
        ...patch,
        updatedAt: new Date().toISOString(),
      }));

      if (isAuthenticated && user?.id) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const dbPatch: Database['public']['Tables']['profiles']['Update'] = {};
          if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;
          if (patch.dateFormat !== undefined) dbPatch.date_format = patch.dateFormat;
          if (patch.timeFormat !== undefined) dbPatch.time_format = patch.timeFormat;
          if (patch.defaultEventDurationMinutes !== undefined)
            dbPatch.default_event_duration_minutes = patch.defaultEventDurationMinutes;
          if (patch.defaultReminderOffsetMinutes !== undefined)
            dbPatch.default_reminder_offset_minutes = patch.defaultReminderOffsetMinutes;
          if (patch.notificationsEnabled !== undefined)
            dbPatch.notifications_enabled = patch.notificationsEnabled;

          if (Object.keys(dbPatch).length > 0) {
            await supabase.from('profiles').update(dbPatch).eq('id', user.id);
          }
        }
      }

      showToast('Preferences saved.', 'success');
    },
    [isAuthenticated, showToast, user?.id]
  );

  const refreshCalendarStatus = useCallback(async () => {
    if (!user?.id) return;
    const res = await calendarService.getIntegrationStatus(user.id);
    if (res.data) {
      setCalendarConnection({
        isConfigured: true,
        isConnected: res.data.isConnected,
        provider: 'google',
        accountEmail: res.data.accountEmail,
        selectedCalendarId: res.data.calendarId,
        selectedCalendarName: 'Primary Google Calendar',
        syncEnabled: res.data.isConnected,
        lastSyncedAt: res.data.lastSyncAt,
        status: res.data.status,
        lastError: res.data.lastError,
        pendingJobsCount: res.data.pendingJobsCount,
        failedJobsCount: res.data.failedJobsCount,
        syncedTasksCount: res.data.syncedTasksCount,
      });
    }
  }, [user?.id]);

  const retryCalendarSync = useCallback(async () => {
    if (!user?.id) return;
    setIsSyncingCalendar(true);
    try {
      const res = await calendarService.triggerSync({ retryFailed: true });
      if (res.error) {
        showToast(`Sync retry error: ${res.error}`, 'warning');
      } else {
        showToast('Calendar synchronization completed.', 'success');
      }
      await refreshCalendarStatus();
      const tasksRes = await taskService.fetchTasks(user.id);
      if (tasksRes.data) setTasks(tasksRes.data);
    } catch (err) {
      console.error('Error retrying calendar sync:', err);
      showToast('Could not complete calendar sync retry.', 'warning');
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [refreshCalendarStatus, showToast, user?.id]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      profile,
      calendarConnection,
      refreshCalendarStatus,
      retryCalendarSync,
      isSyncingCalendar,
      projects,
      tasks,
      calendarBlocks,
      refreshCalendarBlocks,
      timeEntries,
      activeTimer,
      nowMs,
      activeElapsedSeconds,
      activeTask,
      isLoadingData,
      refreshData,
      taskDrawerOpen,
      taskModalOpen: taskDrawerOpen,
      editingTask,
      taskDrawerDefaultDate,
      openCreateTaskDrawer,
      openCreateTaskModal: openCreateTaskDrawer,
      openEditTaskDrawer,
      openEditTaskModal: openEditTaskDrawer,
      closeTaskDrawer,
      closeTaskModal: closeTaskDrawer,
      manualEntryModalOpen,
      manualEntryDefaultTaskId,
      openManualEntryModal,
      closeManualEntryModal,
      deleteTaskModalOpen,
      taskPendingDelete,
      requestDeleteTask,
      closeDeleteTaskModal,
      confirmDeleteTask,
      pendingSwitch,
      cancelTimerSwitch: () => setPendingSwitch(null),
      confirmSaveAndSwitch,
      pendingCompleteWithTimer,
      cancelCompleteWithTimer: () => setPendingCompleteWithTimer(null),
      confirmStopSaveAndComplete,
      globalSearchQuery,
      setGlobalSearchQuery,
      saveTask,
      toggleTaskCompletion,
      archiveTask,
      deleteTask,
      scheduleTaskToDate,
      saveProject,
      toggleArchiveProject,
      deleteProject,
      startTaskTimer,
      pauseActiveTimer,
      resumeActiveTimer,
      stopAndSaveActiveTimer,
      toggleRecoveringPreview,
      addManualTimeEntry,
      deleteTimeEntry,
      updateProfilePreferences,
      toast,
      dismissToast: () => setToast(null),
    }),
    [
      activeElapsedSeconds,
      activeTask,
      activeTimer,
      addManualTimeEntry,
      archiveTask,
      calendarBlocks,
      calendarConnection,
      closeDeleteTaskModal,
      closeManualEntryModal,
      closeTaskDrawer,
      confirmDeleteTask,
      confirmSaveAndSwitch,
      confirmStopSaveAndComplete,
      deleteProject,
      deleteTask,
      deleteTaskModalOpen,
      deleteTimeEntry,
      editingTask,
      globalSearchQuery,
      isLoadingData,
      isSyncingCalendar,
      manualEntryDefaultTaskId,
      manualEntryModalOpen,
      nowMs,
      openCreateTaskDrawer,
      openEditTaskDrawer,
      openManualEntryModal,
      pauseActiveTimer,
      pendingCompleteWithTimer,
      pendingSwitch,
      profile,
      projects,
      refreshCalendarBlocks,
      refreshCalendarStatus,
      refreshData,
      requestDeleteTask,
      resumeActiveTimer,
      retryCalendarSync,
      saveProject,
      saveTask,
      scheduleTaskToDate,
      startTaskTimer,
      stopAndSaveActiveTimer,
      taskDrawerDefaultDate,
      taskDrawerOpen,
      taskPendingDelete,
      tasks,
      timeEntries,
      toast,
      toggleArchiveProject,
      toggleRecoveringPreview,
      toggleTaskCompletion,
      updateProfilePreferences,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}
