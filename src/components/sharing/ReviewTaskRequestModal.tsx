import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileQuestion,
  HelpCircle,
  X,
  XCircle,
} from 'lucide-react';
import type { ProjectTaskRequest } from '../../types/sharing';
import { discussionService } from '../../services/discussionService';
import { PriorityBadge } from '../ui/Badges';
import { Button } from '../ui/Button';

interface ReviewTaskRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ProjectTaskRequest | null;
  onRequestUpdated: () => void;
}

export function ReviewTaskRequestModal({
  isOpen,
  onClose,
  request,
  onRequestUpdated,
}: ReviewTaskRequestModalProps) {
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const [mode, setMode] = useState<'view' | 'approve' | 'feedback' | 'reject'>('view');

  // Approval overrides
  const [approvedTitle, setApprovedTitle] = useState(request.title);
  const [approvedDesc, setApprovedDesc] = useState(request.description || '');
  const [scheduledDate, setScheduledDate] = useState(request.requestedDueDate || '');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priority, setPriority] = useState(request.suggestedPriority);
  const [clientVisible, setClientVisible] = useState(true);

  // Feedback input
  const [feedbackText, setFeedbackText] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const res = await discussionService.approveTaskRequest(request.id, {
      title: approvedTitle.trim(),
      description: approvedDesc.trim() || undefined,
      scheduledDate: scheduledDate || null,
      scheduledStartTime: scheduledStartTime || null,
      plannedDurationMinutes: durationMinutes > 0 ? durationMinutes : 60,
      priority,
      clientVisible,
    });

    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      onClose();
      onRequestUpdated();
    }
  };

  const handleStatusUpdate = async (status: 'needs_information' | 'rejected') => {
    if (!feedbackText.trim()) {
      setErrorMsg('Please provide a message or reason for the client.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await discussionService.updateTaskRequestStatus(
      request.id,
      status,
      feedbackText.trim()
    );

    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      onClose();
      onRequestUpdated();
    }
  };

  const isApproved = request.status === 'approved';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1F2C]/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-xl rounded-[24px] border border-white/80 bg-white p-6 sm:p-8 shadow-[0_25px_60px_rgba(25,45,100,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E9ECF5] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[10px] font-bold text-[#2F65F6] uppercase tracking-wide">
                Client Task Request
              </span>
              <span className="text-xs text-[#7E8B9B]">in {request.projectName}</span>
            </div>
            <h2 id="review-task-title" className="mt-1 text-lg font-bold text-[#1A1F2C]">
              {request.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#7E8B9B] hover:bg-[#E9ECF5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="my-5 space-y-4 text-xs">
          {/* Submitter info line */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F8FAFD] p-3 text-[#475467]">
            <div>
              <span className="text-[#7E8B9B]">Requested by: </span>
              <strong className="text-[#1A1F2C]">{request.requesterName}</strong>
              {request.requesterEmail && (
                <span className="text-[#7E8B9B]"> ({request.requesterEmail})</span>
              )}
            </div>
            <div>
              <span className="text-[#7E8B9B]">Submitted: </span>
              <span>{new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {request.description && (
            <div>
              <span className="font-semibold text-[#1A1F2C] block mb-1">Description:</span>
              <p className="rounded-xl border border-[#E9ECF5] p-3 text-[#344054] leading-relaxed whitespace-pre-wrap bg-white">
                {request.description}
              </p>
            </div>
          )}

          {request.reason && (
            <div>
              <span className="font-semibold text-[#1A1F2C] block mb-1">Business Reason:</span>
              <p className="rounded-xl bg-[#F8FAFD] p-3 text-[#475467] italic">
                &ldquo;{request.reason}&rdquo;
              </p>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div>
              <span className="text-[#7E8B9B] block mb-1">Suggested Priority:</span>
              <PriorityBadge priority={request.suggestedPriority} />
            </div>

            {request.requestedDueDate && (
              <div>
                <span className="text-[#7E8B9B] block mb-1">Requested Due Date:</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2.5 py-1 text-xs font-semibold text-[#1A1F2C]">
                  <Calendar className="h-3 w-3 text-[#2F65F6]" />
                  {request.requestedDueDate}
                </span>
              </div>
            )}
          </div>

          {request.ownerFeedback && (
            <div className="rounded-xl border border-[#FDE8E8] bg-[#FFF5F5] p-3 text-[#9B1C1C]">
              <span className="font-bold block mb-0.5">Previous Owner Feedback:</span>
              <p>{request.ownerFeedback}</p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* View mode action choices */}
        {mode === 'view' && (
          <div className="pt-4 border-t border-[#E9ECF5] flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>

            {!isApproved ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setMode('feedback')}
                  className="flex items-center gap-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-[#B7791F]" />
                  <span>Need Information</span>
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setMode('reject')}
                  className="flex items-center gap-1.5"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setMode('approve')}
                  className="flex items-center gap-1.5 bg-[#16845B] hover:bg-[#13714E] border-[#16845B]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Approve &amp; Create Task</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#16845B] bg-[#EAF7EE] px-3 py-1.5 rounded-full">
                <CheckCircle2 className="h-4 w-4" />
                <span>Task Already Created &amp; Active</span>
              </div>
            )}
          </div>
        )}

        {/* Approve mode: configure task creation settings */}
        {mode === 'approve' && (
          <form onSubmit={handleApprove} className="pt-3 border-t border-[#E9ECF5] space-y-3 text-xs">
            <h4 className="font-bold text-[#1A1F2C]">Configure Approved Deliverable</h4>

            <div>
              <label className="block text-[#1A1F2C] font-semibold mb-1">Task Title</label>
              <input
                type="text"
                value={approvedTitle}
                onChange={(e) => setApprovedTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2 text-xs text-[#1A1F2C] focus:bg-white focus:outline-none focus:border-[#2F65F6]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#1A1F2C] font-semibold mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2 text-xs text-[#1A1F2C] focus:bg-white focus:outline-none focus:border-[#2F65F6]"
                />
              </div>

              <div>
                <label className="block text-[#1A1F2C] font-semibold mb-1">Estimate (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2 text-xs text-[#1A1F2C] focus:bg-white focus:outline-none focus:border-[#2F65F6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={clientVisible}
                  onChange={(e) => setClientVisible(e.target.checked)}
                  className="rounded border-[#D0D5DD] text-[#2F65F6] focus:ring-[#2F65F6]"
                />
                <span className="font-semibold text-[#1A1F2C]">Visible to Client in Portal</span>
              </label>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')}>
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || !approvedTitle.trim()}
                  className="bg-[#16845B] hover:bg-[#13714E] border-[#16845B]"
                >
                  {submitting ? 'Creating Task...' : 'Confirm & Create Task'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Feedback / Need Info mode */}
        {mode === 'feedback' && (
          <div className="pt-3 border-t border-[#E9ECF5] space-y-3 text-xs">
            <h4 className="font-bold text-[#1A1F2C]">Request Information from Client</h4>
            <textarea
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Explain what additional specifications, mockups, or details are required..."
              className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2.5 text-xs text-[#1A1F2C] focus:bg-white focus:outline-none focus:border-[#2F65F6]"
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')}>
                Back
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={submitting || !feedbackText.trim()}
                onClick={() => handleStatusUpdate('needs_information')}
              >
                {submitting ? 'Sending...' : 'Send Questions to Client'}
              </Button>
            </div>
          </div>
        )}

        {/* Reject mode */}
        {mode === 'reject' && (
          <div className="pt-3 border-t border-[#E9ECF5] space-y-3 text-xs">
            <h4 className="font-bold text-[#C2414B]">Reject Task Request</h4>
            <textarea
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Explain why this deliverable cannot be accommodated or is out of scope..."
              className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2.5 text-xs text-[#1A1F2C] focus:bg-white focus:outline-none focus:border-[#2F65F6]"
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')}>
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={submitting || !feedbackText.trim()}
                onClick={() => handleStatusUpdate('rejected')}
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
