-- Migration: 20261122000006_calendar_event_mapping_constraint.sql
-- Description: Adds a formal UNIQUE constraint to google_calendar_event_mappings for PostgREST onConflict support

-- Drop partial unique index if it exists
drop index if exists public.uq_gcal_mappings_user_task_calendar;

-- Add formal UNIQUE constraint on (user_id, task_id, google_calendar_id)
alter table public.google_calendar_event_mappings
  drop constraint if exists uq_gcal_mappings_user_task_cal;

alter table public.google_calendar_event_mappings
  add constraint uq_gcal_mappings_user_task_cal
  unique (user_id, task_id, google_calendar_id);
