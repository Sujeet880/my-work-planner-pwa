-- ==============================================================================
-- My Work Planner — Milestone 12: Client Invitation Delivery & Lifecycle Tracking
-- Migration: 20261123000012_invitation_delivery_lifecycle.sql
-- ==============================================================================

-- 1. Extend `project_invitations` with email delivery tracking columns
alter table public.project_invitations
  add column if not exists delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'failed')),
  add column if not exists delivery_error text null,
  add column if not exists sent_at timestamptz null,
  add column if not exists delivery_provider_message_id text null,
  add column if not exists resend_count integer not null default 0;

create index if not exists idx_project_invitations_delivery on public.project_invitations(delivery_status);

-- 2. Deduplicate existing redundant pending invitations before applying unique constraint
with ranked as (
  select id, row_number() over (partition by project_id, lower(invited_email) order by created_at desc) as rn
  from public.project_invitations
  where accepted_at is null and revoked_at is null
)
update public.project_invitations
set revoked_at = now()
where id in (select id from ranked where rn > 1);

-- 3. Enforce single active pending invitation per project per email
create unique index if not exists uq_project_invitations_active_email
  on public.project_invitations(project_id, lower(invited_email))
  where accepted_at is null and revoked_at is null;

-- 4. Secure RPC: Create or Resend Project Invitation
create or replace function public.rpc_create_or_resend_invitation(
  p_project_id uuid,
  p_invited_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_resend boolean default false
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

  -- 1. Verify caller owns this project
  select id, name, user_id into v_proj
  from public.projects
  where id = p_project_id;

  if not found or v_proj.user_id <> v_uid then
    return json_build_object('success', false, 'error', 'Access denied. Only the project owner can invite clients.');
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Invalid email address.');
  end if;

  -- 2. Check if already an active accepted member
  if exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and lower(invited_email) = v_email
      and membership_status = 'accepted'
  ) then
    return json_build_object('success', false, 'error', 'This user is already an active member of this project.');
  end if;

  -- 3. Check for existing active pending invitation
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
        delivery_status = 'queued',
        delivery_error = null,
        resend_count = resend_count + 1
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

  -- 4. Ensure pending project_members record
  insert into public.project_members (
    project_id,
    invited_email,
    role,
    membership_status,
    invited_by,
    invited_at
  ) values (
    p_project_id,
    v_email,
    'client',
    'pending',
    v_uid,
    now()
  )
  on conflict (project_id, lower(invited_email))
  where membership_status != 'revoked'
  do update set
    updated_at = now();

  -- 5. Enable client_share_enabled on project
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

revoke all on function public.rpc_create_or_resend_invitation(uuid, text, text, timestamptz, boolean) from public;
grant execute on function public.rpc_create_or_resend_invitation(uuid, text, text, timestamptz, boolean) to authenticated;

-- 5. Secure RPC: Update Invitation Delivery Status
create or replace function public.rpc_update_invitation_delivery(
  p_invitation_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('queued', 'sent', 'failed') then
    return json_build_object('success', false, 'error', 'Invalid delivery status.');
  end if;

  update public.project_invitations
  set
    delivery_status = p_status,
    sent_at = case when p_status = 'sent' then now() else sent_at end,
    delivery_provider_message_id = coalesce(p_provider_message_id, delivery_provider_message_id),
    delivery_error = case when p_status = 'failed' then p_error else null end
  where id = p_invitation_id;

  if not found then
    return json_build_object('success', false, 'error', 'Invitation not found.');
  end if;

  return json_build_object('success', true);
end;
$$;

revoke all on function public.rpc_update_invitation_delivery(uuid, text, text, text) from public;
grant execute on function public.rpc_update_invitation_delivery(uuid, text, text, text) to authenticated;

-- 6. Secure RPC: Revoke Project Invitation
create or replace function public.rpc_revoke_project_invitation(p_invitation_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv record;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Authentication required.');
  end if;

  select * into v_inv
  from public.project_invitations
  where id = p_invitation_id;

  if not found then
    return json_build_object('success', false, 'error', 'Invitation not found.');
  end if;

  if not public.is_project_owner(v_inv.project_id) then
    return json_build_object('success', false, 'error', 'Access denied.');
  end if;

  -- Mark invitation revoked
  update public.project_invitations
  set revoked_at = now()
  where id = p_invitation_id;

  -- Update member status to revoked
  update public.project_members
  set membership_status = 'revoked', updated_at = now()
  where project_id = v_inv.project_id
    and lower(invited_email) = lower(v_inv.invited_email);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.rpc_revoke_project_invitation(uuid) from public;
grant execute on function public.rpc_revoke_project_invitation(uuid) to authenticated;
