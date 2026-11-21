# My Work Planner — Task Reminders Model & Lifecycle

## Overview

Task reminders allow users to receive timely alerts before their scheduled work sessions. Reminders integrate directly with task scheduling and enforce strict lifecycle synchronization.

---

## 1. Database Schema (`public.task_reminders`)

Created in migration `20261121000004_task_reminders_and_push_subscriptions.sql`:

```sql
create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  remind_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Foreign key ensuring cross-user isolation
  constraint task_reminders_task_user_fkey foreign key (task_id, user_id)
    references public.tasks(id, user_id) on delete cascade
);
```

### Key Constraints & Indexes
1. **Unique Scheduled Partial Index**:
   ```sql
   create unique index idx_task_reminders_task_scheduled
     on public.task_reminders(task_id)
     where status = 'scheduled';
   ```
   Guarantees that a task can have at most one pending reminder scheduled at any time.
2. **Dispatcher Index**:
   ```sql
   create index idx_task_reminders_due
     on public.task_reminders(status, remind_at)
     where status = 'scheduled';
   ```
   Optimizes background polling queries for due reminders.

---

## 2. Lead Time Options & User Preferences

### Standard Offset Options
- **0 minutes**: At start time
- **5 minutes**: 5 minutes before
- **10 minutes**: 10 minutes before
- **15 minutes**: 15 minutes before (Application Default)
- **30 minutes**: 30 minutes before
- **60 minutes**: 1 hour before
- **Custom**: User-specified positive integer in minutes

### User Profile Preference
Users can configure their default lead time in **Settings → Reminders & Push Notifications**.
Persisted to `public.profiles.default_reminder_offset_minutes` (default: 15).

---

## 3. Lifecycle Rules & Trigger

### Database Trigger: `tr_tasks_reminder_lifecycle`
Runs `after update on public.tasks`:
- If `status = 'completed'`: cancels pending reminder.
- If `is_archived = true`: cancels pending reminder.
- If `scheduled_date is null` (moved to Inbox): cancels pending reminder.

### Application Service Layer (`src/services/reminderService.ts`)
- **Task Creation**: If reminder offset is set and date is present, calls `upsert_task_reminder`.
- **Task Rescheduling**: Shifts `remind_at` when date or start time changes.
- **Task Reopening**: If a task was completed and is reopened, checks whether `remind_at` is in the future; if so, recreates the reminder.
- **Task Deletion**: Calls `cancel_task_reminder`.
