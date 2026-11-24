-- ==============================================================================
-- My Work Planner — Milestone 14: Complete Project Collaboration System Overhaul
-- Migration: 20261123000014_complete_project_collaboration_overhaul.sql
-- Description:
--   1. Adds `project_task_requests` table with client submission and owner review lifecycle.
--   2. Adds `conversation_reads` table for user-specific unread tracking.
--   3. Tightens RLS on `project_comments` to enforce task visibility boundaries.
--   4. Creates atomic & idempotent RPC `rpc_approve_task_request`.
--   5. Connects tables to `supabase_realtime` publication for instant two-way messaging.
-- ==============================================================================

-- 1. Create `project_task_requests` table
create table if not exists public.project_task_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text null,
  reason text null,
  suggested_priority text not null default 'medium' check (suggested_priority in ('low', 'medium', 'high', 'urgent')),
  requested_due_date date null,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'needs_information', 'approved', 'rejected', 'withdrawn')),
  owner_feedback text null,
  created_task_id uuid references public.tasks(id) on delete set null null,
  reviewed_at timestamptz null,
  reviewed_by uuid references auth.users(id) on delete set null null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_task_requests_project on public.project_task_requests(project_id, created_at desc);
create index if not exists idx_project_task_requests_requester on public.project_task_requests(requested_by);
create index if not exists idx_project_task_requests_status on public.project_task_requests(status);

-- 2. Create `conversation_reads` table for user-specific unread tracking
create table if not exists public.conversation_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade null,
  last_read_at timestamptz not null default now(),
  constraint uq_conversation_reads_target unique (user_id, project_id, task_id)
);

create index if not exists idx_conversation_reads_user on public.conversation_reads(user_id, project_id);

-- 3. Row-Level Security for `project_task_requests`
alter table public.project_task_requests enable row level security;

drop policy if exists "task_requests_member_select" on public.project_task_requests;
create policy "task_requests_member_select"
  on public.project_task_requests
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "task_requests_member_insert" on public.project_task_requests;
create policy "task_requests_member_insert"
  on public.project_task_requests
  for insert
  to authenticated
  with check (
    public.is_project_member(project_id)
    and (select auth.uid()) = requested_by
  );

drop policy if exists "task_requests_owner_or_requester_update" on public.project_task_requests;
create policy "task_requests_owner_or_requester_update"
  on public.project_task_requests
  for update
  to authenticated
  using (
    public.is_project_owner(project_id)
    or ((select auth.uid()) = requested_by and status in ('submitted', 'needs_information'))
  )
  with check (
    public.is_project_owner(project_id)
    or ((select auth.uid()) = requested_by and status in ('submitted', 'needs_information', 'withdrawn'))
  );

-- 4. Row-Level Security for `conversation_reads`
alter table public.conversation_reads enable row level security;

drop policy if exists "conversation_reads_user_all" on public.conversation_reads;
create policy "conversation_reads_user_all"
  on public.conversation_reads
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 5. Symmetrical & Task-Boundary Protected SELECT on `project_comments`
drop policy if exists "project_comments_member_select" on public.project_comments;
create policy "project_comments_member_select"
  on public.project_comments
  for select
  to authenticated
  using (
    public.is_project_member(project_id)
    and (
      task_id is null
      or public.is_project_owner(project_id)
      or exists (
        select 1 from public.tasks t
        where t.id = project_comments.task_id
          and t.project_id = project_comments.project_id
          and t.client_visible = true
      )
    )
  );

-- 6. Atomic, Idempotent Task Request Approval RPC
create or replace function public.rpc_approve_task_request(
  p_request_id uuid,
  p_title text default null,
  p_description text default null,
  p_scheduled_date date default null,
  p_scheduled_start_time time default null,
  p_planned_duration_minutes integer default null,
  p_priority text default 'medium',
  p_client_visible boolean default true
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_new_task_id uuid;
  v_owner_id uuid := auth.uid();
  v_final_title text;
  v_final_desc text;
begin
  -- 1. Fetch request and verify existence
  select * into v_req
  from public.project_task_requests
  where id = p_request_id;

  if not found then
    return json_build_object('success', false, 'error', 'Task request not found.');
  end if;

  -- 2. Verify caller is workspace owner of the parent project
  if not public.is_project_owner(v_req.project_id) then
    return json_build_object('success', false, 'error', 'Only the project owner can approve task requests.');
  end if;

  -- 3. Idempotency Check: if already approved, return existing task
  if v_req.status = 'approved' and v_req.created_task_id is not null then
    return json_build_object(
      'success', true,
      'already_approved', true,
      'task_id', v_req.created_task_id,
      'message', 'Task request was already approved.'
    );
  end if;

  v_final_title := coalesce(nullif(trim(p_title), ''), v_req.title);
  v_final_desc := coalesce(p_description, v_req.description);

  -- 4. Create the actual active task in `tasks`
  insert into public.tasks (
    project_id,
    user_id,
    title,
    description,
    scheduled_date,
    scheduled_start_time,
    planned_duration_minutes,
    priority,
    client_visible,
    status,
    is_archived
  ) values (
    v_req.project_id,
    v_owner_id,
    v_final_title,
    v_final_desc,
    coalesce(p_scheduled_date, v_req.requested_due_date),
    p_scheduled_start_time,
    p_planned_duration_minutes,
    coalesce(p_priority, v_req.suggested_priority, 'medium'),
    coalesce(p_client_visible, true),
    'todo',
    false
  )
  returning id into v_new_task_id;

  -- 5. Mark task request as approved
  update public.project_task_requests
  set
    status = 'approved',
    created_task_id = v_new_task_id,
    reviewed_at = now(),
    reviewed_by = v_owner_id,
    updated_at = now()
  where id = p_request_id;

  -- 6. Notify requester of approval
  insert into public.project_notifications (
    recipient_user_id,
    project_id,
    notification_type,
    title,
    body
  ) values (
    v_req.requested_by,
    v_req.project_id,
    'task_request_approved',
    'Task Request Approved: ' || v_final_title,
    'Your task request has been approved and added to project deliverables.'
  );

  return json_build_object(
    'success', true,
    'task_id', v_new_task_id,
    'project_id', v_req.project_id
  );
end;
$$;

revoke all on function public.rpc_approve_task_request(uuid, text, text, date, time, integer, text, boolean) from public;
grant execute on function public.rpc_approve_task_request(uuid, text, text, date, time, integer, text, boolean) to authenticated;

-- 7. Grant table access
grant select, insert, update on public.project_task_requests to authenticated, service_role;
grant select, insert, update, delete on public.conversation_reads to authenticated, service_role;

-- 8. Add Realtime publication support
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_comments'
  ) then
    alter publication supabase_realtime add table public.project_comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_task_requests'
  ) then
    alter publication supabase_realtime add table public.project_task_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_reads'
  ) then
    alter publication supabase_realtime add table public.conversation_reads;
  end if;
end $$;

alter table public.project_comments replica identity full;
alter table public.project_task_requests replica identity full;
