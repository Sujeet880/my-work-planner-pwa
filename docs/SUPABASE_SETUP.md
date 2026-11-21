# Supabase Setup & Database Migration Guide

This guide details the exact steps required to apply the database schema, verify Row Level Security, and manage types for **My Work Planner**.

---

## 1. Project Reference & Environment Variables

| Parameter | Value |
| :--- | :--- |
| **Project Name** | My Task Planer |
| **Project Reference** | `tefxkrigwvyiescuctmb` |
| **Hosting Region** | `ap-northeast-1` (Tokyo) |
| **Project URL** | `https://tefxkrigwvyiescuctmb.supabase.co` |
| **Local Config** | `supabase/config.toml` |
| **Primary Migration** | `supabase/migrations/20261121000001_create_my_work_planner_schema.sql` |
| **pgTAP Test Suite** | `supabase/tests/00001_schema_and_rls_test.sql` |

### Environment Configuration in `.env.local`
```bash
# In /Users/sujitwork/Desktop/WORK/my-work-planner/.env.local
VITE_SUPABASE_URL="https://tefxkrigwvyiescuctmb.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<paste-your-anon-publishable-key-here>"
VITE_APP_BASE_URL="http://localhost:3000"
```

> [!CAUTION]
> **Never commit your `.env.local` file to git.** It is already ignored by `.gitignore`. Never use the `service_role` or secret key in browser code.

---

## 2. Applying the Migration to the Remote Database

The migration script creates all 6 tables (`profiles`, `projects`, `tasks`, `work_sessions`, `active_timers`, `user_preferences`), sets up Row Level Security policies, indexes, and triggers.

### Method A: Via Supabase Dashboard SQL Editor (Fastest & Simplest)

1. Open your browser and go to the Supabase Dashboard:
   [https://supabase.com/dashboard/project/tefxkrigwvyiescuctmb/sql/new](https://supabase.com/dashboard/project/tefxkrigwvyiescuctmb/sql/new)
2. Open the migration file in your code editor:
   `supabase/migrations/20261121000001_create_my_work_planner_schema.sql`
3. Copy the entire contents of the file.
4. Paste it into the SQL Editor in the Supabase Dashboard.
5. Click the green **Run** button (or press `Cmd + Enter`).
6. Confirm the console displays: `Success. No rows returned`.
7. Navigate to **Table Editor** in the left menu to view your newly created tables.

### Method B: Via Supabase CLI

```bash
# 1. Login to Supabase CLI (opens browser authentication)
npx supabase login

# 2. Link your local project to the remote project reference
npx supabase link --project-ref tefxkrigwvyiescuctmb

# 3. Push migrations to remote database
npx supabase db push
```

---

## 3. Generating TypeScript Database Types

Once the migration has been applied to the remote database, generate up-to-date TypeScript definitions:

```bash
# Generate types directly from the remote project schema
npx supabase gen types typescript --project-id tefxkrigwvyiescuctmb > src/types/database.types.ts
```

The codebase is already pre-configured with complete, matching TypeScript types in `src/types/database.types.ts` reflecting all six tables, column constraints, and foreign key relationships.

---

## 4. Running Database Tests (pgTAP)

The test file `supabase/tests/00001_schema_and_rls_test.sql` verifies:
- All 6 tables exist and have active RLS.
- Start time without scheduled date is rejected.
- Planned duration `<= 0` is rejected.
- Work session duration `<= 0` is rejected.
- Cross-tenant references (User A trying to link to User B's project) fail with foreign key errors.
- A user can only have at most **one** active timer.
- Different users can simultaneously have independent active timers.

To execute the test suite locally with Supabase CLI and Docker:
```bash
# Run pgTAP database tests
npx supabase test db
```

---

## 5. Milestone Status & Verification Summary

| Component | Status | Details |
| :--- | :---: | :--- |
| **SQL Migration File** | ✅ **Created & Formatted** | Located at `supabase/migrations/20261121000001_create_my_work_planner_schema.sql` |
| **All 6 Tables Defined** | ✅ **Created & Formatted** | `profiles`, `projects`, `tasks`, `work_sessions`, `active_timers`, `user_preferences` |
| **Row Level Security (RLS)** | ✅ **Created & Formatted** | Explicit policies for SELECT, INSERT, UPDATE (USING + CHECK), DELETE with `(select auth.uid())` subqueries |
| **Database Constraints** | ✅ **Created & Formatted** | Enforces scheduled start time dependency, positive durations, and single active timer per user |
| **pgTAP Test Suite** | ✅ **Created & Formatted** | Located at `supabase/tests/00001_schema_and_rls_test.sql` |
| **TypeScript Types** | ✅ **Verified** | `src/types/database.types.ts` is fully updated and passes typecheck |
| **Application Build** | ✅ **Verified** | `npm test` (15/15 passing) and `npm run build` succeed with 0 errors |
| **Remote Migration Execution** | ⏳ **Awaiting User Action** | Apply the migration SQL via Method A (Dashboard SQL Editor) or Method B (CLI) |
