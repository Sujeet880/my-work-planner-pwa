-- ==============================================================================
-- My Work Planner — Milestone 8: Reminders, PWA & Push Notifications
-- Migration: 20261121000004_task_reminders_and_push_subscriptions.sql
-- Tables:
--   1. task_reminders
--   2. push_subscriptions
-- Enhancements:
--   - Add default_reminder_offset_minutes to profiles
--   - Automatic trigger to cancel scheduled reminders on task completion / archive / inbox move
--   - Helper RPCs for reminder management
-- Security: Strict Row Level Security (RLS), role-based grants, cross-user isolation
-- ==============================================================================

-- 1. Extend profiles with default reminder lead time
alter table public.profiles
  add column if not exists default_reminder_offset_minutes integer not null default 15
  check (default_reminder_offset_minutes >= 0);

-- ==============================================================================
-- Table 1: task_reminders
-- Dedicated execution and audit log for task reminder dispatching
-- ==============================================================================
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

alter table public.task_reminders enable row level security;

-- Updated_at trigger for task_reminders
drop trigger if exists tr_task_reminders_updated_at on public.task_reminders;
create trigger tr_task_reminders_updated_at
  before update on public.task_reminders
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Table 2: push_subscriptions
-- Multi-device Web Push endpoints and encryption keys per user
-- ==============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,

  -- Unique endpoint per user
  constraint uq_push_subscriptions_user_endpoint unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- ==============================================================================
-- Performance & Lookup Indexes
-- ==============================================================================

-- task_reminders indexes
create index if not exists idx_task_reminders_user_id on public.task_reminders(user_id);
create index if not exists idx_task_reminders_task_id on public.task_reminders(task_id);

-- Unique partial index: At most one 'scheduled' reminder per task
create unique index if not exists idx_task_reminders_task_scheduled
  on public.task_reminders(task_id)
  where status = 'scheduled';

-- Dispatcher lookup index: fast retrieval of pending due reminders
create index if not exists idx_task_reminders_due
  on public.task_reminders(status, remind_at)
  where status = 'scheduled';

-- push_subscriptions indexes
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

-- task_reminders RLS
drop policy if exists "task_reminders_user_select" on public.task_reminders;
create policy "task_reminders_user_select"
  on public.task_reminders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "task_reminders_user_insert" on public.task_reminders;
create policy "task_reminders_user_insert"
  on public.task_reminders
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "task_reminders_user_update" on public.task_reminders;
create policy "task_reminders_user_update"
  on public.task_reminders
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "task_reminders_user_delete" on public.task_reminders;
create policy "task_reminders_user_delete"
  on public.task_reminders
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- push_subscriptions RLS
drop policy if exists "push_subscriptions_user_select" on public.push_subscriptions;
create policy "push_subscriptions_user_select"
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "push_subscriptions_user_insert" on public.push_subscriptions;
create policy "push_subscriptions_user_insert"
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_subscriptions_user_update" on public.push_subscriptions;
create policy "push_subscriptions_user_update"
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_subscriptions_user_delete" on public.push_subscriptions;
create policy "push_subscriptions_user_delete"
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ==============================================================================
-- Grants & Public Revocations
-- ==============================================================================
revoke all on public.task_reminders from anon;
revoke all on public.push_subscriptions from anon;

grant select, insert, update, delete on public.task_reminders to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

grant all on public.task_reminders to service_role;
grant all on public.push_subscriptions to service_role;

-- ==============================================================================
-- Database Trigger: Automatic Reminder Lifecycle with Task State
-- When a task is marked completed, archived, or unscheduled (Inbox),
-- automatically cancel any active scheduled reminders.
-- ==============================================================================
create or replace function public.handle_task_reminder_lifecycle()
returns trigger as $$
begin
  -- If task is completed, archived, or scheduled_date cleared
  if (new.status = 'completed' and (old.status is distinct from 'completed'))
     or (new.is_archived = true and (old.is_archived is distinct from true))
     or (new.scheduled_date is null and (old.scheduled_date is not null))
  then
    update public.task_reminders
       set status = 'cancelled',
           updated_at = now()
     where task_id = new.id
       and status = 'scheduled';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.handle_task_reminder_lifecycle() from public, anon;

drop trigger if exists tr_tasks_reminder_lifecycle on public.tasks;
create trigger tr_tasks_reminder_lifecycle
  after update on public.tasks
  for each row execute procedure public.handle_task_reminder_lifecycle();

-- ==============================================================================
-- RPC Functions for Reminder Management
-- ==============================================================================

-- 1. Upsert Task Reminder
create or replace function public.upsert_task_reminder(
  p_task_id uuid,
  p_remind_at timestamptz,
  p_timezone text default 'UTC'
)
returns public.task_reminders as $$
declare
  v_user_id uuid;
  v_task public.tasks%rowtype;
  v_reminder public.task_reminders;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  -- Verify task ownership and eligible state
  select * into v_task
    from public.tasks
   where id = p_task_id and user_id = v_user_id;

  if not found then
    raise exception 'Task not found or access denied' using errcode = 'P0002';
  end if;

  if v_task.scheduled_date is null then
    raise exception 'Cannot schedule reminder for unscheduled inbox task' using errcode = 'P0003';
  end if;

  if v_task.status = 'completed' or v_task.is_archived then
    raise exception 'Cannot schedule reminder for completed or archived task' using errcode = 'P0004';
  end if;

  -- Cancel existing scheduled reminder if exists
  update public.task_reminders
     set status = 'cancelled',
         updated_at = now()
   where task_id = p_task_id
     and user_id = v_user_id
     and status = 'scheduled';

  -- Insert fresh scheduled reminder
  insert into public.task_reminders (
    user_id,
    task_id,
    remind_at,
    timezone,
    status
  ) values (
    v_user_id,
    p_task_id,
    p_remind_at,
    coalesce(nullif(trim(p_timezone), ''), 'UTC'),
    'scheduled'
  )
  returning * into v_reminder;

  return v_reminder;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.upsert_task_reminder(uuid, timestamptz, text) from public, anon;
grant execute on function public.upsert_task_reminder(uuid, timestamptz, text) to authenticated;

-- 2. Cancel Task Reminder
create or replace function public.cancel_task_reminder(
  p_task_id uuid
)
returns boolean as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  update public.task_reminders
     set status = 'cancelled',
         updated_at = now()
   where task_id = p_task_id
     and user_id = v_user_id
     and status = 'scheduled';

  return found;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.cancel_task_reminder(uuid) from public, anon;
grant execute on function public.cancel_task_reminder(uuid) to authenticated;
