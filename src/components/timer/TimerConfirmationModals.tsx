import { useWorkspace } from '../../context/WorkspaceContext';
import { formatClockHHMMSS } from '../../lib/timeMath';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function TimerConfirmationModals() {
  const {
    pendingSwitch,
    cancelTimerSwitch,
    confirmSaveAndSwitch,
    pendingCompleteWithTimer,
    cancelCompleteWithTimer,
    confirmStopSaveAndComplete,
    activeTask,
    activeElapsedSeconds,
    tasks,
  } = useWorkspace();

  const targetSwitchTask = pendingSwitch
    ? tasks.find((t) => t.id === pendingSwitch.targetTaskId)
    : null;

  const targetCompleteTask = pendingCompleteWithTimer
    ? tasks.find((t) => t.id === pendingCompleteWithTimer.taskId)
    : null;

  return (
    <>
      {/* PRD §9.4: Save & Switch Active Timer Confirmation */}
      <Modal
        open={Boolean(pendingSwitch)}
        onClose={cancelTimerSwitch}
        title="Switch Active Timer?"
        description="Only one task timer can run at a time. Switching will save your current work session before starting the new task."
        footer={
          <>
            <Button variant="secondary" onClick={cancelTimerSwitch}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmSaveAndSwitch}>
              Save &amp; Switch
            </Button>
          </>
        }
      >
        <div className="space-y-2.5 rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#667085]">Current active task</span>
            <span className="font-mono text-xs font-semibold text-[#4968D6] tabular-nums-strict">
              {formatClockHHMMSS(activeElapsedSeconds)}
            </span>
          </div>
          <p className="font-medium text-[#202531]">{activeTask?.title ?? 'Current task'}</p>
          <div className="border-t border-[#E4E7EC] pt-2.5">
            <span className="text-xs text-[#667085]">Switching to</span>
            <p className="mt-0.5 font-medium text-[#202531]">
              {targetSwitchTask?.title ?? 'Selected task'}
            </p>
          </div>
        </div>
      </Modal>

      {/* PRD §8.3: Complete Task While Timer Active Confirmation */}
      <Modal
        open={Boolean(pendingCompleteWithTimer)}
        onClose={cancelCompleteWithTimer}
        title="Complete Task With Active Timer?"
        description="This task currently has an active work session. Completing it will stop the timer and save the elapsed duration to your time logs."
        footer={
          <>
            <Button variant="secondary" onClick={cancelCompleteWithTimer}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmStopSaveAndComplete}>
              Stop, Save &amp; Complete
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3.5 text-sm">
          <p className="font-medium text-[#202531]">{targetCompleteTask?.title}</p>
          <p className="mt-1 text-xs text-[#667085] tabular-nums-strict">
            Elapsed session to be saved:{' '}
            <strong className="font-semibold text-[#202531]">
              {formatClockHHMMSS(activeElapsedSeconds)}
            </strong>
          </p>
        </div>
      </Modal>
    </>
  );
}
