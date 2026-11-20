import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  PREVIEW_CALENDAR_CONNECTION,
  PREVIEW_PROFILE,
  PREVIEW_PROJECTS,
  PREVIEW_TASKS,
  PREVIEW_TIME_ENTRIES,
  createInitialPreviewActiveTimer,
} from '../data/previewData';
import {
  calculateActiveSessionSeconds,
  getLocalDateISO,
} from '../lib/timeMath';
import type {
  ActiveTimerState,
  CalendarConnection,
  Profile,
  Project,
  Task,
  TaskFormValues,
  TimeEntry,
} from '../types/models';

export interface PendingTimerSwitch {
  targetTaskId: string;
}

export interface PendingCompleteWithTimer {
  taskId: string;
}

export interface ToastNotice {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

export interface WorkspaceContextValue {
  profile: Profile;
  calendarConnection: CalendarConnection;
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimerState | null;
  nowMs: number;
  activeElapsedSeconds: number;
  activeTask: Task | null;

  // Global drawers / modals
  taskDrawerOpen: boolean;
  editingTask: Task | null;
  taskDrawerDefaultDate: string | null;
  openCreateTaskDrawer: (defaultDate?: string | null) => void;
  openEditTaskDrawer: (task: Task) => void;
  closeTaskDrawer: () => void;

  manualEntryModalOpen: boolean;
  manualEntryDefaultTaskId: string | null;
  openManualEntryModal: (taskId?: string | null) => void;
  closeManualEntryModal: () => void;

  // Confirmation dialogs for PRD timer & task integrity rules
  pendingSwitch: PendingTimerSwitch | null;
  cancelTimerSwitch: () => void;
  confirmSaveAndSwitch: () => void;

  pendingCompleteWithTimer: PendingCompleteWithTimer | null;
  cancelCompleteWithTimer: () => void;
  confirmStopSaveAndComplete: () => void;

  // Search query synced with top bar
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;

  // CRUD & Timer Actions (Milestone 0 local preview state; Supabase persistence arrives in M2-M3)
  saveTask: (values: TaskFormValues, existingTaskId?: string) => Task;
  toggleTaskCompletion: (taskId: string) => void;
  archiveTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  scheduleTaskToDate: (taskId: string, dateIso: string | null) => void;

  saveProject: (input: { id?: string; name: string; description?: string; color: string }) => void;
  toggleArchiveProject: (projectId: string) => void;

  startTaskTimer: (taskId: string) => void;
  pauseActiveTimer: () => void;
  resumeActiveTimer: () => void;
  stopAndSaveActiveTimer: () => void;
  toggleRecoveringPreview: () => void;

  addManualTimeEntry: (input: {
    taskId: string;
    date: string;
    durationSeconds: number;
    startTime?: string;
    endTime?: string;
    notes?: string;
  }) => void;
  deleteTimeEntry: (entryId: string) => void;

  updateProfilePreferences: (patch: Partial<Profile>) => void;

  toast: ToastNotice | null;
  dismissToast: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(PREVIEW_PROFILE);
  const [calendarConnection] = useState<CalendarConnection>(PREVIEW_CALENDAR_CONNECTION);
  const [projects, setProjects] = useState<Project[]>(PREVIEW_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(PREVIEW_TASKS);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(PREVIEW_TIME_ENTRIES);
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(() =>
    createInitialPreviewActiveTimer()
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Global modals & drawers
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDrawerDefaultDate, setTaskDrawerDefaultDate] = useState<string | null>(null);

  const [manualEntryModalOpen, setManualEntryModalOpen] = useState(false);
  const [manualEntryDefaultTaskId, setManualEntryDefaultTaskId] = useState<string | null>(null);

  const [pendingSwitch, setPendingSwitch] = useState<PendingTimerSwitch | null>(null);
  const [pendingCompleteWithTimer, setPendingCompleteWithTimer] =
    useState<PendingCompleteWithTimer | null>(null);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastNotice | null>(null);

  const showToast = useCallback((message: string, tone: ToastNotice['tone'] = 'info') => {
    setToast({ id: String(Date.now()), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(handle);
  }, [toast]);

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

  const openManualEntryModal = useCallback((taskId: string | null = null) => {
    setManualEntryDefaultTaskId(taskId);
    setManualEntryModalOpen(true);
  }, []);

  const closeManualEntryModal = useCallback(() => {
    setManualEntryModalOpen(false);
    setManualEntryDefaultTaskId(null);
  }, []);

  // Internal helper: commits the active timer session as a completed time entry
  const commitActiveTimerSession = useCallback(
    (timer: ActiveTimerState) => {
      const elapsed = calculateActiveSessionSeconds(timer, Date.now());
      const task = tasks.find((t) => t.id === timer.taskId);
      const nowIso = new Date().toISOString();

      if (elapsed > 0) {
        const savedEntry: TimeEntry = {
          id: `te-${Date.now()}`,
          userId: profile.id,
          taskId: timer.taskId,
          projectId: task?.projectId ?? null,
          entryType: 'timer',
          status: 'completed',
          startedAt: timer.sessionStartedAtIso,
          endedAt: nowIso,
          durationSeconds: elapsed,
          notes: 'Tracked via count-up timer (M0 preview session)',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setTimeEntries((prev) => [savedEntry, ...prev]);
      }
      setActiveTimer(null);
    },
    [profile.id, tasks]
  );

  const startTaskTimer = useCallback(
    (taskId: string) => {
      if (activeTimer && activeTimer.taskId === taskId) {
        if (activeTimer.status === 'paused' || activeTimer.status === 'recovering') {
          setNowMs(Date.now());
          setActiveTimer({
            ...activeTimer,
            status: 'running',
            startedAtMs: Date.now(),
          });
          showToast('Timer resumed.', 'info');
        }
        return;
      }

      if (activeTimer && activeTimer.taskId !== taskId) {
        setPendingSwitch({ targetTaskId: taskId });
        return;
      }

      const now = Date.now();
      setNowMs(now);
      setActiveTimer({
        taskId,
        status: 'running',
        startedAtMs: now,
        accumulatedBeforeSegmentSeconds: 0,
        sessionStartedAtIso: new Date(now).toISOString(),
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === 'todo'
            ? { ...t, status: 'in_progress', updatedAt: new Date(now).toISOString() }
            : t
        )
      );
      showToast('Timer started.', 'info');
    },
    [activeTimer, showToast]
  );

  const confirmSaveAndSwitch = useCallback(() => {
    if (!pendingSwitch) return;
    const { targetTaskId } = pendingSwitch;

    if (activeTimer) {
      commitActiveTimerSession(activeTimer);
    }

    const now = Date.now();
    setNowMs(now);
    setActiveTimer({
      taskId: targetTaskId,
      status: 'running',
      startedAtMs: now,
      accumulatedBeforeSegmentSeconds: 0,
      sessionStartedAtIso: new Date(now).toISOString(),
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === targetTaskId && t.status === 'todo'
          ? { ...t, status: 'in_progress', updatedAt: new Date(now).toISOString() }
          : t
      )
    );
    setPendingSwitch(null);
    showToast('Previous session saved and switched to the selected task.', 'success');
  }, [activeTimer, commitActiveTimerSession, pendingSwitch, showToast]);

  const pauseActiveTimer = useCallback(() => {
    if (!activeTimer || activeTimer.status !== 'running') return;
    const elapsed = calculateActiveSessionSeconds(activeTimer, Date.now());
    setActiveTimer({
      ...activeTimer,
      status: 'paused',
      accumulatedBeforeSegmentSeconds: elapsed,
    });
    showToast('Timer paused.', 'info');
  }, [activeTimer, showToast]);

  const resumeActiveTimer = useCallback(() => {
    if (!activeTimer || activeTimer.status === 'running') return;
    const now = Date.now();
    setNowMs(now);
    setActiveTimer({
      ...activeTimer,
      status: 'running',
      startedAtMs: now,
    });
    showToast('Timer resumed.', 'info');
  }, [activeTimer, showToast]);

  const stopAndSaveActiveTimer = useCallback(() => {
    if (!activeTimer) return;
    commitActiveTimerSession(activeTimer);
    showToast('Work session saved to history.', 'success');
  }, [activeTimer, commitActiveTimerSession, showToast]);

  const toggleRecoveringPreview = useCallback(() => {
    if (!activeTimer) return;
    if (activeTimer.status === 'recovering') {
      const now = Date.now();
      setNowMs(now);
      setActiveTimer({ ...activeTimer, status: 'running', startedAtMs: now });
      return;
    }
    const elapsed = calculateActiveSessionSeconds(activeTimer, Date.now());
    setActiveTimer({
      ...activeTimer,
      status: 'recovering',
      accumulatedBeforeSegmentSeconds: elapsed,
    });
  }, [activeTimer]);

  const saveTask = useCallback(
    (values: TaskFormValues, existingTaskId?: string): Task => {
      const nowIso = new Date().toISOString();
      const plannedMinutes = values.plannedDurationMinutes.trim()
        ? parseInt(values.plannedDurationMinutes, 10)
        : null;
      const reminderOffset = values.reminderOffsetMinutes.trim()
        ? parseInt(values.reminderOffsetMinutes, 10)
        : null;
      const scheduledDate = values.scheduledDate.trim() || null;
      const scheduledStartTime = scheduledDate && values.scheduledStartTime.trim()
        ? values.scheduledStartTime.trim()
        : null;

      if (existingTaskId) {
        let updatedTask: Task | null = null;
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== existingTaskId) return t;
            updatedTask = {
              ...t,
              title: values.title.trim(),
              description: values.description.trim() || undefined,
              projectId: values.projectId || null,
              priority: values.priority,
              scheduledDate,
              scheduledStartTime,
              plannedDurationMinutes: plannedMinutes,
              reminderOffsetMinutes: reminderOffset,
              syncToGoogleCalendar: false, // Calendar integration arrives in Milestone 6
              updatedAt: nowIso,
            };
            return updatedTask;
          })
        );
        showToast('Task updated (M0 local preview).', 'success');
        return updatedTask!;
      }

      const newTask: Task = {
        id: `task-${Date.now()}`,
        userId: profile.id,
        projectId: values.projectId || null,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        priority: values.priority,
        status: 'todo',
        scheduledDate,
        scheduledStartTime,
        plannedDurationMinutes: plannedMinutes,
        reminderOffsetMinutes: reminderOffset,
        syncToGoogleCalendar: false,
        calendarSyncStatus: 'not_synced',
        completedAt: null,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setTasks((prev) => [newTask, ...prev]);
      showToast(
        scheduledDate ? 'Task created and scheduled.' : 'Task saved to Inbox (unscheduled).',
        'success'
      );
      return newTask;
    },
    [profile.id, showToast]
  );

  const toggleTaskCompletion = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      // PRD Rule: Completing a task while its timer is running/paused requires explicit confirmation
      if (target.status !== 'completed' && activeTimer && activeTimer.taskId === taskId) {
        setPendingCompleteWithTimer({ taskId });
        return;
      }

      const nowIso = new Date().toISOString();
      const nextStatus = target.status === 'completed' ? 'todo' : 'completed';
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
      showToast(
        nextStatus === 'completed' ? 'Task marked as completed.' : 'Task reopened.',
        'info'
      );
    },
    [activeTimer, showToast, tasks]
  );

  const confirmStopSaveAndComplete = useCallback(() => {
    if (!pendingCompleteWithTimer) return;
    const { taskId } = pendingCompleteWithTimer;

    if (activeTimer && activeTimer.taskId === taskId) {
      commitActiveTimerSession(activeTimer);
    }

    const nowIso = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed', completedAt: nowIso, updatedAt: nowIso }
          : t
      )
    );
    setPendingCompleteWithTimer(null);
    showToast('Active session saved and task marked completed.', 'success');
  }, [activeTimer, commitActiveTimerSession, pendingCompleteWithTimer, showToast]);

  const archiveTask = useCallback(
    (taskId: string) => {
      if (activeTimer?.taskId === taskId) {
        commitActiveTimerSession(activeTimer);
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, isArchived: true, updatedAt: new Date().toISOString() } : t
        )
      );
      showToast('Task archived. Historical time logs remain preserved.', 'info');
    },
    [activeTimer, commitActiveTimerSession, showToast]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      if (activeTimer?.taskId === taskId) {
        setActiveTimer(null);
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setTimeEntries((prev) => prev.filter((e) => e.taskId !== taskId));
      showToast('Task permanently deleted.', 'warning');
    },
    [activeTimer, showToast]
  );

  const scheduleTaskToDate = useCallback(
    (taskId: string, dateIso: string | null) => {
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
      showToast(dateIso ? `Task scheduled for ${dateIso}.` : 'Task moved to Inbox.', 'success');
    },
    [showToast]
  );

  const saveProject = useCallback(
    (input: { id?: string; name: string; description?: string; color: string }) => {
      const nowIso = new Date().toISOString();
      if (input.id) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === input.id
              ? {
                  ...p,
                  name: input.name.trim(),
                  description: input.description?.trim() || undefined,
                  color: input.color,
                  updatedAt: nowIso,
                }
              : p
          )
        );
        showToast('Project updated.', 'success');
        return;
      }

      const nextProject: Project = {
        id: `proj-${Date.now()}`,
        userId: profile.id,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        color: input.color,
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setProjects((prev) => [...prev, nextProject]);
      showToast('Project created.', 'success');
    },
    [profile.id, showToast]
  );

  const toggleArchiveProject = useCallback(
    (projectId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, isArchived: !p.isArchived, updatedAt: new Date().toISOString() }
            : p
        )
      );
      showToast('Project archive status updated.', 'info');
    },
    [showToast]
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

      const entry: TimeEntry = {
        id: `te-${Date.now()}`,
        userId: profile.id,
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
      showToast('Manual time entry added.', 'success');
    },
    [profile.id, showToast, tasks]
  );

  const deleteTimeEntry = useCallback(
    (entryId: string) => {
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
      showToast('Work session removed.', 'info');
    },
    [showToast]
  );

  const updateProfilePreferences = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => ({
        ...prev,
        ...patch,
        updatedAt: new Date().toISOString(),
      }));
      showToast('Preferences updated (M0 local preview).', 'success');
    },
    [showToast]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      profile,
      calendarConnection,
      projects,
      tasks,
      timeEntries,
      activeTimer,
      nowMs,
      activeElapsedSeconds,
      activeTask,
      taskDrawerOpen,
      editingTask,
      taskDrawerDefaultDate,
      openCreateTaskDrawer,
      openEditTaskDrawer,
      closeTaskDrawer,
      manualEntryModalOpen,
      manualEntryDefaultTaskId,
      openManualEntryModal,
      closeManualEntryModal,
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
      calendarConnection,
      closeManualEntryModal,
      closeTaskDrawer,
      confirmSaveAndSwitch,
      confirmStopSaveAndComplete,
      deleteTask,
      deleteTimeEntry,
      editingTask,
      globalSearchQuery,
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
      resumeActiveTimer,
      saveProject,
      saveTask,
      scheduleTaskToDate,
      startTaskTimer,
      stopAndSaveActiveTimer,
      taskDrawerDefaultDate,
      taskDrawerOpen,
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
