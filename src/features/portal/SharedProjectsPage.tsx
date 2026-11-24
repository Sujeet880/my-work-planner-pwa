import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  FolderKanban,
  MessageSquare,
  Shield,
  User,
} from 'lucide-react';
import { sharingService } from '../../services/sharingService';
import type { SharedProjectView } from '../../types/sharing';
import { formatDuration } from '../../lib/timeMath';
import { ClientProjectStatusBadge } from '../../components/ui/Badges';
import { EmptyState } from '../../components/ui/EmptyState';
import { ClientPortalLayout } from './ClientPortalLayout';

export function SharedProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<SharedProjectView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSharedProjects();
  }, []);

  const loadSharedProjects = async () => {
    setLoading(true);
    const res = await sharingService.getSharedProjectsForUser();
    if (res.data) {
      setProjects(res.data);
    }
    setLoading(false);
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C]">
            Shared Projects
          </h1>
          <p className="mt-1 text-sm text-[#7E8B9B]">
            Projects shared with you for collaboration, deliverable review, and milestone tracking.
          </p>
        </div>

        {/* Loading / Projects Grid */}
        {loading ? (
          <div className="py-12 text-center text-xs text-[#7E8B9B]">
            Loading shared projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-8">
            <EmptyState
              icon={<FolderKanban className="h-6 w-6 text-[#2F65F6]" />}
              title="No shared projects yet"
              description="When a project owner invites you to collaborate on their project, it will appear here."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {projects.map((project) => {
              const totalTasks = project.clientVisibleTaskCount;
              const completedTasks = project.completedClientVisibleTaskCount;
              const progressPct =
                totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return (
                <article
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/portal/projects/${project.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/portal/projects/${project.id}`);
                    }
                  }}
                  className="flex flex-col justify-between rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] hover:border-[#2F65F6]/50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2F65F6]"
                >
                  <div className="space-y-4">
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
                          style={{ backgroundColor: project.color }}
                        />
                        <Link
                          to={`/portal/projects/${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-lg font-bold text-[#1A1F2C] hover:text-[#2F65F6] transition-colors"
                        >
                          {project.name}
                        </Link>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <ClientProjectStatusBadge status={project.clientProjectStatus} />
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-sm text-[#475467] leading-relaxed line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    {project.targetCompletionDate && (
                      <div className="flex items-center gap-1.5 text-xs text-[#7E8B9B]">
                        <Calendar className="h-3.5 w-3.5 text-[#2F65F6]" />
                        <span>
                          Target: {new Date(project.targetCompletionDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#7E8B9B]">Progress</span>
                        <span className="text-[#1A1F2C]">
                          {progressPct}% ({completedTasks}/{totalTasks} tasks)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
                        <div
                          className="h-full rounded-full bg-[#2F65F6] transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Metrics & Workspace Button */}
                  <div className="mt-6 border-t border-[#F0F2F5] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs">
                        {project.clientViewTimeTracking && (
                          <div>
                            <span className="text-[#7E8B9B]">Tracked:</span>{' '}
                            <strong className="text-[#1A1F2C]">
                              {formatDuration(project.totalActualSeconds)}
                            </strong>
                          </div>
                        )}
                        {project.clientViewRemainingEstimate && project.totalRemainingEstimateMinutes > 0 && (
                          <div>
                            <span className="text-[#7E8B9B]">Est. Rem:</span>{' '}
                            <strong className="text-[#1A1F2C]">
                              {project.totalRemainingEstimateMinutes}m
                            </strong>
                          </div>
                        )}
                      </div>

                      <Link
                        to={`/portal/projects/${project.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#EDF2FE] px-3.5 py-1.5 text-xs font-semibold text-[#2F65F6] hover:bg-[#D5E2FD] transition-all"
                      >
                        <span>Open Workspace</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ClientPortalLayout>
  );
}
