import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getLocalDateISO, validateTaskInput, type ValidationErrors } from '../../lib/timeMath';
import {
  calculateWorkingDays,
  calculateSchedulePlan,
  getOccupiedIntervalsForDate,
} from '../../services/schedulingEngine';
import type { TaskFormValues, TaskPriority, TaskStatus } from '../../types/models';
import { Button } from '../ui/Button';
import { FieldWrapper, Input, Select, Textarea } from '../ui/Field';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Folder,
  Layers,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

const STANDARD_OFFSETS = ['0', '5', '10', '15', '30', '60'];

export interface TaskFormExtendedValues extends TaskFormValues {
  status?: TaskStatus;
  clientVisible?: boolean;
  remainingEstimateMinutes?: string;
  scheduledEndDate?: string;
  isMultiDay?: boolean;
  dailyPlannedHours?: string;
  includeWeekends?: boolean;
}

function buildInitialValues(
  editingTask: ReturnType<typeof useWorkspace>['editingTask'],
  defaultDate: string | null,
  defaultReminderOffset: number = 15,
  defaultCalendarSyncEnabled: boolean = true
): { formValues: TaskFormExtendedValues; isCustom: boolean; customOffset: string } {
  if (editingTask) {
    const rawOffset =
      editingTask.reminderOffsetMinutes !== null && editingTask.reminderOffsetMinutes !== undefined
        ? String(editingTask.reminderOffsetMinutes)
        : '';
    const isCustom = Boolean(rawOffset && !STANDARD_OFFSETS.includes(rawOffset));
    const isMultiDay = Boolean(
      editingTask.scheduledEndDate &&
      editingTask.scheduledDate &&
      editingTask.scheduledEndDate > editingTask.scheduledDate
    );
    const dailyHours = editingTask.dailyPlannedMinutes
      ? String(editingTask.dailyPlannedMinutes / 60)
      : (editingTask.plannedDurationMinutes ? String(editingTask.plannedDurationMinutes / 60) : '4');

    return {
      formValues: {
        title: editingTask.title,
        description: editingTask.description ?? '',
        projectId: editingTask.projectId,
        priority: editingTask.priority,
        status: editingTask.status,
        scheduledDate: editingTask.scheduledDate ?? '',
        scheduledEndDate: editingTask.scheduledEndDate ?? '',
        isMultiDay,
        dailyPlannedHours: dailyHours,
        includeWeekends: editingTask.includeWeekends ?? false,
        scheduledStartTime: editingTask.scheduledStartTime ?? '',
        plannedDurationMinutes: editingTask.plannedDurationMinutes
          ? String(editingTask.plannedDurationMinutes)
          : '',
        remainingEstimateMinutes: (editingTask as any).remainingEstimateMinutes
          ? String((editingTask as any).remainingEstimateMinutes)
          : '',
        reminderOffsetMinutes: rawOffset,
        reminderCustomTime: '09:00',
        syncToGoogleCalendar: editingTask.syncToGoogleCalendar ?? Boolean(editingTask.scheduledDate),
        clientVisible: (editingTask as any).clientVisible ?? false,
      },
      isCustom,
      customOffset: isCustom ? rawOffset : '',
    };
  }

  const initialOffset = defaultDate ? String(defaultReminderOffset) : '';
  const isCustom = Boolean(initialOffset && !STANDARD_OFFSETS.includes(initialOffset));

  return {
    formValues: {
      title: '',
      description: '',
      projectId: null,
      priority: 'medium',
      status: 'todo',
      scheduledDate: defaultDate ?? '',
      scheduledEndDate: '',
      isMultiDay: false,
      dailyPlannedHours: '4',
      includeWeekends: false,
      scheduledStartTime: '',
      plannedDurationMinutes: '',
      remainingEstimateMinutes: '',
      reminderOffsetMinutes: initialOffset,
      reminderCustomTime: '09:00',
      syncToGoogleCalendar: Boolean(defaultDate) && defaultCalendarSyncEnabled,
      clientVisible: false,
    },
    isCustom,
    customOffset: isCustom ? initialOffset : '',
  };
}

export function TaskFormModal() {
  const {
    taskDrawerOpen,
    editingTask,
    taskDrawerDefaultDate,
    closeTaskDrawer,
    projects,
    profile,
    saveTask,
    requestDeleteTask,
    tasks,
    calendarBlocks,
  } = useWorkspace();

  const defaultCalendarSync = profile?.defaultCalendarSyncEnabled ?? true;

  const [initialData, setInitialData] = useState(() =>
    buildInitialValues(
      editingTask,
      taskDrawerDefaultDate,
      profile?.defaultReminderOffsetMinutes ?? 15,
      defaultCalendarSync
    )
  );
  const [values, setValues] = useState<TaskFormExtendedValues>(initialData.formValues);
  const [isCustomOffset, setIsCustomOffset] = useState<boolean>(initialData.isCustom);
  const [customOffsetMinutes, setCustomOffsetMinutes] = useState<string>(initialData.customOffset);
  const [errors, setErrors] = useState<
    ValidationErrors & {
      reminderCustomTime?: string;
      customOffset?: string;
      scheduledEndDate?: string;
      dailyPlannedHours?: string;
    }
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Sync state whenever modal opens or editingTask changes
  useEffect(() => {
    if (taskDrawerOpen) {
      const data = buildInitialValues(
        editingTask,
        taskDrawerDefaultDate,
        profile?.defaultReminderOffsetMinutes ?? 15,
        defaultCalendarSync
      );
      setInitialData(data);
      setValues(data.formValues);
      setIsCustomOffset(data.isCustom);
      setCustomOffsetMinutes(data.customOffset);
      setErrors({});
      setIsSubmitting(false);
      setShowDiscardConfirm(false);
    }
  }, [
    taskDrawerOpen,
    editingTask,
    taskDrawerDefaultDate,
    profile?.defaultReminderOffsetMinutes,
    defaultCalendarSync,
  ]);

  // Check if form is dirty (has unsaved modifications)
  const isDirty = useMemo(() => {
    return (
      values.title !== initialData.formValues.title ||
      values.description !== initialData.formValues.description ||
      values.projectId !== initialData.formValues.projectId ||
      values.priority !== initialData.formValues.priority ||
      values.status !== initialData.formValues.status ||
      values.scheduledDate !== initialData.formValues.scheduledDate ||
      values.scheduledEndDate !== initialData.formValues.scheduledEndDate ||
      values.isMultiDay !== initialData.formValues.isMultiDay ||
      values.dailyPlannedHours !== initialData.formValues.dailyPlannedHours ||
      values.includeWeekends !== initialData.formValues.includeWeekends ||
      values.scheduledStartTime !== initialData.formValues.scheduledStartTime ||
      values.plannedDurationMinutes !== initialData.formValues.plannedDurationMinutes ||
      values.remainingEstimateMinutes !== initialData.formValues.remainingEstimateMinutes ||
      values.clientVisible !== initialData.formValues.clientVisible ||
      values.syncToGoogleCalendar !== initialData.formValues.syncToGoogleCalendar ||
      values.reminderOffsetMinutes !== initialData.formValues.reminderOffsetMinutes
    );
  }, [values, initialData]);

  // Multi-day calculation preview
  const workingDays = useMemo(() => {
    if (
      !values.isMultiDay ||
      !values.scheduledDate ||
      !values.scheduledEndDate ||
      values.scheduledEndDate < values.scheduledDate
    ) {
      return [];
    }
    return calculateWorkingDays(
      values.scheduledDate,
      values.scheduledEndDate,
      values.includeWeekends ?? false
    );
  }, [values.isMultiDay, values.scheduledDate, values.scheduledEndDate, values.includeWeekends]);

  const dailyHoursNum = parseFloat(values.dailyPlannedHours || '4') || 0;
  const totalCalculatedHours = workingDays.length * dailyHoursNum;
  const totalCalculatedMinutes = Math.round(totalCalculatedHours * 60);

  const schedulePlanPreview = useMemo(() => {
    if (
      !values.isMultiDay ||
      !values.scheduledDate ||
      !values.scheduledEndDate ||
      workingDays.length === 0 ||
      dailyHoursNum <= 0
    ) {
      return null;
    }
    return calculateSchedulePlan({
      startDate: values.scheduledDate,
      endDate: values.scheduledEndDate,
      dailyPlannedHours: dailyHoursNum,
      preferredStartTime: values.scheduledStartTime || '09:00',
      includeWeekends: values.includeWeekends ?? false,
      existingTasks: tasks,
      existingBlocks: calendarBlocks,
      excludeTaskId: editingTask?.id,
    });
  }, [
    values.isMultiDay,
    values.scheduledDate,
    values.scheduledEndDate,
    workingDays,
    dailyHoursNum,
    values.scheduledStartTime,
    values.includeWeekends,
    tasks,
    calendarBlocks,
    editingTask?.id,
  ]);

  // Escape key handling
  useEffect(() => {
    if (!taskDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (isDirty) {
          setShowDiscardConfirm(true);
        } else {
          closeTaskDrawer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [taskDrawerOpen, isDirty, showDiscardConfirm, closeTaskDrawer]);

  if (!taskDrawerOpen) return null;

  const activeProjects = projects.filter((p) => !p.isArchived);
  const selectedProject = projects.find((p) => p.id === values.projectId);

  const handleSafeClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      closeTaskDrawer();
    }
  };

  const handleReminderSelectChange = (val: string) => {
    if (val === 'custom') {
      setIsCustomOffset(true);
      setValues((v) => ({ ...v, reminderOffsetMinutes: customOffsetMinutes || '45' }));
    } else {
      setIsCustomOffset(false);
      setValues((v) => ({ ...v, reminderOffsetMinutes: val }));
    }
    if (errors.reminderCustomTime) {
      setErrors((prev) => ({ ...prev, reminderCustomTime: '' }));
    }
  };

  const handleCustomOffsetChange = (val: string) => {
    setCustomOffsetMinutes(val);
    setValues((v) => ({ ...v, reminderOffsetMinutes: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const extendedErrors: ValidationErrors & {
      reminderCustomTime?: string;
      customOffset?: string;
      scheduledEndDate?: string;
      dailyPlannedHours?: string;
    } = {};

    if (!values.title.trim()) {
      extendedErrors.title = 'Title is required';
    }

    if (values.isMultiDay) {
      if (!values.scheduledDate) {
        extendedErrors.scheduledDate = 'Start date is required for multi-day tasks';
      }
      if (!values.scheduledEndDate) {
        extendedErrors.scheduledEndDate = 'End date is required for multi-day tasks';
      } else if (values.scheduledDate && values.scheduledEndDate < values.scheduledDate) {
        extendedErrors.scheduledEndDate = 'End date cannot be earlier than start date';
      }
      if (!values.dailyPlannedHours || parseFloat(values.dailyPlannedHours) <= 0) {
        extendedErrors.dailyPlannedHours = 'Daily planned hours must be greater than 0';
      }
    } else {
      const validationErrors = validateTaskInput({
        title: values.title,
        scheduledDate: values.scheduledDate,
        scheduledStartTime: values.scheduledStartTime,
        plannedDurationMinutes: values.plannedDurationMinutes,
      });
      Object.assign(extendedErrors, validationErrors);
    }

    // Date-only reminder rule: requires explicit reminder time, never midnight
    if (
      values.scheduledDate &&
      !values.scheduledStartTime &&
      values.reminderOffsetMinutes &&
      (!values.reminderCustomTime || !values.reminderCustomTime.trim())
    ) {
      extendedErrors.reminderCustomTime =
        'Date-only tasks require an explicit reminder time (never defaults to midnight).';
    }

    if (isCustomOffset && values.reminderOffsetMinutes) {
      const parsed = parseInt(values.reminderOffsetMinutes, 10);
      if (isNaN(parsed) || parsed < 0) {
        extendedErrors.customOffset = 'Please enter a valid positive offset in minutes.';
      }
    }

    if (Object.keys(extendedErrors).length > 0) {
      setErrors(extendedErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      let finalPlannedMinutes = values.plannedDurationMinutes;
      if (values.isMultiDay && workingDays.length > 0) {
        finalPlannedMinutes = String(totalCalculatedMinutes);
      }

      const finalValues: TaskFormValues = {
        ...values,
        plannedDurationMinutes: finalPlannedMinutes,
        reminderOffsetMinutes: values.scheduledDate ? values.reminderOffsetMinutes : '',
      };

      const result = await saveTask(finalValues, editingTask?.id);
      if (result) {
        closeTaskDrawer();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorities: { value: TaskPriority; label: string; activeClass: string }[] = [
    { value: 'high', label: 'High', activeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
    { value: 'medium', label: 'Medium', activeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'low', label: 'Low', activeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  ];

  const statuses: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  const isInboxTask = !values.scheduledDate;
  const isDateOnlyTask = Boolean(values.scheduledDate && !values.scheduledStartTime);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1F2C]/45 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      onClick={handleSafeClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-[24px] border border-white/80 bg-white/95 shadow-[0_24px_60px_rgba(25,45,100,0.18)] backdrop-blur-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-sm:h-full max-sm:max-h-none max-sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E9ECF5] bg-white/80 px-6 py-4.5 backdrop-blur-md shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2F65F6]/10 text-[#2F65F6]">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 id="task-modal-title" className="text-lg font-bold text-[#1A1F2C]">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#7E8B9B]">
              {editingTask
                ? 'Update task details, schedule, client visibility, or duration estimate.'
                : 'Plan your focused work. Leave date empty to save directly to Inbox.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F0F2F5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="task-modal-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Section 1: Basic Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
                <Layers className="h-3.5 w-3.5 text-[#2F65F6]" />
                <span>Basic Details</span>
              </div>

              {/* Title */}
              <FieldWrapper id="task-modal-title-input" label="Task Title" required error={errors.title}>
                <Input
                  id="task-modal-title-input"
                  name="title"
                  value={values.title}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, title: e.target.value }));
                    if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                  }}
                  placeholder="e.g., Deliver wireframes for client onboarding flow"
                  hasError={Boolean(errors.title)}
                  className="h-11 rounded-xl text-sm sm:text-base font-medium shadow-xs"
                  autoFocus
                />
              </FieldWrapper>

              {/* Notes / Description */}
              <FieldWrapper id="task-modal-description" label="Notes / Description">
                <Textarea
                  id="task-modal-description"
                  name="description"
                  value={values.description}
                  onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                  placeholder="Add deliverables, meeting context, links, or client requirements..."
                  className="rounded-xl min-h-[80px] text-sm"
                />
              </FieldWrapper>

              {/* Project & Priority / Status */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldWrapper id="task-modal-project" label="Project / Workspace">
                  <Select
                    id="task-modal-project"
                    value={values.projectId ?? ''}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        projectId: e.target.value || null,
                        // If project removed, reset clientVisible to false
                        clientVisible: e.target.value ? v.clientVisible : false,
                      }))
                    }
                    className="h-10 rounded-xl"
                  >
                    <option value="">No Project (Personal Workspace)</option>
                    {activeProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                {/* Priority Selector */}
                <div className="space-y-1.5">
                  <span className="block text-sm font-semibold text-[#1A1F2C]">Priority</span>
                  <div
                    className="grid grid-cols-3 gap-1 rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-1"
                    role="radiogroup"
                    aria-label="Priority"
                  >
                    {priorities.map((p) => {
                      const selected = values.priority === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setValues((v) => ({ ...v, priority: p.value }))}
                          className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                            selected
                              ? `${p.activeClass} shadow-xs font-bold`
                              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Status (shown for existing tasks) */}
              {editingTask && (
                <div className="space-y-1.5 pt-1">
                  <span className="block text-sm font-semibold text-[#1A1F2C]">Task Status</span>
                  <div className="grid grid-cols-3 gap-2">
                    {statuses.map((s) => {
                      const isSelected = (values.status ?? 'todo') === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setValues((v) => ({ ...v, status: s.value }))}
                          className={`flex items-center justify-center rounded-xl border py-2 text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#2F65F6] bg-[#EDF2FE] text-[#2F65F6] shadow-xs'
                              : 'border-[#E9ECF5] bg-white text-[#7E8B9B] hover:border-gray-300 hover:text-[#1A1F2C]'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Schedule & Duration */}
            <div className="space-y-4 pt-2 border-t border-[#F0F3F9]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
                  <Calendar className="h-3.5 w-3.5 text-[#2F65F6]" />
                  <span>Schedule & Duration</span>
                </div>

                {/* Scheduling Mode Switcher */}
                <div className="flex rounded-xl bg-[#F0F3F9] p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        isMultiDay: false,
                        scheduledEndDate: '',
                      }))
                    }
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      !values.isMultiDay
                        ? 'bg-white text-[#1A1F2C] shadow-xs font-bold'
                        : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                    }`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        isMultiDay: true,
                        scheduledDate: v.scheduledDate || getLocalDateISO(),
                        scheduledEndDate: v.scheduledEndDate || v.scheduledDate || getLocalDateISO(),
                        dailyPlannedHours: v.dailyPlannedHours || '4',
                        scheduledStartTime: v.scheduledStartTime || '09:00',
                      }))
                    }
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      values.isMultiDay
                        ? 'bg-[#2F65F6] text-white shadow-xs font-bold'
                        : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                    }`}
                  >
                    <CalendarRange className="h-3.5 w-3.5" />
                    <span>Multi-Day</span>
                  </button>
                </div>
              </div>

              {!values.isMultiDay ? (
                /* Single Day Scheduling */
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Scheduled Date */}
                    <FieldWrapper
                      id="task-modal-date"
                      label="Scheduled Date"
                      helperText="Leave empty to save to Inbox."
                    >
                      <Input
                        id="task-modal-date"
                        type="date"
                        value={values.scheduledDate}
                        onChange={(e) => {
                          const nextDate = e.target.value;
                          setValues((v) => ({
                            ...v,
                            scheduledDate: nextDate,
                            scheduledStartTime: nextDate ? v.scheduledStartTime : '',
                            reminderOffsetMinutes: nextDate ? v.reminderOffsetMinutes : '',
                          }));
                          if (nextDate && errors.scheduledStartTime) {
                            setErrors((prev) => ({ ...prev, scheduledStartTime: '' }));
                          }
                        }}
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>

                    {/* Start Time */}
                    <FieldWrapper
                      id="task-modal-start-time"
                      label="Start Time (Optional)"
                      error={errors.scheduledStartTime}
                      helperText={
                        values.scheduledDate
                          ? 'Optional specific start time'
                          : 'Requires a scheduled date'
                      }
                    >
                      <Input
                        id="task-modal-start-time"
                        type="time"
                        disabled={!values.scheduledDate}
                        value={values.scheduledStartTime}
                        onChange={(e) => {
                          setValues((v) => ({
                            ...v,
                            scheduledStartTime: e.target.value,
                          }));
                          if (errors.scheduledStartTime) {
                            setErrors((prev) => ({ ...prev, scheduledStartTime: '' }));
                          }
                        }}
                        hasError={Boolean(errors.scheduledStartTime)}
                        className="h-10 rounded-xl disabled:opacity-40"
                      />
                    </FieldWrapper>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Planned Duration */}
                    <FieldWrapper
                      id="task-modal-planned-duration"
                      label="Planned Duration (minutes)"
                      error={errors.plannedDurationMinutes}
                      helperText="Estimated focus effort, e.g. 45, 60, 90 min"
                    >
                      <Input
                        id="task-modal-planned-duration"
                        type="number"
                        min={1}
                        max={1440}
                        step={5}
                        placeholder="e.g., 60"
                        value={values.plannedDurationMinutes}
                        onChange={(e) => {
                          setValues((v) => ({
                            ...v,
                            plannedDurationMinutes: e.target.value,
                          }));
                          if (errors.plannedDurationMinutes) {
                            setErrors((prev) => ({
                              ...prev,
                              plannedDurationMinutes: '',
                            }));
                          }
                        }}
                        hasError={Boolean(errors.plannedDurationMinutes)}
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>

                    {/* Remaining Estimate (for projects or edit mode) */}
                    <FieldWrapper
                      id="task-modal-remaining-estimate"
                      label="Remaining Estimate (minutes)"
                      helperText="Manual estimate for client progress tracking"
                    >
                      <Input
                        id="task-modal-remaining-estimate"
                        type="number"
                        min={0}
                        max={1440}
                        step={5}
                        placeholder={values.plannedDurationMinutes || 'Optional remaining min'}
                        value={values.remainingEstimateMinutes ?? ''}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            remainingEstimateMinutes: e.target.value,
                          }))
                        }
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>
                  </div>
                </>
              ) : (
                /* Multi-Day Scheduling */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Start Date */}
                    <FieldWrapper
                      id="task-modal-start-date"
                      label="Start Date"
                      required
                      error={errors.scheduledDate}
                    >
                      <Input
                        id="task-modal-start-date"
                        type="date"
                        value={values.scheduledDate}
                        onChange={(e) => {
                          const nextDate = e.target.value;
                          setValues((v) => ({
                            ...v,
                            scheduledDate: nextDate,
                            scheduledEndDate:
                              v.scheduledEndDate && v.scheduledEndDate < nextDate
                                ? nextDate
                                : v.scheduledEndDate || nextDate,
                          }));
                          if (errors.scheduledDate) {
                            setErrors((prev) => ({ ...prev, scheduledDate: '' }));
                          }
                        }}
                        hasError={Boolean(errors.scheduledDate)}
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>

                    {/* End Date */}
                    <FieldWrapper
                      id="task-modal-end-date"
                      label="End Date"
                      required
                      error={errors.scheduledEndDate}
                    >
                      <Input
                        id="task-modal-end-date"
                        type="date"
                        min={values.scheduledDate}
                        value={values.scheduledEndDate || ''}
                        onChange={(e) => {
                          setValues((v) => ({
                            ...v,
                            scheduledEndDate: e.target.value,
                          }));
                          if (errors.scheduledEndDate) {
                            setErrors((prev) => ({ ...prev, scheduledEndDate: '' }));
                          }
                        }}
                        hasError={Boolean(errors.scheduledEndDate)}
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Daily Planned Effort (hours) */}
                    <FieldWrapper
                      id="task-modal-daily-hours"
                      label="Daily Planned Effort (hours)"
                      required
                      error={errors.dailyPlannedHours}
                      helperText="Target hours allocated per working day"
                    >
                      <Input
                        id="task-modal-daily-hours"
                        type="number"
                        min={0.5}
                        max={16}
                        step={0.5}
                        placeholder="e.g., 4"
                        value={values.dailyPlannedHours || '4'}
                        onChange={(e) => {
                          setValues((v) => ({
                            ...v,
                            dailyPlannedHours: e.target.value,
                          }));
                          if (errors.dailyPlannedHours) {
                            setErrors((prev) => ({ ...prev, dailyPlannedHours: '' }));
                          }
                        }}
                        hasError={Boolean(errors.dailyPlannedHours)}
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>

                    {/* Preferred Daily Start Time */}
                    <FieldWrapper
                      id="task-modal-preferred-start-time"
                      label="Preferred Start Time"
                      helperText="Default time for daily calendar blocks"
                    >
                      <Input
                        id="task-modal-preferred-start-time"
                        type="time"
                        value={values.scheduledStartTime || '09:00'}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            scheduledStartTime: e.target.value,
                          }))
                        }
                        className="h-10 rounded-xl"
                      />
                    </FieldWrapper>
                  </div>

                  {/* Skip Weekends Option */}
                  <div className="flex items-center justify-between rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3.5">
                    <div className="space-y-0.5">
                      <label
                        htmlFor="task-modal-skip-weekends"
                        className="text-xs font-semibold text-[#1A1C20] cursor-pointer block"
                      >
                        Skip Weekends (Saturday & Sunday)
                      </label>
                      <p className="text-[11px] text-[#7E8B9B]">
                        When enabled, only Monday through Friday are scheduled as working days.
                      </p>
                    </div>
                    <input
                      id="task-modal-skip-weekends"
                      type="checkbox"
                      checked={!values.includeWeekends}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, includeWeekends: !e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-[#2F65F6] focus:ring-[#2F65F6] cursor-pointer"
                    />
                  </div>

                  {/* Live Calculation & Feasibility Banner */}
                  {values.scheduledDate &&
                    values.scheduledEndDate &&
                    values.scheduledEndDate >= values.scheduledDate && (
                      <div className="rounded-xl border border-[#DDE7FD] bg-[#EDF2FE]/60 p-4 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <span className="font-bold text-[#1A1F2C] flex items-center gap-1.5">
                            <CalendarRange className="h-4 w-4 text-[#2F65F6]" />
                            <span>Calculated Workload Allocation</span>
                          </span>
                          <span className="font-bold text-[#2F65F6] text-sm tabular-nums-strict">
                            {totalCalculatedHours} hrs total ({totalCalculatedMinutes} min)
                          </span>
                        </div>
                        <p className="mt-1 text-[#4A5568]">
                          {workingDays.length} working day{workingDays.length === 1 ? '' : 's'} ×{' '}
                          {dailyHoursNum}h/day ={' '}
                          <strong className="text-[#1A1F2C]">
                            {totalCalculatedHours} total planned hours
                          </strong>{' '}
                          allocated across separate daily calendar blocks.
                        </p>

                        {/* Live Schedule Feasibility & Conflict Check */}
                        {schedulePlanPreview && (
                          <div className="mt-3 pt-2.5 border-t border-[#DDE7FD]/80">
                            {schedulePlanPreview.conflicts.some((c) => c.conflictType === 'insufficient_time') ? (
                              <div className="flex items-start gap-2 text-rose-700">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                  {schedulePlanPreview.conflicts.find((c) => c.conflictType === 'insufficient_time')?.message ||
                                    `Daily effort (${dailyHoursNum}h) exceeds available working hours. Please reduce daily hours.`}
                                </span>
                              </div>
                            ) : schedulePlanPreview.hasConflict ? (
                              <div className="flex items-start gap-2 text-amber-800">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                                <div>
                                  <span className="font-semibold">
                                    Time overlap detected on preferred start time.
                                  </span>
                                  <p className="mt-0.5 text-[11px] text-amber-700">
                                    {schedulePlanPreview.conflicts[0]?.suggestedSlot
                                      ? `Overlaps with existing scheduled event on ${schedulePlanPreview.conflicts[0].date}. Suggested alternate slot: ${schedulePlanPreview.conflicts[0].suggestedSlot.startTime} – ${schedulePlanPreview.conflicts[0].suggestedSlot.endTime}.`
                                      : 'Blocks will be assigned to next available working slots.'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  All {workingDays.length} daily time blocks fit cleanly into your
                                  working schedule.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Section 3: Reminders */}
            <div className="space-y-4 pt-2 border-t border-[#F0F3F9]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
                <Clock className="h-3.5 w-3.5 text-[#2F65F6]" />
                <span>Reminder Notification</span>
              </div>

              <FieldWrapper
                id="task-modal-reminder"
                label="Task Reminder"
                helperText={
                  isInboxTask
                    ? 'Reminders require a scheduled date'
                    : 'Pushes notification to device'
                }
              >
                <Select
                  id="task-modal-reminder"
                  disabled={isInboxTask}
                  value={isCustomOffset ? 'custom' : values.reminderOffsetMinutes}
                  onChange={(e) => handleReminderSelectChange(e.target.value)}
                  className="h-10 rounded-xl disabled:opacity-40"
                >
                  <option value="">No reminder</option>
                  <option value="0">At start time (0 min)</option>
                  <option value="5">5 minutes before</option>
                  <option value="10">10 minutes before</option>
                  <option value="15">15 minutes before (Default)</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before (60 min)</option>
                  <option value="custom">Custom offset...</option>
                </Select>
              </FieldWrapper>

              {/* Custom Offset Input */}
              {isCustomOffset && !isInboxTask && (
                <FieldWrapper
                  id="task-modal-custom-offset"
                  label="Custom Reminder Offset (minutes before)"
                  error={errors.customOffset}
                  helperText="Enter minutes before start time to trigger reminder."
                >
                  <Input
                    id="task-modal-custom-offset"
                    type="number"
                    min={0}
                    max={1440}
                    placeholder="e.g., 45"
                    value={customOffsetMinutes}
                    onChange={(e) => handleCustomOffsetChange(e.target.value)}
                    hasError={Boolean(errors.customOffset)}
                    className="h-10 rounded-xl"
                  />
                </FieldWrapper>
              )}

              {/* Explicit Reminder Time for Date-Only Tasks */}
              {isDateOnlyTask && values.reminderOffsetMinutes && (
                <div className="rounded-xl border border-[#EDF2FE] bg-[#F8FAFD] p-3.5 space-y-2">
                  <FieldWrapper
                    id="task-modal-date-only-reminder-time"
                    label="Reminder Time (Explicit time required)"
                    error={errors.reminderCustomTime}
                    helperText="Date-only tasks require an explicit time (never defaults to midnight)."
                  >
                    <Input
                      id="task-modal-date-only-reminder-time"
                      type="time"
                      value={values.reminderCustomTime || '09:00'}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, reminderCustomTime: e.target.value }));
                        if (errors.reminderCustomTime) {
                          setErrors((prev) => ({ ...prev, reminderCustomTime: '' }));
                        }
                      }}
                      hasError={Boolean(errors.reminderCustomTime)}
                      className="h-10 rounded-xl bg-white"
                    />
                  </FieldWrapper>
                </div>
              )}
            </div>

            {/* Section 4: Collaboration & Additional Options */}
            <div className="space-y-4 pt-2 border-t border-[#F0F3F9]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
                <Folder className="h-3.5 w-3.5 text-[#2F65F6]" />
                <span>Collaboration & Synchronization</span>
              </div>

              {/* Client Visibility Control */}
              <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {values.clientVisible ? (
                        <Eye className="h-4 w-4 text-[#2F65F6]" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-[#7E8B9B]" />
                      )}
                      <span className="text-xs font-bold text-[#1A1F2C]">
                        Client Portal Visibility
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7E8B9B]">
                      {values.projectId
                        ? values.clientVisible
                          ? 'Visible to invited clients in this shared project.'
                          : 'Internal Only — hidden from invited clients.'
                        : 'Assign this task to a shared project to enable client visibility.'}
                    </p>
                  </div>

                  <div className="flex items-center rounded-lg border border-[#E9ECF5] bg-white p-0.5 shadow-2xs">
                    <button
                      type="button"
                      disabled={!values.projectId}
                      onClick={() => setValues((v) => ({ ...v, clientVisible: false }))}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        !values.clientVisible
                          ? 'bg-[#1A1F2C] text-white shadow-xs'
                          : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                      }`}
                    >
                      Internal Only
                    </button>
                    <button
                      type="button"
                      disabled={!values.projectId}
                      onClick={() => setValues((v) => ({ ...v, clientVisible: true }))}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        values.clientVisible
                          ? 'bg-[#2F65F6] text-white shadow-xs'
                          : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                      }`}
                    >
                      Visible to Client
                    </button>
                  </div>
                </div>
              </div>

              {/* Google Calendar Sync */}
              <div className="flex items-center justify-between rounded-xl border border-[#EDF2FE] bg-[#F8FAFD] p-3.5">
                <div className="space-y-0.5 pr-2">
                  <label htmlFor="task-modal-sync-calendar" className="text-xs font-semibold text-[#1A1C20] cursor-pointer block">
                    Sync to Google Calendar
                  </label>
                  <p className="text-[11px] text-[#7E8B9B]">
                    {isInboxTask
                      ? 'Only scheduled tasks can sync to Google Calendar.'
                      : 'Automatically creates or updates calendar event via one-way sync.'}
                  </p>
                </div>
                <input
                  id="task-modal-sync-calendar"
                  type="checkbox"
                  disabled={isInboxTask}
                  checked={!isInboxTask && values.syncToGoogleCalendar}
                  onChange={(e) => setValues((v) => ({ ...v, syncToGoogleCalendar: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#2F65F6] focus:ring-[#2F65F6] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>

              {/* Contextual notice for Inbox tasks */}
              {isInboxTask && (
                <p className="text-xs text-[#7E8B9B] bg-[#F8FAFD] border border-[#E9ECF5] rounded-xl p-3">
                  💡 This task is unscheduled and will be saved to your <strong>Inbox</strong>. Reminders will be disabled until a scheduled date is set.
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E9ECF5] bg-[#F8FAFD] px-6 py-4 shrink-0">
          <div>
            {editingTask ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  closeTaskDrawer();
                  requestDeleteTask(editingTask);
                }}
                className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <Archive className="h-4 w-4 text-amber-600" />
                <span>Move to Archive</span>
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleSafeClose} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editingTask && (
              <Button variant="ghost" onClick={handleSafeClose} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              type="submit"
              form="task-modal-form"
              disabled={isSubmitting}
              className="px-6 shadow-sm"
            >
              {isSubmitting
                ? 'Saving...'
                : editingTask
                ? 'Save Changes'
                : 'Create Task'}
            </Button>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Dialog */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#1A1F2C]">Discard Changes?</h3>
                <p className="text-xs text-[#7E8B9B] mt-0.5">
                  You have unsaved changes that will be lost if you close now.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardConfirm(false)}
              >
                Keep Editing
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  closeTaskDrawer();
                }}
              >
                Discard & Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
