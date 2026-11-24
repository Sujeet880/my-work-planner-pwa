import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCheck,
  Clock,
  Filter,
  FolderKanban,
  Inbox,
  Layers,
  MessageSquare,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { discussionService } from '../../services/discussionService';
import type {
  InboxConversationItem,
  InboxFilterType,
  ProjectTaskRequest,
} from '../../types/sharing';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges';
import { ReviewTaskRequestModal } from '../../components/sharing/ReviewTaskRequestModal';

export function OwnerClientInboxPage() {
  const { projects } = useWorkspace();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<InboxConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InboxFilterType>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Review modal state
  const [reviewRequest, setReviewRequest] = useState<ProjectTaskRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    loadInbox();
  }, [unreadOnly]);

  const loadInbox = async () => {
    setLoading(true);
    const res = await discussionService.fetchInboxConversations();
    if (res.data) {
      setConversations(res.data);
    }
    setLoading(false);
  };

  const handleConversationClick = async (item: InboxConversationItem) => {
    if (item.type === 'task_request') {
      if (item.taskRequest) {
        setReviewRequest(item.taskRequest);
        setIsReviewModalOpen(true);
      }
      return;
    }

    // Mark as read
    await discussionService.markConversationRead(item.projectId, item.taskId);

    // Navigate to project discussions
    if (item.taskId) {
      navigate(`/projects/${item.projectId}?tab=discussions&taskId=${item.taskId}`);
    } else {
      navigate(`/projects/${item.projectId}?tab=discussions`);
    }
  };

  const handleMarkAllRead = async () => {
    await discussionService.markAllNotificationsAsRead();
    for (const c of conversations) {
      if (c.unreadCount > 0) {
        await discussionService.markConversationRead(c.projectId, c.taskId);
      }
    }
    loadInbox();
  };

  // Filter conversations
  const filteredConversations = conversations.filter((item) => {
    if (selectedProjectId !== 'all' && item.projectId !== selectedProjectId) return false;
    if (unreadOnly && item.unreadCount === 0) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'project_discussions') return item.type === 'project_discussion';
    if (activeTab === 'task_discussions') return item.type === 'task_discussion';
    if (activeTab === 'task_requests') return item.type === 'task_request';
    return true;
  });

  const totalUnread = conversations.filter((c) => c.unreadCount > 0).length;
  const projectDiscussionsCount = conversations.filter((c) => c.type === 'project_discussion').length;
  const taskDiscussionsCount = conversations.filter((c) => c.type === 'task_discussion').length;
  const taskRequestsCount = conversations.filter((c) => c.type === 'task_request').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C]">
            Client Inbox
          </h1>
          <p className="mt-1 text-sm text-[#7E8B9B]">
            Unified inbox for client discussions, deliverable questions, and client task requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-xl border border-[#E9ECF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none cursor-pointer"
            >
              <option value="all">All Shared Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              unreadOnly
                ? 'bg-[#EDF2FE] text-[#2F65F6]'
                : 'bg-white border border-[#E9ECF5] text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            {unreadOnly ? 'Showing Unread' : 'Show All'}
          </button>

          <button
            type="button"
            onClick={loadInbox}
            disabled={loading}
            title="Refresh conversations"
            className="flex items-center gap-1.5 rounded-full border border-[#E9ECF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#7E8B9B] hover:text-[#1A1F2C] transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#2F65F6]' : ''}`} />
            <span>Refresh</span>
          </button>

          {totalUnread > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark All Read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E9ECF5] bg-white px-4 rounded-2xl shadow-sm overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <Inbox className="h-4 w-4" />
          <span>All Conversations</span>
          <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] text-[#7E8B9B]">
            {conversations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('project_discussions')}
          className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'project_discussions'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Project Discussions</span>
          <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] text-[#7E8B9B]">
            {projectDiscussionsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('task_discussions')}
          className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'task_discussions'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Task Discussions</span>
          <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] text-[#7E8B9B]">
            {taskDiscussionsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('task_requests')}
          className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'task_requests'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <PlusCircle className="h-4 w-4" />
          <span>Client Task Requests</span>
          <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] text-[#7E8B9B]">
            {taskRequestsCount}
          </span>
        </button>
      </div>

      {/* Conversations Stream */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#7E8B9B]">Loading client inbox...</div>
      ) : filteredConversations.length === 0 ? (
        <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-8">
          <EmptyState
            icon={<Inbox className="h-6 w-6 text-[#7E8B9B]" />}
            title="No conversations found"
            description="When clients post feedback, discuss deliverables, or request new tasks, they will appear here."
          />
        </div>
      ) : (
        <div className="divide-y divide-[#F0F2F5] rounded-2xl border border-[#E9ECF5] bg-white shadow-sm overflow-hidden">
          {filteredConversations.map((item) => {
            const isRequest = item.type === 'task_request';
            const isTaskDiscussion = item.type === 'task_discussion';
            const isUnread = item.unreadCount > 0;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleConversationClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleConversationClick(item);
                  }
                }}
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 transition-colors cursor-pointer focus:outline-none focus:bg-[#F4F8FE] ${
                  isUnread ? 'bg-[#F4F8FE] hover:bg-[#EBF3FE]' : 'hover:bg-[#F8FAFD]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Icon badge */}
                  <div
                    className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shrink-0 shadow-sm ${
                      isRequest
                        ? 'bg-[#EAF7EE] text-[#16845B]'
                        : isTaskDiscussion
                        ? 'bg-[#EDF2FE] text-[#2F65F6]'
                        : isUnread
                        ? 'bg-[#2F65F6] text-white'
                        : 'bg-[#F0F2F5] text-[#7E8B9B]'
                    }`}
                  >
                    {isRequest ? (
                      <PlusCircle className="h-4 w-4" />
                    ) : isTaskDiscussion ? (
                      <Layers className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Project badge */}
                      <span className="rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[10px] font-bold text-[#2F65F6]">
                        {item.projectName}
                      </span>

                      {/* Type badge */}
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#7E8B9B]">
                        {isRequest
                          ? 'Task Request'
                          : isTaskDiscussion
                          ? 'Task Discussion'
                          : 'Project Discussion'}
                      </span>

                      {/* Task title if task discussion */}
                      {isTaskDiscussion && item.taskTitle && (
                        <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[11px] font-semibold text-[#1A1F2C] truncate max-w-[200px]">
                          Task: {item.taskTitle}
                        </span>
                      )}

                      {/* Unread indicator */}
                      {isUnread && (
                        <span className="flex items-center gap-1 rounded-full bg-[#2F65F6] px-2 py-0.5 text-[10px] font-bold text-white">
                          New
                        </span>
                      )}
                    </div>

                    {/* Sender identity */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-[#1A1F2C]">
                        {item.senderName}
                      </span>
                      {item.senderRole && (
                        <span className="rounded-full bg-[#F0F2F5] px-2 py-0.2 text-[10px] font-medium text-[#7E8B9B]">
                          {item.senderRole}
                        </span>
                      )}
                      <span className="text-[#98A2B3]">·</span>
                      <span className="text-[11px] text-[#7E8B9B]">
                        {new Date(item.lastActivityAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Message snippet */}
                    <p className="text-xs text-[#475467] line-clamp-2">
                      {item.lastMessageSnippet}
                    </p>
                  </div>
                </div>

                {/* Right side action */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isRequest ? (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-[#EAF7EE] px-3 py-1.5 text-xs font-semibold text-[#16845B] hover:bg-[#D5EFE0] transition-colors">
                      Review Request &rarr;
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2F65F6] hover:underline">
                      Open Discussion &rarr;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Task Request Modal */}
      <ReviewTaskRequestModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewRequest(null);
        }}
        request={reviewRequest}
        onRequestUpdated={() => {
          loadInbox();
        }}
      />
    </div>
  );
}
