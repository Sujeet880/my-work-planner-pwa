-- Migration: 20261122000008_fix_calendar_outbox_after_trigger.sql
-- Description: Changes outbox enqueue trigger from BEFORE INSERT to AFTER INSERT so task row exists before sync job foreign key check

-- 1. Status Setter Trigger Function (BEFORE INSERT OR UPDATE)
-- Sets sync_to_google_calendar and calendar_sync_status directly on the task row
create or replace function public.trg_tasks_calendar_set_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_is_connected boolean := false;
begin
  select (status = 'connected') into v_is_connected
  from public.google_calendar_connections
  where user_id = NEW.user_id;

  if coalesce(v_is_connected, false) then
    if NEW.scheduled_date is not null and not coalesce(NEW.is_archived, false) then
      NEW.sync_to_google_calendar := true;
      if TG_OP = 'INSERT' then
        NEW.calendar_sync_status := 'pending';
      elsif TG_OP = 'UPDATE' and (
        OLD.scheduled_date is distinct from NEW.scheduled_date or
        OLD.scheduled_start_time is distinct from NEW.scheduled_start_time or
        OLD.planned_duration_minutes is distinct from NEW.planned_duration_minutes or
        OLD.title is distinct from NEW.title or
        OLD.description is distinct from NEW.description
      ) then
        NEW.calendar_sync_status := 'pending';
      end if;
    elsif NEW.scheduled_date is null or NEW.is_archived = true then
      NEW.sync_to_google_calendar := false;
      NEW.calendar_sync_status := 'not_synced';
    end if;
  end if;

  return NEW;
end;
$$;

-- 2. Outbox Enqueue Trigger Function (AFTER INSERT OR UPDATE)
-- Safely inserts outbox sync jobs now that the task row exists in public.tasks
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
  select (status = 'connected') into v_is_connected
  from public.google_calendar_connections
  where user_id = NEW.user_id;

  if not coalesce(v_is_connected, false) then
    return NEW;
  end if;

  -- Case E: Moving to Inbox (scheduled_date became null) or archived
  if TG_OP = 'UPDATE' and OLD.scheduled_date is not null and (NEW.scheduled_date is null or NEW.is_archived = true) then
    perform public.queue_calendar_sync_job(
      p_task_id => NEW.id,
      p_operation => 'delete',
      p_payload => '{}'::jsonb,
      p_calendar_id => 'primary',
      p_user_id => NEW.user_id
    );
    return NEW;
  end if;

  -- Scheduled task (Cases A, B, C, D)
  if NEW.scheduled_date is not null and not coalesce(NEW.is_archived, false) then
    -- On UPDATE, only enqueue if calendar-relevant fields changed
    if TG_OP = 'UPDATE' and 
       OLD.title = NEW.title and
       OLD.description is not distinct from NEW.description and
       OLD.scheduled_date = NEW.scheduled_date and
       OLD.scheduled_start_time is not distinct from NEW.scheduled_start_time and
       OLD.planned_duration_minutes is not distinct from NEW.planned_duration_minutes and
       OLD.is_archived = NEW.is_archived then
      return NEW;
    end if;

    v_payload := jsonb_build_object(
      'title', NEW.title,
      'description', NEW.description,
      'scheduled_date', NEW.scheduled_date,
      'scheduled_start_time', NEW.scheduled_start_time,
      'planned_duration_minutes', NEW.planned_duration_minutes
    );

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

-- 3. Delete Outbox Enqueue Trigger Function (BEFORE DELETE)
-- Queues remote calendar delete job before the task row is removed
create or replace function public.trg_tasks_calendar_sync_del_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_is_connected boolean := false;
  v_has_event boolean := false;
begin
  select (status = 'connected') into v_is_connected
  from public.google_calendar_connections
  where user_id = OLD.user_id;

  if coalesce(v_is_connected, false) and OLD.scheduled_date is not null then
    select exists(
      select 1 from public.google_calendar_event_mappings
      where user_id = OLD.user_id and task_id = OLD.id
    ) into v_has_event;

    if v_has_event then
      perform public.queue_calendar_sync_job(
        p_task_id => OLD.id,
        p_operation => 'delete',
        p_payload => '{}'::jsonb,
        p_calendar_id => 'primary',
        p_user_id => OLD.user_id
      );
    end if;
  end if;

  return OLD;
end;
$$;

-- 4. Re-attach Triggers to public.tasks
drop trigger if exists trg_tasks_calendar_set_status on public.tasks;
create trigger trg_tasks_calendar_set_status
  before insert or update of title, description, scheduled_date, scheduled_start_time, planned_duration_minutes, is_archived
  on public.tasks
  for each row
  execute function public.trg_tasks_calendar_set_status();

drop trigger if exists trg_tasks_calendar_sync on public.tasks;
create trigger trg_tasks_calendar_sync
  after insert or update of title, description, scheduled_date, scheduled_start_time, planned_duration_minutes, is_archived
  on public.tasks
  for each row
  execute function public.trg_tasks_calendar_sync_outbox();

drop trigger if exists trg_tasks_calendar_sync_del on public.tasks;
create trigger trg_tasks_calendar_sync_del
  before delete
  on public.tasks
  for each row
  execute function public.trg_tasks_calendar_sync_del_outbox();
