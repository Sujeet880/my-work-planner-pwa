import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarOff, Info } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { validateTaskInput, type ValidationErrors } from '../../lib/timeMath';
import type { TaskFormValues, TaskPriority } from '../../types/models';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { FieldWrapper, Input, Select, Textarea } from '../ui/Field';

function buildInitialValues(
  editingTask: ReturnType<typeof useWorkspace>['editingTask'],
  defaultDate: string | null
): TaskFormValues {
  if (editingTask) {
    return {
      title: editingTask.title,
      description: editingTask.description ?? '',
      projectId: editingTask.projectId,
      priority: editingTask.priority,
      scheduledDate: editingTask.scheduledDate ?? '',
      scheduledStartTime: editingTask.scheduledStartTime ?? '',
      plannedDurationMinutes: editingTask.plannedDurationMinutes
        ? String(editingTask.plannedDurationMinutes)
        : '',
      reminderOffsetMinutes: editingTask.reminderOffsetMinutes
        ? String(editingTask.reminderOffsetMinutes)
        : '',
      syncToGoogleCalendar: false,
    };
  }
  return {
    title: '',
    description: '',
    projectId: null,
    priority: 'medium',
    scheduledDate: defaultDate ?? '',
    scheduledStartTime: '',
    plannedDurationMinutes: '',
    reminderOffsetMinutes: '',
    syncToGoogleCalendar: false,
  };
}

export function TaskFormDrawer() {
  const {
    taskDrawerOpen,
    editingTask,
    taskDrawerDefaultDate,
    closeTaskDrawer,
    projects,
    calendarConnection,
    saveTask,
  } = useWorkspace();

  const [values, setValues] = useState<TaskFormValues>(() =>
    buildInitialValues(editingTask, taskDrawerDefaultDate)
  );
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (taskDrawerOpen) {
      setValues(buildInitialValues(editingTask, taskDrawerDefaultDate));
      setErrors({});
    }
  }, [taskDrawerOpen, editingTask, taskDrawerDefaultDate]);

  const activeProjects = projects.filter((p) => !p.isArchived);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateTaskInput({
      title: values.title,
      scheduledDate: values.scheduledDate,
      scheduledStartTime: values.scheduledStartTime,
      plannedDurationMinutes: values.plannedDurationMinutes,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    saveTask(values, editingTask?.id);
    closeTaskDrawer();
  };

  const handleSaveAsInbox = () => {
    const inboxValues: TaskFormValues = {
      ...values,
      scheduledDate: '',
      scheduledStartTime: '',
    };
    const validationErrors = validateTaskInput({
      title: inboxValues.title,
      scheduledDate: '',
      scheduledStartTime: '',
      plannedDurationMinutes: inboxValues.plannedDurationMinutes,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    saveTask(inboxValues, editingTask?.id);
    closeTaskDrawer();
  };

  const priorities: { value: TaskPriority; label: string }[] = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  return (
    <Drawer
      open={taskDrawerOpen}
      onClose={closeTaskDrawer}
      title={editingTask ? 'Edit Task' : 'Create New Task'}
      subtitle={
        editingTask
          ? 'Update scheduling, priority, or planned duration.'
          : 'Schedule a task for a specific day or leave unscheduled in Inbox.'
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={closeTaskDrawer}>
            Cancel
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {!editingTask && (
              <Button variant="secondary" onClick={handleSaveAsInbox}>
                Save to Inbox
              </Button>
            )}
            <Button variant="primary" type="submit" form="task-drawer-form">
              {editingTask ? 'Save Changes' : 'Save Task'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="task-drawer-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
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
            placeholder="e.g., Prepare client proposal draft"
            hasError={Boolean(errors.title)}
            autoFocus
          />
        </FieldWrapper>

        <FieldWrapper id="task-description" label="Description (Optional)">
          <Textarea
            id="task-description"
            name="description"
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            placeholder="Add brief context, deliverables, or links..."
          />
        </FieldWrapper>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper id="task-project" label="Project / Client">
            <Select
              id="task-project"
              value={values.projectId ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, projectId: e.target.value || null }))
              }
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
            <span className="block text-sm font-medium text-[#202531]">Priority</span>
            <div
              className="grid grid-cols-3 gap-1 rounded-lg border border-[#E4E7EC] bg-[#F0F2F5] p-1"
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
                    className={`h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'bg-white text-[#202531] shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                        : 'text-[#667085] hover:text-[#202531]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper
            id="task-date"
            label="Scheduled Date"
            helperText="Leave blank to keep in Inbox."
          >
            <Input
              id="task-date"
              type="date"
              value={values.scheduledDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setValues((v) => ({ ...v, scheduledDate: nextDate }));
                if (nextDate && errors.scheduledStartTime) {
                  setErrors((prev) => ({ ...prev, scheduledStartTime: '' }));
                }
              }}
            />
          </FieldWrapper>

          <FieldWrapper
            id="task-start-time"
            label="Scheduled Start Time"
            error={errors.scheduledStartTime}
            helperText="Optional. Requires a scheduled date."
          >
            <Input
              id="task-start-time"
              type="time"
              value={values.scheduledStartTime}
              onChange={(e) => {
                setValues((v) => ({ ...v, scheduledStartTime: e.target.value }));
                if (errors.scheduledStartTime) {
                  setErrors((prev) => ({ ...prev, scheduledStartTime: '' }));
                }
              }}
              hasError={Boolean(errors.scheduledStartTime)}
            />
          </FieldWrapper>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper
            id="task-planned-duration"
            label="Planned Duration (minutes)"
            error={errors.plannedDurationMinutes}
            helperText="Used for Planned vs Actual reporting."
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
                setValues((v) => ({ ...v, plannedDurationMinutes: e.target.value }));
                if (errors.plannedDurationMinutes) {
                  setErrors((prev) => ({ ...prev, plannedDurationMinutes: '' }));
                }
              }}
              hasError={Boolean(errors.plannedDurationMinutes)}
            />
          </FieldWrapper>

          <FieldWrapper
            id="task-reminder"
            label="Reminder (Optional)"
            helperText="In-app & browser notice when active."
          >
            <Select
              id="task-reminder"
              value={values.reminderOffsetMinutes}
              onChange={(e) =>
                setValues((v) => ({ ...v, reminderOffsetMinutes: e.target.value }))
              }
            >
              <option value="">No reminder</option>
              <option value="0">At start time</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </Select>
          </FieldWrapper>
        </div>

        {/* Google Calendar Sync Status — Honest Disconnected State in M0 */}
        <div className="rounded-xl border border-[#E4E7EC] bg-[#F6F7F9] p-3.5">
          <div className="flex items-start gap-2.5">
            <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#202531]">
                  Google Calendar (One-Way Sync)
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-[#667085] border border-[#E4E7EC]">
                  {calendarConnection.isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#667085]">
                {!values.scheduledDate
                  ? 'Inbox tasks are unscheduled and do not sync to Google Calendar until a date is assigned.'
                  : 'Connect Google Calendar in Settings (Milestone 6) to push scheduled tasks one-way from My Work Planner to Google Calendar.'}
              </p>
              <Link
                to="/settings/google-calendar"
                onClick={closeTaskDrawer}
                className="mt-1.5 inline-block text-xs font-medium text-[#4968D6] hover:underline"
              >
                View Calendar Integration Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Single Active Timer Info */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E4E7EC] bg-white p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3574B8]" />
          <p className="text-xs leading-relaxed text-[#667085]">
            Only one task timer can run at a time. Starting a timer on a new task will prompt you
            to save and switch from any active session.
          </p>
        </div>
      </form>
    </Drawer>
  );
}
