import React, { useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import type { Task, Project } from '../../types/models';
import { ProjectDiscussionsView } from './ProjectDiscussionsView';
import { PriorityBadge, StatusBadge } from '../ui/Badges';

interface TaskDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  project: Project | null;
  currentUserId: string;
}

export function TaskDiscussionModal({
  isOpen,
  onClose,
  task,
  project,
  currentUserId,
}: TaskDiscussionModalProps) {
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

  // Prevent background page scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !task || !project) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-discussion-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A1F2C]/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[24px] border border-white/80 bg-white shadow-[0_25px_60px_rgba(25,45,100,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E9ECF5] px-6 py-4 bg-[#F8FAFD]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF2FE] text-[#2F65F6]">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="task-discussion-title" className="text-base font-bold text-[#1A1F2C] truncate">
                  {task.title}
                </h2>
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
              </div>
              <p className="text-xs text-[#7E8B9B] truncate">
                Project: {project.name} · Dedicated Task Discussion
              </p>
            </div>
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

        {/* Scrollable Discussion Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {task.description && (
            <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-xs text-[#475467] leading-relaxed">
              <span className="font-semibold text-[#1A1F2C]">Task Overview: </span>
              {task.description}
            </div>
          )}

          <ProjectDiscussionsView
            projectId={project.id}
            projectName={project.name}
            projectOwnerId={project.userId}
            currentUserId={currentUserId}
            taskId={task.id}
            taskTitle={task.title}
            allowComments={project.clientAllowComments ?? true}
          />
        </div>
      </div>
    </div>
  );
}
