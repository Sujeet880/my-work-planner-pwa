import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { validateTaskInput, type ValidationErrors } from '../../lib/timeMath';
import type { TaskFormValues, TaskPriority } from '../../types/models';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { FieldWrapper, Input, Select, Textarea } from '../ui/Field';

const STANDARD_OFFSETS = ['0', '5', '10', '15', '30', '60'];

function buildInitialValues(
  editingTask: ReturnType<typeof useWorkspace>['editingTask'],
  defaultDate: string | null,
  defaultReminderOffset: number = 15,
  defaultCalendarSyncEnabled: boolean = true
): { formValues: TaskFormValues; isCustom: boolean; customOffset: string } {
  if (editingTask) {
    const rawOffset =
      editingTask.reminderOffsetMinutes !== null && editingTask.reminderOffsetMinutes !== undefined
        ? String(editingTask.reminderOffsetMinutes)
        : '';
    const isCustom = Boolean(rawOffset && !STANDARD_OFFSETS.includes(rawOffset));
    return {
      formValues: {
        title: editingTask.title,
        description: editingTask.description ?? '',
        projectId: editingTask.projectId,
        priority: editingTask.priority,
        scheduledDate: editingTask.scheduledDate ?? '',
        scheduledStartTime: editingTask.scheduledStartTime ?? '',
        plannedDurationMinutes: editingTask.plannedDurationMinutes
          ? String(editingTask.plannedDurationMinutes)
          : '',
        reminderOffsetMinutes: rawOffset,
        reminderCustomTime: '09:00',
        syncToGoogleCalendar: editingTask.syncToGoogleCalendar ?? Boolean(editingTask.scheduledDate),
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
      scheduledDate: defaultDate ?? '',
      scheduledStartTime: '',
      plannedDurationMinutes: '',
      reminderOffsetMinutes: initialOffset,
      reminderCustomTime: '09:00',
      syncToGoogleCalendar: Boolean(defaultDate) && defaultCalendarSyncEnabled,
    },
    isCustom,
    customOffset: isCustom ? initialOffset : '',
  };
}

export function TaskFormDrawer() {
  const {
    taskDrawerOpen,
    editingTask,
    taskDrawerDefaultDate,
    closeTaskDrawer,
    projects,
    profile,
    saveTask,
  } = useWorkspace();

  const defaultCalendarSync = profile?.defaultCalendarSyncEnabled ?? true;

  const [initialData] = useState(() =>
    buildInitialValues(
      editingTask,
      taskDrawerDefaultDate,
      profile?.defaultReminderOffsetMinutes ?? 15,
      defaultCalendarSync
    )
  );
  const [values, setValues] = useState<TaskFormValues>(initialData.formValues);
  const [isCustomOffset, setIsCustomOffset] = useState<boolean>(initialData.isCustom);
  const [customOffsetMinutes, setCustomOffsetMinutes] = useState<string>(initialData.customOffset);
  const [errors, setErrors] = useState<ValidationErrors & { reminderCustomTime?: string; customOffset?: string }>({});

  useEffect(() => {
    if (taskDrawerOpen) {
      const data = buildInitialValues(
        editingTask,
        taskDrawerDefaultDate,
        profile?.defaultReminderOffsetMinutes ?? 15,
        defaultCalendarSync
      );
      setValues(data.formValues);
      setIsCustomOffset(data.isCustom);
      setCustomOffsetMinutes(data.customOffset);
      setErrors({});
    }
  }, [taskDrawerOpen, editingTask, taskDrawerDefaultDate, profile?.defaultReminderOffsetMinutes, defaultCalendarSync]);

  const activeProjects = projects.filter((p) => !p.isArchived);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateTaskInput({
      title: values.title,
      scheduledDate: values.scheduledDate,
      scheduledStartTime: values.scheduledStartTime,
      plannedDurationMinutes: values.plannedDurationMinutes,
    });

    const extendedErrors: ValidationErrors & { reminderCustomTime?: string; customOffset?: string } = {
      ...validationErrors,
    };

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

    // Unscheduled inbox tasks cannot have reminders
    const finalValues: TaskFormValues = {
      ...values,
      reminderOffsetMinutes: values.scheduledDate ? values.reminderOffsetMinutes : '',
    };

    saveTask(finalValues, editingTask?.id);
    closeTaskDrawer();
  };

  const priorities: { value: TaskPriority; label: string }[] = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const isInboxTask = !values.scheduledDate;
  const isDateOnlyTask = Boolean(values.scheduledDate && !values.scheduledStartTime);

  return (
    <Drawer
      open={taskDrawerOpen}
      onClose={closeTaskDrawer}
      title={editingTask ? 'Edit Task' : 'Create New Task'}
      subtitle={
        editingTask
          ? 'Update priority, duration estimate, or schedule date.'
          : 'Schedule for a specific day or leave unscheduled to save in Inbox.'
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button variant="ghost" onClick={closeTaskDrawer}>
            Cancel
          </Button>

          <Button
            variant="primary"
            type="submit"
            form="task-drawer-form"
            className="px-6"
          >
            {editingTask ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      }
    >
      <form
        id="task-drawer-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        {/* Task Title */}
        <FieldWrapper
          id="task-title"
          label="Task Title"
          required
          error={errors.title}
        >
          <Input
            id="task-title"
            name="title"
            value={values.title}
            onChange={(e) => {
              setValues((v) => ({ ...v, title: e.target.value }));
              if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
            }}
            placeholder="e.g., Prepare quarterly roadmap presentation"
            hasError={Boolean(errors.title)}
            className="h-11 rounded-xl text-base"
            autoFocus
          />
        </FieldWrapper>

        {/* Description / Notes */}
        <FieldWrapper id="task-description" label="Notes / Description">
          <Textarea
            id="task-description"
            name="description"
            value={values.description}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
            placeholder="Add deliverables, links, or context..."
            className="rounded-xl min-h-[90px]"
          />
        </FieldWrapper>

        {/* Project & Priority */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper id="task-project" label="Project / Client">
            <Select
              id="task-project"
              value={values.projectId ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, projectId: e.target.value || null }))
              }
              className="h-10 rounded-xl"
            >
              <option value="">No Project</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-[#1A1F2C]">
              Priority
            </span>
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
                    className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? 'bg-white text-[#1A1F2C] shadow-xs'
                        : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scheduled Date & Start Time */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper
            id="task-date"
            label="Scheduled Date"
            helperText="Leave empty to save to Inbox."
          >
            <Input
              id="task-date"
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

          <FieldWrapper
            id="task-start-time"
            label="Start Time (Optional)"
            error={errors.scheduledStartTime}
            helperText={
              values.scheduledDate
                ? 'Optional start time'
                : 'Requires a scheduled date'
            }
          >
            <Input
              id="task-start-time"
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

        {/* Planned Duration & Reminder */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper
            id="task-planned-duration"
            label="Planned Duration (minutes)"
            error={errors.plannedDurationMinutes}
            helperText="E.g., 45, 60, 90 min"
          >
            <Input
              id="task-planned-duration"
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

          <FieldWrapper
            id="task-reminder"
            label="Task Reminder"
            helperText={
              isInboxTask
                ? 'Reminders require a scheduled date'
                : 'Pushes notification to device'
            }
          >
            <Select
              id="task-reminder"
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
        </div>

        {/* Custom Offset Input when selected */}
        {isCustomOffset && !isInboxTask && (
          <FieldWrapper
            id="task-custom-offset"
            label="Custom Reminder Offset (minutes before)"
            error={errors.customOffset}
            helperText="Enter minutes before start time to trigger reminder."
          >
            <Input
              id="task-custom-offset"
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
              id="task-date-only-reminder-time"
              label="Reminder Time (Explicit time required)"
              error={errors.reminderCustomTime}
              helperText="Date-only tasks require an explicit time (never defaults to midnight)."
            >
              <Input
                id="task-date-only-reminder-time"
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

        {/* Google Calendar Sync Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-[#EDF2FE] bg-[#F8FAFD] p-3.5">
          <div className="space-y-0.5 pr-2">
            <label htmlFor="task-sync-calendar" className="text-xs font-semibold text-[#1A1C20] cursor-pointer block">
              Sync to Google Calendar
            </label>
            <p className="text-[11px] text-[#7E8B9B]">
              {isInboxTask
                ? 'Only scheduled tasks can sync to Google Calendar.'
                : 'Automatically keeps Google Calendar updated.'}
            </p>
          </div>
          <input
            id="task-sync-calendar"
            type="checkbox"
            disabled={isInboxTask}
            checked={!isInboxTask && values.syncToGoogleCalendar}
            onChange={(e) => setValues((v) => ({ ...v, syncToGoogleCalendar: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        {/* Contextual notice */}
        {isInboxTask && (
          <p className="text-xs text-[#7E8B9B] bg-[#F8FAFD] border border-[#E9ECF5] rounded-xl p-3">
            💡 This task is unscheduled and will be saved to your <strong>Inbox</strong>. Reminders will be disabled until a scheduled date is set.
          </p>
        )}
      </form>
    </Drawer>
  );
}
