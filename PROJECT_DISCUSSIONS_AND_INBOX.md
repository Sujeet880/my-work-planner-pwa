# Project Discussions & Client Inbox System Specification

## 1. Overview & Objectives

Collaborative communication in **My Work Planner** provides a clean, in-context message exchange between the project owner and invited external clients. It avoids cluttered third-party channels (like Slack or endless email threads) by attaching discussions directly to the relevant project or deliverable.

---

## 2. Threading Data Model

Discussions are structured hierarchically using `public.project_comments`:

```
public.project_comments
├── id: uuid (PK)
├── project_id: uuid (FK -> public.projects)
├── task_id: uuid null (FK -> public.tasks, null for project-level threads)
├── parent_comment_id: uuid null (FK -> self, null for top-level threads)
├── author_id: uuid (FK -> auth.users)
├── body: text (validated non-empty)
├── resolved_at: timestamptz null
├── resolved_by: uuid null
├── created_at: timestamptz
├── updated_at: timestamptz
└── deleted_at: timestamptz null (soft delete)
```

### 2.1 Thread Hierarchy & Reply Nesting
- **Top-Level Comment**: `parent_comment_id IS NULL`. Represents a distinct discussion thread or question.
- **Nested Reply**: `parent_comment_id IS NOT NULL`. Attached as a response to the top-level comment.
- The UI nests replies cleanly with a visual indent and border line, preventing unbounded recursive indentation while preserving full conversational clarity.

### 2.2 Task Scoping
- If `task_id IS NULL`: The comment is a general project-level discussion (e.g., contracts, overall deadlines, feedback).
- If `task_id IS NOT NULL`: The comment is bound to that specific task (e.g., feedback on a specific design or deliverable).
- In `ProjectDiscussionsView`, users can filter threads by task or view all discussions across the project.
- In `TaskDetailsPage`, the task's discussions are embedded directly below work sessions.

---

## 3. Thread Resolution Mechanics

To keep client feedback actionable, discussion threads can be resolved once addressed:
- **Resolution Trigger**: Either the comment author or the project owner clicks "Resolve".
- **Database Effect**: `resolved_at` is stamped with `now()` and `resolved_by` records the user's ID.
- **Visual State**: Resolved threads receive an emerald checkmark badge (`Resolved`) and a gentle green background.
- **Filter**: Discussions can be toggled between `All`, `Active`, and `Resolved` using filter pills.
- **Reopen**: Resolved threads can be reopened at any time if further questions arise.

---

## 4. Notifications & Dual-Inbox Architecture

### 4.1 Notification Triggers & Dispatching
Whenever a communication event occurs, `discussionService` dispatches a `project_notifications` record:

| Event | Notification Type | Recipients | Trigger Rule |
| :--- | :--- | :--- | :--- |
| Client posts comment | `project_comment` / `task_comment` | Project Owner | Author is not owner |
| Owner replies to comment | `comment_reply` | Thread author & project members | Recipient is not author |
| Client replies to comment | `comment_reply` | Project owner & other members | Recipient is not author |
| Owner posts project update | `project_update` | All accepted client members | Recipient is not author |
| Client accepts invite | `invitation_accepted` | Project Owner | Owner notified of acceptance |

> [!NOTE]
> Self-notification prevention: The dispatch logic enforces `recipient_user_id != author_id` so users never receive notifications for their own comments or actions.

### 4.2 Owner Client Inbox (`/client-inbox`)
- Placed in the owner's main sidebar navigation with an icon (`MessageSquareQuote`).
- Aggregates client comments, replies, deliverable questions, and invitation acceptances across all owned projects.
- Features:
  - Filter by project dropdown (`All Projects` or specific project).
  - Unread toggle (`Showing Unread` vs `Show All`).
  - One-click "Mark All Read" button.
  - Clicking any notification marks it as read and jumps directly to the project's discussions view.

### 4.3 Client Inbox (`/portal/inbox`)
- Dedicated notification center in the Client Portal header.
- Displays an unread badge with real-time count.
- Aggregates owner replies, task feedback, and published milestone updates.
- Clicking any notification jumps directly to `/portal/projects/:id` to inspect the deliverable and reply.
