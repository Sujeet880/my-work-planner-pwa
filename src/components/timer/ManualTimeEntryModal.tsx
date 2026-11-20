import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getLocalDateISO,
  validateManualTimeEntry,
  type ValidationErrors,
} from '../../lib/timeMath';
import { Button } from '../ui/Button';
import { FieldWrapper, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function ManualTimeEntryModal() {
  const {
    manualEntryModalOpen,
    manualEntryDefaultTaskId,
    closeManualEntryModal,
    tasks,
    addManualTimeEntry,
  } = useWorkspace();

  const availableTasks = tasks.filter((t) => !t.isArchived);

  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState(getLocalDateISO());
  const [inputMode, setInputMode] = useState<'duration' | 'range'>('duration');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (manualEntryModalOpen) {
      setTaskId(manualEntryDefaultTaskId ?? availableTasks[0]?.id ?? '');
      setDate(getLocalDateISO());
      setInputMode('duration');
      setDurationMinutes('30');
      setStartTime('09:00');
      setEndTime('09:30');
      setNotes('');
      setErrors({});
    }
  }, [manualEntryModalOpen, manualEntryDefaultTaskId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { errors: nextErrors, computedSeconds } = validateManualTimeEntry({
      taskId,
      date,
      inputMode,
      durationMinutes,
      startTime,
      endTime,
    });

    if (Object.keys(nextErrors).length > 0 || !computedSeconds) {
      setErrors(nextErrors);
      return;
    }

    addManualTimeEntry({
      taskId,
      date,
      durationSeconds: computedSeconds,
      startTime: inputMode === 'range' ? startTime : undefined,
      endTime: inputMode === 'range' ? endTime : undefined,
      notes,
    });
    closeManualEntryModal();
  };

  return (
    <Modal
      open={manualEntryModalOpen}
      onClose={closeManualEntryModal}
      title="Add Manual Time Entry"
      description="Log work performed outside the automatic count-up timer. Manual entries are clearly labeled in history."
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeManualEntryModal}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="manual-time-entry-form">
            Save Work Session
          </Button>
        </>
      }
    >
      <form id="manual-time-entry-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FieldWrapper id="manual-task" label="Task" required error={errors.taskId}>
          <Select
            id="manual-task"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            hasError={Boolean(errors.taskId)}
          >
            <option value="">Select a task</option>
            {availableTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </FieldWrapper>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper id="manual-date" label="Work Date" required error={errors.date}>
            <Input
              id="manual-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              hasError={Boolean(errors.date)}
            />
          </FieldWrapper>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-[#202531]">Entry Method</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#E4E7EC] bg-[#F0F2F5] p-1">
              <button
                type="button"
                onClick={() => setInputMode('duration')}
                className={`h-8 rounded-md text-xs font-medium cursor-pointer ${
                  inputMode === 'duration'
                    ? 'bg-white text-[#202531] shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                    : 'text-[#667085]'
                }`}
              >
                Duration
              </button>
              <button
                type="button"
                onClick={() => setInputMode('range')}
                className={`h-8 rounded-md text-xs font-medium cursor-pointer ${
                  inputMode === 'range'
                    ? 'bg-white text-[#202531] shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                    : 'text-[#667085]'
                }`}
              >
                Start / End
              </button>
            </div>
          </div>
        </div>

        {inputMode === 'duration' ? (
          <FieldWrapper
            id="manual-duration"
            label="Duration (minutes)"
            required
            error={errors.durationMinutes}
          >
            <Input
              id="manual-duration"
              type="number"
              min={1}
              max={1440}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              hasError={Boolean(errors.durationMinutes)}
            />
          </FieldWrapper>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper id="manual-start" label="Start Time" required error={errors.startTime}>
              <Input
                id="manual-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                hasError={Boolean(errors.startTime)}
              />
            </FieldWrapper>
            <FieldWrapper id="manual-end" label="End Time" required error={errors.endTime}>
              <Input
                id="manual-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                hasError={Boolean(errors.endTime)}
              />
            </FieldWrapper>
          </div>
        )}

        <FieldWrapper id="manual-notes" label="Notes (Optional)">
          <Textarea
            id="manual-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Brief note about what was completed..."
          />
        </FieldWrapper>
      </form>
    </Modal>
  );
}
