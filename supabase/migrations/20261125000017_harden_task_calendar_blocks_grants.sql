-- ==============================================================================
-- My Work Planner — Harden task_calendar_blocks role grants
-- Migration: 20261125000017_harden_task_calendar_blocks_grants.sql
-- Description:
--   Matches the privilege posture of all other core tables (tasks, projects,
--   work_sessions) by revoking anon privileges and explicitly granting CRUD to
--   authenticated users (strictly governed by RLS policies).
-- ==============================================================================

revoke all on public.task_calendar_blocks from anon;
grant select, insert, update, delete on public.task_calendar_blocks to authenticated;
