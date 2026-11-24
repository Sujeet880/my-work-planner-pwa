-- ==============================================================================
-- My Work Planner — Milestone 10: Project Sharing & Client Portal Schema
-- Migration: 20261122000010_project_sharing_and_client_portal.sql
-- Description:
--   1. Adds client visibility and remaining estimate fields to `tasks`.
--   2. Adds sharing and progress visibility configuration to `projects`.
--   3. Creates `project_members`, `project_invitations`, `project_comments`,
--      `project_updates`, and `project_notifications` tables.
--   4. Configures tight, non-recursive Row-Level Security (RLS) policies.
-- ==============================================================================

-- 1. Extend existing `tasks` table
alter table public.tasks
  add column if not exists client_visible boolean not null default false,
  add column if not exists remaining_estimate_minutes integer check (remaining_estimate_minutes is null or remaining_estimate_minutes >= 0);

-- 2. Extend existing `projects` table
alter table public.projects
  add column if not exists target_completion_date date null,
  add column if not exists client_share_enabled boolean not null default false,
  add column if not exists client_view_time_tracking boolean not null default false,
  add column if not exists client_view_remaining_estimate boolean not null default false,
  add column if not exists client_view_task_dates boolean not null default true,
  add column if not exists client_allow_comments boolean not null default true,
  add column if not exists client_project_status text not null default 'on_track' check (client_project_status in ('on_track', 'at_risk', 'delayed', 'completed'));

-- 3. Create `project_members` table
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade null,
  invited_email text not null,
  role text not null default 'client' check (role in ('owner', 'client')),
  membership_status text not null default 'pending' check (membership_status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_members_project_id on public.project_members(project_id);
create index if not exists idx_project_members_user_id on public.project_members(user_id);
create index if not exists idx_project_members_email on public.project_members(lower(invited_email));
create unique index if not exists uq_project_members_active_email
  on public.project_members(project_id, lower(invited_email))
  where membership_status != 'revoked';

-- 4. Create `project_invitations` table
create table if not exists public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_email text not null,
  token_hash text not null unique,
  role text not null default 'client' check (role in ('client')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_invitations_token on public.project_invitations(token_hash);
create index if not exists idx_project_invitations_project on public.project_invitations(project_id);
create index if not exists idx_project_invitations_email on public.project_invitations(lower(invited_email));

-- 5. Create `project_comments` table
create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade null,
  parent_comment_id uuid references public.project_comments(id) on delete cascade null,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  resolved_at timestamptz null,
  resolved_by uuid references auth.users(id) on delete set null null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_project_comments_project on public.project_comments(project_id);
create index if not exists idx_project_comments_task on public.project_comments(task_id);
create index if not exists idx_project_comments_parent on public.project_comments(parent_comment_id);
create index if not exists idx_project_comments_author on public.project_comments(author_id);

-- 6. Create `project_updates` table
create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'delayed', 'completed')),
  progress_snapshot integer check (progress_snapshot is null or (progress_snapshot >= 0 and progress_snapshot <= 100)),
  message text not null,
  target_completion_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_updates_project on public.project_updates(project_id, created_at desc);

-- 7. Create `project_notifications` table
create table if not exists public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  comment_id uuid references public.project_comments(id) on delete cascade null,
  notification_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_notifications_recipient on public.project_notifications(recipient_user_id, read_at);
create index if not exists idx_project_notifications_project on public.project_notifications(project_id);

-- -----------------------------------------------------------------------------
-- 8. Security Definer Helper Functions
-- -----------------------------------------------------------------------------

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id
      and user_id = (select auth.uid())
  ) or exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = (select auth.uid())
      and membership_status = 'accepted'
  );
$$;

grant execute on function public.is_project_owner(uuid) to authenticated, service_role;
grant execute on function public.is_project_member(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. Row Level Security Configuration
-- -----------------------------------------------------------------------------

-- Enable RLS on all new tables
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_comments enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_notifications enable row level security;

-- 9.1 `projects` Policies
-- Allow members (accepted clients) to SELECT shared projects
drop policy if exists "project_members_select_shared" on public.projects;
create policy "project_members_select_shared"
  on public.projects
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_project_member(id)
  );

-- 9.2 `project_members` Policies
drop policy if exists "project_members_owner_manage" on public.project_members;
create policy "project_members_owner_manage"
  on public.project_members
  for all
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists "project_members_self_read" on public.project_members;
create policy "project_members_self_read"
  on public.project_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 9.3 `project_invitations` Policies
drop policy if exists "project_invitations_owner_manage" on public.project_invitations;
create policy "project_invitations_owner_manage"
  on public.project_invitations
  for all
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- 9.4 `tasks` Policies (Client Read-Only Access to client_visible tasks)
drop policy if exists "tasks_member_client_visible_select" on public.tasks;
create policy "tasks_member_client_visible_select"
  on public.tasks
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      client_visible = true
      and project_id is not null
      and public.is_project_member(project_id)
    )
  );

-- 9.5 `work_sessions` Policies (Client Read-Only Access if enabled on project)
drop policy if exists "work_sessions_member_select" on public.work_sessions;
create policy "work_sessions_member_select"
  on public.work_sessions
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      task_id is not null
      and exists (
        select 1 from public.tasks t
        join public.projects p on p.id = t.project_id
        where t.id = work_sessions.task_id
          and t.client_visible = true
          and p.client_view_time_tracking = true
          and public.is_project_member(p.id)
      )
    )
  );

-- 9.6 `project_comments` Policies
drop policy if exists "project_comments_member_select" on public.project_comments;
create policy "project_comments_member_select"
  on public.project_comments
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "project_comments_member_insert" on public.project_comments;
create policy "project_comments_member_insert"
  on public.project_comments
  for insert
  to authenticated
  with check (
    public.is_project_member(project_id)
    and (select auth.uid()) = author_id
    and (
      task_id is null
      or exists (
        select 1 from public.tasks t
        where t.id = project_comments.task_id
          and t.project_id = project_comments.project_id
          and (public.is_project_owner(project_comments.project_id) or t.client_visible = true)
      )
    )
  );

drop policy if exists "project_comments_author_or_owner_update" on public.project_comments;
create policy "project_comments_author_or_owner_update"
  on public.project_comments
  for update
  to authenticated
  using (
    (select auth.uid()) = author_id
    or public.is_project_owner(project_id)
  )
  with check (
    (select auth.uid()) = author_id
    or public.is_project_owner(project_id)
  );

drop policy if exists "project_comments_author_or_owner_delete" on public.project_comments;
create policy "project_comments_author_or_owner_delete"
  on public.project_comments
  for delete
  to authenticated
  using (
    (select auth.uid()) = author_id
    or public.is_project_owner(project_id)
  );

-- 9.7 `project_updates` Policies
drop policy if exists "project_updates_member_select" on public.project_updates;
create policy "project_updates_member_select"
  on public.project_updates
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "project_updates_owner_manage" on public.project_updates;
create policy "project_updates_owner_manage"
  on public.project_updates
  for all
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- 9.8 `project_notifications` Policies
drop policy if exists "project_notifications_recipient_all" on public.project_notifications;
create policy "project_notifications_recipient_all"
  on public.project_notifications
  for all
  to authenticated
  using ((select auth.uid()) = recipient_user_id)
  with check ((select auth.uid()) = recipient_user_id);

drop policy if exists "project_notifications_member_insert" on public.project_notifications;
create policy "project_notifications_member_insert"
  on public.project_notifications
  for insert
  to authenticated
  with check (public.is_project_member(project_id));

-- Grant Data API permissions to authenticated & service_role
grant select, insert, update, delete on public.project_members to authenticated, service_role;
grant select, insert, update, delete on public.project_invitations to authenticated, service_role;
grant select, insert, update, delete on public.project_comments to authenticated, service_role;
grant select, insert, update, delete on public.project_updates to authenticated, service_role;
grant select, insert, update, delete on public.project_notifications to authenticated, service_role;
