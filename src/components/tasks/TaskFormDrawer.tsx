import React, { useEffect, useState } from 'react';
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

          <FieldWrapper id="task-reminder" label="Reminder">
            <Select
              id="task-reminder"
              value={values.reminderOffsetMinutes}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  reminderOffsetMinutes: e.target.value,
                }))
              }
              className="h-10 rounded-xl"
            >
              <option value="">No reminder</option>
              <option value="0">At start time</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </Select>
          </FieldWrapper>
        </div>

        {/* Contextual notice */}
        {!values.scheduledDate && (
          <p className="text-xs text-[#7E8B9B] bg-[#F8FAFD] border border-[#E9ECF5] rounded-xl p-3">
            💡 This task is unscheduled and will be saved to your <strong>Inbox</strong>. You can schedule it anytime.
          </p>
        )}
      </form>
    </Drawer>
  );
}
