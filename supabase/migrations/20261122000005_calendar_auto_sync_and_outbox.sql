-- Migration: 20261122000005_calendar_auto_sync_and_outbox.sql
-- Description: Automatic Google Calendar synchronization outbox triggers & service-role RPC support
-- Author: Google Antigravity & Supabase Skills

-- 1. Update queue_calendar_sync_job RPC to support both authenticated users and service-role callers
create or replace function public.queue_calendar_sync_job(
  p_task_id uuid,
  p_operation text,
  p_payload jsonb default '{}'::jsonb,
  p_calendar_id text default 'primary',
  p_user_id uuid default null
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
  -- Resolve target user ID
  -- If authenticated user session exists, auth.uid() takes absolute precedence
  v_user_id := auth.uid();
  if v_user_id is null then
    -- Service role / system caller
    if p_user_id is not null then
      v_user_id := p_user_id;
    elsif p_task_id is not null then
      select user_id into v_user_id from public.tasks where id = p_task_id;
    end if;
  end if;

  if v_user_id is null then
    raise exception 'Authentication or target user ID required';
  end if;

  if p_operation not in ('upsert', 'delete') then
    raise exception 'Invalid operation: must be upsert or delete';
  end if;

  -- Lookup existing mapped Google event ID if task exists
  if p_task_id is not null then
    select google_event_id into v_event_id
    from public.google_calendar_event_mappings
    where user_id = v_user_id
      and task_id = p_task_id
      and google_calendar_id = p_calendar_id;
  end if;

  -- Cancel / supersede any older pending job for the exact same task
  if p_task_id is not null then
    update public.google_calendar_sync_jobs
    set status = 'completed',
        last_error = 'Superseded by newer job',
        updated_at = now()
    where user_id = v_user_id
      and task_id = p_task_id
      and status = 'pending';
  end if;

  -- Insert new sync job into transactional outbox
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

  -- Update task's sync status to pending
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

-- Permissions
revoke execute on function public.queue_calendar_sync_job(uuid, text, jsonb, text, uuid) from public, anon;
grant execute on function public.queue_calendar_sync_job(uuid, text, jsonb, text, uuid) to authenticated, service_role;

-- 2. Automatic Outbox Trigger Function for Tasks Table
create or replace function public.trg_tasks_calendar_sync_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_is_connected boolean := false;
  v_payload jsonb;
begin
  -- Check if user has an active Google Calendar connection
  if TG_OP = 'DELETE' then
    select (status = 'connected') into v_is_connected
    from public.google_calendar_connections
    where user_id = OLD.user_id;

    if coalesce(v_is_connected, false) and OLD.scheduled_date is not null then
      perform public.queue_calendar_sync_job(
        p_task_id => OLD.id,
        p_operation => 'delete',
        p_payload => '{}'::jsonb,
        p_calendar_id => 'primary',
        p_user_id => OLD.user_id
      );
    end if;
    return OLD;
  end if;

  -- INSERT or UPDATE
  select (status = 'connected') into v_is_connected
  from public.google_calendar_connections
  where user_id = NEW.user_id;

  -- If user has not connected Google Calendar, exit cleanly without blocking task save
  if not coalesce(v_is_connected, false) then
    return NEW;
  end if;

  -- Case E: If task was moved to Inbox (scheduled_date became null) or archived
  if TG_OP = 'UPDATE' and OLD.scheduled_date is not null and (NEW.scheduled_date is null or NEW.is_archived = true) then
    perform public.queue_calendar_sync_job(
      p_task_id => NEW.id,
      p_operation => 'delete',
      p_payload => '{}'::jsonb,
      p_calendar_id => 'primary',
      p_user_id => NEW.user_id
    );
    NEW.sync_to_google_calendar := false;
    NEW.calendar_sync_status := 'not_synced';
    return NEW;
  end if;

  -- If scheduled task (Cases A, B, C, D)
  if NEW.scheduled_date is not null and not coalesce(NEW.is_archived, false) then
    v_payload := jsonb_build_object(
      'title', NEW.title,
      'description', NEW.description,
      'scheduled_date', NEW.scheduled_date,
      'scheduled_start_time', NEW.scheduled_start_time,
      'planned_duration_minutes', NEW.planned_duration_minutes
    );

    NEW.sync_to_google_calendar := true;
    NEW.calendar_sync_status := 'pending';

    perform public.queue_calendar_sync_job(
      p_task_id => NEW.id,
      p_operation => 'upsert',
      p_payload => v_payload,
      p_calendar_id => 'primary',
      p_user_id => NEW.user_id
    );
  end if;

  return NEW;
end;
$$;

-- 3. Attach Trigger to Tasks Table
drop trigger if exists trg_tasks_calendar_sync on public.tasks;
create trigger trg_tasks_calendar_sync
  before insert or update of title, description, scheduled_date, scheduled_start_time, planned_duration_minutes, is_archived
  on public.tasks
  for each row
  execute function public.trg_tasks_calendar_sync_outbox();

drop trigger if exists trg_tasks_calendar_sync_del on public.tasks;
create trigger trg_tasks_calendar_sync_del
  before delete
  on public.tasks
  for each row
  execute function public.trg_tasks_calendar_sync_outbox();

-- 4. Initial Synchronization: Queue all existing scheduled tasks for connected users
do $$
declare
  r record;
begin
  for r in
    select t.id, t.user_id, t.title, t.description, t.scheduled_date, t.scheduled_start_time, t.planned_duration_minutes
    from public.tasks t
    join public.google_calendar_connections c on c.user_id = t.user_id
    where c.status = 'connected'
      and t.scheduled_date is not null
      and not t.is_archived
  loop
    update public.tasks
    set sync_to_google_calendar = true,
        calendar_sync_status = 'pending'
    where id = r.id;

    perform public.queue_calendar_sync_job(
      p_task_id => r.id,
      p_operation => 'upsert',
      p_payload => jsonb_build_object(
        'title', r.title,
        'description', r.description,
        'scheduled_date', r.scheduled_date,
        'scheduled_start_time', r.scheduled_start_time,
        'planned_duration_minutes', r.planned_duration_minutes
      ),
      p_calendar_id => 'primary',
      p_user_id => r.user_id
    );
  end loop;
end;
$$;
