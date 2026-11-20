import React, { useState } from 'react';
import { Archive, FolderKanban, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { calculateSavedWorkSeconds, formatDuration } from '../../lib/timeMath';
import type { Project } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { FieldWrapper, Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';

const COLOR_OPTIONS = [
  { hex: '#4968D6', label: 'Slate Blue' },
  { hex: '#16845B', label: 'Forest Green' },
  { hex: '#B7791F', label: 'Warm Amber' },
  { hex: '#3574B8', label: 'Calm Sky' },
  { hex: '#C2414B', label: 'Muted Crimson' },
  { hex: '#667085', label: 'Neutral Slate' },
];

export function ProjectsPage() {
  const { projects, tasks, timeEntries, saveProject, toggleArchiveProject } = useWorkspace();

  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4968D6');
  const [nameError, setNameError] = useState<string | null>(null);

  const visibleProjects = projects.filter((p) => (showArchived ? p.isArchived : !p.isArchived));

  const openNewProject = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setColor('#4968D6');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
            Organize / Projects &amp; Clients
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#202531]">
            Projects &amp; Clients
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Group tasks and track planned versus saved actual hours across clients and personal areas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Show Active' : 'Show Archived'}
          </Button>
          <Button variant="primary" size="md" onClick={openNewProject}>
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Project Grid */}
      {visibleProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title={showArchived ? 'No archived projects' : 'No active projects yet'}
          description={
            showArchived
              ? 'Archived projects remain available here while preserving historical time logs.'
              : 'Create a project or client to organize tasks and filter reports.'
          }
          action={
            !showArchived && (
              <Button variant="primary" size="sm" onClick={openNewProject}>
                <Plus className="h-4 w-4" />
                <span>Create Project</span>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                className="flex flex-col justify-between rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden="true"
                      />
                      <h2 className="truncate text-base font-semibold text-[#202531]">
                        {project.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${project.name}`}
                        onClick={() => openEditProject(project)}
                        className="px-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={
                          project.isArchived
                            ? `Restore ${project.name}`
                            : `Archive ${project.name}`
                        }
                        onClick={() => toggleArchiveProject(project.id)}
                        className="px-2"
                      >
                        {project.isArchived ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="mt-2 text-sm text-[#667085]">{project.description}</p>
                  )}
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[#F0F2F5] pt-4 text-xs">
                  <div>
                    <dt className="text-[#667085]">Tasks</dt>
                    <dd className="mt-1 font-semibold text-[#202531] tabular-nums-strict">
                      {activeTaskCount} open · {completedCount} done
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#667085]">Planned</dt>
                    <dd className="mt-1 font-semibold text-[#202531] tabular-nums-strict">
                      {formatDuration(plannedSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#667085]">Saved Actual</dt>
                    <dd className="mt-1 font-semibold text-[#4968D6] tabular-nums-strict">
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

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-[#202531]">Accent Color</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.hex}
                  type="button"
                  aria-label={opt.label}
                  aria-pressed={color === opt.hex}
                  onClick={() => setColor(opt.hex)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border cursor-pointer ${
                    color === opt.hex
                      ? 'border-[#202531] ring-2 ring-[#7895F2]/40'
                      : 'border-[#E4E7EC]'
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
    </div>
  );
}
