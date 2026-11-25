import { AlertTriangle, CalendarX2, History } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function DeleteTaskModal() {
  const { deleteTaskModalOpen, taskPendingDelete, closeDeleteTaskModal, confirmDeleteTask } =
    useWorkspace();

  if (!taskPendingDelete) return null;

  return (
    <Modal
      open={deleteTaskModalOpen}
      onClose={closeDeleteTaskModal}
      title="Delete Task?"
      description=""
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={closeDeleteTaskModal}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmDeleteTask}
            className="shadow-sm"
          >
            Delete Task
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-[#1A1F2C] break-words">
              {taskPendingDelete.title}
            </h4>
            <p className="mt-1 text-xs text-[#7E8B9B]">
              Are you sure you want to permanently delete this task?
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3.5 text-xs text-[#4A5568]">
          <div className="flex items-start gap-2">
            <CalendarX2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2F65F6]" />
            <span>
              <strong>Calendar cleanup:</strong> All scheduled calendar time blocks allocated for this task will be removed.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>
              <strong>Work session safety:</strong> All previously completed work sessions and time entries remain preserved in your reports.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
