import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Bell, FolderKanban, Pencil, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { calculateSavedWorkSeconds, formatDuration } from '../../lib/timeMath';
import type { Project } from '../../types/models';
import { ClientProjectStatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { FieldWrapper, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ShareProjectModal } from '../../components/sharing/ShareProjectModal';

const COLOR_OPTIONS = [
  { hex: '#2F65F6', label: 'Electric Blue' },
  { hex: '#16845B', label: 'Forest Green' },
  { hex: '#E67E22', label: 'Warm Amber' },
  { hex: '#3B82F6', label: 'Sky Blue' },
  { hex: '#8B5CF6', label: 'Violet Purple' },
  { hex: '#EC4899', label: 'Rose Pink' },
  { hex: '#7E8B9B', label: 'Neutral Slate' },
];

export function ProjectsPage() {
  const { projects, tasks, timeEntries, saveProject, toggleArchiveProject, deleteProject } = useWorkspace();

  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sharingProject, setSharingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2F65F6');
  const [nameError, setNameError] = useState<string | null>(null);

  const visibleProjects = projects.filter((p) => (showArchived ? p.isArchived : !p.isArchived));

  const openNewProject = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setColor('#2F65F6');
    setNameError(null);
    setModalOpen(true);
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description ?? '');
    setColor(project.color);
    setNameError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Project or client name is required.');
      return;
    }
    saveProject({
      id: editingProject?.id,
      name,
      description,
      color,
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C] sm:text-4xl">
            Projects &amp; Clients
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            Organize tasks and track planned versus saved actual hours across client initiatives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-full border border-[#E9ECF5] bg-white/80 p-1 backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                !showArchived
                  ? 'bg-[#EDF2FE] text-[#2F65F6]'
                  : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                showArchived
                  ? 'bg-[#EDF2FE] text-[#2F65F6]'
                  : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
              }`}
            >
              Archived
            </button>
          </div>

          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E9ECF5] bg-white text-[#1A1F2C] shadow-sm hover:bg-[#F8FAFD] transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#2F65F6] ring-2 ring-white" />
          </button>

          <button
            type="button"
            onClick={openNewProject}
            className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_6px_20px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Project Grid */}
      {visibleProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6 text-[#2F65F6]" />}
          title={showArchived ? 'No archived projects' : 'No active projects yet'}
          description={
            showArchived
              ? 'Archived projects remain available here while preserving historical time logs.'
              : 'Create a project or client to organize tasks and filter reports.'
          }
          action={
            !showArchived && (
              <Button variant="primary" size="md" onClick={openNewProject}>
                <Plus className="h-4 w-4" />
                <span>Create Project</span>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {visibleProjects.map((project) => {
            const projectTasks = tasks.filter((t) => !t.isArchived && t.projectId === project.id);
            const activeTaskCount = projectTasks.filter((t) => t.status !== 'completed').length;
            const completedCount = projectTasks.filter((t) => t.status === 'completed').length;
            const plannedSeconds = projectTasks.reduce(
              (sum, t) => sum + (t.plannedDurationMinutes ? t.plannedDurationMinutes * 60 : 0),
              0
            );
            const savedActualSeconds = calculateSavedWorkSeconds(
              timeEntries.filter((e) => e.projectId === project.id)
            );

            return (
              <article
                key={project.id}
                className="flex flex-col justify-between rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.12)]"
                        style={{ backgroundColor: project.color }}
                        aria-hidden="true"
                      />
                      <Link
                        to={`/projects/${project.id}`}
                        className="truncate text-lg font-semibold text-[#1A1F2C] hover:text-[#2F65F6] transition-colors"
                      >
                        {project.name}
                      </Link>
                      <ClientProjectStatusBadge status={project.clientProjectStatus} />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Share ${project.name}`}
                        onClick={() => setSharingProject(project)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#16845B] hover:bg-[#EAF7EE] transition-colors"
                        title="Share project with client"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => openEditProject(project)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F4F7FD] hover:text-[#1A1F2C] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={
                          project.isArchived
                            ? `Restore ${project.name}`
                            : `Archive ${project.name}`
                        }
                        onClick={() => toggleArchiveProject(project.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F4F7FD] hover:text-[#1A1F2C] transition-colors"
                      >
                        {project.isArchived ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete project "${project.name}"? Any associated tasks will be kept and unassigned.`
                            )
                          ) {
                            deleteProject(project.id);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="mt-2.5 text-sm text-[#7E8B9B] leading-relaxed line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>

                <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-[#F0F2F5] pt-4 text-xs">
                  <div>
                    <dt className="font-medium text-[#7E8B9B]">Tasks</dt>
                    <dd className="mt-1 font-semibold text-[#1A1F2C] tabular-nums-strict">
                      {activeTaskCount} open · {completedCount} done
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[#7E8B9B]">Planned</dt>
                    <dd className="mt-1 font-semibold text-[#1A1F2C] tabular-nums-strict">
                      {formatDuration(plannedSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[#7E8B9B]">Saved Actual</dt>
                    <dd className="mt-1 font-semibold text-[#2F65F6] tabular-nums-strict">
                      {formatDuration(savedActualSeconds)}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProject ? 'Edit Project' : 'Create New Project'}
        description="Use projects to organize client work, initiatives, or personal categories."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="project-form">
              {editingProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FieldWrapper
            id="project-name"
            label="Project / Client Name"
            required
            error={nameError ?? undefined}
          >
            <Input
              id="project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g., Raasta"
              hasError={Boolean(nameError)}
              autoFocus
            />
          </FieldWrapper>

          <FieldWrapper id="project-desc" label="Description (Optional)">
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of work under this project..."
            />
          </FieldWrapper>

          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
              Accent Color
            </span>
            <div className="flex flex-wrap gap-2.5">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.hex}
                  type="button"
                  aria-label={opt.label}
                  aria-pressed={color === opt.hex}
                  onClick={() => setColor(opt.hex)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                    color === opt.hex
                      ? 'border-[#2F65F6] ring-4 ring-[#2F65F6]/20 scale-105'
                      : 'border-[#E9ECF5] hover:scale-105'
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: opt.hex }}
                  />
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Share Project Modal */}
      {sharingProject && (
        <ShareProjectModal
          isOpen={Boolean(sharingProject)}
          onClose={() => setSharingProject(null)}
          project={sharingProject}
        />
      )}
    </div>
  );
}
