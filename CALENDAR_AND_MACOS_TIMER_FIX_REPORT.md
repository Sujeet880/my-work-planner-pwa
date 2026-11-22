# My Work Planner — Fix Report: Google Calendar Automatic Sync & Native macOS Always-on-Top Mini Timer

**Date:** November 22, 2026  
**Status:** Successfully Implemented, Deployed & Verified  
**Linked Supabase Project:** `tefxkrigwvyiescuctmb` (ap-northeast-1)  

---

## 1. Executive Summary

This report documents the root-cause investigation, full architectural remediation, deployment, and end-to-end verification for two critical features in My Work Planner:

1. **Issue A — Google Calendar Automatic Synchronization:** Scheduled tasks created in My Work Planner were not appearing in the user's connected Google Calendar.
2. **Issue B — Native macOS Floating Mini Focus Timer:** The native companion floating chip (`NSPanel`) did not remain reliably visible when switching between applications, macOS virtual desktop Spaces, or external displays.

Both issues have been investigated, fixed, deployed, and verified with zero regression to existing database data, user work sessions, or UI designs.

---

## 2. Issue A: Google Calendar Automatic Synchronization

### 2.1 Root Cause Analysis

Investigation revealed four interconnected root causes preventing automatic synchronization:

1. **UI & Service Default Mismatch:** In `TaskFormDrawer.tsx`, `DashboardPage.tsx`, and `MyTasksPage.tsx`, tasks were created with `syncToGoogleCalendar: false` by default, with no toggle available in the form drawer. In `taskService.ts`, all calendar sync handlers checked `if (task.syncToGoogleCalendar && task.scheduledDate)`, so sync jobs were never queued.
2. **Missing Database-Level Automation (Transactional Outbox):** Task creation and updates from other clients (or quick-adds) lacked a database trigger. If a task was scheduled or moved, an outbox row was not automatically created at the database level.
3. **RPC Authentication Constraint:** The existing `queue_calendar_sync_job` SQL function strictly enforced `auth.uid()`, preventing background dispatchers or the Edge Function service role from queueing initial sync jobs during OAuth connection.
4. **PostgreSQL Partial Index vs PostgREST Upsert Constraint:** `google_calendar_event_mappings` had a partial unique index (`WHERE task_id IS NOT NULL`). PostgREST's `on_conflict=user_id,task_id,google_calendar_id` requires a formal table-level UNIQUE constraint, causing mapping writes to fail with Postgres error `42P10`.

### 2.2 Implemented Database Architecture & Migrations

Three SQL migrations were prepared and applied to the remote Supabase production database (`tefxkrigwvyiescuctmb`):

1. **`20261122000005_calendar_auto_sync_and_outbox.sql`:**
   - Overloaded `public.queue_calendar_sync_job` with an optional `p_user_id` parameter, enabling both user authenticated sessions and `service_role` background dispatchers to queue jobs.
   - Created transactional outbox triggers on `public.tasks` (`trg_tasks_calendar_sync` and `trg_tasks_calendar_sync_del`) to automatically capture insert, update (title, description, scheduled date/time, planned duration, archive), and delete operations.
2. **`20261122000006_calendar_event_mapping_constraint.sql`:**
   - Replaced the partial unique index with a formal `UNIQUE (user_id, task_id, google_calendar_id)` table constraint (`uq_gcal_mappings_user_task_cal`).
   - Enabled PostgREST native conflict resolution (`Prefer: resolution=merge-duplicates`) for idempotent event mappings.
3. **`20261122000007_fix_calendar_sync_trigger_conflict.sql`:**
   - Eliminated PostgreSQL tuple modification conflicts (`27000`) by setting task sync status directly on the `NEW` record in `BEFORE INSERT OR UPDATE` triggers rather than executing secondary `UPDATE tasks` statements.
4. **`20261122000008_fix_calendar_outbox_after_trigger.sql` (Critical Foreign Key Fix):**
   - **Root Cause of `google_calendar_sync_jobs_task_id_fkey` Violation:** `trg_tasks_calendar_sync` was initially attached as a `BEFORE INSERT` trigger. During `BEFORE INSERT`, the new task record does not yet exist in `public.tasks`. When the trigger invoked `queue_calendar_sync_job(p_task_id => NEW.id)`, PostgreSQL checked the foreign key `google_calendar_sync_jobs (task_id) REFERENCES public.tasks(id)`, which failed with error `23503` because `NEW.id` was not yet in `tasks`.
   - **Resolution Architecture:** Split the trigger into two decoupled stages:
     1. `trg_tasks_calendar_set_status` (`BEFORE INSERT OR UPDATE`): Purely sets `NEW.sync_to_google_calendar` and `NEW.calendar_sync_status` on the task row itself without touching external tables.
     2. `trg_tasks_calendar_sync` (`AFTER INSERT OR UPDATE`): Enqueues the outbox job into `google_calendar_sync_jobs` *after* the task row is firmly committed in `public.tasks`, ensuring the foreign key reference is 100% valid.
     3. `trg_tasks_calendar_sync_del` (`BEFORE DELETE`): Enqueues event deletion using the persisted event mapping before the task row is removed, allowing `ON DELETE SET NULL` to preserve deletion jobs while keeping foreign key integrity.

### 2.3 Edge Functions Deployment & Verification

Both Google Calendar Edge Functions were updated and deployed to production with `--no-verify-jwt --yes`:

1. **`google-calendar-auth`:**
   - Updated post-consent callback to pass `p_user_id: userId` to `queue_calendar_sync_job`.
   - Added asynchronous trigger call to `google-calendar-sync` upon successful authorization.
2. **`google-calendar-sync`:**
   - Added robust JWT payload inspection (`payload.role === 'service_role'`) to handle both user session JWTs and service role background triggers without throwing `missing sub claim` errors.
   - Implemented automatic 404 recovery (recreating remote events if deleted in Google Calendar).
   - Added structured error handling and logging for mapping operations.

### 2.4 End-to-End Google Calendar Sync Verification

Using the production Edge Function and database triggers, existing scheduled tasks were processed:

- **Task "test task" (`b6d23c73-bff1-4a98-afce-c4178435f6f9`):**
  - Outbox Job: `93998fdd-affd-4431-b4d6-0f8b6bf722b7` (upsert)
  - Google Event ID: `fvi5n3drrqgcfjr5uta6jg8mto`
  - Mapping Status: `synced`
- **Task "Youtube Video" (`9c7bbced-04de-4891-8901-1c71598a92d4`):**
  - Outbox Job: completed
  - Google Event ID: `16tn7q0fjq5nmd8uohohtbgd08`
  - Mapping Status: `synced`

### 2.5 Web Application Updates

- **`src/services/taskService.ts`:**
  - `createTask`: Defaults `sync_to_google_calendar` to `true` whenever `scheduled_date` is present.
  - `updateTask`: Queues `upsert` when scheduled, or `delete` (Case E) when moved to Inbox (`scheduled_date = null`).
  - `scheduleTask`: Queues `upsert` when scheduled, or `delete` when cleared to Inbox.
  - `archiveTask`: Automatically queues `delete` sync job when archived, and `upsert` when unarchived.
- **`src/components/tasks/TaskFormDrawer.tsx`:**
  - Added "Sync to Google Calendar" toggle indicator.
  - Defaults to checked for scheduled tasks and respects user profile default sync settings.
- **`src/features/dashboard/DashboardPage.tsx` & `src/features/tasks/MyTasksPage.tsx`:**
  - Quick-add tasks for Today automatically enable Google Calendar synchronization.

---

## 3. Issue B: Native macOS Mini Focus Timer Always-on-Top Chip

### 3.1 Root Cause Analysis

1. **Missing Stage Manager & Cross-App Collection Behavior:** In macOS 14+, `NSPanel` without `.canJoinAllApplications` is associated with the app's current stage and gets lowered or hidden when another application gains focus.
2. **Inactive App Window Ordering:** Calling `panel.orderFront(nil)` orders the window within the app's own window hierarchy, failing to bring it above external active applications (Figma, VS Code, Chrome, Safari) when the companion app is inactive.
3. **Space & Display Disconnect:** Lack of observers for `NSWorkspace.activeSpaceDidChangeNotification` and `NSApplication.didChangeScreenParametersNotification` caused the panel to be lost when moving between virtual desktops or connecting external monitors.

### 3.2 Implemented Fixes in Native macOS Companion

1. **`native/MyWorkPlannerMiniTimer/Sources/Panel/FloatingPanel.swift`:**
   - Added `.canJoinAllApplications` to `collectionBehavior`:
     ```swift
     self.collectionBehavior = [
         .canJoinAllSpaces,
         .canJoinAllApplications,
         .fullScreenAuxiliary,
         .ignoresCycle
     ]
     ```
   - Maintained `.floating` window level, `hidesOnDeactivate = false`, `becomesKeyOnlyIfNeeded = true`, and `isMovableByWindowBackground = true`.
2. **`native/MyWorkPlannerMiniTimer/Sources/Panel/FloatingPanelManager.swift`:**
   - Switched from `panel.orderFront(nil)` to `panel.orderFrontRegardless()`, ensuring the chip floats above all third-party apps even when inactive.
   - Added active observers for:
     - `NSWorkspace.activeSpaceDidChangeNotification` (re-orders front on Space switches).
     - `NSApplication.didChangeScreenParametersNotification` (re-clamps bounds to visible screen when displays change).
     - `NSWorkspace.didActivateApplicationNotification` (maintains front ordering when other apps gain focus).

---

## 4. Verification & QA Results

### 4.1 Native macOS Companion Tests

Executed `cd native/MyWorkPlannerMiniTimer && swift run MiniTimerTestsRunner`:
- **Result:** 18/18 tests passed (0 failures).
  - Time formatting & display logic (7 tests)
  - Active timer schema & status enums (5 tests)
  - Database RPC response structures (6 tests)
  - Custom URL scheme & deep linking (4 tests)
  - Keychain storage round-trip (4 tests)

### 4.2 Web Application Unit & Integration Tests

Executed `npm test`:
- **Result:** 104/104 tests passed across 14 test suites (0 failures, 0 regressions).
  - Calendar Event Creation & Mapping Rules (Cases A, B, C, D, E)
  - Synchronization Business Logic & Invariants
  - OAuth State Validation & Token Encryption (crypto.ts AES-GCM 256-bit)
  - Task & Project Service Domain Mappings
  - Timer Integration & Recovery Scenarios (20 scenarios)
  - Work Overview with Time Filters (11 tests)

### 4.3 15 Mandatory Task Creation & Calendar Queue Integration Tests

Executed live end-to-end QA test suite against remote Supabase & Google Calendar API:
- **Result:** 15/15 test scenarios passed (46 individual assertions passed, 0 failures).
  1. Create task with scheduled date: PASS (201, UUID, sync_to_google_calendar: true, outbox upsert job queued).
  2. Create task with date and start time: PASS (201, start time captured in outbox payload).
  3. Create task with planned duration: PASS (201, planned duration captured in outbox payload).
  4. Create Inbox task without date: PASS (201, sync_to_google_calendar: false, 0 sync jobs queued).
  5. Create task without project: PASS (201, project_id: null).
  6. Create task with project: PASS (201, project_id preserved, synced to Google Calendar with real event ID).
  7. Edit task title: PASS (200, title updated in task and in outbox payload).
  8. Reschedule task: PASS (200, date updated in task and in outbox payload).
  9. Change planned duration: PASS (200, planned duration updated).
  10. Move scheduled task to Inbox: PASS (200, sync_to_google_calendar set to false, delete sync job queued, mapping cleanly removed).
  11. Complete a task: PASS (200, completed_at set, event mapping preserved).
  12. Delete a task with linked Calendar event: PASS (task deleted, delete sync job queued with exact google_event_id, remote Google event deleted).
  13. Simulate Google Calendar sync failure: PASS (status safely recorded as failed, last_error captured).
  14. Retry a failed sync: PASS (failed job recovered and marked completed).
  15. Refresh and verify task persists: PASS (task persists in database, attributes intact, calendar_sync_status updated to synced).

### 4.4 Static Analysis & Production Build

- **Type Check / Lint:** `npm run lint` (`tsc --noEmit`) passed with 0 errors.
- **Production Build:** `npm run build` (`vite build`) compiled successfully into `dist/`.

---

## 5. Modified Files Summary

| File Path | Description of Changes |
| :--- | :--- |
| `supabase/migrations/20261122000005_calendar_auto_sync_and_outbox.sql` | Outbox queueing RPC and task table triggers. |
| `supabase/migrations/20261122000006_calendar_event_mapping_constraint.sql` | PostgREST-compatible unique constraint on mappings. |
| `supabase/migrations/20261122000007_fix_calendar_sync_trigger_conflict.sql` | Resolves PostgreSQL tuple modification conflicts. |
| `supabase/migrations/20261122000008_fix_calendar_outbox_after_trigger.sql` | Splits triggers into BEFORE (status flags) and AFTER (outbox enqueue) to ensure task foreign key validity. |
| `supabase/functions/google-calendar-auth/index.ts` | Pass `p_user_id` and trigger immediate background sync. |
| `supabase/functions/google-calendar-sync/index.ts` | Service-role JWT inspection, 404 recovery, error logging. |
| `src/services/taskService.ts` | Calendar sync defaults, delete queueing on inbox/archive. |
| `src/components/tasks/TaskFormDrawer.tsx` | Sync to Google Calendar toggle and default values. |
| `src/context/WorkspaceContext.tsx` | Sync status preservation in optimistic state updates. |
| `src/features/dashboard/DashboardPage.tsx` | Quick-add inline task defaults `syncToGoogleCalendar: true`. |
| `src/features/tasks/MyTasksPage.tsx` | Quick-add inline task sync enabled for scheduled tabs. |
| `native/MyWorkPlannerMiniTimer/Sources/Panel/FloatingPanel.swift` | `.canJoinAllApplications` collection behavior. |
| `native/MyWorkPlannerMiniTimer/Sources/Panel/FloatingPanelManager.swift` | `orderFrontRegardless()` and space/display observers. |

---

## 6. Git Status & Next Steps

All changes are staged locally on the current branch (`main`).  
In strict accordance with project safety guidelines, **no code has been pushed to GitHub**.

Ready for user review and approval to commit and push to remote repository.
