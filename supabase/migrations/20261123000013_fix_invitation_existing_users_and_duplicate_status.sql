-- ==============================================================================
-- My Work Planner — Milestone 13: Trusted Auth User Status Check & Invitation Status Fix
-- Migration: 20261123000013_fix_invitation_existing_users_and_duplicate_status.sql
-- ==============================================================================

-- 1. Trusted Security Definer function to check if a user already exists in auth.users
-- This allows the server-side edge function and RPCs to differentiate existing registered
-- users from brand new users without throwing or leaking auth errors.
create or replace function public.rpc_check_auth_user_status(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_confirmed boolean;
begin
  select id, (email_confirmed_at is not null)
  into v_user_id, v_confirmed
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is not null then
    return jsonb_build_object(
      'exists', true,
      'user_id', v_user_id,
      'is_confirmed', coalesce(v_confirmed, false)
    );
  else
    return jsonb_build_object(
      'exists', false,
      'user_id', null,
      'is_confirmed', false
    );
  end if;
end;
$$;

revoke all on function public.rpc_check_auth_user_status(text) from public;
grant execute on function public.rpc_check_auth_user_status(text) to authenticated, service_role;

-- 2. Enhanced rpc_create_or_resend_invitation with independent resend count tracking
-- Reissuing a link (e.g. Copy Invitation Link) generates a fresh secure token without
-- artificially incrementing the email resend counter.
create or replace function public.rpc_create_or_resend_invitation(
  p_project_id uuid,
  p_invited_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_resend boolean default false,
  p_increment_resend boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_invited_email));
  v_proj record;
  v_existing_inv record;
  v_inv_id uuid;
  v_is_resend boolean := false;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Authentication required.');
  end if;

  -- Verify caller owns this project
  select id, name, user_id into v_proj
  from public.projects
  where id = p_project_id;

  if not found or v_proj.user_id <> v_uid then
    return json_build_object('success', false, 'error', 'Access denied. Only the project owner can invite clients.');
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Invalid email address.');
  end if;

  -- Check if already an active accepted member
  if exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and lower(invited_email) = v_email
      and membership_status = 'accepted'
  ) then
    return json_build_object('success', false, 'error', 'This user is already an active member of this project.');
  end if;

  -- Check for existing active pending invitation
  select * into v_existing_inv
  from public.project_invitations
  where project_id = p_project_id
    and lower(invited_email) = v_email
    and accepted_at is null
    and revoked_at is null
  limit 1;

  if found then
    if p_resend or v_existing_inv.expires_at < now() or v_existing_inv.delivery_status = 'failed' then
      -- Invalidate old token and update with fresh token
      update public.project_invitations
      set
        token_hash = p_token_hash,
        expires_at = p_expires_at,
        delivery_status = case when p_increment_resend then 'queued' else delivery_status end,
        delivery_error = case when p_increment_resend then null else delivery_error end,
        resend_count = case when p_increment_resend then resend_count + 1 else resend_count end
      where id = v_existing_inv.id
      returning id into v_inv_id;

      v_is_resend := true;
    else
      -- Active unexpired invitation already exists and not explicitly resending
      v_inv_id := v_existing_inv.id;
    end if;
  else
    -- Insert new invitation
    insert into public.project_invitations (
      project_id,
      invited_email,
      token_hash,
      role,
      invited_by,
      expires_at,
      delivery_status,
      delivery_error,
      resend_count
    ) values (
      p_project_id,
      v_email,
      p_token_hash,
      'client',
      v_uid,
      p_expires_at,
      'queued',
      null,
      0
    )
    returning id into v_inv_id;
  end if;

  -- Ensure pending project_members record exists
  insert into public.project_members (
    project_id,
    invited_email,
    role,
    membership_status,
    invited_by,
    invited_at,
    accepted_at
  ) values (
    p_project_id,
    v_email,
    'client',
    'pending',
    v_uid,
    now(),
    null
  )
  on conflict (project_id, lower(invited_email))
  where membership_status != 'revoked'
  do update set
    updated_at = now();

  -- Enable client_share_enabled on project
  update public.projects
  set client_share_enabled = true
  where id = p_project_id;

  return json_build_object(
    'success', true,
    'invitation_id', v_inv_id,
    'project_name', v_proj.name,
    'is_resend', v_is_resend,
    'invited_email', v_email
  );
end;
$$;

revoke all on function public.rpc_create_or_resend_invitation(uuid, text, text, timestamptz, boolean, boolean) from public;
grant execute on function public.rpc_create_or_resend_invitation(uuid, text, text, timestamptz, boolean, boolean) to authenticated, service_role;

-- 3. Data cleanup: ensure any pending project_members records have accepted_at = null
update public.project_members
set accepted_at = null
where membership_status = 'pending' and accepted_at is not null;
