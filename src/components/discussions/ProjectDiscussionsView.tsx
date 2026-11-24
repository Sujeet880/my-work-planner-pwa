import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Layers,
  MessageSquare,
  MessageSquareQuote,
  Radio,
  RefreshCw,
  Send,
  WifiOff,
} from 'lucide-react';
import type { ProjectComment } from '../../types/sharing';
import {
  discussionService,
  type RealtimeConnectionStatus,
} from '../../services/discussionService';
import { CommentThread } from './CommentThread';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

interface ProjectDiscussionsViewProps {
  projectId: string;
  projectName?: string;
  projectOwnerId: string;
  currentUserId: string;
  taskId?: string;
  taskTitle?: string;
  allowComments?: boolean;
  tasks?: Array<{ id: string; title: string }>;
}

export function ProjectDiscussionsView({
  projectId,
  projectName = 'Project',
  projectOwnerId,
  currentUserId,
  taskId,
  taskTitle,
  allowComments = true,
  tasks = [],
}: ProjectDiscussionsViewProps) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('connecting');
  const [filterState, setFilterState] = useState<'all' | 'active' | 'resolved'>('all');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>(taskId || 'all');

  // New comment compose
  const [newCommentBody, setNewCommentBody] = useState('');
  const [newCommentTaskId, setNewCommentTaskId] = useState<string>(taskId || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isTaskDiscussion = Boolean(taskId);
  const activeTaskTitle = taskTitle || tasks.find((t) => t.id === taskId)?.title;

  const loadComments = async () => {
    const res = await discussionService.getCommentsForProject(projectId, taskId);
    if (res.data) {
      setComments(res.data);
    }
    setLoading(false);
    // Mark as read for this user
    discussionService.markConversationRead(projectId, taskId).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    loadComments();

    if (taskId) {
      setSelectedTaskFilter(taskId);
      setNewCommentTaskId(taskId);
    }

    // Subscribe to realtime updates for instant two-way messaging
    const unsubscribe = discussionService.subscribeToComments(
      projectId,
      () => {
        loadComments();
      },
      (status) => {
        setRealtimeStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [projectId, taskId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCommentBody.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setErrorMsg(null);

    const res = await discussionService.createComment({
      projectId,
      body: trimmed,
      taskId: taskId || (newCommentTaskId ? newCommentTaskId : undefined),
    });
    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setNewCommentBody('');
      if (!taskId) setNewCommentTaskId('');
      loadComments();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePostComment(e);
    }
  };

  // Filtered comments
  const visibleComments = comments.filter((c) => {
    if (filterState === 'active' && c.resolvedAt) return false;
    if (filterState === 'resolved' && !c.resolvedAt) return false;
    if (!taskId && selectedTaskFilter !== 'all') {
      if (selectedTaskFilter === 'general') {
        if (c.taskId !== null) return false;
      } else if (c.taskId !== selectedTaskFilter) {
        return false;
      }
    }
    return true;
  });

  const activeCount = comments.filter((c) => !c.resolvedAt).length;
  const resolvedCount = comments.filter((c) => Boolean(c.resolvedAt)).length;

  return (
    <div className="space-y-6">
      {/* Context Discussion Header */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[#E9ECF5] bg-gradient-to-r from-white via-[#F8FAFD] to-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EDF2FE] text-[#2F65F6]">
              {isTaskDiscussion ? <Layers className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1F2C]">
                {isTaskDiscussion ? `Task Discussion: ${activeTaskTitle || 'Task'}` : `Project Discussion`}
              </h2>
              <p className="text-[11px] text-[#7E8B9B]">
                {isTaskDiscussion
                  ? `Parent Project: ${projectName} · Task-specific thread`
                  : `${projectName} · Shared project-wide conversation`}
              </p>
            </div>
          </div>

          {/* Connection state UI */}
          {realtimeStatus === 'connected' && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#16845B] bg-[#EAF7EE] px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-[#16845B] animate-pulse" />
              <span>Connected</span>
            </div>
          )}

          {realtimeStatus === 'connecting' && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2F65F6] bg-[#EDF2FE] px-2.5 py-1 rounded-full">
              <RefreshCw className="h-3 w-3 animate-spin text-[#2F65F6]" />
              <span>Connecting...</span>
            </div>
          )}

          {realtimeStatus === 'reconnecting' && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#B7791F] bg-[#FEF3E2] px-2.5 py-1 rounded-full">
              <RefreshCw className="h-3 w-3 animate-spin text-[#B7791F]" />
              <span>Reconnecting...</span>
            </div>
          )}

          {realtimeStatus === 'offline' && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#667085] bg-[#F0F2F5] px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-[#98A2B3]" />
              <span>Offline</span>
            </div>
          )}

          {realtimeStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C2414B] bg-[#FCE8E9] px-2.5 py-1 rounded-full">
              <AlertCircle className="h-3 w-3 text-[#C2414B]" />
              <span>Connection Error</span>
              <button
                type="button"
                onClick={() => {
                  setRealtimeStatus('connecting');
                  loadComments();
                }}
                className="underline font-bold ml-1 hover:text-[#9B1C1C] cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E9ECF5] pb-4">
        <div className="inline-flex rounded-full border border-[#E9ECF5] bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setFilterState('all')}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filterState === 'all'
                ? 'bg-[#EDF2FE] text-[#2F65F6]'
                : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            All ({comments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('active')}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filterState === 'active'
                ? 'bg-[#EDF2FE] text-[#2F65F6]'
                : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('resolved')}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              filterState === 'resolved'
                ? 'bg-[#EAF7EE] text-[#16845B]'
                : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Task filter (if on project-level view) */}
        {!taskId && tasks.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[#7E8B9B]" />
            <select
              value={selectedTaskFilter}
              onChange={(e) => setSelectedTaskFilter(e.target.value)}
              className="rounded-xl border border-[#E9ECF5] bg-white px-3 py-1 text-xs font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none"
            >
              <option value="all">All Messages (Project &amp; Tasks)</option>
              <option value="general">Project Discussion Only</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  Task: {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* New Comment Compose Box */}
      {allowComments ? (
        <form
          onSubmit={handlePostComment}
          className="rounded-2xl border border-[#E9ECF5] bg-gradient-to-b from-white to-[#F8FAFD] p-4 shadow-[0_4px_18px_rgba(25,45,100,0.02)]"
        >
          <div className="flex items-center justify-between mb-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#1A1F2C]">
              <MessageSquareQuote className="h-4 w-4 text-[#2F65F6]" />
              <span>
                {isTaskDiscussion ? `Reply in ${activeTaskTitle}` : 'Post in project discussion'}
              </span>
            </div>
            <span className="text-[11px] text-[#98A2B3]">Press Enter to send, Shift+Enter for new line</span>
          </div>

          <textarea
            rows={3}
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTaskDiscussion
                ? `Write a message about "${activeTaskTitle}"...`
                : 'Type your message, milestone feedback, or question for the project...'
            }
            required
            className="w-full rounded-xl border border-[#E9ECF5] bg-white p-3 text-sm text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {!taskId && tasks.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#7E8B9B]">Attach to task:</span>
                <select
                  value={newCommentTaskId}
                  onChange={(e) => setNewCommentTaskId(e.target.value)}
                  className="rounded-lg border border-[#E9ECF5] bg-white px-2.5 py-1 text-xs text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none"
                >
                  <option value="">(None - General Project Discussion)</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {errorMsg && <span className="text-xs text-[#C2414B] font-medium">{errorMsg}</span>}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting || !newCommentBody.trim()}
                className="flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submitting ? 'Sending...' : 'Send Message'}</span>
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-xs text-[#7E8B9B] italic text-center">
          Comments and discussions are currently disabled for this project by the owner.
        </div>
      )}

      {/* Discussion Message Stream */}
      {loading ? (
        <div className="py-8 text-center text-xs text-[#7E8B9B]">Loading messages...</div>
      ) : visibleComments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6 text-[#7E8B9B]" />}
          title={filterState === 'all' ? 'No messages yet' : `No ${filterState} messages`}
          description={
            filterState === 'all'
              ? isTaskDiscussion
                ? 'Send a question or deliverable note above to start this task discussion.'
                : 'Post a question or milestone update above to start the project discussion.'
              : 'Switch filters to view all comments in this conversation.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              projectOwnerId={projectOwnerId}
              projectId={projectId}
              allowReplies={allowComments}
              onCommentUpdated={loadComments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
