-- ==============================================================================
-- My Work Planner — Milestone 2: Database Schema, SQL Migrations & Row Level Security
-- Migration: 20261121000001_create_my_work_planner_schema.sql
-- Tables:
--   1. profiles
--   2. projects
--   3. tasks
--   4. work_sessions
--   5. active_timers
--   6. user_preferences
-- Security: Strict Row Level Security (RLS) on all 6 tables, role-based grants,
--           cross-user isolation constraints, and safe auth triggers.
-- ==============================================================================

-- 1. Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Utility Trigger: Automatically maintain 'updated_at' timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

-- Revoke direct execution of trigger functions from public / anonymous callers
revoke execute on function public.update_updated_at_column() from public, anon;

-- ==============================================================================
-- Table 1: profiles
-- Stores user display profile linked 1:1 with auth.users
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  full_name text,
  avatar_url text,
  timezone text not null default 'Asia/Kolkata',
  date_format text not null default 'DD/MM/YYYY',
  time_format text not null default '12h',
  default_event_duration_minutes integer not null default 60 check (default_event_duration_minutes > 0),
  notifications_enabled boolean not null default true,
  default_calendar_sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Updated_at trigger for profiles
drop trigger if exists tr_profiles_updated_at on public.profiles;
create trigger tr_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Table 2: projects
-- User projects and client groupings
-- ==============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_name text,
  description text,
  color text not null default '#2F65F6',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Composite unique key to support multi-tenant cross-referencing foreign keys
  constraint projects_id_user_id_key unique (id, user_id)
);

alter table public.projects enable row level security;

-- Updated_at trigger for projects
drop trigger if exists tr_projects_updated_at on public.projects;
create trigger tr_projects_updated_at
  before update on public.projects
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Table 3: tasks
-- User tasks for inbox and scheduled daily focus
-- ==============================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  scheduled_date date, -- null = Inbox, non-null = Scheduled view
  scheduled_start_time time, -- HH:mm, requires scheduled_date to be present
  planned_duration_minutes integer check (planned_duration_minutes is null or planned_duration_minutes > 0),
  reminder_offset_minutes integer,
  sync_to_google_calendar boolean not null default false,
  calendar_sync_status text not null default 'not_synced' check (calendar_sync_status in ('not_synced', 'synced', 'pending', 'failed')),
  completed_at timestamptz,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Constraint: Start time cannot exist without a scheduled date
  constraint check_task_start_time_requires_date check (
    scheduled_start_time is null or scheduled_date is not null
  ),

  -- Composite unique key to allow composite foreign key references from work_sessions and active_timers
  constraint tasks_id_user_id_key unique (id, user_id),

  -- Composite foreign key guarantees a task can NEVER reference another user's project
  constraint tasks_project_user_fkey foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete set null
);

alter table public.tasks enable row level security;

-- Business Rule 4 Trigger: Removing scheduled_date must automatically clear scheduled_start_time
create or replace function public.handle_task_scheduling_rules()
returns trigger as $$
begin
  if new.scheduled_date is null then
    new.scheduled_start_time := null;
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

revoke execute on function public.handle_task_scheduling_rules() from public, anon;

drop trigger if exists tr_tasks_scheduling_rules on public.tasks;
create trigger tr_tasks_scheduling_rules
  before insert or update on public.tasks
  for each row execute procedure public.handle_task_scheduling_rules();

-- Updated_at trigger for tasks
drop trigger if exists tr_tasks_updated_at on public.tasks;
create trigger tr_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Table 4: work_sessions
-- Historical completed automatic work sessions and manual time entries
-- ==============================================================================
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  project_id uuid,
  entry_type text not null default 'automatic' check (entry_type in ('automatic', 'manual', 'timer')),
  session_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null check (duration_seconds > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Safe relationship strategy: Deleting a task sets task_id to NULL so work history is NEVER lost
  constraint work_sessions_task_user_fkey foreign key (task_id, user_id)
    references public.tasks(id, user_id) on delete set null,

  -- Cross-user project safety
  constraint work_sessions_project_user_fkey foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete set null,

  -- Work Session Rules:
  -- 1. Duration must be strictly positive (> 0)
  -- 2. Automatic/timer sessions must have valid started_at and ended_at with ended_at > started_at
  -- 3. Manual entries require positive duration and support manual date/notes
  constraint check_work_session_timestamps check (
    (entry_type in ('automatic', 'timer') and started_at is not null and ended_at is not null and ended_at > started_at)
    or
    (entry_type = 'manual')
  )
);

alter table public.work_sessions enable row level security;

-- Updated_at trigger for work_sessions
drop trigger if exists tr_work_sessions_updated_at on public.work_sessions;
create trigger tr_work_sessions_updated_at
  before update on public.work_sessions
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Table 5: active_timers
-- Persists the single global active timer per user (Running or Paused)
-- ==============================================================================
create table if not exists public.active_timers (
  -- user_id is the PRIMARY KEY: enforces STRICTLY AT MOST ONE active timer per user at the database level!
  user_id uuid primary key references auth.users(id) on delete cascade,
  task_id uuid not null,
  state text not null check (state in ('running', 'paused')),
  segment_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Composite foreign key: timer task must belong to the active user
  constraint active_timers_task_user_fkey foreign key (task_id, user_id)
    references public.tasks(id, user_id) on delete cascade,

  -- Enforces segment timestamp validity based on timer state
  constraint check_active_timer_running_segment check (
    (state = 'running' and segment_started_at is not null)
    or
    (state = 'paused')
  )
);

alter table public.active_timers enable row level security;

-- Updated_at trigger for active_timers
drop trigger if exists tr_active_timers_updated_at on public.active_timers;
create trigger tr_active_timers_updated_at
  before update on public.active_timers
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Table 6: user_preferences
-- Persistent user-level settings
-- ==============================================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light',
  week_start_day text not null default 'monday' check (week_start_day in ('monday', 'sunday')),
  timezone text not null default 'Asia/Kolkata',
  default_calendar_event_duration_minutes integer not null default 60 check (default_calendar_event_duration_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- Updated_at trigger for user_preferences
drop trigger if exists tr_user_preferences_updated_at on public.user_preferences;
create trigger tr_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.update_updated_at_column();

-- ==============================================================================
-- Performance Indexes (Foreign keys & frequently queried column filters)
-- ==============================================================================

-- projects
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_user_archived on public.projects(user_id, is_archived);

-- tasks
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_user_scheduled on public.tasks(user_id, scheduled_date);
create index if not exists idx_tasks_user_status on public.tasks(user_id, status);
create index if not exists idx_tasks_user_archived on public.tasks(user_id, is_archived);

-- work_sessions
create index if not exists idx_work_sessions_user_id on public.work_sessions(user_id);
create index if not exists idx_work_sessions_task_id on public.work_sessions(task_id);
create index if not exists idx_work_sessions_project_id on public.work_sessions(project_id);
create index if not exists idx_work_sessions_user_date on public.work_sessions(user_id, session_date);
create index if not exists idx_work_sessions_user_started on public.work_sessions(user_id, started_at);

-- active_timers
create index if not exists idx_active_timers_task_id on public.active_timers(task_id);

-- ==============================================================================
-- Explicit PostgreSQL Grants & Public Revocations
-- ==============================================================================

-- Revoke all permissions from the anon role
revoke all on public.profiles from anon;
revoke all on public.projects from anon;
revoke all on public.tasks from anon;
revoke all on public.work_sessions from anon;
revoke all on public.active_timers from anon;
revoke all on public.user_preferences from anon;

-- Grant required operations to authenticated users
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.work_sessions to authenticated;
grant select, insert, update, delete on public.active_timers to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- Optimized with cached `(select auth.uid())` subqueries and explicit `to authenticated`
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RLS: profiles
-- ------------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

-- ------------------------------------------------------------------------------
-- RLS: projects
-- ------------------------------------------------------------------------------
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- RLS: tasks
-- ------------------------------------------------------------------------------
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
  on public.tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- RLS: work_sessions
-- ------------------------------------------------------------------------------
drop policy if exists "work_sessions_select_own" on public.work_sessions;
create policy "work_sessions_select_own"
  on public.work_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "work_sessions_insert_own" on public.work_sessions;
create policy "work_sessions_insert_own"
  on public.work_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "work_sessions_update_own" on public.work_sessions;
create policy "work_sessions_update_own"
  on public.work_sessions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "work_sessions_delete_own" on public.work_sessions;
create policy "work_sessions_delete_own"
  on public.work_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- RLS: active_timers
-- ------------------------------------------------------------------------------
drop policy if exists "active_timers_select_own" on public.active_timers;
create policy "active_timers_select_own"
  on public.active_timers for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "active_timers_insert_own" on public.active_timers;
create policy "active_timers_insert_own"
  on public.active_timers for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "active_timers_update_own" on public.active_timers;
create policy "active_timers_update_own"
  on public.active_timers for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "active_timers_delete_own" on public.active_timers;
create policy "active_timers_delete_own"
  on public.active_timers for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- RLS: user_preferences
-- ------------------------------------------------------------------------------
drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
  on public.user_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own"
  on public.user_preferences for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ==============================================================================
-- Secure Auth User Trigger: Automatic Profile and Preferences Initialization
-- Guarantees that every new sign-up receives a profile and user_preferences row.
-- Wrapped in an exception block so that it cannot break registration.
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- 1. Create default profile row
  insert into public.profiles (
    id,
    email,
    display_name,
    full_name,
    avatar_url
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- 2. Create default user preferences row
  insert into public.user_preferences (
    user_id,
    theme,
    week_start_day,
    timezone,
    default_calendar_event_duration_minutes
  )
  values (
    new.id,
    'light',
    'monday',
    'Asia/Kolkata',
    60
  )
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    -- Never allow profile trigger issues to abort auth.users creation
    raise warning 'handle_new_user warning: %', sqlerrm;
    return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Revoke execute on handle_new_user from public/anon
revoke execute on function public.handle_new_user() from public, anon;

-- Recreate trigger cleanly on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
