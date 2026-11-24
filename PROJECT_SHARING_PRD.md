# Product Requirements Document (PRD) — Project Sharing & Client Collaboration

## 1. Executive Summary & Vision

**My Work Planner** is an individual-first productivity application built for freelancers, consultants, agency leads, and solopreneurs. While its core purpose is private, focused execution (with persistent timers, native floating widgets, and calendar integration), real-world solo professionals frequently need to share progress, deliverables, and milestone status with their external clients.

This PRD defines the **Project Sharing & Client Portal** evolution. It enables owners to securely invite clients into dedicated, restricted project portals without turning the application into an overwhelming enterprise team-management platform (such as Jira or Asana).

---

## 2. Core User Personas

### 2.1 Workspace Owner (Primary User)
- **Profile**: Freelance developer, product designer, fractional executive, or independent consultant.
- **Goals**:
  - Keep internal notes, private tasks, and work sessions completely confidential by default.
  - Selectively share approved client deliverables with clients.
  - Control client visibility into logged work hours and remaining estimates.
  - Collect client feedback and questions directly in context rather than scattered across email or WhatsApp.

### 2.2 External Client Collaborator (Invited User)
- **Profile**: Founder, marketing manager, product owner, or corporate sponsor paying for services.
- **Goals**:
  - View current milestone status (`on_track`, `at_risk`, `delayed`, `completed`) and target completion date.
  - Review only approved deliverables without seeing internal brainstorms or messy work logs.
  - Leave threaded questions or comments on specific deliverables or general project threads.
  - Access a clear, lightweight Client Inbox alerting them to owner replies and official status updates.

---

## 3. Product Principles & Invariants

1. **Private by Default**: All tasks, projects, time entries, and calendar sync jobs are 100% private to the owner unless explicitly shared.
2. **Granular Task Visibility**: Tasks inside a shared project default to `client_visible = false` (Internal Only). The owner must explicitly toggle `client_visible = true` for a task to be exposed to clients.
3. **Owner-Controlled Telemetry**:
   - `client_view_time_tracking`: Owner chooses whether clients see logged work hours.
   - `client_view_remaining_estimate`: Owner chooses whether clients see remaining minutes.
   - `client_view_task_dates`: Owner chooses whether clients see scheduled dates.
   - `client_allow_comments`: Owner chooses whether clients can post messages and replies.
4. **No Heavy Enterprise Overhead**: No complex hierarchical role systems (Admin, Manager, Contributor, Guest). There are only two clean roles: **Owner** and **Client**.
5. **Single-Use Cryptographic Invitations**: Invitations are issued via single-use, 24-byte random hex tokens stored only as SHA-256 hashes in the database.

---

## 4. Functional Specifications

### 4.1 Owner Project Sharing Controls (`/projects/:id`)
- **Share Project Button & Modal**:
  - Email invitation input with optional personal welcome note.
  - 1-click single-use invitation link copying fallback.
  - Member management table: view active client members, joined dates, remove member.
  - Pending invitations table: view pending invites, expiration dates, revoke invitation.
  - Granular visibility toggles: time tracking, remaining estimate, scheduled dates, comments.
  - Client project status dropdown (`on_track`, `at_risk`, `delayed`, `completed`).
  - Target completion date selector.

### 4.2 Client Portal (`/portal` & `/portal/projects/:id`)
- **Shared Projects Grid (`/portal`)**:
  - Card view showing project name, client status badge, progress bar (computed strictly over client-visible tasks), target date, and owner name.
- **Project Workspace (`/portal/projects/:id`)**:
  - **Overview**: Progress percentage, target date, total deliverables count, logged time (if enabled), remaining estimate (if enabled).
  - **Deliverables**: Read-only task list displaying approved client-visible tasks with status (`todo`, `in_progress`, `completed`), priority, and scheduled dates.
  - **Discussions**: Real-time threaded discussion forum with replies, resolution tracking, and owner badges.
  - **Milestone Updates**: Historical timeline of official updates published by the owner.

### 4.3 Discussions & Comments
- **Project-Level & Task-Level Threads**: Comments can be attached to the project overall or to a specific client-visible task.
- **Author Identity Badges**: Visually distinguishes `Owner` (Electric Blue) from `Client` (Violet Purple).
- **Thread Resolution**: Either author or owner can mark a discussion thread as resolved once questions are answered.
- **Optimistic Posting**: Immediate UI feedback when sending messages or replies.

### 4.4 Inboxes
- **Client Inbox (`/portal/inbox`)**: Shows owner replies and project updates for the invited client.
- **Owner Client Inbox (`/client-inbox`)**: Dedicated notification center in the owner's workspace alerting the owner to client questions, comments, replies, and invitation acceptances across all client initiatives.

---

## 5. Success Metrics
- **Zero Data Leakage**: 100% of internal-only tasks remain inaccessible via API or database queries to external clients.
- **Quick Onboarding**: Client invitation acceptance and portal view loaded in under 2 seconds.
- **Reduced Status Meeting Overhead**: Clients can inspect progress and ask questions asynchronously.
