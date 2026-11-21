-- ==============================================================================
-- My Work Planner — Milestone 5: Persistent Timer & Complete Work Session Management
-- Migration: 20261121000002_timer_rpc_operations.sql
-- Functions:
--   1. rpc_start_timer(p_task_id uuid)
--   2. rpc_pause_timer()
--   3. rpc_resume_timer()
--   4. rpc_stop_timer()
--   5. rpc_switch_timer(p_new_task_id uuid)
--   6. rpc_complete_task_with_timer(p_task_id uuid)
-- Security: SECURITY DEFINER with set search_path = public, auth.uid() validation,
--           row-level locking, and strict role grants.
-- ==============================================================================

-- 1. rpc_start_timer: Starts or resumes a timer for a given task
create or replace function public.rpc_start_timer(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task record;
  v_timer record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate task ownership and active state
  select id, project_id, status into v_task
  from public.tasks
  where id = p_task_id and user_id = v_user_id and is_archived = false;

  if not found then
    raise exception 'Task not found or access denied';
  end if;

  -- Check existing active timer for this user
  select * into v_timer
  from public.active_timers
  where user_id = v_user_id
  for update;

  if found then
    if v_timer.task_id = p_task_id then
      if v_timer.state = 'paused' then
        -- Resuming existing paused timer for same task
        update public.active_timers
        set state = 'running',
            segment_started_at = now(),
            updated_at = now()
        where user_id = v_user_id
        returning * into v_timer;

        return jsonb_build_object(
          'action', 'resumed',
          'timer', row_to_json(v_timer)
        );
      else
        return jsonb_build_object(
          'action', 'already_running',
          'timer', row_to_json(v_timer)
        );
      end if;
    else
      raise exception 'Another task timer is already active. Please switch or stop first.';
    end if;
  end if;

  -- Create fresh active timer
  insert into public.active_timers (
    user_id,
    task_id,
    state,
    segment_started_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    p_task_id,
    'running',
    now(),
    now(),
    now()
  )
  returning * into v_timer;

  -- If task was 'todo', promote it to 'in_progress'
  if v_task.status = 'todo' then
    update public.tasks
    set status = 'in_progress',
        updated_at = now()
    where id = p_task_id and user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'action', 'started',
    'timer', row_to_json(v_timer)
  );
end;
$$;

-- 2. rpc_pause_timer: Saves the running segment to work_sessions and sets timer to paused
create or replace function public.rpc_pause_timer()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_timer record;
  v_task record;
  v_profile record;
  v_duration integer;
  v_timezone text := 'Asia/Kolkata';
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_timer
  from public.active_timers
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'No active timer found to pause';
  end if;

  if v_timer.state = 'paused' then
    return jsonb_build_object(
      'action', 'already_paused',
      'timer', row_to_json(v_timer)
    );
  end if;

  -- Calculate duration in seconds
  v_duration := greatest(1, round(extract(epoch from (now() - v_timer.segment_started_at))))::integer;

  -- Retrieve task details and profile timezone
  select project_id into v_task from public.tasks where id = v_timer.task_id and user_id = v_user_id;
  select timezone into v_profile from public.profiles where id = v_user_id;
  if v_profile.timezone is not null and v_profile.timezone <> '' then
    v_timezone := v_profile.timezone;
  end if;

  -- Insert completed session segment
  insert into public.work_sessions (
    user_id,
    task_id,
    project_id,
    entry_type,
    session_date,
    started_at,
    ended_at,
    duration_seconds,
    notes,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_timer.task_id,
    v_task.project_id,
    'automatic',
    (now() at time zone v_timezone)::date,
    v_timer.segment_started_at,
    now(),
    v_duration,
    'Tracked via count-up timer',
    now(),
    now()
  )
  returning id into v_session_id;

  -- Update timer state to paused
  update public.active_timers
  set state = 'paused',
      segment_started_at = null,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_timer;

  return jsonb_build_object(
    'action', 'paused',
    'timer', row_to_json(v_timer),
    'session_id', v_session_id,
    'duration_seconds', v_duration
  );
end;
$$;

-- 3. rpc_resume_timer: Resumes a paused timer with a new segment_started_at
create or replace function public.rpc_resume_timer()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_timer record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_timer
  from public.active_timers
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'No paused timer found to resume';
  end if;

  if v_timer.state = 'running' then
    return jsonb_build_object(
      'action', 'already_running',
      'timer', row_to_json(v_timer)
    );
  end if;

  update public.active_timers
  set state = 'running',
      segment_started_at = now(),
      updated_at = now()
  where user_id = v_user_id
  returning * into v_timer;

  return jsonb_build_object(
    'action', 'resumed',
    'timer', row_to_json(v_timer)
  );
end;
$$;

-- 4. rpc_stop_timer: Stops and removes active timer; commits running segment if running
create or replace function public.rpc_stop_timer()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_timer record;
  v_task record;
  v_profile record;
  v_duration integer := 0;
  v_timezone text := 'Asia/Kolkata';
  v_session_id uuid := null;
  v_session_saved boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_timer
  from public.active_timers
  where user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'stopped', true,
      'session_saved', false
    );
  end if;

  -- If running, save completed segment
  if v_timer.state = 'running' and v_timer.segment_started_at is not null then
    v_duration := greatest(1, round(extract(epoch from (now() - v_timer.segment_started_at))))::integer;

    select project_id into v_task from public.tasks where id = v_timer.task_id and user_id = v_user_id;
    select timezone into v_profile from public.profiles where id = v_user_id;
    if v_profile.timezone is not null and v_profile.timezone <> '' then
      v_timezone := v_profile.timezone;
    end if;

    insert into public.work_sessions (
      user_id,
      task_id,
      project_id,
      entry_type,
      session_date,
      started_at,
      ended_at,
      duration_seconds,
      notes,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_timer.task_id,
      v_task.project_id,
      'automatic',
      (now() at time zone v_timezone)::date,
      v_timer.segment_started_at,
      now(),
      v_duration,
      'Tracked via count-up timer',
      now(),
      now()
    )
    returning id into v_session_id;

    v_session_saved := true;
  end if;

  -- Delete active timer record
  delete from public.active_timers where user_id = v_user_id;

  return jsonb_build_object(
    'stopped', true,
    'session_saved', v_session_saved,
    'session_id', v_session_id,
    'duration_seconds', v_duration
  );
end;
$$;

-- 5. rpc_switch_timer: Atomically commits existing running segment and starts a timer on new task
create or replace function public.rpc_switch_timer(p_new_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_timer record;
  v_new_task record;
  v_task record;
  v_profile record;
  v_duration integer := 0;
  v_timezone text := 'Asia/Kolkata';
  v_session_id uuid := null;
  v_session_saved boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate new task
  select id, project_id, status into v_new_task
  from public.tasks
  where id = p_new_task_id and user_id = v_user_id and is_archived = false;

  if not found then
    raise exception 'Target task not found or access denied';
  end if;

  -- Lock existing timer
  select * into v_timer
  from public.active_timers
  where user_id = v_user_id
  for update;

  if found and v_timer.state = 'running' and v_timer.segment_started_at is not null then
    v_duration := greatest(1, round(extract(epoch from (now() - v_timer.segment_started_at))))::integer;

    select project_id into v_task from public.tasks where id = v_timer.task_id and user_id = v_user_id;
    select timezone into v_profile from public.profiles where id = v_user_id;
    if v_profile.timezone is not null and v_profile.timezone <> '' then
      v_timezone := v_profile.timezone;
    end if;

    insert into public.work_sessions (
      user_id,
      task_id,
      project_id,
      entry_type,
      session_date,
      started_at,
      ended_at,
      duration_seconds,
      notes,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_timer.task_id,
      v_task.project_id,
      'automatic',
      (now() at time zone v_timezone)::date,
      v_timer.segment_started_at,
      now(),
      v_duration,
      'Tracked via count-up timer',
      now(),
      now()
    )
    returning id into v_session_id;

    v_session_saved := true;
  end if;

  -- Upsert active timer for the new task
  insert into public.active_timers (
    user_id,
    task_id,
    state,
    segment_started_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    p_new_task_id,
    'running',
    now(),
    now(),
    now()
  )
  on conflict (user_id) do update
  set task_id = p_new_task_id,
      state = 'running',
      segment_started_at = now(),
      updated_at = now()
  returning * into v_timer;

  -- If new task was 'todo', update to 'in_progress'
  if v_new_task.status = 'todo' then
    update public.tasks
    set status = 'in_progress',
        updated_at = now()
    where id = p_new_task_id and user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'action', 'switched',
    'timer', row_to_json(v_timer),
    'previous_session_saved', v_session_saved,
    'previous_session_id', v_session_id,
    'previous_duration_seconds', v_duration
  );
end;
$$;

-- 6. rpc_complete_task_with_timer: Completes a task, saves running segment if active, and clears timer
create or replace function public.rpc_complete_task_with_timer(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_timer record;
  v_task record;
  v_profile record;
  v_duration integer := 0;
  v_timezone text := 'Asia/Kolkata';
  v_session_id uuid := null;
  v_session_saved boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate task
  select id, project_id, status into v_task
  from public.tasks
  where id = p_task_id and user_id = v_user_id;

  if not found then
    raise exception 'Task not found or access denied';
  end if;

  -- Lock active timer if one exists for this user
  select * into v_timer
  from public.active_timers
  where user_id = v_user_id
  for update;

  if found and v_timer.task_id = p_task_id then
    if v_timer.state = 'running' and v_timer.segment_started_at is not null then
      v_duration := greatest(1, round(extract(epoch from (now() - v_timer.segment_started_at))))::integer;

      select timezone into v_profile from public.profiles where id = v_user_id;
      if v_profile.timezone is not null and v_profile.timezone <> '' then
        v_timezone := v_profile.timezone;
      end if;

      insert into public.work_sessions (
        user_id,
        task_id,
        project_id,
        entry_type,
        session_date,
        started_at,
        ended_at,
        duration_seconds,
        notes,
        created_at,
        updated_at
      ) values (
        v_user_id,
        p_task_id,
        v_task.project_id,
        'automatic',
        (now() at time zone v_timezone)::date,
        v_timer.segment_started_at,
        now(),
        v_duration,
        'Tracked via count-up timer',
        now(),
        now()
      )
      returning id into v_session_id;

      v_session_saved := true;
    end if;

    -- Delete active timer
    delete from public.active_timers where user_id = v_user_id;
  end if;

  -- Mark task completed
  update public.tasks
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_task_id and user_id = v_user_id;

  return jsonb_build_object(
    'completed', true,
    'task_id', p_task_id,
    'session_saved', v_session_saved,
    'session_id', v_session_id,
    'duration_seconds', v_duration
  );
end;
$$;

-- ==============================================================================
-- Role Grants and Revocations for Timer RPCs
-- ==============================================================================

revoke all on function public.rpc_start_timer(uuid) from public, anon;
grant execute on function public.rpc_start_timer(uuid) to authenticated;

revoke all on function public.rpc_pause_timer() from public, anon;
grant execute on function public.rpc_pause_timer() to authenticated;

revoke all on function public.rpc_resume_timer() from public, anon;
grant execute on function public.rpc_resume_timer() to authenticated;

revoke all on function public.rpc_stop_timer() from public, anon;
grant execute on function public.rpc_stop_timer() to authenticated;

revoke all on function public.rpc_switch_timer(uuid) from public, anon;
grant execute on function public.rpc_switch_timer(uuid) to authenticated;

revoke all on function public.rpc_complete_task_with_timer(uuid) from public, anon;
grant execute on function public.rpc_complete_task_with_timer(uuid) to authenticated;
