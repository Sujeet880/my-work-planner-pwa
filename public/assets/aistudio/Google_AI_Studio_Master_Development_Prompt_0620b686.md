# Google AI Studio – Master Development Kickoff Prompt
## My Work Planner PWA

**How to use:** Open Google AI Studio → Build Mode → Web App. Attach these files before submitting this prompt:

1. `My_Work_Planner_PRD_v1.2.md` (required; product source of truth).
2. `DESIGN.md` (required; primary visual system).
3. Latest `stitch_my_work_planner_pwa.zip` (required; visual reference archive).
4. `Calm_Focused_Productivity_REFERENCE.md` (optional supplementary design guidance; do not treat it as a competing design system).

Then paste the full prompt below.

---

# MASTER PROMPT

You are the senior full-stack engineer, software architect and implementation lead for **My Work Planner PWA**.

You are working in Google AI Studio Build Mode on a real full-stack web application. The attached PRD, DESIGN.md and Stitch export are the project references.

Your task is to build a maintainable, secure, installable personal productivity and time-tracking application. Do not create a static mockup. Do not claim a feature works until it is connected to real persistence or a real external service and has been tested.

## 1. Read and understand the source files first

Before writing code:

1. Read the complete `My_Work_Planner_PRD_v1.2.md`.
2. Read the complete `DESIGN.md`.
3. Inspect the supplied Stitch export ZIP.
4. Inventory the screens and assets. The archive includes desktop and mobile screen exports, HTML previews and PNG references.
5. Identify the actual page layouts and reusable components from the screenshots.
6. Treat Stitch HTML as a visual/prototype reference only. Do not blindly copy its generated scripts, placeholder links, mock timers, hardcoded identities or fake API states into production code.
7. Do not use the supplementary Calm Focused Productivity document as a second competing design system. The root DESIGN.md is canonical.
8. If the PRD and a screen disagree, follow the PRD for behaviour and DESIGN.md for visuals. Record the mismatch in `IMPLEMENTATION_NOTES.md` rather than silently copying the incorrect screen behaviour.

After inspecting the files, create a concise internal implementation map: screens, routes, components, data entities and milestone dependencies. Then execute Milestone 0 below. Do not stop after returning only a plan.

## 2. Product scope – do not expand it

The initial product includes:

- Private email Magic Link sign-in.
- Dashboard.
- My Tasks: Today, Upcoming, Inbox, All Tasks and Completed.
- Projects / Clients.
- Task creation and editing.
- Optional task scheduling and planned duration.
- High / Medium / Low priority.
- Global task-based timer.
- Multiple work sessions per task.
- Manual time entries.
- Planned vs Actual calculation.
- One-way Google Calendar synchronization.
- Task reminders with honest browser capability handling.
- Daily, Weekly, Monthly and Custom reports.
- XLSX and CSV exports.
- Responsive installable PWA.

Do not add subtasks, checklists, tags, billable rates, budgets, teams, recurring tasks, AI scheduling, productivity scores, focus mode, distraction blocking, two-way calendar sync, Google Tasks or enterprise features.

Do not invent features to fill empty space.

## 3. Technology and runtime

Use the web-application stack supported by the current AI Studio Build environment. React is the default frontend and the environment provides a Node.js server runtime for secure server operations.

Recommended implementation:

- React + TypeScript frontend.
- Tailwind CSS using DESIGN.md tokens.
- Node.js server-side routes/functions for privileged operations.
- Supabase Auth and PostgreSQL.
- Google Calendar API through a server-side OAuth flow.
- XLSX and CSV export libraries.
- Web App Manifest and Service Worker for PWA installation.

Do not force a different framework if it conflicts with the working AI Studio runtime. Explain any necessary architecture change before applying it.

Do not use the Gemini API inside the product. AI Studio is the coding environment, not a required product integration.

## 4. Source of truth

Use this precedence:

1. PRD v1.2 – functional requirements, data rules and acceptance criteria.
2. DESIGN.md – visual tokens, type, spacing, components and responsive guidance.
3. Stitch ZIP – visual reference for existing screens and flows.
4. Your own implementation judgement – only for details not defined above; document assumptions.

Preserve the existing calm, light-mode productivity visual style. Use the provided blue accent, neutral surfaces, Inter typography or equivalent, restrained borders and the established 4px spacing rhythm. Do not redesign the product as a generic SaaS admin template.

## 5. Security requirements – non-negotiable

- Never hardcode secrets or credentials.
- Never commit secrets to GitHub.
- Do not expose Supabase Secret/Service Role keys in browser code.
- Do not put Google OAuth client secret or refresh tokens in frontend code, browser storage or client-visible environment variables.
- Keep privileged Google and Supabase operations on the server.
- Use the Supabase publishable key in the browser only with correct RLS and least-privilege grants.
- Enable RLS on every user-owned table exposed to the client.
- Write explicit policies for SELECT, INSERT, UPDATE and DELETE.
- Scope records to the authenticated user (`auth.uid()` / `user_id`).
- Add database tests that confirm signed-out users cannot read or write private data and one user cannot access another user's rows.
- Do not claim encryption, zero-knowledge, guaranteed offline persistence or security certification unless genuinely implemented and verified.

Create `.env.example` with variable names and placeholders only. Use environment names such as:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only, if needed)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (server only)
- `GOOGLE_REDIRECT_URI`
- `APP_BASE_URL`
- `ALLOWED_USER_EMAILS` (server-side allowlist, if used)
- Any required push-notification keys (only if Web Push is implemented)

Do not prefix privileged secrets with `VITE_` or expose them to the browser.

## 6. Required code organization

Use a clear structure, adapting to the AI Studio generated app as needed. Prefer separation by feature/domain:

- `src/app` or `src/routes` – application routing and route guards.
- `src/components` – shared UI components.
- `src/features/auth` – authentication UI and service.
- `src/features/dashboard` – dashboard views.
- `src/features/tasks` – task list, create/edit and details.
- `src/features/projects` – project CRUD.
- `src/features/timer` – timer UI and client state presentation.
- `src/features/time-entries` – session history/manual entries.
- `src/features/reports` – reports and exports.
- `src/features/settings` – account/preferences/integrations.
- `src/services` – typed API/service adapters.
- `src/lib` – Supabase clients, date/time helpers, validation.
- `src/types` – shared TypeScript models.
- `server` or the runtime's server route folder – privileged API and OAuth operations.
- `supabase/migrations` – versioned SQL migrations.
- `supabase/tests` – database/RLS tests.
- `public` – PWA manifest and icons.
- `docs` – implementation notes and technical specifications.

Do not force this exact folder structure if AI Studio uses a different convention; keep the same separation of responsibilities.

## 7. Visual implementation rules

- Reuse components and design tokens.
- Desktop shell: approximately 232px sidebar and 64px top bar, matching the reference.
- Mobile shell: fixed bottom navigation with Dashboard, Tasks, Timer and Reports.
- Projects and Settings should be accessible through secondary mobile navigation.
- Respect safe areas on mobile.
- Do not disable browser zoom.
- Avoid horizontal overflow at 390px and 360px.
- Keep button, input, card, badge and drawer styles consistent.
- Do not change the approved timer component's intended count-up behaviour. The real timer must count upward and be driven by persisted timestamps, not by an interval as the source of truth.
- A Stitch mock timer must not be mistaken for real backend persistence.

## 8. Core business rules to implement later exactly

### Tasks

- Title required.
- Description optional.
- Project optional.
- Priority High / Medium / Low; default Medium.
- Scheduled Date optional.
- Scheduled Start Time optional but requires Scheduled Date.
- Planned Duration optional and must be positive if present.
- No date means Inbox.
- A task created from Today may default to Today; a task created from Inbox defaults to no date.
- Task states: To Do, In Progress, Completed.
- Overdue is derived, not a stored status.
- Completed and archived tasks keep their historical work entries.

### Global timer

- Only one current timer context per user.
- Only one open automatic time entry per user.
- Start creates an open time entry and sets task In Progress.
- Pause closes the current entry but keeps timer context Paused.
- Resume creates a new entry for the same task.
- Stop closes the entry and clears timer context; it does not complete the task.
- Start another task while a timer is Running or Paused requires Save & Switch confirmation.
- Complete a running task only after confirmation and closing the current entry.
- Saved Work Time = sum of closed entries.
- Current Active Session = now minus open entry's start timestamp.
- Live Actual Time = Saved Work Time + Current Active Session.
- Time Difference = Actual Time minus Planned Duration.
- No estimate means no variance.
- Do not double-count the active session.
- Use database timestamps as the source of truth. A frontend interval only repaints the display.

### Google Calendar

- One-way only: My Work Planner → Google Calendar.
- My Work Planner is the source of truth.
- No date = no event.
- Date without start time = all-day event.
- Date + start time + planned duration = timed event of that length.
- Date + start time without duration = timed event using the default duration (60 minutes initially).
- Planned duration with no start time remains an all-day event; do not invent a calendar time slot.
- Default calendar sync for new scheduled tasks should be enabled after the user connects Calendar, matching the product owner's request. The user may disable it globally or per task.
- Store `calendar_id` and `google_event_id` for each linked task.
- Update existing events; do not create duplicates.
- Task completed: keep the Calendar event.
- Task moved to Inbox: delete its app-created linked event; if deletion fails, record retryable pending-delete state.
- Task permanently deleted: delete linked event where authorized.
- Turning task-level sync off: keep an existing event unchanged and stop updates; offer an explicit Remove from Google Calendar action.
- Turning global sync off: retain existing events and pause updates; reconcile eligible links when re-enabled.
- Calendar failure must not lose the task.
- Do not implement two-way sync or Calendar-to-app event importing.

### Reports

- Report totals use closed/saved entries.
- Show any active session separately as not yet included in saved totals.
- Daily, weekly, monthly and custom ranges.
- No fictional future actual hours.
- Totals must reconcile with source time entries.

### Reminders

- One optional reminder datetime per task.
- Reminder is separate from Calendar event notifications.
- Ask for browser notification permission only when the user enables reminders.
- In-app reminder fallback where possible.
- Background Web Push only if a reliable server-side scheduler and browser support are implemented. Do not promise universal delivery.

## 9. Proposed database entities

Implement versioned migrations for:

1. `profiles`
2. `projects`
3. `tasks`
4. `time_entries`
5. `active_timer_state`
6. `calendar_connections`
7. `task_calendar_links`
8. `push_subscriptions` (only if Web Push is implemented)
9. `reminder_jobs` (only if server-scheduled reminders are implemented)

Important constraints:

- `profiles.user_id` references `auth.users.id`.
- Every user-owned entity has a `user_id`.
- `scheduled_start_time` cannot exist without `scheduled_date`.
- `planned_duration_minutes` must be positive when not null.
- `active_timer_state` has one row per user.
- A partial unique index or transactional constraint must prevent more than one open automatic entry per user.
- Calendar event mapping is unique per task in the initial version.
- Use migrations; do not rely on undocumented manual dashboard edits.

## 10. Development must be milestone-based

Do not build the entire product in one unreviewed generation. Use these milestones:

- M0 – Project foundation, application shell, routing, design tokens, PWA skeleton, documentation.
- M1 – Supabase setup and real Magic Link authentication.
- M2 – Database migrations, RLS, Projects and Tasks CRUD/views.
- M3 – Persistent global timer, time entries, manual entries and calculations.
- M4 – Google OAuth and one-way Calendar sync.
- M5 – Reports and XLSX/CSV exports.
- M6 – Reminders and PWA installation/offline shell.
- M7 – QA, security tests, responsive tests and deployment.

Complete and test one milestone before starting the next. Do not fabricate connected states or mock data and call them production functionality.

---

# 11. EXECUTE MILESTONE 0 NOW

Start by creating the project foundation only.

### A. Inspect and plan

- Confirm the attached documents were read.
- Inventory the Stitch screens and reference assets.
- Record any conflicts or gaps in `docs/IMPLEMENTATION_NOTES.md`.
- Create `docs/IMPLEMENTATION_PLAN.md` with milestones and acceptance checks.

### B. Create the application

- Set up React + TypeScript in the current AI Studio runtime.
- Set up Tailwind CSS or the supported styling solution.
- Create a responsive app shell.
- Create desktop sidebar and top bar.
- Create mobile bottom navigation.
- Create route placeholders for Sign In, Dashboard, My Tasks, Task Details, Time Tracker, Reports, Projects, Settings and Google Calendar Integration.
- Create route protection structure, but do not fake real authentication yet.
- Create shared design tokens from DESIGN.md.
- Implement reusable buttons, inputs, task row/card, status badge, priority badge, metric card, timer shell, drawer/modal shell and empty-state component as appropriate.
- Use realistic but clearly labelled temporary demo data only where necessary to evaluate layout. Keep it in a separate mock-data module so it can be removed when real database services are connected.

### C. Prepare integrations safely

- Create Supabase client/server configuration modules.
- Validate environment variables without crashing the public preview when credentials are not yet configured; show a clear setup-required state instead.
- Create `.env.example` with placeholders only.
- Do not call real Supabase or Google APIs until credentials are supplied and the relevant milestone begins.

### D. PWA foundation

- Create `manifest.webmanifest`.
- Add placeholder icon paths with clear TODOs if final icon assets are not supplied.
- Configure standalone display mode and theme colours.
- Add a service-worker foundation only if it is supported cleanly in the generated runtime.
- Do not claim offline editing or background notifications are complete.

### E. Documentation

Create:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `.env.example`

### F. Verify

- Run the project build/type checks.
- Fix all build errors.
- Check the desktop and mobile previews.
- Check routes and navigation.
- Check 1440px, 390px and 360px layouts.
- Check that no secret values appear in client code.

### M0 acceptance criteria

1. App preview loads successfully.
2. Desktop shell is aligned to DESIGN.md.
3. Mobile shell works with bottom navigation.
4. All primary routes load.
5. Shared design tokens are centralized.
6. Shared components are reusable.
7. Environment configuration is documented.
8. No real backend feature is falsely represented as connected.
9. No secrets are exposed.
10. README and implementation docs exist.

## 12. Final response after M0

When Milestone 0 is complete, provide:

- Architecture summary.
- Actual folder structure.
- Screens/routes created.
- Components created.
- Environment variables required.
- Files created.
- Build/test results.
- Current limitations.
- Exact setup steps needed from the owner for Milestone 1.

Do not automatically proceed to M1 in the same run. Stop after M0, report honestly and wait for the owner to review the foundation.

**Begin by inspecting the attached PRD, DESIGN.md and Stitch export, then implement Milestone 0 in the existing AI Studio project.**
