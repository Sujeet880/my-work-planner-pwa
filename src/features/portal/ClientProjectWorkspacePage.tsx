import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  HelpCircle,
  Layers,
  MessageSquare,
  PlusCircle,
  Shield,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sharingService } from '../../services/sharingService';
import { discussionService } from '../../services/discussionService';
import type {
  SharedProjectView,
  ProjectUpdate,
  ProjectTaskRequest,
} from '../../types/sharing';
import type { Task, Project } from '../../types/models';
import { formatDuration } from '../../lib/timeMath';
import {
  ClientProjectStatusBadge,
  PriorityBadge,
  StatusBadge,
} from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ClientPortalLayout } from './ClientPortalLayout';
import { ProjectDiscussionsView } from '../../components/discussions/ProjectDiscussionsView';
import { RequestTaskModal } from '../../components/sharing/RequestTaskModal';
import { TaskDiscussionModal } from '../../components/discussions/TaskDiscussionModal';

export function ClientProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [project, setProject] = useState<SharedProjectView | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [taskRequests, setTaskRequests] = useState<ProjectTaskRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab navigation
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'discussions' || tabParam === 'updates' || tabParam === 'requests'
      ? tabParam
      : 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'discussions' | 'updates' | 'requests'>(
    initialTab
  );
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');

  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedDiscussionTask, setSelectedDiscussionTask] = useState<Task | null>(null);

  useEffect(() => {
    if (projectId) {
      loadWorkspace();
    }
  }, [projectId]);

  // Handle query param taskId to open discussion
  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    if (taskIdParam && tasks.length > 0) {
      const match = tasks.find((t) => t.id === taskIdParam);
      if (match) {
        setSelectedDiscussionTask(match);
      }
    }
  }, [searchParams, tasks]);

  const loadWorkspace = async () => {
    if (!projectId) return;
    setLoading(true);

    const [projectsRes, tasksRes, updatesRes, requestsRes] = await Promise.all([
      sharingService.getSharedProjectsForUser(),
      sharingService.getClientVisibleTasksForProject(projectId),
      discussionService.getProjectUpdates(projectId),
      discussionService.fetchTaskRequests(projectId),
    ]);

    if (projectsRes.data) {
      const match = projectsRes.data.find((p) => p.id === projectId);
      if (match) setProject(match);
    }
    if (tasksRes.data) setTasks(tasksRes.data);
    if (updatesRes.data) setUpdates(updatesRes.data);
    if (requestsRes.data) setTaskRequests(requestsRes.data);

    setLoading(false);
  };

  if (loading) {
    return (
      <ClientPortalLayout>
        <div className="py-16 text-center text-xs text-[#7E8B9B]">Loading project workspace...</div>
      </ClientPortalLayout>
    );
  }

  if (!project) {
    return (
      <ClientPortalLayout>
        <div className="space-y-4">
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Shared Projects</span>
          </Link>
          <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-8">
            <EmptyState
              icon={<FolderKanban className="h-6 w-6 text-[#7E8B9B]" />}
              title="Project not accessible"
              description="You do not have access to this shared project or it has been unshared."
              action={
                <Link to="/portal">
                  <span className="inline-block rounded-xl bg-[#2F65F6] px-4 py-2 text-xs font-semibold text-white">
                    Return to Shared Projects
                  </span>
                </Link>
              }
            />
          </div>
        </div>
      </ClientPortalLayout>
    );
  }

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const progressPct =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'all') return true;
    return t.status === taskFilter;
  });

  // Construct project object for TaskDiscussionModal
  const projectModel: Project = {
    id: project.id,
    userId: project.userId,
    name: project.name,
    color: project.color,
    description: project.description,
    isArchived: false,
    clientName: null,
    targetCompletionDate: project.targetCompletionDate,
    clientShareEnabled: project.clientShareEnabled,
    clientProjectStatus: project.clientProjectStatus,
    clientAllowComments: project.clientAllowComments,
    clientViewTimeTracking: project.clientViewTimeTracking,
    clientViewRemainingEstimate: project.clientViewRemainingEstimate,
    clientViewTaskDates: project.clientViewTaskDates,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          to="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Shared Projects</span>
        </Link>

        {/* Project Header Card */}
        <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 shrink-0 rounded-full shadow-sm"
                  style={{ backgroundColor: project.color }}
                />
                <h1 className="text-2xl font-bold tracking-tight text-[#1A1F2C] sm:text-3xl">
                  {project.name}
                </h1>
                <ClientProjectStatusBadge status={project.clientProjectStatus} />
              </div>

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

            {/* Request a Task quick button */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsRequestModalOpen(true)}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Request a Task</span>
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mt-6 border-t border-[#F0F2F5] pt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-[#7E8B9B]">Deliverables Progress</span>
              <span className="text-[#1A1F2C]">
                {progressPct}% ({completedTasks.length}/{tasks.length} tasks completed)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
              <div
                className="h-full rounded-full bg-[#2F65F6] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Metrics Chips */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
              <div className="rounded-xl bg-[#F8FAFD] p-3">
                <span className="text-[#7E8B9B]">Total Deliverables</span>
                <p className="mt-0.5 text-sm font-bold text-[#1A1F2C]">{tasks.length}</p>
              </div>
              <div className="rounded-xl bg-[#F8FAFD] p-3">
                <span className="text-[#7E8B9B]">Completed</span>
                <p className="mt-0.5 text-sm font-bold text-[#16845B]">
                  {completedTasks.length}
                </p>
              </div>
              {project.clientViewTimeTracking && (
                <div className="rounded-xl bg-[#F8FAFD] p-3">
                  <span className="text-[#7E8B9B]">Logged Time</span>
                  <p className="mt-0.5 text-sm font-bold text-[#2F65F6]">
                    {formatDuration(project.totalActualSeconds)}
                  </p>
                </div>
              )}
              {project.clientViewRemainingEstimate && project.totalRemainingEstimateMinutes > 0 && (
                <div className="rounded-xl bg-[#F8FAFD] p-3">
                  <span className="text-[#7E8B9B]">Remaining Estimate</span>
                  <p className="mt-0.5 text-sm font-bold text-[#1A1F2C]">
                    {project.totalRemainingEstimateMinutes}m
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E9ECF5] bg-white px-4 rounded-2xl shadow-sm overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 border-b-2 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#2F65F6] text-[#2F65F6]'
                : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            <FolderKanban className="h-4 w-4" />
            <span>Deliverables ({tasks.length})</span>
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
            <span>Task Requests ({taskRequests.length})</span>
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
            <span>Discussions &amp; Questions</span>
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
            <span>Milestone Updates ({updates.length})</span>
          </button>
        </div>

        {/* Tab 1: Deliverables */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Filter buttons & Request Task Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    taskFilter === 'all'
                      ? 'bg-[#EDF2FE] text-[#2F65F6]'
                      : 'bg-white border border-[#E9ECF5] text-[#7E8B9B] hover:text-[#1A1F2C]'
                  }`}
                >
                  All ({tasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('in_progress')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    taskFilter === 'in_progress'
                      ? 'bg-[#EDF2FE] text-[#2F65F6]'
                      : 'bg-white border border-[#E9ECF5] text-[#7E8B9B] hover:text-[#1A1F2C]'
                  }`}
                >
                  In Progress ({tasks.filter((t) => t.status === 'in_progress').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('completed')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    taskFilter === 'completed'
                      ? 'bg-[#EAF7EE] text-[#16845B]'
                      : 'bg-white border border-[#E9ECF5] text-[#7E8B9B] hover:text-[#1A1F2C]'
                  }`}
                >
                  Completed ({completedTasks.length})
                </button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsRequestModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Request Deliverable</span>
              </Button>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-[#E9ECF5] bg-white p-6">
                <EmptyState
                  icon={<FolderKanban className="h-6 w-6 text-[#7E8B9B]" />}
                  title="No deliverables found"
                  description="No tasks match the selected filter."
                />
              </div>
            ) : (
              <div className="divide-y divide-[#F0F2F5] rounded-2xl border border-[#E9ECF5] bg-white shadow-sm overflow-hidden">
                {filteredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F8FAFD] transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="font-semibold text-sm text-[#1A1F2C] truncate block">
                        {t.title}
                      </span>
                      {t.description && (
                        <p className="text-xs text-[#7E8B9B] line-clamp-1">{t.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />

                      {project.clientViewTaskDates && t.scheduledDate && (
                        <span className="text-[11px] text-[#7E8B9B] bg-[#F0F2F5] px-2 py-0.5 rounded-full">
                          {t.scheduledDate}
                        </span>
                      )}

                      {project.clientViewRemainingEstimate &&
                        t.remainingEstimateMinutes !== null &&
                        t.remainingEstimateMinutes !== undefined && (
                          <span className="text-[11px] font-medium text-[#7E8B9B] bg-[#F0F2F5] px-2 py-0.5 rounded-full">
                            Est: {t.remainingEstimateMinutes}m
                          </span>
                        )}

                      {/* Discuss Task button */}
                      <button
                        type="button"
                        onClick={() => setSelectedDiscussionTask(t)}
                        title="Discuss this deliverable"
                        className="flex items-center gap-1.5 rounded-full bg-[#EDF2FE] hover:bg-[#D5E2FD] text-[#2F65F6] px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Discuss</span>
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
                <h3 className="text-sm font-bold text-[#1A1F2C]">Your Deliverable Requests</h3>
                <p className="text-xs text-[#7E8B9B]">
                  Track approval status, feedback, and deliverables created from your requests.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsRequestModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>New Request</span>
              </Button>
            </div>

            {taskRequests.length === 0 ? (
              <div className="rounded-2xl border border-[#E9ECF5] bg-white p-6">
                <EmptyState
                  icon={<PlusCircle className="h-6 w-6 text-[#7E8B9B]" />}
                  title="No task requests submitted yet"
                  description="Need additional deliverables, modifications, or features? Submit a task request for the project owner to review."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsRequestModalOpen(true)}
                      className="flex items-center gap-1.5"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Submit First Request</span>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-[#F0F2F5] rounded-2xl border border-[#E9ECF5] bg-white shadow-sm overflow-hidden">
                {taskRequests.map((req) => {
                  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                    submitted: { bg: 'bg-[#FEF3E2]', text: 'text-[#B7791F]', label: 'Submitted' },
                    under_review: { bg: 'bg-[#EDF2FE]', text: 'text-[#2F65F6]', label: 'Under Review' },
                    needs_information: { bg: 'bg-[#FEF3E2]', text: 'text-[#B7791F]', label: 'Needs Info' },
                    approved: { bg: 'bg-[#EAF7EE]', text: 'text-[#16845B]', label: 'Approved' },
                    rejected: { bg: 'bg-[#FCE8E9]', text: 'text-[#C2414B]', label: 'Rejected' },
                    withdrawn: { bg: 'bg-[#F0F2F5]', text: 'text-[#7E8B9B]', label: 'Withdrawn' },
                  };
                  const statusCfg = statusColors[req.status] || statusColors.submitted;

                  return (
                    <div key={req.id} className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#1A1F2C]">{req.title}</h4>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.bg} ${statusCfg.text}`}
                          >
                            {statusCfg.label}
                          </span>
                          <PriorityBadge priority={req.suggestedPriority} />
                        </div>

                        <span className="text-[11px] text-[#7E8B9B]">
                          Submitted {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {req.description && (
                        <p className="text-xs text-[#475467] leading-relaxed whitespace-pre-wrap">
                          {req.description}
                        </p>
                      )}

                      {req.reason && (
                        <p className="text-xs text-[#7E8B9B] italic">
                          Reason: &ldquo;{req.reason}&rdquo;
                        </p>
                      )}

                      {/* Owner feedback alert */}
                      {req.ownerFeedback && (
                        <div
                          className={`rounded-xl p-3 text-xs leading-relaxed ${
                            req.status === 'needs_information'
                              ? 'bg-[#FEF3E2] border border-[#F6D39D] text-[#975A16]'
                              : req.status === 'rejected'
                              ? 'bg-[#FCE8E9] border border-[#F8B4B7] text-[#9B1C1C]'
                              : 'bg-[#F8FAFD] border border-[#E9ECF5] text-[#344054]'
                          }`}
                        >
                          <span className="font-bold block mb-0.5">Owner Response:</span>
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
            tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
          />
        )}

        {/* Tab 4: Milestone Updates */}
        {activeTab === 'updates' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7E8B9B]">
              Milestone Progress Timeline
            </h3>

            {updates.length === 0 ? (
              <div className="rounded-2xl border border-[#E9ECF5] bg-white p-6">
                <EmptyState
                  icon={<Clock className="h-6 w-6 text-[#7E8B9B]" />}
                  title="No updates yet"
                  description="The project owner will publish milestone updates and status notes here."
                />
              </div>
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
        )}

        {/* Request Task Modal */}
        <RequestTaskModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          projectId={project.id}
          projectName={project.name}
          onRequestSubmitted={loadWorkspace}
        />

        {/* Dedicated Task Discussion Modal */}
        <TaskDiscussionModal
          isOpen={selectedDiscussionTask !== null}
          onClose={() => setSelectedDiscussionTask(null)}
          task={selectedDiscussionTask}
          project={projectModel}
          currentUserId={user?.id || ''}
        />
      </div>
    </ClientPortalLayout>
  );
}
