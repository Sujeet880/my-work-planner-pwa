# My Work Planner — Codebase Architecture & Service Guide

This document establishes the official architectural standards, module boundaries, and service patterns for My Work Planner. All future features and AI coding sessions must adhere to these guidelines to avoid duplicate implementations, dead components, and architectural divergence.

---

## 1. Directory Structure & Module Responsibilities

```text
my-work-planner/
├── .vscode/                               # Workspace configuration (Deno & TypeScript)
│   ├── settings.json                      # Scopes Deno language server exclusively to ./supabase/functions
│   └── extensions.json                    # Recommended extensions (denoland.vscode-deno)
├── docs/                                  # Administrative & deployment runbooks
│   └── EMAIL_TEMPLATES_SETUP.md           # Supabase Auth dashboard email template configuration guide
├── src/
│   ├── components/                        # Reusable and cross-feature UI components
│   │   ├── auth/                          # Route guards (ProtectedRoute, OwnerRoute, ClientPortalRoute)
│   │   ├── discussions/                   # Project discussion components (CommentThread, ProjectDiscussionsView)
│   │   ├── layout/                        # Shell layout, navigation bar, top bar (AppShell)
│   │   ├── pwa/                           # PWA installation and offline status indicators
│   │   ├── sharing/                       # Project sharing and client invitation modals (ShareProjectModal)
│   │   ├── tasks/                         # Task forms, modals, rows (TaskFormModal, TaskRow)
│   │   ├── timer/                         # Persistent focus timer UI (ActiveTimerCard, ManualTimeEntryModal)
│   │   └── ui/                            # Atomic design system components (Button, Modal, Badges, Field, MetricCard)
│   ├── context/                           # React Context providers (AuthContext, WorkspaceContext)
│   ├── data/                              # Static configuration, mock data (previewData)
│   ├── features/                          # Feature pages and page-level sub-components
│   │   ├── auth/                          # Sign-in, sign-up, password reset pages (SignInPage, ResetPasswordPage, ForgotPasswordPage)
│   │   ├── dashboard/                     # Primary owner dashboard (DashboardPage, WorkOverview, TodayTaskList)
│   │   ├── inbox/                         # Owner client message inbox (OwnerClientInboxPage)
│   │   ├── portal/                        # Client-facing portal (SharedProjectsPage, ClientProjectWorkspacePage, AcceptInvitationPage, ClientInboxPage)
│   │   ├── projects/                      # Owner project management (ProjectsPage, ProjectDetailsPage)
│   │   ├── reports/                       # Analytics and time tracking reports (ReportsPage)
│   │   ├── settings/                      # User settings & integrations (SettingsPage, GoogleCalendarPage)
│   │   ├── tasks/                         # Task list & detail views (MyTasksPage, TaskDetailsPage)
│   │   └── time-tracker/                  # Dedicated time tracking view (TimeTrackerPage)
│   ├── hooks/                             # Reusable React hooks (useOnlineStatus, usePWAInstall)
│   ├── lib/                               # Core shared runtime utilities
│   │   ├── env.ts                         # Environment variable access and validation
│   │   ├── redirectUrl.ts                 # Canonical environment-aware URL generation (single source of truth)
│   │   ├── supabaseClient.ts              # Browser Supabase client singleton
│   │   └── timeMath.ts                    # Pure time calculation, duration formatting, variance calculation
│   ├── services/                          # Single-source-of-truth backend API services & unit tests
│   │   ├── calendarService.ts             # Google Calendar integration service & sync queue dispatcher
│   │   ├── discussionService.ts           # Project discussions & comment threads service
│   │   ├── projectService.ts              # Projects CRUD and metadata service
│   │   ├── pushService.ts                 # Web Push notification subscription & registration
│   │   ├── reminderService.ts             # Task reminders & notification offset calculations
│   │   ├── reportService.ts               # Analytics aggregation & CSV/XLSX export service
│   │   ├── sharingService.ts              # Project membership, invitation tokens, client sharing service
│   │   ├── taskService.ts                 # Tasks CRUD and ordering service
│   │   └── timerService.ts                # Persistent timer & work session history service
│   └── types/                             # TypeScript domain models and Supabase schema types
│       ├── database.types.ts              # Generated Supabase database schema types
│       ├── models.ts                      # Frontend application models (Task, Project, TimeEntry, etc.)
│       └── sharing.ts                     # Collaboration models (ProjectMember, ProjectInvitation, etc.)
├── supabase/
│   ├── functions/                         # Supabase Edge Functions (Deno TypeScript runtime)
│   │   ├── _shared/                       # Shared Edge Function modules (CORS, Google OAuth, AES crypto)
│   │   ├── deno.json                      # Edge function compiler and linting configuration
│   │   ├── dispatch-task-reminders/       # Scheduled Web Push notification dispatcher
│   │   ├── google-calendar-auth/          # Google Calendar OAuth 2.0 flow & token management
│   │   ├── google-calendar-sync/          # Google Calendar bidirectional synchronization engine
│   │   └── send-client-invitation/        # Secure client invitation generator & email dispatcher
│   ├── migrations/                        # Chronological PostgreSQL schema migrations
│   └── templates/                         # Branded HTML email templates for Supabase Auth & transactional email
└── ARCHITECTURE_GUIDE.md                  # This file
```

---

## 2. Core Architectural Rules

### 2.1 Never Create Duplicate Components or Shims
- **Modals vs Drawers:** All tasks use centered modals (`TaskFormModal`). Do not re-create side drawers (`TaskFormDrawer`) or create compatibility re-export shims.
- **Components:** Before creating a component, verify if an existing one in `src/components/` covers the use case.
- **Dead Code:** Never create `_new`, `_backup`, or `deprecated` files. Rely on Git history for version tracking.

### 2.2 Backend & Data Service Single Source of Truth
- All Supabase interactions must go through the dedicated domain service in `src/services/` (e.g. `sharingService`, `taskService`, `projectService`).
- **Never call `supabase.from(...)` directly inside React components**; delegate to the corresponding service.
- All service operations must have comprehensive test coverage in `src/services/<service>.test.ts`.

### 2.3 Strict Separation: Owner vs Client Workspaces
- **Owner Role:** Has full access to personal tasks, timers, Google Calendar integration, reports, and settings.
- **Client Role:** Strictly restricted to `/portal` routes. External clients cannot access `/dashboard`, `/tasks`, `/time-tracker`, or `/settings`.
- **Database Row-Level Security (RLS):** Database policies enforce that clients can only read projects explicitly shared via accepted `project_members` records, and only view tasks marked `client_visible = true`.
- **Active Clients vs Pending Invitations:**
  - A user with a pending invitation is **never** displayed as an Active Client.
  - Active Clients are strictly filtered by `membership_status = 'accepted'`.
  - Joined date is derived strictly from `member.acceptedAt` (never falling back to invitation `createdAt`).

### 2.4 Project Invitations & Token Security
- **Secure Randomness:** Tokens are 48-character hex strings generated via `crypto.getRandomValues`.
- **Hashed Storage:** Raw tokens are never stored in the database. Only SHA-256 digests (`token_hash`) are persisted.
- **Single-Use & Invalidation:** Accepting or reissuing an invitation invalidates previous tokens.
- **Email Delivery Separation:**
  - Invitation lifecycle (`pending`, `accepted`, `expired`, `revoked`) is decoupled from email delivery status (`queued`, `sent`, `failed`).
  - Copying an invitation link does not mark email delivery as sent and does not increment `resend_count`.
  - Resending email triggers actual provider dispatch and increments `resend_count`.
- **Existing User Guard:**
  - The server checks whether the recipient already has an account via `rpc_check_auth_user_status`.
  - `admin.inviteUserByEmail` is only called for new users. Existing users receive project-level invitations without duplicate account creation.

### 2.5 Deno Edge Functions vs Browser TypeScript
- Edge functions in `supabase/functions/` run on **Deno 2.x**.
- The root `tsconfig.json` excludes `supabase/functions`.
- The `.vscode/settings.json` enables Deno exclusively for `./supabase/functions`.
- Run `deno check` and `deno lint` on `supabase/functions/` to validate edge functions independently of Vite.

---

## 3. Email Strategy & Provider Integration

### 3.1 Supabase Auth Emails (SMTP)
- Handled by Supabase Auth for: Password Recovery, Magic Link, Email Confirmation, and Password Changed.
- Configured in Supabase Dashboard &rarr; Settings &rarr; Authentication &rarr; SMTP Settings.
- Branded templates are maintained in `supabase/templates/` and copied to the Supabase Auth Email Templates dashboard.

### 3.2 Application Project Invitations (Edge Function)
- Handled by `supabase/functions/send-client-invitation`.
- Dispatches branded HTML invitations with custom project name, inviter details, and personal notes.
- Uses `RESEND_API_KEY` (and optional `RESEND_FROM_EMAIL`) configured in Supabase Secrets.
- If no transactional email provider is configured, the Edge Function sets `delivery_status = 'failed'` with clear guidance, and provides a direct, secure single-use link for manual sharing (e.g. via WhatsApp, Slack, or direct email).
