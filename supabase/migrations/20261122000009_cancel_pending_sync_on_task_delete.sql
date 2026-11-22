-- Migration: 20261122000009_cancel_pending_sync_on_task_delete.sql
-- Description: Ensures deleting a task automatically cancels any pending upsert jobs to prevent orphan Google Calendar events

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
  -- Cancel any pending upsert jobs for this task immediately
  update public.google_calendar_sync_jobs
  set status = 'completed',
      last_error = 'Skipped: task deleted before sync',
      updated_at = now()
  where task_id = OLD.id
    and status = 'pending';

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
