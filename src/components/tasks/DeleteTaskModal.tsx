import { Archive, CalendarX2, History, RotateCcw } from 'lucide-react';
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
      title="Move Task to Archive?"
      description=""
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={closeDeleteTaskModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={confirmDeleteTask}
            className="shadow-sm bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Archive className="h-4 w-4 mr-1.5" />
            Move to Archive
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Archive className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-[#1A1F2C] break-words">
              {taskPendingDelete.title}
            </h4>
            <p className="mt-1 text-xs text-[#7E8B9B]">
              This task will be moved to your Archive and removed from your active task lists and calendar.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3.5 text-xs text-[#4A5568]">
          <div className="flex items-start gap-2">
            <CalendarX2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2F65F6]" />
            <span>
              <strong>Calendar cleanup:</strong> Future scheduled time blocks will be removed from your active schedule, while historical calendar records remain intact.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>
              <strong>Work session safety:</strong> All previously completed work sessions and time entries remain safely preserved in reports.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
            <span>
              <strong>Restorable:</strong> You can view or restore this task at any time from the Archived tab in My Tasks.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
