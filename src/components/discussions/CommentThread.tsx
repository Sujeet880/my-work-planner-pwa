import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  CornerDownRight,
  MessageSquare,
  RotateCcw,
  Send,
  Trash2,
  User,
} from 'lucide-react';
import type { ProjectComment } from '../../types/sharing';
import { discussionService } from '../../services/discussionService';
import { Button } from '../ui/Button';

interface CommentThreadProps {
  comment: ProjectComment;
  currentUserId: string;
  projectOwnerId: string;
  projectId: string;
  allowReplies?: boolean;
  onCommentUpdated: () => void;
}

export function CommentThread({
  comment,
  currentUserId,
  projectOwnerId,
  projectId,
  allowReplies = true,
  onCommentUpdated,
}: CommentThreadProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isAuthor = currentUserId === comment.authorId;
  const isOwner = currentUserId === projectOwnerId;
  const canManage = isAuthor || isOwner;
  const isResolved = Boolean(comment.resolvedAt);

  const authorIsOwner = comment.authorId === projectOwnerId;
  const authorDisplayName =
    comment.authorName ||
    (comment.authorEmail ? comment.authorEmail.split('@')[0] : null) ||
    (authorIsOwner ? 'Project Owner' : 'Client Collaborator');
  const roleLabel = comment.authorRole || (authorIsOwner ? 'Project Owner' : 'Client Collaborator');

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReplySubmit(e);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyBody.trim();
    if (!trimmed) return;

    setSubmittingReply(true);
    const res = await discussionService.createComment({
      projectId,
      parentCommentId: comment.id,
      body: trimmed,
      taskId: comment.taskId || undefined,
    });
    setSubmittingReply(false);

    if (res.error) {
      alert(`Error posting reply: ${res.error}`);
    } else {
      setReplyBody('');
      setReplyOpen(false);
      onCommentUpdated();
    }
  };

  const handleToggleResolve = async () => {
    setActionLoading(true);
    const res = await discussionService.toggleCommentResolved(comment.id, !isResolved);
    setActionLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      onCommentUpdated();
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    setActionLoading(true);
    const res = await discussionService.deleteComment(commentId);
    setActionLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      onCommentUpdated();
    }
  };

  return (
    <article
      className={`rounded-2xl border transition-all ${
        isResolved
          ? 'border-[#BDE8C8] bg-[#F4FBF6]/60'
          : 'border-[#E9ECF5] bg-white shadow-[0_4px_15px_rgba(25,45,100,0.02)]'
      } p-4 sm:p-5`}
    >
      {/* Top Meta Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
              authorIsOwner
                ? 'bg-[#2F65F6] text-white shadow-sm'
                : 'bg-[#8B5CF6] text-white shadow-sm'
            }`}
          >
            {authorDisplayName[0].toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-[#1A1F2C]">{authorDisplayName}</span>
              <span className="text-[#98A2B3] text-[10px]">·</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  authorIsOwner
                    ? 'bg-[#EDF2FE] text-[#2F65F6]'
                    : 'bg-[#F5EDFD] text-[#8B5CF6]'
                }`}
              >
                {roleLabel}
              </span>
              {comment.taskTitle && (
                <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] font-medium text-[#7E8B9B]">
                  Task: {comment.taskTitle}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#7E8B9B]">
              {new Date(comment.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {canManage && (
            <button
              type="button"
              onClick={handleToggleResolve}
              disabled={actionLoading}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                isResolved
                  ? 'bg-[#EAF7EE] text-[#16845B] hover:bg-[#D4EFE0]'
                  : 'text-[#7E8B9B] hover:bg-[#F0F2F5] hover:text-[#1A1F2C]'
              }`}
              title={isResolved ? 'Mark as active' : 'Mark as resolved'}
            >
              {isResolved ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Resolved</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Resolve</span>
                </>
              )}
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => handleDelete(comment.id)}
              disabled={actionLoading}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors"
              title="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Comment Body */}
      <div className="mt-3 text-sm text-[#1A1F2C] leading-relaxed whitespace-pre-wrap">
        {comment.body}
      </div>

      {/* Replies Section */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-2.5 border-l-2 border-[#E9ECF5] pl-4 pt-1">
          {comment.replies.map((reply) => {
            const replyIsOwner = reply.authorId === projectOwnerId;
            const replyAuthorName =
              reply.authorName ||
              (reply.authorEmail ? reply.authorEmail.split('@')[0] : null) ||
              (replyIsOwner ? 'Project Owner' : 'Client Collaborator');
            const replyRole = reply.authorRole || (replyIsOwner ? 'Project Owner' : 'Client Collaborator');
            const canDeleteReply = currentUserId === reply.authorId || isOwner;

            return (
              <div
                key={reply.id}
                className="rounded-xl border border-[#F0F2F5] bg-[#F8FAFD] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-[#1A1F2C]">{replyAuthorName}</span>
                    <span className="text-[#98A2B3] text-[9px]">·</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                        replyIsOwner
                          ? 'bg-[#EDF2FE] text-[#2F65F6]'
                          : 'bg-[#F5EDFD] text-[#8B5CF6]'
                      }`}
                    >
                      {replyRole}
                    </span>
                    <span className="text-[10px] text-[#7E8B9B]">
                      {new Date(reply.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {canDeleteReply && (
                    <button
                      type="button"
                      onClick={() => handleDelete(reply.id)}
                      className="text-[#7E8B9B] hover:text-[#C2414B] cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <p className="mt-1.5 text-xs text-[#344054] leading-relaxed whitespace-pre-wrap">
                  {reply.body}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply Trigger & Form */}
      {allowReplies && (
        <div className="mt-3 pt-2">
          {!replyOpen ? (
            <button
              type="button"
              onClick={() => setReplyOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:text-[#2554DB] transition-colors cursor-pointer"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
          ) : (
            <form onSubmit={handleReplySubmit} className="mt-2 space-y-2">
              <textarea
                rows={2}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder="Write a reply... (Press Enter to send, Shift+Enter for new line)"
                required
                className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2.5 text-xs text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyBody('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submittingReply}
                  className="flex items-center gap-1.5"
                >
                  <Send className="h-3 w-3" />
                  <span>{submittingReply ? 'Posting...' : 'Post Reply'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
