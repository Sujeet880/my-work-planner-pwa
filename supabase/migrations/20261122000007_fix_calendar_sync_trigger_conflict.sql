-- Migration: 20261122000007_fix_calendar_sync_trigger_conflict.sql
-- Description: Fixes tuple modification conflict by removing duplicate task updates in queue_calendar_sync_job

create or replace function public.queue_calendar_sync_job(
  p_task_id uuid,
  p_operation text default 'upsert',
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
  if p_user_id is not null then
    v_user_id := p_user_id;
  else
    v_user_id := auth.uid();
  end if;

  if v_user_id is null then
    raise exception 'Authentication required or valid p_user_id must be provided to queue calendar sync job';
  end if;

  if p_operation not in ('upsert', 'delete') then
    raise exception 'Invalid operation: %. Must be upsert or delete.', p_operation;
  end if;

  if p_task_id is not null then
    select google_event_id into v_event_id
    from public.google_calendar_event_mappings
    where user_id = v_user_id
      and task_id = p_task_id
      and google_calendar_id = p_calendar_id
    limit 1;
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

  return v_job_id;
end;
$$;

-- Fix trigger function for tasks table
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
  -- DELETE operation
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

  -- Check connection for INSERT / UPDATE
  select (status = 'connected') into v_is_connected
  from public.google_calendar_connections
  where user_id = NEW.user_id;

  if not coalesce(v_is_connected, false) then
    return NEW;
  end if;

  -- Case E: Moving to Inbox (scheduled_date became null) or archiving
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

  -- Scheduled task (Cases A, B, C, D)
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
