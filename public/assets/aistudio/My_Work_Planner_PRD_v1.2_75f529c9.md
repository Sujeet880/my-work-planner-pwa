# My Work Planner PWA
## Product Requirements Document (PRD)

**Document version:** 1.2 – Consolidated Development Baseline  
**Status:** Ready for implementation planning  
**Prepared:** 20 November 2026  
**Product type:** Personal productivity and time-tracking Progressive Web App (PWA)  
**Primary experience:** Desktop / Mac  
**Secondary experience:** Mobile and tablet browsers  
**Initial account model:** One private personal workspace; data model remains user-scoped so it can support additional users later if deliberately expanded.

---

## 0. How to use this document

This is the consolidated product specification to use for development. It brings together the product decisions made during planning, the previously discussed PRD requirements, and the actual screen assets in the latest supplied Stitch export.

The latest supplied Stitch ZIP was inspected. It contains **24 `code.html` screen exports**, **16 `screen.png` previews**, a root-level `design.md`, and a supplementary `calm_focused_productivity/DESIGN.md`. It does not contain a complete detailed PRD. This document therefore consolidates the requirements established in the project discussions and uses the Stitch export as the current visual reference.

### Source-of-truth order

1. **This PRD v1.2** is the source of truth for product behaviour, scope, data rules and acceptance criteria.
2. **Root `design.md`** is the primary source of truth for visual tokens and design principles.
3. **Calm Focused Productivity `DESIGN.md`** is supplementary visual guidance. It should not become a competing design system.
4. **Latest Stitch screen export** is the visual reference for layouts, screen composition and component patterns. It is not production application code and does not override functional rules in this PRD.
5. Any older prompt, sample value or generated screen content that conflicts with this PRD should be treated as outdated.

### Implementation status

The application is not yet a functioning production app. Stitch exports are visual/prototype references. Authentication, database persistence, real timer state, Google Calendar API operations, notifications, reporting queries and PWA behaviour must be implemented and tested during development.

---

# 1. Product overview

## 1.1 Product vision

My Work Planner is a lightweight personal workspace for planning tasks, organizing work by project, recording actual working time and understanding the difference between estimated and actual time.

It should help the user answer four questions quickly:

1. What do I need to do today or on a future date?
2. What should I work on next?
3. How much time have I actually spent on each task?
4. How does actual working time compare with my plan?

The product combines task planning, task-based time tracking and practical reporting in one installable web application.

## 1.2 Problem statement

The user works across multiple projects and types of work. A conventional to-do list does not record how long each task actually takes. A standalone timer does not provide enough context about planned tasks, priorities or project-wise work. A spreadsheet can record time, but it creates manual overhead.

My Work Planner should make the complete daily loop simple:

**Plan → Work → Track → Review.**

## 1.3 Target user

### Primary user
An individual professional, freelancer, designer, developer or independent worker who manages tasks across multiple clients/projects and wants a reliable personal time record.

### Initial usage model
- One private workspace owned by one person.
- One authenticated account in the initial release.
- No team collaboration or shared project workspaces.
- Data tables remain scoped by authenticated `user_id` so the design does not block a future multi-user expansion.

## 1.4 Product principles

- Simplicity over feature quantity.
- Fast task creation.
- One obvious action to start tracking work.
- Accurate time records are more important than decorative productivity metrics.
- The same timer and task data must be consistent on every screen.
- Planned duration is an estimate, not a deadline or a productivity target.
- Historical work records must not disappear automatically.
- Desktop and mobile must share the same business rules.
- The UI should feel calm, focused and professional, not like an enterprise project-management suite.

---

# 2. Goals and non-goals

## 2.1 MVP goals

1. Sign in privately using email-based passwordless authentication.
2. Create, edit, schedule, complete, archive and manage tasks.
3. Organize tasks by optional project/client.
4. Support Today, Upcoming, Inbox, All Tasks and Completed views.
5. Set High, Medium or Low priority.
6. Add an optional planned duration to a task.
7. Track actual work through Start, Pause, Resume and Stop controls.
8. Support multiple work sessions per task.
9. Add manual time entries when the user forgets to run the timer.
10. Calculate saved time, active time, live actual time and planned-vs-actual difference correctly.
11. Synchronize eligible scheduled tasks from My Work Planner to Google Calendar (one-way only).
12. Support task reminders, subject to browser permission and delivery capability.
13. Provide daily, weekly, monthly and custom-range reports.
14. Export task summaries and work-session history to Excel and CSV.
15. Provide an installable responsive PWA experience on supported desktop and mobile browsers.

## 2.2 Explicitly out of scope for the initial MVP

Do not implement these unless separately approved:

- Subtasks, checklists or nested tasks.
- Task tags or custom labels.
- Recurring tasks or recurring reminders.
- Kanban boards, Gantt charts or resource allocation.
- Team collaboration, shared workspaces or roles.
- Employee attendance or timesheets for payroll.
- Billing, invoices, billable rates or client budget management.
- Project budgets, budget forecasts or financial drift metrics.
- AI scheduling, AI task suggestions or automatic priority scoring.
- Focus mode, distraction blocking, deep-focus scores, flow state or gamification.
- Two-way Google Calendar synchronization.
- Google Tasks integration.
- Calendar-to-app event importing.
- Native iOS or Android applications.
- Complex offline-first editing and conflict resolution.
- Full workspace ZIP/JSON backup and restore in the first release.

## 2.3 Product success criteria

The MVP is useful when the user can create tasks, schedule them, track actual work, review accurate time totals and export the records without maintaining a separate spreadsheet.

Success is measured by correctness and low friction, not by productivity scores.

---

# 3. Platforms and technical direction

## 3.1 Product format

Build a responsive PWA, not a native app.

- On Mac/desktop, it should be installable or launchable in a standalone app window on supported browsers.
- On mobile, it should be installable through the browser's supported Add to Home Screen / Install App flow.
- The same account and cloud data should be available on each signed-in device.

## 3.2 Development environment

Use Google AI Studio Build Mode as the AI-assisted development environment. Its current web-app workflow provides a React frontend by default and a Node.js server runtime for secure server-side operations. The generated code can be maintained through GitHub synchronization or exported for local development. The exact project structure should follow the environment's current capabilities rather than forcing an incompatible framework.

### Recommended baseline

- Frontend: React + TypeScript.
- Styling: Tailwind CSS, using the provided design tokens.
- Server: Node.js server-side routes/functions supported by the chosen deployment environment.
- Authentication: Supabase Auth.
- Database: Supabase PostgreSQL.
- Calendar: Google Calendar API.
- Export: XLSX library and CSV generation.
- PWA: Web App Manifest and Service Worker.
- Version control: GitHub.

Do not add Gemini API functionality to the product. Google AI Studio is the development environment; the product does not currently require AI features.

## 3.3 Hosting approach

Develop and validate in AI Studio preview first. Choose production hosting after the application works and the server-side requirements are known. Cloud Run is a natural option from AI Studio; Vercel is also an option if the application is exported and its plan terms/limits suit the use. Do not assume any hosting, database, email, push-notification or OAuth setup is unlimited or permanently free.

---

# 4. Information architecture and navigation

## 4.1 Primary desktop navigation

1. Dashboard
2. My Tasks
3. Time Tracker
4. Reports

Secondary navigation:

5. Projects
6. Settings

Account actions are available from the profile/account area.

## 4.2 Primary mobile navigation

1. Dashboard
2. Tasks
3. Timer
4. Reports

Projects and Settings are accessible through a secondary menu/account area. Do not overcrowd the mobile bottom navigation.

## 4.3 Screen inventory from the current Stitch export

### Desktop assets

- S01 – Sign In.
- S02 – Dashboard – Active Timer.
- S02 – Dashboard – No Active Timer.
- Dashboard Interaction States – Add Task Drawer.
- S03 – My Tasks – Today.
- S04 – My Tasks – Upcoming.
- S05 – My Tasks – Inbox.
- S06 – Create Task Drawer – Google Calendar Connected.
- S06 – Task Creation States & Calendar Variations.
- S07 – Task Details & Live Timer.
- S08 – Time Tracker & Work Sessions.
- S10 – Reports & Analytics.
- S11 – Projects & Clients.
- S12 – Settings, Preferences & Integrations.

### Mobile assets

- M01 – Mobile Sign In.
- M02 – Mobile Dashboard.
- M03 – Mobile My Tasks.
- M04 – Mobile Create / Edit Task.
- M05 – Mobile Task Details.
- M06 – Mobile Time Tracker.
- M07 – Mobile Reports.
- M08 – Mobile Projects.
- M09 – Mobile Settings.
- M10 – Mobile Google Calendar Integration.

### Screen composition guidance

The Stitch export is a design reference, not a strict route requirement. Several views (Today, Upcoming, Inbox, All, Completed) can be states within one My Tasks route. Work Session History can be a view or section within Time Tracker. Calendar integration can be a Settings sub-page and a task-level status section.

---

# 5. Authentication and account requirements

## 5.1 Authentication model

Use Supabase Auth passwordless email Magic Link.

The initial product is private and intended for one owner. Do not create public sign-up, social login, organization onboarding or team invitations in the MVP.

Recommended initial configuration:
- Provision the owner's account in Supabase Auth.
- Use email Magic Link for sign-in.
- Disable automatic account creation from the sign-in form (`shouldCreateUser: false`) unless the product owner explicitly chooses to enable registration later.
- Optionally enforce a server-side allowlist for the initial owner account. Do not hardcode an email address in frontend code.

## 5.2 Authentication journey

1. User opens the app.
2. If no valid session exists, show Sign In.
3. User enters an email address.
4. Validate email format.
5. Send a Magic Link through Supabase Auth.
6. Show a separate “Check your email” state only after the request succeeds.
7. User opens the link.
8. Handle the configured auth callback and verify the one-time link.
9. Create/restore the authenticated session.
10. Redirect to Dashboard.

## 5.3 Required auth states

- Initial Sign In.
- Empty email validation.
- Invalid email validation.
- Sending link.
- Link sent.
- Resending link / cooldown.
- Change email.
- Verifying link.
- Successful verification.
- Expired link.
- Invalid or already-used link.
- Network error.
- Provider/email delivery error.
- Too many requests / rate limited.
- Already authenticated.
- Sign out confirmation or immediate sign-out according to the final UX.

Do not show “Magic Link Sent” on the initial form. Do not prefill a demo email. Do not provide a “Demo: Enter Workspace” bypass. Do not claim authentication succeeded before Supabase confirms it.

## 5.4 Session handling

- Keep authenticated routes protected.
- Restore the session after app reload.
- Sign out must clear the app session safely.
- A signed-out user must not access task/project/report data.
- Configure allowed redirect URLs for local development and production.
- Use a production-ready email delivery configuration before relying on Magic Links for regular use.

---

# 6. Task management

## 6.1 Task fields

| Field | Type / Rule | Required |
|---|---|---|
| Task ID | UUID | System |
| Title | Text, trimmed, non-empty | Yes |
| Description | Optional text | No |
| Project ID | Optional relation | No |
| Priority | High / Medium / Low; default Medium | Yes (defaulted) |
| Status | To Do / In Progress / Completed | System/default |
| Scheduled Date | Local date; nullable | No |
| Scheduled Start Time | Local time; nullable; requires date | No |
| Scheduled Timezone | IANA timezone; default from profile | System/default |
| Planned Duration | Positive integer minutes; nullable | No |
| Reminder DateTime | Optional timezone-aware timestamp | No |
| Calendar Sync Enabled | Boolean, initial value from user preference | No |
| Created At | Timestamp | System |
| Updated At | Timestamp | System |
| Completed At | Nullable timestamp | System |
| Archived At | Nullable timestamp | System |
| Deleted At | Nullable timestamp for soft deletion | System |

Do not add subtasks, tags, checklists, acceptance criteria or billable fields.

## 6.2 Task priority

- High
- Medium
- Low

Default: Medium.

Priority is a user-controlled task attribute. Do not infer or automatically change priority.

## 6.3 Task status

- **To Do:** not yet started.
- **In Progress:** work has started or the user has explicitly marked it in progress.
- **Completed:** user has completed the task.

Starting a timer automatically changes To Do to In Progress. Pausing or stopping a timer does not change the task to Completed. Reopening a completed task returns it to In Progress if it has recorded work, otherwise To Do.

Overdue is a derived visual condition, not a separate stored task status. A task is overdue when its scheduled date/time has passed in its scheduling timezone and it is not Completed. For a date-only task, it becomes overdue after the scheduled local day ends.

Archiving is separate from completion. Archived tasks and their time history remain available in historical views.

## 6.4 Task creation and quick add

The user can create a task from Dashboard, My Tasks, Inbox or Upcoming.

The same underlying form and validation rules must be used in all contexts. The default scheduled date may vary by context:

- Quick Add from Today: preselect Today.
- Quick Add from Upcoming with a selected date: preselect that date.
- Quick Add from Inbox: leave the date empty.
- General Add Task: date may be empty; if empty, save to Inbox.

Task creation should be lightweight. The title is the first field. Optional information should not block saving.

### Save behaviour

- No Scheduled Date: save in Inbox.
- Scheduled Date = Today: show in Today.
- Scheduled Date in the future: show in Upcoming.
- Planned Duration is optional.
- Project is optional.
- Description is optional.
- Start Time cannot be set without Scheduled Date.

## 6.5 Task views

### Today
Tasks scheduled for the user's current local date, grouped or sorted by scheduled start time where available.

### Upcoming
Tasks scheduled after the current local date, grouped by date.

### Inbox
Tasks with no scheduled date. Primary action: Schedule.

### All Tasks
All non-archived, non-deleted tasks, including scheduled and unscheduled tasks.

### Completed
Tasks with Completed status. Keep historical work entries visible.

## 6.6 Task actions

Primary actions:
- Open Details.
- Start / Resume Timer.
- Complete Task.

Secondary actions:
- Edit.
- Reschedule.
- Archive.
- Delete (soft delete; confirmation required).

Do not overload task rows with every action. Use a contextual menu for secondary actions.

## 6.7 Task archive and deletion

- Archive should hide a task from active views without deleting its data.
- Completed tasks remain accessible in Completed and Reports.
- Deletion should be a deliberate, confirmed action.
- Prefer soft deletion with `deleted_at` so accidental deletion can be recovered during initial development/testing.
- Permanent purge can be a later administrative/data-retention decision.

---

# 7. Projects and clients

## 7.1 Purpose

Projects are lightweight categories for grouping tasks. They are not full project-management workspaces.

## 7.2 Project fields

- Project ID (UUID).
- User ID.
- Project Name (required).
- Description (optional).
- Optional accent colour identifier (limited to the existing design palette; not arbitrary per-screen colours).
- Status: Active / Archived.
- Created At / Updated At.
- Archived At (nullable).

## 7.3 Initial example projects

Use these only as prototype/sample data:
- Raasta.
- Foundry.
- Sangi Food & Herbs.
- Personal.

Do not hardcode these as permanent application categories. The user can create, rename and archive projects.

## 7.4 Project behaviour

- A task may belong to zero or one project.
- Archiving a project does not delete associated tasks or work entries.
- Archived projects should not appear as the default choice for new tasks, but historical project reporting remains available.
- Project summaries show task counts, completed counts, planned time and saved actual time.
- Do not show project budgets, billable hours, financial drift or billing-quarter metrics.

---

# 8. Scheduling and date/time rules

## 8.1 Date and time are separate

Scheduled Date is optional. Scheduled Start Time is optional but requires a Scheduled Date. Planned Duration is independent of start time and remains optional.

## 8.2 Timezone

- Initial profile timezone default: `Asia/Kolkata`.
- Timezone is editable in Settings.
- Store real event/work timestamps as timezone-aware instants (UTC in the database).
- Store scheduled date and scheduled local start time with the IANA timezone that defines the intended local schedule.
- Display dates and times using the profile/task timezone rules.
- Do not hardcode the timezone into UI components.

## 8.3 Date and time formatting

Use the user's configured preferences:
- 12-hour or 24-hour time.
- Configurable date format.
- Duration labels such as `2h 30m`.
- Running timer display in `HH:MM:SS` with tabular numerals.

## 8.4 Overdue calculation

Calculate overdue using the task's scheduled local date/time and timezone. Do not store a manually editable “Overdue” status.

---

# 9. Time tracking and timer requirements

This is a core product feature.

## 9.1 Core rule: one timer context per user

There can be only one current timer context for a user at a time. The context can be Running or Paused. Only one automatic work entry may be open/running at a time.

When a different task is started while the current timer context is Running or Paused, show a confirmation:

**Another task is running/paused. Save the current work and switch to the new task?**

Actions:
- Cancel.
- Save & Switch.

Save & Switch closes any open automatic work entry, clears the prior timer context and starts a new timer for the selected task. Previous entries remain saved against the previous task.

## 9.2 Timer actions

### Start
- Verify there is no other active timer context.
- Create an automatic time entry with `started_at` set to the server timestamp and `ended_at` null.
- Create/update the user's active timer state as Running.
- Set task status to In Progress if it was To Do.

### Pause
- Close the current automatic time entry using a server timestamp.
- Store its duration.
- Set timer context to Paused for the same task.
- Keep task status In Progress.

### Resume
- Create a new automatic time entry.
- Set timer context to Running.
- Preserve all previous entries.

### Stop
- Close and save the current automatic time entry.
- Clear the active timer context.
- Keep task status In Progress.
- Do not complete the task.

### Complete while running
- Ask for confirmation.
- Close and save the current entry.
- Clear the timer context.
- Set task status Completed and `completed_at`.

## 9.3 Actual-time definitions

- **Saved Work Time:** sum of closed automatic entries and valid manual entries for the task.
- **Current Active Session:** elapsed time since `started_at` for the currently open entry.
- **Live Actual Time:** Saved Work Time + Current Active Session.
- **Actual Time after Pause/Stop:** the sum of saved entries only.

Actual duration is derived from time entries. Do not store multiple independently editable totals that can drift apart.

## 9.4 Time-entry rules

Each time entry includes:
- ID.
- User ID.
- Task ID.
- Entry Type: Automatic / Manual.
- Start timestamp (nullable for duration-only manual entry).
- End timestamp (nullable only for a currently open automatic entry).
- Duration seconds (stored when closed or for duration-only manual entries).
- Optional notes.
- Created At / Updated At.

Automatic entries:
- Start and end timestamps define the duration.
- An open automatic entry has `ended_at = null`.
- Only one open automatic entry is allowed per user.

Manual entries:
- User can enter a date plus duration, or start/end times.
- Duration must be greater than zero.
- If start and end are provided, end must be after start.
- Entry is visibly labelled Manual.
- Manual entries contribute to actual time.
- Manual entries can be edited or removed by the user.
- Warn about overlapping manual and automatic time ranges where overlap can be detected; do not silently double-count without informing the user.

## 9.5 Timer accuracy and recovery

- The database timestamps are the source of truth.
- The visible counter is a presentation layer that recalculates elapsed time from timestamps.
- A JavaScript interval may update the display, but it must not be the source of elapsed-time truth.
- Refreshing or reopening the PWA must not reset the timer.
- After reopening, retrieve the active timer state and open entry; calculate elapsed time using current server time or a reliable time reference.
- If network is unavailable, show an offline state and do not falsely claim that a start/pause/stop action has been persisted. The initial MVP is online-first; robust offline mutation queueing is deferred unless implemented and tested explicitly.
- Do not allow the browser clock to silently overwrite server-recorded timestamps.

## 9.6 Time calculation rules

`Saved Work Time = SUM(closed time-entry durations)`

`Current Active Session = now - open_entry.started_at`

`Live Actual Time = Saved Work Time + Current Active Session`

`Time Difference = Actual Time - Planned Duration`

Interpretation:
- Positive difference: Over Plan.
- Negative difference: Under Plan.
- Zero: On Target.
- No planned duration: No Estimate; do not calculate a variance.

## 9.7 Where active time appears

- Dashboard and Task Details can show Live Actual Time and must label it clearly if it includes the active session.
- Time Tracker must show Saved Work Time, Current Active Session and Live Actual Time as distinct values.
- Reports and exports use saved/closed entries for stable historical totals. If an active session is displayed on a report screen, show it separately as “Currently Running – not yet included in saved report totals”.
- Do not double-count an open entry in both saved totals and active totals.

## 9.8 Timer visual behaviour

The Stitch prototype currently contains a live-updating count-up timer. Preserve the intended count-up behaviour in the real application. A timer should increase elapsed time; it is not a countdown.

The timer should be globally consistent across screens. Different screen components must read the same active timer state rather than maintain independent timers.

---

# 10. Google Calendar integration

## 10.1 Direction and source of truth

Synchronization is strictly one-way:

**My Work Planner → Google Calendar.**

My Work Planner is the source of truth.

Do not implement or advertise:
- Two-way synchronization.
- Calendar-to-app task import.
- Calendar edits updating tasks.
- Calendar-side completion status syncing.
- Bidirectional conflict resolution.

## 10.2 Connection and settings

Provide a Google Calendar integration under Settings with:
- Connect Google Account.
- Connected account email.
- Destination Calendar (default Primary Calendar).
- Global Automatic Sync toggle.
- Default Calendar Sync for New Scheduled Tasks toggle.
- Default Calendar Event Duration (initial default 60 minutes).
- Sync status and recent sync activity.
- Retry for identifiable failed syncs.
- Disconnect Account.

The app must request only scopes necessary for the supported features. Calendar event creation/update/deletion requires event write access. Listing the user's calendars requires calendar-list read access. Confirm scope selection and Google OAuth consent requirements during implementation.

## 10.3 Task-level sync

Each task has a Calendar Sync preference. When the Google account is connected and global automatic sync is enabled, new scheduled tasks default to sync enabled (the user's stated desired default). The user can disable sync for an individual task.

If task-level sync is disabled after an event has already been created, leave the existing Calendar event unchanged and stop future automatic updates. Provide an explicit “Remove from Google Calendar” action if the user wants it deleted.

If global automatic sync is disabled, stop future automatic operations but do not silently delete already-created events. When global sync is re-enabled, reconcile eligible linked tasks using stored event IDs.

## 10.4 Event creation rules

| Task scheduling | Google Calendar representation |
|---|---|
| No scheduled date | No event |
| Date only, no start time | All-day event |
| Date + start time + planned duration | Timed event using planned duration |
| Date + start time, no planned duration | Timed event using the configured default duration (60 minutes initially) |
| Sync disabled | No new event / no automatic updates |

A date-only task with a planned duration remains an all-day event. The planned duration remains visible in My Work Planner but must not be converted into an invented calendar time slot.

For all-day events, Google Calendar uses date-only start/end fields. The end date is exclusive; a one-day event ends on the following date. For timed events, use date-time values and the correct IANA timezone.

## 10.5 Event update/delete rules

- Task title changed: update the linked event title.
- Description/project changed: update relevant event description if configured.
- Date/start time changed: update the linked event timing.
- Planned duration changed: update the linked event end time.
- Task completed: keep the event; do not sync completion status.
- Task moved to Inbox: delete the linked event created by this app; if deletion fails, retain a pending-delete state and allow retry.
- Task permanently deleted: delete the linked app-created event where authorized; if deletion fails, retain a retryable pending-delete record.
- Calendar disconnected: stop future sync; do not automatically delete existing events.
- Task-level sync disabled: retain existing event unchanged and stop updates until re-enabled or explicitly removed.

## 10.6 Duplicate prevention and failure handling

- Store the external `calendar_id` and `google_event_id` for each linked task.
- Use an idempotent create/update flow so repeated saves do not create duplicate events.
- A task must save successfully in My Work Planner even if Calendar sync fails.
- Calendar failure must not roll back or delete the task.
- Show Pending, Synced, Failed, Disabled or Disconnected status accurately.
- Retry should target the same linked event where possible.
- Do not show “Synced” until the Google API confirms success.

## 10.7 OAuth and token handling

Use a server-side OAuth authorization-code flow for the web application. Keep Google client secret and refresh tokens server-side only. Never put refresh tokens or client secrets into browser storage, frontend environment variables or source code. Handle revoked/expired authorization by marking the connection as needing reconnection.

The Google OAuth consent screen, redirect URIs, authorized domains, API enablement and any verification requirements must be configured in Google Cloud before production use.

---

# 11. Reminders and notifications

## 11.1 Task reminder

Each task may have one optional reminder datetime. Reminder is separate from Google Calendar sync.

- If the task has a scheduled start time, offer convenient choices such as at start time or a selected interval before it.
- If the task has only a date, allow a custom reminder time on that date.
- If the task has no scheduled date, the user may still set an explicit reminder datetime if the UI supports it; this does not create a Calendar event.
- Do not automatically copy an app reminder into Google Calendar.

## 11.2 Notification permission

- Do not request browser notification permission immediately on first page load.
- Request permission when the user enables reminders or performs an action that needs notifications.
- Show Granted, Denied and Unsupported states.
- Provide an in-app reminder fallback while the app is open.

## 11.3 Delivery expectations

For notifications while the PWA is closed, implement Web Push with a server-side scheduling/delivery mechanism only if the chosen hosting/runtime supports it reliably. This requires push subscriptions and secure server-side delivery. Do not promise guaranteed delivery on every browser/device. If reliable background delivery is not available in the first deployment, clearly label the limitation and ship in-app/foreground reminders first.

Recurring reminders are out of scope.

---

# 12. Dashboard

The Dashboard is the default landing screen after authentication.

## 12.1 Main content

- Greeting and current date.
- Today's task count.
- Completed task count.
- Planned hours for today's scheduled tasks.
- Actual tracked hours for today (clearly labelled if live active time is included).
- Current active timer when one exists.
- Today's task list.
- A compact upcoming tasks section.
- A useful Add Task action.

## 12.2 Dashboard states

### Active Timer
Show the one global active task, project, priority, live elapsed time and Pause/Stop actions. The same task/time must be reflected everywhere else.

### No Active Timer
Show a clear idle state and an action to start a task. Do not show a hidden or duplicate timer.

## 12.3 Dashboard non-goals

Do not add flow state, focus score, deep-work score, daily velocity, pace prediction, distraction blocker, capacity forecast, target-hour assumption or productivity gamification.

---

# 13. Time Tracker and Work Session History

The Time Tracker is the central workspace for current and recent work sessions.

Required content:
- Current active timer (if any).
- Saved Work Time for the selected date range.
- Current Active Session, shown separately.
- Live Actual Time where relevant.
- Recent work sessions.
- Add Manual Entry.
- Date/project/task/entry-type filters.

Work Session History may be a dedicated sub-view within Time Tracker; it does not require a separate primary navigation item.

Each session row should show date, task, project, start/end time where available, duration and Automatic/Manual type.

---

# 14. Reports and analytics

## 14.1 Report periods

- Daily.
- Weekly.
- Monthly.
- Custom date range.

## 14.2 Core metrics

- Total tasks.
- Completed tasks.
- Pending tasks.
- Planned hours.
- Saved actual hours.
- Planned-vs-actual difference (only where a planned estimate exists).

## 14.3 Charts and tables

- Planned vs Actual comparison.
- Daily working time trend.
- Project-wise time distribution.
- Task performance table.

Do not add billable ratio, average deep-work block, peak productivity day, productivity scores, daily velocity, project budgets or financial drift.

## 14.4 Reporting rules

- Report actual time is based on saved/closed work entries.
- A currently running session may be shown separately but is not silently included in saved report totals.
- Future dates must not show recorded actual hours unless actual time entries truly exist for those dates (for example, a manual entry with a valid past/future record should be explicitly handled; normal future scheduled tasks have zero actual time).
- Project totals must reconcile with included task/session data.
- Weekly/monthly totals must reconcile with daily totals.
- Tasks without an estimate show No Estimate, not zero variance.

---

# 15. Excel and CSV export

Provide export options for a selected date range and optional project filter.

## 15.1 XLSX structure

Recommended workbook sheets:

1. **Task Summary** – task ID, title, project, priority, status, scheduled date, start time, planned duration, saved actual duration, variance.
2. **Work Sessions** – entry ID, task title, project, entry type, date, start timestamp, end timestamp, duration, notes.

## 15.2 CSV

Allow export of the selected dataset as CSV. If both task summary and work sessions are required, offer separate CSV downloads or clearly named files.

## 15.3 Export rules

- Use the user's selected date/time format and timezone for display/export.
- Keep durations as numeric minutes/seconds in a documented column or as an unambiguous duration string.
- Exclude open active sessions from saved work-session exports. If a live snapshot is ever offered, label it clearly as a snapshot and do not pretend it is a completed session.
- Do not add billable or budget fields.

---

# 16. Settings

Settings should be divided into focused sections rather than one excessively long technical page.

## 16.1 Account
- Signed-in email.
- Account information.
- Sign out.

## 16.2 General
- Timezone (initial default Asia/Kolkata; user editable).
- Date format.
- Time format (12-hour / 24-hour).
- Default Calendar Event Duration (initial default 60 minutes).

## 16.3 Notifications
- Browser permission status.
- Enable task reminders.
- Reminder preferences.
- In-app fallback availability.

## 16.4 Integrations
- Google Calendar connection.
- Connected Google account.
- Destination calendar.
- Global automatic sync.
- Default sync preference for new scheduled tasks.
- Sync status/history and retry for failures.
- Disconnect account.

## 16.5 Data & Export
- Export tasks.
- Export work sessions.
- Export reports.
- Excel and CSV.

## 16.6 App & Installation
- Application name/version.
- PWA install instructions for supported browsers/devices.

Do not show unverified technical diagnostics, fake cloud health, fake sync latency, device hardware data, encryption claims or a Pro licence.

---

# 17. PWA requirements

## 17.1 Installability

Implement:
- `manifest.webmanifest`.
- App name: My Work Planner.
- Short name: Work Planner.
- Start URL and scope.
- Standalone display mode.
- Theme/background colours aligned with DESIGN.md.
- Proper 192px and 512px application icons, including maskable variants where appropriate.
- Correct manifest link and HTTPS deployment.

## 17.2 Service worker

Use a service worker for application-shell caching and a meaningful offline fallback where appropriate. Do not cache private task responses indiscriminately. Do not claim full offline task editing unless offline data synchronization and conflict handling have been designed, implemented and tested.

## 17.3 Responsive support

Primary desktop reference: 1440 × 900.
Mobile references: 390 × 844 and 360 × 800.
Tablet: responsive intermediate layout.

Do not disable browser zoom. Respect mobile safe-area insets and avoid sticky controls covering content.

## 17.4 Timer and app closure

Timer persistence must be based on server-recorded timestamps. It must continue to show the correct elapsed time when the user reopens the PWA. A service worker or browser interval must not be treated as the timer's source of truth.

---

# 18. Data model and proposed database entities

The following is the proposed logical schema. Exact SQL types, indexes, constraints and migrations should be finalized during implementation.

## 18.1 `profiles`

- `user_id` UUID primary key referencing `auth.users(id)`.
- `display_name` text nullable.
- `timezone` text, default `Asia/Kolkata` for initial setup.
- `date_format` text.
- `time_format` text (`12h` or `24h`).
- `default_calendar_event_duration_minutes` integer, default 60.
- `automatic_calendar_sync_enabled` boolean.
- `default_calendar_sync_for_new_tasks` boolean, default true after connection is established.
- notification preference fields as needed.
- `created_at`, `updated_at`.

## 18.2 `projects`

- `id` UUID primary key.
- `user_id` UUID, owner.
- `name` text.
- `description` text nullable.
- `color_key` text nullable.
- `status` active/archived.
- `created_at`, `updated_at`, `archived_at`.

## 18.3 `tasks`

- `id` UUID primary key.
- `user_id` UUID, owner.
- `project_id` UUID nullable.
- `title` text.
- `description` text nullable.
- `priority` enum/check: high, medium, low.
- `status` enum/check: todo, in_progress, completed.
- `scheduled_date` date nullable.
- `scheduled_start_time` time nullable.
- `scheduled_timezone` text nullable/default from profile.
- `planned_duration_minutes` integer nullable; must be positive when present.
- `reminder_at` timestamptz nullable.
- `calendar_sync_enabled` boolean.
- `completed_at` timestamptz nullable.
- `created_at`, `updated_at`, `archived_at`, `deleted_at`.

Constraint: `scheduled_start_time` cannot exist when `scheduled_date` is null.

## 18.4 `time_entries`

- `id` UUID primary key.
- `user_id` UUID, owner.
- `task_id` UUID.
- `entry_type` automatic/manual.
- `started_at` timestamptz nullable.
- `ended_at` timestamptz nullable.
- `duration_seconds` bigint/integer nullable until an automatic entry is closed; required for duration-only manual entries.
- `work_date` date for duration-only/manual reporting context where needed.
- `notes` text nullable.
- `created_at`, `updated_at`.

Automatic entry: `started_at` required; `ended_at` null only while running. Once closed, persist a non-negative duration derived from timestamps.

Manual entry: either start/end pair or positive duration with work date. If start/end are provided, end must be after start.

## 18.5 `active_timer_state`

One row per user (user ID is primary key) to represent the currently selected timer context:

- `user_id` UUID primary key.
- `task_id` UUID.
- `state` running/paused.
- `current_time_entry_id` UUID nullable (set while running; null while paused).
- `updated_at` timestamptz.

Starting a different task must transactionally close the old open entry and replace/clear the previous state before creating the new one.

## 18.6 `calendar_connections`

- `id` UUID primary key.
- `user_id` UUID unique.
- `google_account_email` text.
- `selected_calendar_id` text.
- `selected_calendar_name` text.
- `connection_status` connected/reconnect_required/disconnected.
- token/credential references managed securely server-side; never exposed to browser queries.
- `connected_at`, `updated_at`.

OAuth refresh tokens must be protected as secrets. If stored in the database, access must be denied to normal client roles and encryption-at-rest/secret-management must be applied. Never return tokens to the frontend.

## 18.7 `task_calendar_links`

- `id` UUID primary key.
- `user_id` UUID.
- `task_id` UUID unique (one linked event per task in the initial version).
- `calendar_id` text.
- `google_event_id` text.
- `sync_status` pending/synced/failed/disabled/delete_pending.
- `last_synced_at` timestamptz nullable.
- `last_error_code` / sanitized `last_error_message` nullable.
- `created_at`, `updated_at`.

Use unique constraints/indexes to prevent duplicate mapping for the same task and calendar event.

## 18.8 `push_subscriptions` (only if Web Push is implemented)

- `id` UUID.
- `user_id` UUID.
- subscription endpoint and keys stored securely.
- browser/device metadata where useful.
- `created_at`, `updated_at`, `revoked_at`.

## 18.9 `reminder_jobs` (only if server-scheduled delivery is implemented)

- `id` UUID.
- `user_id` UUID.
- `task_id` UUID.
- `remind_at` timestamptz.
- `status` pending/sent/failed/cancelled.
- delivery metadata and timestamps.

---

# 19. Data security and privacy

## 19.1 Authentication and authorization

- Use Supabase Auth.
- Enable Row Level Security on every user-owned table exposed through the Data API.
- Enforce ownership using `auth.uid() = user_id` (or the equivalent profile relationship).
- Use least-privilege grants and policies for each operation.
- Add automated database tests for allowed and denied access.
- Signed-out visitors must not read or modify private records.

## 19.2 Secrets

- Supabase publishable key may be used in the browser with correct RLS and grants.
- Supabase secret/service-role key must remain server-side.
- Google OAuth client secret and refresh tokens must remain server-side.
- Never hardcode credentials.
- Never commit secrets into GitHub.
- Do not place privileged keys in `VITE_` or other client-exposed environment variables.

## 19.3 Data ownership

Every task, project, time entry, reminder, calendar link and profile preference must be scoped to its authenticated owner.

## 19.4 Sensitive claims

Do not advertise zero-knowledge encryption, end-to-end encryption, guaranteed offline persistence, device key recovery or security certifications unless they are genuinely implemented and independently verified.

---

# 20. Error handling and edge cases

The application must provide clear feedback for:

- Sign-in link invalid/expired.
- Email sending failure/rate limit.
- Network unavailable.
- Task save failure.
- Project save failure.
- Timer start/pause/resume/stop failure.
- A timer already running for another task.
- Calendar disconnected/revoked permission.
- Calendar event create/update/delete failure.
- Duplicate sync retry.
- Invalid date/time combination.
- Invalid or zero planned duration.
- Invalid manual entry range.
- Export generation failure.
- Notification permission denied/unsupported.

A Calendar failure must not prevent the task from being saved. A report/export failure must not modify task or time data. A timer action must not appear successful until its persistence operation succeeds.

---

# 21. Non-functional requirements

## 21.1 Performance

- Fast first load on ordinary desktop and mobile connections.
- Avoid unnecessary dashboard re-fetching.
- Paginate or constrain long history lists.
- Keep timer display updates lightweight.

## 21.2 Reliability

- Database timestamps are authoritative.
- Timer actions are transactional and idempotent where practical.
- Prevent more than one open automatic entry per user.
- Preserve work history when a task is edited, completed or archived.
- Calendar sync retries must not create duplicate events.

## 21.3 Accessibility

- Target WCAG AA contrast.
- Visible keyboard focus.
- Accessible labels for icon-only controls.
- Colour is not the only status indicator.
- Mobile touch targets approximately 44 × 44 CSS pixels where practical.
- Respect reduced motion and browser zoom.

## 21.4 Compatibility

Support current evergreen Chrome/Edge/Safari browsers to the extent their PWA and notification capabilities allow. Clearly handle platform differences. Do not promise identical install, push or background behaviour in all browsers.

---

# 22. Development milestones and delivery plan

Implement in small, testable milestones. Do not generate the entire production product in one step.

## Milestone 0 – Project foundation

- Create React + TypeScript application in AI Studio's supported environment.
- Establish project folders, routing and application shell.
- Implement design tokens and reusable shell components.
- Set up environment configuration and `.env.example`.
- Prepare Supabase client/server configuration without real secrets.
- Create PWA manifest and icon references.
- Add README, ARCHITECTURE and IMPLEMENTATION_PLAN.
- Confirm build and preview work.

**Exit criteria:** project runs; desktop/mobile shell and routes work; no fake backend claims; no secrets in source.

## Milestone 1 – Supabase and authentication

- Configure Supabase project and environment variables.
- Configure passwordless Magic Link.
- Configure redirect URLs and email delivery.
- Implement sign-in, verification callback, error/retry states and sign-out.
- Protect application routes.
- Create profile on first authorized sign-in if appropriate.
- Add RLS and auth tests.

**Exit criteria:** real email link sign-in works; unauthenticated access is blocked; sign-out works; account is owner-only for MVP.

## Milestone 2 – Database, projects and tasks

- Create migrations for profiles, projects and tasks.
- Create RLS policies and tests.
- Implement project CRUD/archive.
- Implement task create/edit/archive/complete/delete.
- Implement Today, Upcoming, Inbox, All and Completed views.
- Implement validation, filters and sorting.

**Exit criteria:** task data persists after reload and is isolated by user.

## Milestone 3 – Timer and time entries

- Create time_entries and active_timer_state.
- Implement transactional start, pause, resume, stop, switch and complete flows.
- Enforce one timer context per user and one open automatic entry.
- Implement manual time entry and edit/delete validation.
- Implement timestamp-based recovery.
- Implement saved/live/active duration calculations.
- Add unit and integration tests for time formulas and state transitions.

**Exit criteria:** timer values remain correct after navigation/reload/reopen; no double counting; only one current timer context.

## Milestone 4 – Google Calendar

- Configure Google Cloud project and Calendar API.
- Configure OAuth consent, client credentials, redirect URIs and required scopes.
- Implement secure server-side authorization-code flow.
- Store/retrieve credentials securely.
- List selectable calendars.
- Implement event create/update/delete and mapping table.
- Implement one-way sync and retry/idempotency behaviour.

**Exit criteria:** scheduled task creates one event; task updates update the same event; no duplicate event; failures do not lose tasks.

## Milestone 5 – Reports and export

- Implement saved-work queries.
- Implement Daily, Weekly, Monthly and Custom reports.
- Implement project/task summaries.
- Implement XLSX and CSV export.
- Add reconciliation tests for task/session totals.

**Exit criteria:** report totals reconcile with saved time entries; exports contain accurate rows.

## Milestone 6 – Reminders and PWA completion

- Implement app reminder preferences.
- Implement browser permission flow and in-app reminder fallback.
- Implement Web Push only if server scheduling and delivery can be supported reliably.
- Complete manifest, icons, service worker and update flow.
- Test installation on supported Mac and mobile browsers.

**Exit criteria:** installable PWA works; permission states are clear; notification claims match actual capability.

## Milestone 7 – QA, hardening and deployment

- Test all critical flows on desktop and mobile.
- Test RLS and authentication boundaries.
- Test timer edge cases and data reconciliation.
- Test Calendar reconnect/failure/duplicate handling.
- Test export and timezone/date formatting.
- Fix critical and high-severity bugs.
- Connect final deployment and production environment variables.
- Document backup, restore and deployment procedures appropriate to the chosen hosting plan.

**Exit criteria:** all P0/P1 acceptance tests pass and the owner can use the application end-to-end.

---

# 23. Acceptance criteria – MVP release gate

The app is not ready for release until all items below pass.

## Authentication
- A user can sign in using a valid email Magic Link.
- Invalid/expired links show useful recovery actions.
- A signed-out user cannot open private app routes.
- Sign out works.

## Tasks and projects
- User can create/edit/archive projects.
- User can create/edit/complete/archive/delete tasks.
- User can create unscheduled Inbox tasks.
- User can schedule Today and future tasks.
- Start Time cannot exist without Scheduled Date.
- Planned Duration is optional and validated when provided.
- Task data persists after reload.

## Timer
- Only one current timer context per user.
- Only one open automatic time entry per user.
- Start, Pause, Resume, Stop and Switch work correctly.
- Stop does not complete the task.
- Completing a running task saves the active entry first.
- Reload/reopen does not reset elapsed time.
- Manual entries contribute to actual time.
- Saved and active time are not double-counted.

## Planned vs Actual
- Actual time is derived from time entries.
- Time Difference is actual minus planned.
- No estimate does not show a fabricated variance.
- Dashboard/Task Details live values are labelled correctly.
- Reports and exports reconcile with saved entries.

## Google Calendar
- Only one-way sync is implemented.
- A date-only task creates an all-day event when sync is enabled.
- A timed task uses planned duration or configured default duration.
- An unscheduled task creates no event.
- Rescheduling updates the existing event.
- Retry does not create duplicates.
- Completing a task leaves the event in place.
- Moving to Inbox deletes the linked app-created event or records a retryable delete failure.
- Disconnecting does not silently delete existing events.
- Task save succeeds even if Calendar sync fails.

## Reports and export
- Daily/weekly/monthly/custom filters work.
- Totals reconcile with time entries.
- Future scheduled tasks do not appear as recorded actual work.
- XLSX and CSV exports are valid and accurate.

## PWA and responsive UI
- App has a valid manifest and icons.
- App is installable on supported browsers.
- Desktop/mobile navigation works.
- No horizontal overflow at 390px and 360px.
- Sticky controls do not cover content.
- App accurately explains notification and offline limitations.

---

# 24. Open decisions and assumptions

These are the remaining items that should be confirmed during implementation rather than silently guessed:

1. **Initial account allowlist:** the initial private account should be pre-provisioned or restricted by a server-side allowlist. Confirm the exact email in Supabase, not in source code.
2. **Calendar default:** after the Google account is connected, automatic sync for newly scheduled tasks should default to enabled, matching the user's stated preference. The user can disable it globally or per task.
3. **When task-level Calendar sync is turned off after an event exists:** keep the existing event unchanged and stop updates; provide a separate explicit Remove from Google Calendar action.
4. **When global sync is disabled:** retain existing events and pause future synchronization; reconcile on re-enable.
5. **Reminder delivery:** foreground/in-app reminders are baseline. Background Web Push is conditional on reliable server scheduling and browser support.
6. **Offline editing:** not part of the first release. The app is online-first; only a clear offline state and timer display based on the last known timestamp are expected until a tested offline queue is explicitly added.
7. **Hosting:** decide between Cloud Run and Vercel after the full-stack project is tested and actual usage/cost implications are understood.
8. **Date format default:** use a sensible default for the initial profile and let the user change it in Settings. Do not hardcode one format into every screen.

---

# 25. Glossary

- **Task:** A single work item.
- **Project:** An optional grouping for tasks.
- **Scheduled Date:** The local date on which the task is planned.
- **Scheduled Start Time:** Optional local start time on the scheduled date.
- **Planned Duration:** Optional estimate in minutes.
- **Time Entry / Work Session:** A recorded interval or manual duration of work against a task.
- **Saved Work Time:** Sum of closed work entries.
- **Current Active Session:** Elapsed time for the currently open automatic entry.
- **Live Actual Time:** Saved time plus the current active session.
- **Task Status:** To Do, In Progress or Completed.
- **Timer State:** Idle, Running, Paused, Stopped or Recovering.
- **Inbox:** Unscheduled tasks.
- **All-Day Event:** Google Calendar event using date-only start/end values.
- **One-Way Sync:** My Work Planner updates Google Calendar; Calendar edits do not update My Work Planner.

---

# 26. Technical reference links

These are implementation references, not additional product requirements:

- Google AI Studio Build Mode: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- Supabase passwordless email authentication: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Supabase React Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/react
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase secure data guidance: https://supabase.com/docs/guides/database/secure-data
- Google OAuth web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Google Calendar events insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Google Calendar events update: https://developers.google.com/workspace/calendar/api/v3/reference/events/update
- Google Calendar calendar list: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list
- Google Calendar event concepts (timed/all-day): https://developers.google.com/workspace/calendar/api/concepts/events-calendars
- PWA installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable

---

**End of PRD v1.2 – Consolidated Development Baseline**
