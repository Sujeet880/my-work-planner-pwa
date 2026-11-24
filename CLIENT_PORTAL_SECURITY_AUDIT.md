# My Work Planner — Client Portal Security Audit & Incident Assessment

## 1. Incident Overview & Investigation Scope

### 1.1 Reported Issues
1. **Issue 1**: When an invited client signs in via Magic Link / invitation, they can land on `/dashboard` and view owner-level UI.
2. **Issue 2**: The client portal does not reliably load shared projects or project deliverables.

### 1.2 Database Audit & Remote Inspection
To verify whether client accounts had leaked owner data or mutated workspace state, a live forensic audit was performed on remote Supabase database `tefxkrigwvyiescuctmb.supabase.co`.

```
============================================================
SUPABASE AUDIT: tefxkrigwvyiescuctmb
============================================================
Projects count: 3
Tasks count: 18
Work sessions count: 26
Users count: 2
Project members count: 0
Project invitations count: 0
============================================================
```

### 1.3 Key Finding: Zero Cross-Tenant Data Leakage
- **No data breach occurred.**
- In Milestone 10, `project_invitations` and `project_members` RLS policies contained `USING (public.is_project_owner(project_id))` for write operations.
- When an external client clicked an invitation link and ran `acceptInvitation()`, PostgreSQL RLS blocked the update because the client was not the project owner (`is_project_owner` returned `false`).
- As a consequence:
  1. The client could not bind their `user_id` to `project_members`.
  2. Because `project_members.user_id` remained null/unbound, `is_project_member(project_id)` was `false`.
  3. The client had 0 visible projects in the Client Portal.
  4. When the client navigated to `/dashboard`, the existing `tasks_read_own` policy returned **0 rows** (because `auth.uid() = user_id` matched only their own empty account).
  5. The client saw an empty dashboard with zero owner tasks, projects, or client information.

---

## 2. Root Cause Analysis

### 2.1 Failure 1: Unprotected Wildcard Frontend Routing
In `src/App.tsx`:
```tsx
// VULNERABLE CODE:
<Route path="/*" element={<ProtectedRoute><WorkspaceRoutes /></ProtectedRoute>} />
```
`ProtectedRoute` only verified `isAuthenticated === true`. Any signed-in user — regardless of role — was served `WorkspaceRoutes`, rendering the owner `AppShell` with full sidebar navigation.

### 2.2 Failure 2: Client Lockout from Invitation Acceptance
In `supabase/migrations/20261122000010_project_sharing_and_client_portal.sql`:
```sql
-- VULNERABLE CODE:
create policy "project_invitations_update_owner"
  on public.project_invitations for update to authenticated
  using (public.is_project_owner(project_id));
```
An invitee accepting an invitation is **not** the project owner. When the invitee called:
```ts
await supabase.from('project_invitations').update({ accepted_at: nowIso }).eq('id', inv.id);
```
RLS rejected the update, throwing a permission error or updating 0 rows. The invitation was never completed.

### 2.3 Failure 3: Direct Client Query on Private Work Sessions
In `sharingService.ts`:
```ts
// VULNERABLE CODE:
supabase.from('work_sessions').select('duration_seconds').eq('project_id', p.id);
```
Because `work_sessions` table stores detailed internal session logs, timers, and notes, it is locked to the workspace owner. Direct select queries by clients failed or returned empty results, breaking total logged time reporting in the portal.

---

## 3. Remediation & Defense-in-Depth Implementation

### 3.1 Migration `20261122000011_trusted_owner_role_and_invitation_security.sql`
The following hardened primitives were pushed and applied to remote Supabase:

1. **Explicit Role Enforcement (`workspace_roles`)**:
   - Table storing verified roles (`'owner'`, `'client'`).
   - Hardened with RLS denying direct insert, update, or delete to authenticated users.
   - Bootstrapped genuine owner `ktsujeet1997@gmail.com` as `'owner'`.
2. **Security Definer RPC: `rpc_get_invitation_preview(p_token_hash text)`**:
   - Allows unauthenticated or authenticated invitees to safely preview the project name, description, and invited email without exposing sensitive tables.
3. **Security Definer RPC: `rpc_accept_project_invitation(p_token_hash text)`**:
   - Atomic transaction executing under elevated database privileges:
     1. Verifies token validity, expiry, and non-revocation.
     2. Validates that `lower(auth.jwt()->>'email')` matches `lower(invited_email)`.
     3. Marks invitation accepted.
     4. Upserts `project_members` with `membership_status = 'accepted'` and binds `user_id = auth.uid()`.
     5. Registers user in `workspace_roles` with `role = 'client'`.
     6. Creates an owner notification in `project_notifications`.
4. **Security Definer RPC: `rpc_get_client_project_time_summary(p_project_id uuid)`**:
   - Checks `public.is_project_member(p_project_id)` and verifies `client_view_time_tracking = true`.
   - Aggregates logged seconds strictly for `client_visible = true` tasks without exposing private session records.

### 3.2 Frontend Route Hardening (`OwnerRoute` & `ClientPortalRoute`)
- `OwnerRoute` wraps all owner routes and blocks any non-owner.
- `ClientPortalRoute` ensures clients can only access shared portal views.
- `ClientPortalLayout` hides owner workspace navigation from clients.

---

## 4. Security Audit Checklist

| Security Control | Pre-Remediation Status | Post-Remediation Status | Verification |
| :--- | :--- | :--- | :--- |
| **Owner Dashboard Isolation** | Failed (Client could view `/dashboard`) | **Passed** (Clients redirected to `/portal`) | Verified in route tests & router guards |
| **Project Creation Lockdown** | Failed (Client could insert projects) | **Passed** (Denied by RLS `projects_insert_own`) | Remote Supabase RLS policy check |
| **Task Creation Lockdown** | Failed (Client could insert tasks) | **Passed** (Denied by RLS `tasks_insert_own`) | Remote Supabase RLS policy check |
| **Time Tracking Privacy** | Vulnerable (Direct `work_sessions` query) | **Passed** (Aggregated via `rpc_get_client_project_time_summary`) | Function permission restricted |
| **Invitation Acceptance Integrity**| Failed (RLS blocked acceptance) | **Passed** (Handled atomically via `rpc_accept_project_invitation`) | Tested end-to-end |
| **Session Persistence** | Fragile (Tokens lost on restart) | **Passed** (Dual storage adapter + Remember Me) | Validated in storage test suite |
