import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, FileQuestion, PlusCircle, X } from 'lucide-react';
import { discussionService } from '../../services/discussionService';
import type { TaskRequestPriority } from '../../types/sharing';
import { Button } from '../ui/Button';

interface RequestTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onRequestSubmitted: () => void;
}

export function RequestTaskModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onRequestSubmitted,
}: RequestTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<TaskRequestPriority>('medium');
  const [dueDate, setDueDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasUnsavedChanges = Boolean(
    title.trim() || description.trim() || reason.trim() || dueDate
  );

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setReason('');
    setPriority('medium');
    setDueDate('');
    setErrorMsg(null);
    setSuccess(false);
    onClose();
  };

  const handleAttemptClose = () => {
    if (submitting) return;
    if (hasUnsavedChanges && !success) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes in your task request. Discard them?'
      );
      if (confirmDiscard) {
        resetAndClose();
      }
    } else {
      resetAndClose();
    }
  };

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAttemptClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, hasUnsavedChanges, submitting, success]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a task title.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please provide a brief description of the requested deliverable.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await discussionService.createTaskRequest({
      projectId,
      title: title.trim(),
      description: description.trim(),
      reason: reason.trim() || undefined,
      suggestedPriority: priority,
      requestedDueDate: dueDate || null,
    });

    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setDescription('');
        setReason('');
        setPriority('medium');
        setDueDate('');
        onClose();
        onRequestSubmitted();
      }, 1200);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1F2C]/40 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={handleAttemptClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[24px] border border-white/80 bg-white shadow-[0_25px_60px_rgba(25,45,100,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-[#E9ECF5] p-6 pb-4 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF2FE] text-[#2F65F6]">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="request-task-title" className="text-lg font-bold text-[#1A1F2C]">
                Request a Task
              </h2>
              <p className="text-xs text-[#7E8B9B]">
                Submit a new deliverable request for project <strong className="text-[#1A1F2C]">{projectName}</strong>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAttemptClose}
            className="rounded-full p-1.5 text-[#7E8B9B] hover:bg-[#E9ECF5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 pt-4 flex-1">

        {success ? (
          <div className="py-10 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF7EE] text-[#16845B]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#1A1F2C]">Task Request Submitted!</h3>
            <p className="text-xs text-[#7E8B9B]">
              The project owner has been notified and will review your request.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="req-title" className="block text-xs font-semibold text-[#1A1F2C]">
                Task Title <span className="text-[#C2414B]">*</span>
              </label>
              <input
                id="req-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Add payment receipt download button"
                required
                className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] px-3.5 py-2.5 text-xs text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
              />
            </div>

            <div>
              <label htmlFor="req-desc" className="block text-xs font-semibold text-[#1A1F2C]">
                Description &amp; Deliverable Details <span className="text-[#C2414B]">*</span>
              </label>
              <textarea
                id="req-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what needs to be created, changed, or verified..."
                required
                className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-xs text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
              />
            </div>

            <div>
              <label htmlFor="req-reason" className="block text-xs font-semibold text-[#1A1F2C]">
                Business Context or Reason (Optional)
              </label>
              <input
                id="req-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customers requested this feature during testing"
                className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] px-3.5 py-2.5 text-xs text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="req-priority" className="block text-xs font-semibold text-[#1A1F2C]">
                  Suggested Priority
                </label>
                <select
                  id="req-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskRequestPriority)}
                  className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] px-3 py-2 text-xs font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:bg-white focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label htmlFor="req-date" className="block text-xs font-semibold text-[#1A1F2C]">
                  Target Due Date (Optional)
                </label>
                <input
                  id="req-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] px-3 py-2 text-xs font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-[11px] text-[#7E8B9B] flex items-start gap-2">
              <FileQuestion className="h-4 w-4 text-[#2F65F6] shrink-0 mt-0.5" />
              <span>
                Task requests are reviewed by the project owner before becoming active deliverables.
                You can track review progress in your Client Inbox.
              </span>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E9ECF5]">
              <Button type="button" variant="ghost" onClick={handleAttemptClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !title.trim()}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
