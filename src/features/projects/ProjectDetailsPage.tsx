import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FolderKanban,
  HelpCircle,
  Layers,
  MessageSquare,
  Pencil,
  Plus,
  PlusCircle,
  RotateCcw,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { calculateSavedWorkSeconds, formatDuration } from '../../lib/timeMath';
import type { Task, Project } from '../../types/models';
import type {
  ClientProjectStatus,
  ProjectUpdate,
  ProjectTaskRequest,
} from '../../types/sharing';
import { discussionService } from '../../services/discussionService';
import {
  ClientProjectStatusBadge,
  ClientVisibilityBadge,
  PriorityBadge,
  StatusBadge,
} from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ShareProjectModal } from '../../components/sharing/ShareProjectModal';
import { ProjectDiscussionsView } from '../../components/discussions/ProjectDiscussionsView';
import { ReviewTaskRequestModal } from '../../components/sharing/ReviewTaskRequestModal';
import { TaskDiscussionModal } from '../../components/discussions/TaskDiscussionModal';

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    projects,
    tasks,
    timeEntries,
    refreshData,
    openCreateTaskDrawer,
    openEditTaskDrawer,
    deleteProject,
    toggleArchiveProject,
  } = useWorkspace();

  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'requests' ||
    tabParam === 'discussions' ||
    tabParam === 'updates' ||
    tabParam === 'access'
      ? tabParam
      : 'tasks';

  const [activeTab, setActiveTab] = useState<'tasks' | 'requests' | 'discussions' | 'updates' | 'access'>(
    initialTab
  );
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  // Task Requests
  const [taskRequests, setTaskRequests] = useState<ProjectTaskRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedReviewRequest, setSelectedReviewRequest] = useState<ProjectTaskRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Task Discussion Modal
  const [discussionTask, setDiscussionTask] = useState<Task | null>(null);

  // New update compose state
  const [newUpdateStatus, setNewUpdateStatus] = useState<ClientProjectStatus>('on_track');
  const [newUpdateMessage, setNewUpdateMessage] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId);
  const projectTasks = tasks.filter((t) => !t.isArchived && t.projectId === project?.id);

  useEffect(() => {
    if (project) {
      setNewUpdateStatus(project.clientProjectStatus || 'on_track');
      loadUpdates();
      loadTaskRequests();
    }
  }, [project?.id]);

  // Handle URL param for taskId discussion
  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    if (taskIdParam && projectTasks.length > 0) {
      const match = projectTasks.find((t) => t.id === taskIdParam);
      if (match) {
        setDiscussionTask(match);
      }
    }
  }, [searchParams, projectTasks]);

  const loadUpdates = async () => {
    if (!project) return;
    setLoadingUpdates(true);
    const res = await discussionService.getProjectUpdates(project.id);
    if (res.data) setUpdates(res.data);
    setLoadingUpdates(false);
  };

  const loadTaskRequests = async () => {
    if (!project) return;
    setLoadingRequests(true);
    const res = await discussionService.fetchTaskRequests(project.id);
    if (res.data) setTaskRequests(res.data);
    setLoadingRequests(false);
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const trimmed = newUpdateMessage.trim();
    if (!trimmed) return;

    setSubmittingUpdate(true);
    setUpdateError(null);

    const res = await discussionService.createProjectUpdate({
      projectId: project.id,
      status: newUpdateStatus,
      message: trimmed,
    });
    setSubmittingUpdate(false);

    if (res.error) {
      setUpdateError(res.error);
    } else {
      setNewUpdateMessage('');
      loadUpdates();
    }
  };

  if (!project) {
    return (
      <div className="space-y-4">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2F65F6] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Projects</span>
        </Link>
        <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-8">
          <EmptyState
            icon={<FolderKanban className="h-6 w-6 text-[#7E8B9B]" />}
            title="Project not found"
            description="This project may have been deleted or does not exist."
            action={
              <Link to="/projects">
                <Button variant="primary">Return to Projects</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const completedTasks = projectTasks.filter((t) => t.status === 'completed');
  const progressPct =
    projectTasks.length > 0
      ? Math.round((completedTasks.length / projectTasks.length) * 100)
      : 0;

  const plannedSeconds = projectTasks.reduce(
    (sum, t) => sum + (t.plannedDurationMinutes ? t.plannedDurationMinutes * 60 : 0),
    0
  );
  const savedActualSeconds = calculateSavedWorkSeconds(
    timeEntries.filter((e) => e.projectId === project.id)
  );

  const clientVisibleCount = projectTasks.filter((t) => t.clientVisible).length;
  const pendingRequestsCount = taskRequests.filter(
    (r) => r.status === 'submitted' || r.status === 'under_review' || r.status === 'needs_information'
  ).length;

  return (
    <div className="space-y-7">
      {/* Back button & top metadata */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Projects</span>
        </Link>

        {/* Project Header Card */}
        <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 shrink-0 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.15)]"
                  style={{ backgroundColor: project.color }}
                />
                <h1 className="text-2xl font-bold tracking-tight text-[#1A1F2C] sm:text-3xl">
                  {project.name}
                </h1>
                <ClientProjectStatusBadge status={project.clientProjectStatus} />
              </div>

              {project.clientName && (
                <p className="text-xs font-semibold text-[#7E8B9B]">
                  Client: <span className="text-[#1A1F2C]">{project.clientName}</span>
                </p>
              )}

              {project.description && (
                <p className="max-w-2xl text-sm text-[#475467] leading-relaxed">
                  {project.description}
                </p>
              )}

              {project.targetCompletionDate && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#7E8B9B]">
                  <Calendar className="h-3.5 w-3.5 text-[#2F65F6]" />
                  <span>Target Date: {new Date(project.targetCompletionDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="flex items-center gap-2 rounded-full border border-[#BDE8C8] bg-[#EAF7EE] px-4 py-2 text-xs font-bold text-[#16845B] shadow-sm hover:bg-[#D4EFE0] transition-all cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>
                  {project.clientShareEnabled ? 'Sharing Active' : 'Share with Client'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openCreateTaskDrawer(project.id)}
                className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#2554DB] transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Metrics & Progress Bar */}
          <div className="mt-6 border-t border-[#F0F2F5] pt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-[#7E8B9B]">Project Completion Progress</span>
              <span className="text-[#1A1F2C]">
                {progressPct}% ({completedTasks.length}/{projectTasks.length} tasks)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
              <div
                className="h-full rounded-full bg-[#2F65F6] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
              <div className="rounded-xl bg-[#F8FAFD] p-3">
                <span className="text-[#7E8B9B]">Total Tasks</span>
                <p className="mt-0.5 text-sm font-bold text-[#1A1F2C]">{projectTasks.length}</p>
              </div>
              <div className="rounded-xl bg-[#F8FAFD] p-3">
                <span className="text-[#7E8B9B]">Client Visible</span>
                <p className="mt-0.5 text-sm font-bold text-[#16845B]">
                  {clientVisibleCount} tasks
                </p>
              </div>
              <div className="rounded-xl bg-[#F8FAFD] p-3">
                <span className="text-[#7E8B9B]">Planned Hours</span>
                <p className="mt-0.5 text-sm font-bold text-[#1A1F2C]">
                  {formatDuration(plannedSeconds)}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8FAFD] p-3">
                <span className="text-[#7E8B9B]">Saved Actual</span>
                <p className="mt-0.5 text-sm font-bold text-[#2F65F6]">
                  {formatDuration(savedActualSeconds)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#E9ECF5] bg-white/70 px-4 backdrop-blur-md rounded-2xl shadow-sm overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 border-b-2 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <FolderKanban className="h-4 w-4" />
          <span>Tasks ({projectTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 border-b-2 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'requests'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <PlusCircle className="h-4 w-4" />
          <span>Task Requests</span>
          {pendingRequestsCount > 0 ? (
            <span className="rounded-full bg-[#2F65F6] px-2 py-0.5 text-[10px] font-bold text-white">
              {pendingRequestsCount} new
            </span>
          ) : (
            <span className="rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] text-[#7E8B9B]">
              {taskRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discussions')}
          className={`flex items-center gap-2 border-b-2 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'discussions'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Discussions &amp; Client Feedback</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('updates')}
          className={`flex items-center gap-2 border-b-2 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'updates'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Client Updates ({updates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 border-b-2 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'access'
              ? 'border-[#2F65F6] text-[#2F65F6]'
              : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Client Access &amp; Permissions</span>
        </button>
      </div>

      {/* Tab 1: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1A1F2C]">Project Task List</h2>
            <button
              type="button"
              onClick={() => openCreateTaskDrawer(project.id)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add task to project</span>
            </button>
          </div>

          {projectTasks.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6 text-[#7E8B9B]" />}
              title="No tasks in this project yet"
              description="Create tasks to organize deliverables and share them selectively with your client."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openCreateTaskDrawer(project.id)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Task</span>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-[#F0F2F5] rounded-2xl border border-[#E9ECF5] bg-white shadow-sm overflow-hidden">
              {projectTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F8FAFD] transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => openEditTaskDrawer(t)}
                      className="text-left font-semibold text-sm text-[#1A1F2C] hover:text-[#2F65F6] truncate cursor-pointer"
                    >
                      {t.title}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <ClientVisibilityBadge clientVisible={t.clientVisible} />

                    {t.remainingEstimateMinutes !== null && t.remainingEstimateMinutes !== undefined && (
                      <span className="text-[11px] font-medium text-[#7E8B9B] bg-[#F0F2F5] px-2 py-0.5 rounded-full">
                        Est: {t.remainingEstimateMinutes}m rem
                      </span>
                    )}

                    {/* Dedicated Task Discussion Button */}
                    <button
                      type="button"
                      onClick={() => setDiscussionTask(t)}
                      className="flex items-center gap-1.5 rounded-full bg-[#F0F2F5] hover:bg-[#EDF2FE] hover:text-[#2F65F6] px-2.5 py-1 text-xs font-semibold text-[#475467] transition-all cursor-pointer"
                      title="Open task discussion"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Discuss</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditTaskDrawer(t)}
                      className="p-1.5 text-[#7E8B9B] hover:text-[#1A1F2C] transition-colors cursor-pointer"
                      title="Edit task"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Task Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1A1F2C]">Client Task Requests</h2>
              <p className="text-xs text-[#7E8B9B]">
                Review deliverable proposals submitted by invited clients and convert them into project tasks.
              </p>
            </div>
          </div>

          {loadingRequests ? (
            <div className="py-12 text-center text-xs text-[#7E8B9B]">Loading task requests...</div>
          ) : taskRequests.length === 0 ? (
            <div className="rounded-2xl border border-[#E9ECF5] bg-white p-6">
              <EmptyState
                icon={<PlusCircle className="h-6 w-6 text-[#7E8B9B]" />}
                title="No task requests submitted"
                description="When your client submits requests for new deliverables or features, they will appear here for your review and approval."
              />
            </div>
          ) : (
            <div className="divide-y divide-[#F0F2F5] rounded-2xl border border-[#E9ECF5] bg-white shadow-sm overflow-hidden">
              {taskRequests.map((req) => {
                const isApproved = req.status === 'approved';
                const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
                  submitted: { bg: 'bg-[#FEF3E2]', text: 'text-[#B7791F]', label: 'Submitted' },
                  under_review: { bg: 'bg-[#EDF2FE]', text: 'text-[#2F65F6]', label: 'Under Review' },
                  needs_information: { bg: 'bg-[#FEF3E2]', text: 'text-[#B7791F]', label: 'Needs Info' },
                  approved: { bg: 'bg-[#EAF7EE]', text: 'text-[#16845B]', label: 'Approved' },
                  rejected: { bg: 'bg-[#FCE8E9]', text: 'text-[#C2414B]', label: 'Rejected' },
                  withdrawn: { bg: 'bg-[#F0F2F5]', text: 'text-[#7E8B9B]', label: 'Withdrawn' },
                };
                const cfg = statusStyles[req.status] || statusStyles.submitted;

                return (
                  <div key={req.id} className="p-4 space-y-3 hover:bg-[#F8FAFD] transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm text-[#1A1F2C]">{req.title}</h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}
                          >
                            {cfg.label}
                          </span>
                          <PriorityBadge priority={req.suggestedPriority} />
                          {req.requestedDueDate && (
                            <span className="text-[11px] text-[#7E8B9B] bg-[#F0F2F5] px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-[#2F65F6]" />
                              Due: {req.requestedDueDate}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#7E8B9B]">
                          Requested by <strong className="text-[#1A1F2C]">{req.requesterName}</strong>
                          {req.requesterEmail && ` (${req.requesterEmail})`} · {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant={isApproved ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => {
                          setSelectedReviewRequest(req);
                          setIsReviewModalOpen(true);
                        }}
                        className="self-start sm:self-center"
                      >
                        {isApproved ? 'View Details' : 'Review & Approve'}
                      </Button>
                    </div>

                    {req.description && (
                      <p className="text-xs text-[#475467] leading-relaxed whitespace-pre-wrap">
                        {req.description}
                      </p>
                    )}

                    {req.reason && (
                      <p className="text-xs text-[#7E8B9B] italic">
                        Context: &ldquo;{req.reason}&rdquo;
                      </p>
                    )}

                    {req.ownerFeedback && (
                      <div className="rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-2.5 text-xs text-[#344054]">
                        <span className="font-semibold block mb-0.5">Your Feedback to Client:</span>
                        <p>{req.ownerFeedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Discussions */}
      {activeTab === 'discussions' && (
        <ProjectDiscussionsView
          projectId={project.id}
          projectName={project.name}
          projectOwnerId={project.userId}
          currentUserId={user?.id || ''}
          allowComments={project.clientAllowComments ?? true}
          tasks={projectTasks.map((t) => ({ id: t.id, title: t.title }))}
        />
      )}

      {/* Tab 4: Updates */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          {/* Post Client Update Form */}
          <form
            onSubmit={handlePostUpdate}
            className="rounded-2xl border border-[#E9ECF5] bg-white p-5 shadow-sm space-y-4"
          >
            <h3 className="text-sm font-bold text-[#1A1F2C]">Post Client Status Update</h3>
            <p className="text-xs text-[#7E8B9B]">
              Broadcast an official milestone update or status change to the client portal.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#1A1F2C]">Project Status</label>
                <select
                  value={newUpdateStatus}
                  onChange={(e) => setNewUpdateStatus(e.target.value as ClientProjectStatus)}
                  className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] px-3 py-2 text-xs font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:bg-white focus:outline-none"
                >
                  <option value="on_track">On Track</option>
                  <option value="at_risk">At Risk</option>
                  <option value="delayed">Delayed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1F2C]">Update Message</label>
              <textarea
                rows={3}
                value={newUpdateMessage}
                onChange={(e) => setNewUpdateMessage(e.target.value)}
                placeholder="We have finished designing the first version of the wireframes and moved onto core API integration..."
                required
                className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-xs text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
              />
            </div>

            {updateError && (
              <p className="text-xs text-[#C2414B] font-medium">{updateError}</p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submittingUpdate}
                className="flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submittingUpdate ? 'Publishing...' : 'Publish Update'}</span>
              </Button>
            </div>
          </form>

          {/* Timeline of Updates */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7E8B9B] mb-3">
              Historical Timeline
            </h3>

            {loadingUpdates ? (
              <div className="py-6 text-center text-xs text-[#7E8B9B]">Loading updates...</div>
            ) : updates.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-6 w-6 text-[#7E8B9B]" />}
                title="No updates published yet"
                description="Publish an update above to keep your clients informed of milestone progress."
              />
            ) : (
              <div className="relative border-l-2 border-[#E9ECF5] pl-6 space-y-6">
                {updates.map((up) => (
                  <div key={up.id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2F65F6] shadow-sm" />
                    <div className="rounded-2xl border border-[#E9ECF5] bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <ClientProjectStatusBadge status={up.status} />
                        <span className="text-[11px] text-[#7E8B9B]">
                          {new Date(up.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs text-[#344054] leading-relaxed whitespace-pre-wrap">
                        {up.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Access */}
      {activeTab === 'access' && (
        <div className="rounded-2xl border border-[#E9ECF5] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1A1F2C]">Client Access &amp; Collaboration</h3>
              <p className="text-xs text-[#7E8B9B]">
                Configure sharing options, invite new clients, or revoke access.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Manage Sharing</span>
            </Button>
          </div>

          <div className="rounded-xl bg-[#F8FAFD] p-4 text-xs text-[#475467] space-y-2">
            <p>
              <strong>Portal Sharing:</strong> {project.clientShareEnabled ? 'Enabled' : 'Disabled'}
            </p>
            <p>
              <strong>Client Comments:</strong>{' '}
              {project.clientAllowComments ? 'Allowed' : 'Disallowed'}
            </p>
            <p>
              <strong>Show Tracked Hours:</strong>{' '}
              {project.clientViewTimeTracking ? 'Yes' : 'Hidden'}
            </p>
            <p>
              <strong>Show Remaining Estimates:</strong>{' '}
              {project.clientViewRemainingEstimate ? 'Yes' : 'Hidden'}
            </p>
          </div>
        </div>
      )}

      {/* Share Project Modal */}
      <ShareProjectModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        project={project}
      />

      {/* Dedicated Task Discussion Modal */}
      <TaskDiscussionModal
        isOpen={discussionTask !== null}
        onClose={() => setDiscussionTask(null)}
        task={discussionTask}
        project={project}
        currentUserId={user?.id || ''}
      />

      {/* Review Task Request Modal */}
      <ReviewTaskRequestModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedReviewRequest(null);
        }}
        request={selectedReviewRequest}
        onRequestUpdated={async () => {
          await loadTaskRequests();
          await refreshData();
        }}
      />
    </div>
  );
}
