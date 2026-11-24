-- ==============================================================================
-- My Work Planner — Milestone 11: Trusted Workspace Authorization, Client Portal Security & RPCs
-- Migration: 20261122000011_trusted_owner_role_and_invitation_security.sql
-- ==============================================================================

-- 1. Create `workspace_roles` table
create table if not exists public.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  role text not null check (role in ('owner', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_roles_user_id on public.workspace_roles(user_id);
create index if not exists idx_workspace_roles_role on public.workspace_roles(role);

-- Enable RLS on `workspace_roles`
alter table public.workspace_roles enable row level security;

drop policy if exists "workspace_roles_read_own" on public.workspace_roles;
create policy "workspace_roles_read_own"
  on public.workspace_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Deny authenticated insert/update/delete on workspace_roles (only migrations or security definer RPCs can change roles)
drop policy if exists "workspace_roles_deny_authenticated_insert" on public.workspace_roles;
create policy "workspace_roles_deny_authenticated_insert"
  on public.workspace_roles
  for insert
  to authenticated
  with check (false);

drop policy if exists "workspace_roles_deny_authenticated_update" on public.workspace_roles;
create policy "workspace_roles_deny_authenticated_update"
  on public.workspace_roles
  for update
  to authenticated
  using (false);

drop policy if exists "workspace_roles_deny_authenticated_delete" on public.workspace_roles;
create policy "workspace_roles_deny_authenticated_delete"
  on public.workspace_roles
  for delete
  to authenticated
  using (false);

-- 2. Bootstrap Genuine Workspace Owner Account
-- Seed the known owner user ID if present in auth.users
insert into public.workspace_roles (user_id, role)
select id, 'owner'
from auth.users
where email in ('ktsujeet1997@gmail.com')
on conflict (user_id) do update set role = 'owner';

-- Also ensure any user who already created projects is recognized as owner
insert into public.workspace_roles (user_id, role)
select distinct user_id, 'owner'
from public.projects
where user_id is not null
on conflict (user_id) do nothing;

-- 3. Security Definer Helper: is_workspace_owner
create or replace function public.is_workspace_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_roles
    where user_id = p_user_id
      and role = 'owner'
  );
$$;

-- 4. Enforce Owner-Only Writes on `projects`
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects
  for update
  to authenticated
  using (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

-- 5. Enforce Owner-Only Writes on `tasks`
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
  on public.tasks
  for delete
  to authenticated
  using (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

-- 6. Enforce Owner-Only Writes on `work_sessions` & `active_timers`
drop policy if exists "work_sessions_insert_own" on public.work_sessions;
create policy "work_sessions_insert_own"
  on public.work_sessions
  for insert
  to authenticated
  with check (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

drop policy if exists "active_timers_insert_own" on public.active_timers;
create policy "active_timers_insert_own"
  on public.active_timers
  for insert
  to authenticated
  with check (
    public.is_workspace_owner((select auth.uid()))
    and (select auth.uid()) = user_id
  );

-- 7. Secure RPC: Preview Project Invitation (Bypasses table RLS for unverified invitees)
create or replace function public.rpc_get_invitation_preview(p_token_hash text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_proj record;
begin
  select * into v_inv
  from public.project_invitations
  where token_hash = p_token_hash;

  if not found then
    return json_build_object('found', false, 'error', 'Invitation not found or invalid link.');
  end if;

  select name, description, color into v_proj
  from public.projects
  where id = v_inv.project_id;

  return json_build_object(
    'found', true,
    'id', v_inv.id,
    'project_id', v_inv.project_id,
    'project_name', coalesce(v_proj.name, 'Shared Project'),
    'project_description', v_proj.description,
    'project_color', coalesce(v_proj.color, '#2F65F6'),
    'invited_email', v_inv.invited_email,
    'expires_at', v_inv.expires_at,
    'is_expired', v_inv.expires_at < now(),
    'is_accepted', v_inv.accepted_at is not null,
    'is_revoked', v_inv.revoked_at is not null
  );
end;
$$;

revoke all on function public.rpc_get_invitation_preview(text) from public;
grant execute on function public.rpc_get_invitation_preview(text) to authenticated, anon;

-- 8. Secure RPC: Accept Project Invitation (Atomic, Verified & Safe)
create or replace function public.rpc_accept_project_invitation(p_token_hash text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_inv record;
  v_now timestamptz := now();
begin
  if v_uid is null or v_email = '' then
    return json_build_object('success', false, 'error', 'Authentication required.');
  end if;

  select * into v_inv
  from public.project_invitations
  where token_hash = p_token_hash;

  if not found then
    return json_build_object('success', false, 'error', 'Invalid invitation token.');
  end if;

  if v_inv.revoked_at is not null then
    return json_build_object('success', false, 'error', 'This invitation was revoked by the project owner.');
  end if;

  if v_inv.accepted_at is not null then
    return json_build_object('success', true, 'project_id', v_inv.project_id, 'message', 'Invitation already accepted.');
  end if;

  if v_inv.expires_at < v_now then
    return json_build_object('success', false, 'error', 'This invitation has expired.');
  end if;

  if lower(v_inv.invited_email) <> v_email then
    return json_build_object(
      'success', false,
      'error', 'Email mismatch: This invitation was sent to ' || v_inv.invited_email || ' but you are signed in as ' || v_email || '.'
    );
  end if;

  -- 1. Mark invitation accepted
  update public.project_invitations
  set accepted_at = v_now
  where id = v_inv.id;

  -- 2. Upsert project membership as accepted
  insert into public.project_members (
    project_id,
    user_id,
    invited_email,
    role,
    membership_status,
    invited_by,
    invited_at,
    accepted_at,
    updated_at
  ) values (
    v_inv.project_id,
    v_uid,
    v_email,
    'client',
    'accepted',
    v_inv.invited_by,
    v_inv.created_at,
    v_now,
    v_now
  )
  on conflict (project_id, lower(invited_email))
  where membership_status != 'revoked'
  do update set
    user_id = v_uid,
    membership_status = 'accepted',
    accepted_at = v_now,
    updated_at = v_now;

  -- 3. Register user as 'client' in workspace_roles if not already owner
  insert into public.workspace_roles (user_id, role)
  values (v_uid, 'client')
  on conflict (user_id) do nothing;

  -- 4. Notify project owner
  insert into public.project_notifications (
    recipient_user_id,
    project_id,
    notification_type,
    title,
    body
  ) values (
    v_inv.invited_by,
    v_inv.project_id,
    'invitation_accepted',
    'Client Accepted Invitation',
    v_email || ' has accepted your invitation and joined the project workspace.'
  );

  return json_build_object('success', true, 'project_id', v_inv.project_id);
end;
$$;

revoke all on function public.rpc_accept_project_invitation(text) from public;
grant execute on function public.rpc_accept_project_invitation(text) to authenticated;

-- 9. Secure RPC: Get Safe Client Time Summary
create or replace function public.rpc_get_client_project_time_summary(p_project_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_share_time boolean;
  v_total_seconds bigint := 0;
begin
  if not public.is_project_member(p_project_id) then
    return json_build_object('error', 'Access denied.');
  end if;

  select client_view_time_tracking into v_share_time
  from public.projects
  where id = p_project_id;

  if not coalesce(v_share_time, false) then
    return json_build_object('time_tracking_enabled', false, 'total_actual_seconds', 0);
  end if;

  select coalesce(sum(ws.duration_seconds), 0) into v_total_seconds
  from public.work_sessions ws
  join public.tasks t on t.id = ws.task_id
  where t.project_id = p_project_id
    and t.client_visible = true;

  return json_build_object(
    'time_tracking_enabled', true,
    'total_actual_seconds', v_total_seconds
  );
end;
$$;

revoke all on function public.rpc_get_client_project_time_summary(uuid) from public;
grant execute on function public.rpc_get_client_project_time_summary(uuid) to authenticated;
