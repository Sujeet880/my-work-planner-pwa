-- Migration: 20261121000003_google_calendar_integration.sql
-- Description: Google Calendar One-Way Integration (Connections, Tokens, Event Mappings, Sync Jobs & Status RPCs)
-- Author: Google Antigravity & Supabase Skills

-- 1. Table: google_calendar_connections
-- Tracks user's Google Calendar connection metadata and status
create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error', 'needs_reauth')),
  google_account_email text,
  google_calendar_id text not null default 'primary',
  granted_scopes text[] not null default array['https://www.googleapis.com/auth/calendar.events'],
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.google_calendar_connections enable row level security;

-- Policies for google_calendar_connections
create policy "Users can select own calendar connection"
  on public.google_calendar_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own calendar connection"
  on public.google_calendar_connections
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own calendar connection"
  on public.google_calendar_connections
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own calendar connection"
  on public.google_calendar_connections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. Table: google_calendar_tokens (HIGH SECURITY)
-- Holds encrypted Google OAuth tokens. Completely inaccessible via client Data API / anon / authenticated roles.
create table if not exists public.google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.google_calendar_tokens enable row level security;

-- Explicitly revoke access from public, anon, and authenticated
revoke all on public.google_calendar_tokens from public, anon, authenticated;
grant all on public.google_calendar_tokens to service_role;

-- 3. Table: google_calendar_event_mappings
-- Maps My Work Planner tasks to Google Calendar events (1:1 per task & calendar)
create table if not exists public.google_calendar_event_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  google_calendar_id text not null default 'primary',
  google_event_id text not null,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'failed', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.google_calendar_event_mappings enable row level security;

-- Performance & Foreign Key Indexes
create index if not exists idx_gcal_mappings_user_id
  on public.google_calendar_event_mappings (user_id);

create index if not exists idx_gcal_mappings_task_id
  on public.google_calendar_event_mappings (task_id)
  where task_id is not null;

create index if not exists idx_gcal_mappings_google_event
  on public.google_calendar_event_mappings (user_id, google_calendar_id, google_event_id);

-- Enforce exactly one active mapping per task and calendar
create unique index if not exists uq_gcal_mappings_user_task_calendar
  on public.google_calendar_event_mappings (user_id, task_id, google_calendar_id)
  where task_id is not null;

-- Policies for google_calendar_event_mappings
create policy "Users can select own event mappings"
  on public.google_calendar_event_mappings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own event mappings"
  on public.google_calendar_event_mappings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own event mappings"
  on public.google_calendar_event_mappings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own event mappings"
  on public.google_calendar_event_mappings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Table: google_calendar_sync_jobs (Transactional Outbox / Sync Queue)
-- Queues retryable, idempotent sync operations
create table if not exists public.google_calendar_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  operation text not null check (operation in ('upsert', 'delete')),
  google_calendar_id text not null default 'primary',
  google_event_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 5,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.google_calendar_sync_jobs enable row level security;

-- Indexes for Queue Processing
create index if not exists idx_gcal_sync_jobs_user_status
  on public.google_calendar_sync_jobs (user_id, status);

create index if not exists idx_gcal_sync_jobs_queue
  on public.google_calendar_sync_jobs (status, created_at)
  where status in ('pending', 'processing');

-- Policies for google_calendar_sync_jobs
create policy "Users can select own sync jobs"
  on public.google_calendar_sync_jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own sync jobs"
  on public.google_calendar_sync_jobs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own sync jobs"
  on public.google_calendar_sync_jobs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 5. RPC: queue_calendar_sync_job
-- Atomically inserts or replaces pending sync jobs for a task
create or replace function public.queue_calendar_sync_job(
  p_task_id uuid,
  p_operation text,
  p_payload jsonb default '{}'::jsonb,
  p_calendar_id text default 'primary'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid;
  v_job_id uuid;
  v_event_id text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_operation not in ('upsert', 'delete') then
    raise exception 'Invalid operation: must be upsert or delete';
  end if;

  -- If this is a delete or update, look up existing event id
  if p_task_id is not null then
    select google_event_id into v_event_id
    from public.google_calendar_event_mappings
    where user_id = v_user_id
      and task_id = p_task_id
      and google_calendar_id = p_calendar_id;
  end if;

  -- If an older pending job exists for the same task, cancel/supersede it with latest state
  if p_task_id is not null then
    update public.google_calendar_sync_jobs
    set status = 'completed',
        last_error = 'Superseded by newer job',
        updated_at = now()
    where user_id = v_user_id
      and task_id = p_task_id
      and status = 'pending';
  end if;

  -- Insert new sync job
  insert into public.google_calendar_sync_jobs (
    user_id,
    task_id,
    operation,
    google_calendar_id,
    google_event_id,
    payload,
    status
  )
  values (
    v_user_id,
    p_task_id,
    p_operation,
    p_calendar_id,
    v_event_id,
    p_payload,
    'pending'
  )
  returning id into v_job_id;

  -- Also update task's calendar_sync_status to pending
  if p_task_id is not null then
    update public.tasks
    set calendar_sync_status = 'pending',
        updated_at = now()
    where id = p_task_id
      and user_id = v_user_id;
  end if;

  return v_job_id;
end;
$$;

-- Revoke from public, grant to authenticated
revoke execute on function public.queue_calendar_sync_job(uuid, text, jsonb, text) from public, anon;
grant execute on function public.queue_calendar_sync_job(uuid, text, jsonb, text) to authenticated;

-- 6. RPC: get_calendar_integration_status
-- Returns comprehensive status of connection, pending jobs, and failed jobs
create or replace function public.get_calendar_integration_status()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid;
  v_connection record;
  v_pending_count integer;
  v_failed_count integer;
  v_synced_tasks_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Fetch connection
  select * into v_connection
  from public.google_calendar_connections
  where user_id = v_user_id;

  -- Count pending jobs
  select count(*) into v_pending_count
  from public.google_calendar_sync_jobs
  where user_id = v_user_id
    and status in ('pending', 'processing');

  -- Count failed jobs
  select count(*) into v_failed_count
  from public.google_calendar_sync_jobs
  where user_id = v_user_id
    and status = 'failed';

  -- Count active mapped events
  select count(*) into v_synced_tasks_count
  from public.google_calendar_event_mappings
  where user_id = v_user_id
    and sync_status = 'synced';

  return jsonb_build_object(
    'isConnected', coalesce(v_connection.status = 'connected', false),
    'status', coalesce(v_connection.status, 'disconnected'),
    'accountEmail', v_connection.google_account_email,
    'calendarId', coalesce(v_connection.google_calendar_id, 'primary'),
    'lastSyncAt', v_connection.last_sync_at,
    'lastError', v_connection.last_error,
    'pendingJobsCount', coalesce(v_pending_count, 0),
    'failedJobsCount', coalesce(v_failed_count, 0),
    'syncedTasksCount', coalesce(v_synced_tasks_count, 0)
  );
end;
$$;

-- Revoke from public, grant to authenticated
revoke execute on function public.get_calendar_integration_status() from public, anon;
grant execute on function public.get_calendar_integration_status() to authenticated;

-- 7. RPC: disconnect_google_calendar
-- Atomically disconnects Google Calendar, deletes tokens, cancels pending jobs
create or replace function public.disconnect_google_calendar()
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Update connection status
  update public.google_calendar_connections
  set status = 'disconnected',
      last_error = null,
      updated_at = now()
  where user_id = v_user_id;

  -- Delete sensitive tokens
  delete from public.google_calendar_tokens
  where user_id = v_user_id;

  -- Cancel pending jobs
  update public.google_calendar_sync_jobs
  set status = 'completed',
      last_error = 'Cancelled due to calendar disconnection',
      updated_at = now()
  where user_id = v_user_id
    and status in ('pending', 'processing');

  -- Reset task calendar_sync_status back to not_synced
  update public.tasks
  set calendar_sync_status = 'not_synced',
      updated_at = now()
  where user_id = v_user_id
    and calendar_sync_status != 'not_synced';

  return true;
end;
$$;

-- Revoke from public, grant to authenticated
revoke execute on function public.disconnect_google_calendar() from public, anon;
grant execute on function public.disconnect_google_calendar() to authenticated;
