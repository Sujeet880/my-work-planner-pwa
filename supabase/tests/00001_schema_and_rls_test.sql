-- ==============================================================================
-- My Work Planner — Milestone 2: Database Schema & RLS Test Suite (pgTAP)
-- File: supabase/tests/00001_schema_and_rls_test.sql
-- Run with: supabase test db
-- ==============================================================================

begin;
select plan(28);

-- ------------------------------------------------------------------------------
-- 1. Table Existence Tests
-- ------------------------------------------------------------------------------
select has_table('public', 'profiles', 'Table profiles exists');
select has_table('public', 'projects', 'Table projects exists');
select has_table('public', 'tasks', 'Table tasks exists');
select has_table('public', 'work_sessions', 'Table work_sessions exists');
select has_table('public', 'active_timers', 'Table active_timers exists');
select has_table('public', 'user_preferences', 'Table user_preferences exists');

-- ------------------------------------------------------------------------------
-- 2. Foreign Key Existence Tests
-- ------------------------------------------------------------------------------
select has_fk('public', 'profiles', 'profiles references auth.users');
select has_fk('public', 'projects', 'projects references auth.users');
select has_fk('public', 'tasks', 'tasks has foreign key constraints');
select has_fk('public', 'work_sessions', 'work_sessions has foreign key constraints');
select has_fk('public', 'active_timers', 'active_timers has foreign key constraints');
select has_fk('public', 'user_preferences', 'user_preferences references auth.users');

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Enabled Tests
-- ------------------------------------------------------------------------------
select row_security_active('public.profiles', 'RLS active on profiles');
select row_security_active('public.projects', 'RLS active on projects');
select row_security_active('public.tasks', 'RLS active on tasks');
select row_security_active('public.work_sessions', 'RLS active on work_sessions');
select row_security_active('public.active_timers', 'RLS active on active_timers');
select row_security_active('public.user_preferences', 'RLS active on user_preferences');

-- ------------------------------------------------------------------------------
-- 4. Setup Test Fixtures (Two simulated test users)
-- ------------------------------------------------------------------------------
create schema if not exists tests;
create or replace function tests.setup_users() returns void as $$
declare
  user_a uuid := '11111111-1111-4111-8111-111111111111';
  user_b uuid := '22222222-2222-4222-8222-222222222222';
begin
  -- Insert User A and User B into auth.users (if not already present)
  insert into auth.users (id, email)
  values
    (user_a, 'user_a@example.com'),
    (user_b, 'user_b@example.com')
  on conflict (id) do nothing;
end;
$$ language plpgsql;

select tests.setup_users();

-- ------------------------------------------------------------------------------
-- 5. Business Rule 3: Start time without scheduled date must fail check constraint
-- ------------------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.tasks (user_id, title, scheduled_start_time)
    values ('11111111-1111-4111-8111-111111111111', 'Invalid Start Time', '10:00:00')
  $$,
  '23514', -- check_violation
  NULL,
  'Cannot insert scheduled_start_time when scheduled_date is null'
);

-- ------------------------------------------------------------------------------
-- 6. Business Rule 5: Planned duration <= 0 must fail check constraint
-- ------------------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.tasks (user_id, title, planned_duration_minutes)
    values ('11111111-1111-4111-8111-111111111111', 'Invalid Planned Duration', 0)
  $$,
  '23514',
  NULL,
  'Cannot insert task with planned_duration_minutes <= 0'
);

-- ------------------------------------------------------------------------------
-- 7. Unscheduled tasks (Inbox) are cleanly supported
-- ------------------------------------------------------------------------------
select lives_ok(
  $$
    insert into public.tasks (id, user_id, title, scheduled_date)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Inbox Task A', null)
  $$,
  'Unscheduled tasks (Inbox) can be created with scheduled_date = null'
);

-- ------------------------------------------------------------------------------
-- 8. Scheduled tasks are cleanly supported
-- ------------------------------------------------------------------------------
select lives_ok(
  $$
    insert into public.tasks (id, user_id, title, scheduled_date, scheduled_start_time, planned_duration_minutes)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'Scheduled Task A', '2026-11-21', '09:30:00', 45)
  $$,
  'Scheduled tasks with start time and duration are successfully created'
);

-- ------------------------------------------------------------------------------
-- 9. Work Session: Duration must be strictly > 0
-- ------------------------------------------------------------------------------
select throws_ok(
  $$
    insert into public.work_sessions (user_id, task_id, duration_seconds)
    values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0)
  $$,
  '23514',
  NULL,
  'Work session duration must be > 0 seconds'
);

-- ------------------------------------------------------------------------------
-- 10. Cross-Tenant Integrity: User A cannot link their task to User B project
-- ------------------------------------------------------------------------------
select lives_ok(
  $$
    insert into public.projects (id, user_id, name)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 'User B Project')
  $$,
  'User B creates their own project'
);

select throws_ok(
  $$
    insert into public.tasks (user_id, project_id, title)
    values ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'User A trying to steal Project B')
  $$,
  '23503', -- foreign_key_violation
  NULL,
  'Composite foreign key rejects task referencing another user project'
);

-- ------------------------------------------------------------------------------
-- 11. Active Timers: Exactly ONE active timer per user
-- ------------------------------------------------------------------------------
select lives_ok(
  $$
    insert into public.active_timers (user_id, task_id, state, segment_started_at)
    values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'running', now())
  $$,
  'User A creates a running active timer'
);

select throws_ok(
  $$
    insert into public.active_timers (user_id, task_id, state, segment_started_at)
    values ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'running', now())
  $$,
  '23505', -- unique_violation (primary key on user_id)
  NULL,
  'Database prevents a second active timer for the same user'
);

-- ------------------------------------------------------------------------------
-- 12. Multiple Users can each have their own independent active timer
-- ------------------------------------------------------------------------------
select lives_ok(
  $$
    insert into public.tasks (id, user_id, title)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '22222222-2222-4222-8222-222222222222', 'User B Task');

    insert into public.active_timers (user_id, task_id, state, segment_started_at)
    values ('22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'running', now());
  $$,
  'User B can simultaneously have their own active timer'
);

select * from finish();
rollback;
