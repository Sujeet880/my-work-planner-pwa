# Implementation Plan — My Work Planner PWA

This roadmap follows `My_Work_Planner_PRD_v1.2.md` and the Master Development Kickoff Prompt. Each milestone requires verification and owner sign-off before proceeding where external credentials or provisioning are needed.

## Milestone 0 — Architecture, Design System, Shell & PWA Foundation (Complete)
- Centralized `DESIGN.md` tokens (light mode only, Inter typography, tabular numerals, `#F6F7F9` canvas, `#FFFFFF` surfaces, `#4968D6` accent).
- Complete responsive `AppShell` (Desktop 232px fixed sidebar + 64px top bar; Tablet collapsible drawer; Mobile bottom navigation + sticky compact active timer).
- All primary routes scaffolded and wired (`/sign-in`, `/dashboard`, `/tasks`, `/tasks/:taskId`, `/time-tracker`, `/reports`, `/projects`, `/settings`, `/settings/google-calendar`).
- Pure domain calculations & validations (`src/lib/timeMath.ts`) verified by automated `node:test` unit tests.
- PWA manifest, valid PNG/SVG icons, minimal app-shell service worker, install button, and offline notice.
- Isolated, removable Milestone 0 preview data (`src/data/previewData.ts`); zero external secrets or fabricated connections.

## Milestone 1 — Authentication & Private Access Control (Next — Awaiting Owner Supabase Setup)
- Configure Supabase project credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, server keys, `ALLOWED_USER_EMAILS`).
- Wire real Supabase Email Magic Link sign-in and `/auth/callback` session verification.
- Enforce real route protection across all workspace views; redirect unauthenticated visitors to `/sign-in`.
- Auto-initialize owner `profiles` row with default timezone `Asia/Kolkata`.

## Milestone 2 — Database Schema, RLS, Projects & Core Task Management
- Apply SQL migrations for `profiles`, `projects`, `tasks`, `time_entries`, `calendar_connections`, and `task_calendar_links` with strict owner-only RLS policies.
- Remove `src/data/previewData.ts` and connect Projects CRUD, Tasks CRUD, Today/Upcoming/Inbox/All/Completed queries, search, filters, archive, and permanent delete to Supabase.

## Milestone 3 — Persistent Global Time Tracker & Manual Time Entries
- Persist active running/paused timer state in PostgreSQL so reload/tab-close recovery works accurately across desktop and mobile devices.
- Enforce single-active-timer constraint at both UI and database levels.
- Wire full manual time entry CRUD and chronological session history.

## Milestone 4 — Dashboard & Reports Analytics
- Replace local calculations with server/database-backed Daily, Weekly, Monthly, and Custom range aggregations.
- Maintain strict separation between saved report totals and any active unsaved timer session.

## Milestone 5 — Excel (.xlsx) & CSV (.csv) Exports
- Implement real multi-sheet `.xlsx` workbook generation (Summary, Tasks, Time Entries, Project Breakdown) and UTF-8 `.csv` exports scoped to selected filters and date ranges.

## Milestone 6 — Google Calendar One-Way Sync (Awaiting Owner Google OAuth Setup)
- Configure server-side Google OAuth consent & token storage (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- Implement strictly one-way sync (`My Work Planner → Google Calendar`) supporting all-day events, timed events, fallback default duration (60m), updates, removals, and retryable error states.

## Milestone 7 — Task Reminders, Mobile Polish & Production Hardening
- Implement in-app task reminder alerts plus browser notification support with honest platform capability messaging.
- Final cross-device PWA audit, accessibility verification, and production deployment checklist.
