# Client Portal Technical Architecture & Routing Specification

## 1. Architectural Overview

The Client Portal (`/portal`) is a restricted, dedicated sub-application within **My Work Planner** designed specifically for external client stakeholders. It operates within the same React + TypeScript + Vite codebase and Supabase backend as the main application, but enforces strict UI isolation, separate routing boundaries, and database-level Row-Level Security (RLS).

---

## 2. Route Hierarchy & Access Control

```
App.tsx
│
├── Public Routes
│   ├── /sign-in                     (Email magic link authentication)
│   ├── /auth/callback               (OAuth / OTP token verification callback)
│   └── /invite/:token               (Public invitation landing page & token verification)
│
├── Owner Workspace (Protected via ProtectedRoute + AppShell)
│   ├── /dashboard                   (Productivity overview & active timers)
│   ├── /tasks                       (Task lists: Scheduled, Today, Upcoming, Inbox)
│   ├── /tasks/:taskId               (Task details, persistent timer, work sessions)
│   ├── /projects                    (Project cards, create project modal)
│   ├── /projects/:projectId         (Project details, tasks, discussions, updates, sharing)
│   ├── /client-inbox                (Owner notifications for client comments & activities)
│   ├── /time-tracker                (Full timer view, manual time entries)
│   ├── /reports                     (Time reports, CSV & XLSX export)
│   └── /settings/*                  (Profile preferences, Google Calendar integration)
│
└── Client Portal (Protected via ProtectedRoute + ClientPortalLayout)
    ├── /portal                      (SharedProjectsPage: lists projects shared with user)
    ├── /portal/projects/:projectId  (ClientProjectWorkspacePage: deliverables, discussions)
    └── /portal/inbox                (ClientInboxPage: notifications for client)
```

---

## 3. Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ ClientPortalLayout                                                     │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Top Client Navbar: [Brand Logo] [Client Portal] [Shared Projects]  │ │
│ │ [Inbox Badge] [Personal Workspace Switcher] [User Avatar / SignOut]│ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Page Content Container                                             │ │
│ │                                                                    │ │
│ │ Choice of:                                                         │ │
│ │  1. SharedProjectsPage                                             │ │
│ │     - Grid of SharedProjectView cards                              │ │
│ │     - Progress calculated strictly over client_visible = true      │ │
│ │     - Time metrics rendered conditionally per owner permissions    │ │
│ │                                                                    │ │
│ │  2. ClientProjectWorkspacePage                                     │ │
│ │     - Header: Project metadata, status badge, target date          │ │
│ │     - Tab 1: Deliverables (Read-only Task list, client_visible=true)│ │
│ │     - Tab 2: Discussions (ProjectDiscussionsView)                  │ │
│ │     - Tab 3: Milestone Updates (Timeline of ProjectUpdate records) │ │
│ │                                                                    │ │
│ │  3. ClientInboxPage                                                │ │
│ │     - Stream of ProjectNotification records                        │ │
│ │     - Filter by Unread / All                                       │ │
│ │     - Mark as Read and direct route jump                           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. State Management & Data Flow

### 4.1 Client Role Isolation
- An authenticated user can be an **Owner** of their personal projects and simultaneously a **Client** on projects shared by other consultants.
- In `ClientPortalLayout`, a "Personal Workspace" quick-link allows dual-persona users to toggle back to `/dashboard` instantly.
- In `AppShell`, a "Client Portal" navigation link appears in the sidebar for easy access to shared workspaces.

### 4.2 Read-Only Enforcement
- External clients have **no write access** to `projects`, `tasks`, `work_sessions`, or `active_timers`.
- Frontend forms for task creation, timer operations, or scheduling are omitted entirely from the `/portal` layout.
- Database RLS policies explicitly reject any `INSERT`, `UPDATE`, or `DELETE` operations from client users on `tasks` or `projects`.

### 4.3 Time Tracking Privacy Controls
- Client portal components verify `project.clientViewTimeTracking` before displaying logged work hours.
- If `clientViewTimeTracking = false`, no work session hours, durations, or variance numbers are returned or rendered.
- If `clientViewRemainingEstimate = false`, remaining estimate minutes are hidden from task cards and project totals.
- If `clientViewTaskDates = false`, scheduled dates and times are suppressed from task lists.

---

## 5. Invitation Acceptance Lifecycle

```
1. Owner sends invitation to client@company.com via ShareProjectModal.
2. System generates:
   - 24-byte cryptographically random hex token (rawToken).
   - SHA-256 hash (tokenHash) stored in public.project_invitations.
   - Pending membership record in public.project_members (status = 'pending').
3. Client opens ${origin}/invite/${rawToken}.
4. If not signed in:
   - Client is redirected to /sign-in with returnTo set to /invite/${rawToken}.
   - Client signs in with their invited email via magic link.
5. On /invite/${rawToken}:
   - Authenticated client clicks "Accept & Join Project".
   - Client calls sharingService.acceptInvitation(rawToken).
   - Backend matches tokenHash, verifies authenticated user email matches invitedEmail.
   - Membership status updates to 'accepted' and user_id is bound.
   - Project owner receives an 'invitation_accepted' notification in their Client Inbox.
   - Client is redirected immediately to /portal/projects/${projectId}.
```
