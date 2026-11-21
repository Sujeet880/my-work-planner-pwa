# Timer Operations & PostgreSQL RPC Specification — My Work Planner

This document details the atomic state transitions, PostgreSQL RPC functions, and error recovery behavior of the timer system in **My Work Planner**.

---

## 1. Atomic Database Functions (RPCs)

All multi-table timer operations are executed inside PostgreSQL stored procedures defined in `supabase/migrations/20261121000002_timer_rpc_operations.sql`.

Each function:
- Runs as `SECURITY DEFINER` with `SET search_path = public`.
- Validates that `auth.uid()` is NOT NULL.
- Uses `FOR UPDATE` row locking on `active_timers` to eliminate race conditions and double clicks.
- Verifies that the task belongs to the authenticated user.
- Employs PostgreSQL `now()` to ensure authoritative server timestamps.

```
+---------------------------------------------------------------------------------------+
| Function                                  | Parameters          | Return Type | Grant |
+---------------------------------------------------------------------------------------+
| public.rpc_start_timer                    | p_task_id uuid      | jsonb       | auth  |
| public.rpc_pause_timer                    | (none)              | jsonb       | auth  |
| public.rpc_resume_timer                   | (none)              | jsonb       | auth  |
| public.rpc_stop_timer                     | (none)              | jsonb       | auth  |
| public.rpc_switch_timer                   | p_new_task_id uuid  | jsonb       | auth  |
| public.rpc_complete_task_with_timer       | p_task_id uuid      | jsonb       | auth  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Operation Specifications

### 2.1 Start Timer (`rpc_start_timer`)
- **Preconditions**:
  - User is authenticated.
  - Task exists, belongs to user, and is unarchived.
- **Logic**:
  1. If user already has an active timer:
     - If on the same task and paused: updates `state = 'running'`, `segment_started_at = now()`. Returns `action: 'resumed'`.
     - If on the same task and running: returns `action: 'already_running'`.
     - If on a different task: throws error `'Another task timer is already active. Please switch or stop first.'`.
  2. If no active timer:
     - Inserts into `active_timers` (`state = 'running'`, `segment_started_at = now()`).
     - If task status is `'todo'`, updates it to `'in_progress'`.
     - Returns `action: 'started'`.

### 2.2 Pause Timer (`rpc_pause_timer`)
- **Preconditions**: Active timer exists with `state = 'running'`.
- **Logic**:
  1. Computes segment duration: `greatest(1, round(extract(epoch from (now() - segment_started_at))))`.
  2. Inserts completed row into `work_sessions` (`entry_type = 'automatic'`).
  3. Updates `active_timers`: `state = 'paused'`, `segment_started_at = NULL`.
  4. Returns `action: 'paused'`, `duration_seconds`, and `session_id`.

### 2.3 Resume Timer (`rpc_resume_timer`)
- **Preconditions**: Active timer exists with `state = 'paused'`.
- **Logic**:
  1. Sets `active_timers`: `state = 'running'`, `segment_started_at = now()`.
  2. Previous saved work sessions remain intact in `work_sessions`.
  3. Returns `action: 'resumed'`.

### 2.4 Stop Timer (`rpc_stop_timer`)
- **Preconditions**: Active timer exists.
- **Logic**:
  1. If `state = 'running'`, calculates elapsed segment duration and inserts row into `work_sessions`.
  2. If `state = 'paused'`, skips inserting an empty session.
  3. Deletes record from `active_timers`.
  4. Task status remains unchanged (e.g. `in_progress`).
  5. Returns `stopped: true`, `session_saved: boolean`.

### 2.5 Save & Switch Timer (`rpc_switch_timer`)
- **Preconditions**: User attempts to start timer on a new task while one is running or paused.
- **UI Dialog**: Prompts user with "Save & Switch" confirmation.
- **Atomic Database Logic**:
  1. If current timer is running, commits the segment to `work_sessions`.
  2. Upserts `active_timers`: `task_id = p_new_task_id`, `state = 'running'`, `segment_started_at = now()`.
  3. If new task is `'todo'`, updates it to `'in_progress'`.
  4. Guarantees that at no point do two active timers coexist.

### 2.6 Complete Task with Active Timer (`rpc_complete_task_with_timer`)
- **Preconditions**: User marks a task completed while its timer is active.
- **UI Dialog**: Prompts user explaining the active session will be saved.
- **Atomic Database Logic**:
  1. If timer was running on this task, commits final segment to `work_sessions`.
  2. Deletes active timer.
  3. Sets task status to `'completed'` and `completed_at = now()`.

---

## 3. Failure & Recovery Modes

1. **Browser Tab Inactivity / Background Throttling**:
   - Modern browsers throttle `setInterval` callbacks in inactive tabs to once per minute or pause them entirely.
   - Because *My Work Planner* derives elapsed time from `Date.now() - startedAtMs` (which reflects wall-clock time), waking up or switching tabs immediately renders the exact elapsed time without loss.
2. **Page Refresh or App Reopen**:
   - On hydration, `loadUserData` queries `active_timers`.
   - Running timers are restored with their original `segment_started_at`.
   - Paused timers are restored in paused state with 0 active segment seconds and all previously saved sessions loaded from `work_sessions`.
3. **Network Failure & Rejection**:
   - Client performs optimistic state updates.
   - If an RPC or network operation fails, state is rolled back and an error toast is surfaced.
   - Work sessions are never deleted during failed retries.
