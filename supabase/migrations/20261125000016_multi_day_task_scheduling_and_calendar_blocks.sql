-- ==============================================================================
-- My Work Planner — Feature Enhancement: Multi-Day Task Scheduling & Calendar Blocks
-- Migration: 20261125000016_multi_day_task_scheduling_and_calendar_blocks.sql
-- Description:
--   1. Adds multi-day scheduling metadata to public.tasks (scheduled_end_date, daily_planned_minutes, include_weekends).
--   2. Creates public.task_calendar_blocks table with strict RLS, cascade cleanup on task delete,
--      and performance indexes for conflict-free calendar slot lookups.
-- ==============================================================================

-- 1. Extend tasks table with multi-day scheduling columns
alter table public.tasks
  add column if not exists scheduled_end_date date,
  add column if not exists daily_planned_minutes integer check (daily_planned_minutes is null or daily_planned_minutes > 0),
  add column if not exists include_weekends boolean not null default false;

-- Constraint: End date must not precede start date
alter table public.tasks
  drop constraint if exists check_task_end_date_valid;

alter table public.tasks
  add constraint check_task_end_date_valid check (
    scheduled_end_date is null or (scheduled_date is not null and scheduled_end_date >= scheduled_date)
  );

-- Index for date-range task queries
create index if not exists idx_tasks_user_date_range
  on public.tasks (user_id, scheduled_date, scheduled_end_date)
  where scheduled_date is not null;

-- 2. Table: task_calendar_blocks
-- Stores individual allocated calendar time blocks linked to parent tasks
create table if not exists public.task_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Constraint: block end time must follow start time
  constraint check_block_time_valid check (end_time > start_time)
);

-- Enable Row Level Security
alter table public.task_calendar_blocks enable row level security;

-- Updated_at trigger
drop trigger if exists tr_task_calendar_blocks_updated_at on public.task_calendar_blocks;
create trigger tr_task_calendar_blocks_updated_at
  before update on public.task_calendar_blocks
  for each row execute procedure public.update_updated_at_column();

-- Indexes for performance & slot lookups
create index if not exists idx_task_calendar_blocks_user_date
  on public.task_calendar_blocks (user_id, block_date);

create index if not exists idx_task_calendar_blocks_task_id
  on public.task_calendar_blocks (task_id);

create index if not exists idx_task_calendar_blocks_user_task
  on public.task_calendar_blocks (user_id, task_id);

-- Row Level Security Policies (Strict cross-user isolation using (select auth.uid()))
create policy "Users can select own task calendar blocks"
  on public.task_calendar_blocks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own task calendar blocks"
  on public.task_calendar_blocks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own task calendar blocks"
  on public.task_calendar_blocks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own task calendar blocks"
  on public.task_calendar_blocks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
