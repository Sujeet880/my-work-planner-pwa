# Project Permissions, Security & PostgreSQL Row-Level Security (RLS) Specification

## 1. Security Architecture Principles

In Milestone 10, security and authorization are strictly enforced at the database level using PostgreSQL Row-Level Security (RLS) policies and security-definer helper functions.

Security is never delegated solely to frontend conditional rendering.

### Core Security Invariants
1. **Confidentiality by Default**: All tasks, projects, work sessions, timers, and notifications remain strictly private to their owner unless explicitly shared.
2. **Strict Task Boundary**: External clients can NEVER query or see tasks where `client_visible = false`. Internal tasks are filtered directly in PostgreSQL row checks.
3. **Immutability for Clients**: Clients have strictly read-only access to tasks and projects. Any SQL `INSERT`, `UPDATE`, or `DELETE` attempted by a client on `public.tasks` or `public.projects` will be rejected by RLS.
4. **Token Hashing**: Raw invitation tokens are never stored in the database. Only their cryptographic SHA-256 hash is persisted in `public.project_invitations.token_hash`.
5. **No Infinite Recursion**: RLS policies avoid circular table queries by utilizing `SECURITY DEFINER` helper functions with a fixed `search_path = public`.

---

## 2. PostgreSQL Helper Functions

Implemented in `supabase/migrations/20261122000010_project_sharing_and_client_portal.sql`:

```sql
-- Checks if current authenticated user owns the given project
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects
    where id = p_project_id
      and user_id = auth.uid()
  );
$$;

-- Checks if current authenticated user is an accepted member or owner of the project
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects
    where id = p_project_id
      and user_id = auth.uid()
  ) or exists (
    select 1
    from public.project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and membership_status = 'accepted'
  );
$$;
```

---

## 3. Row-Level Security Matrix

| Table | Operation | Role / Condition | Security Rule & SQL Definition |
| :--- | :--- | :--- | :--- |
| **`projects`** | `SELECT` | Owner | `user_id = auth.uid()` |
| | `SELECT` | Client | `client_share_enabled = true AND id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND membership_status = 'accepted')` |
| | `INSERT` | Owner only | `user_id = auth.uid()` |
| | `UPDATE` | Owner only | `user_id = auth.uid()` |
| | `DELETE` | Owner only | `user_id = auth.uid()` |
| **`tasks`** | `SELECT` | Owner | `user_id = auth.uid()` |
| | `SELECT` | Client | `client_visible = true AND project_id IS NOT NULL AND public.is_project_member(project_id)` |
| | `INSERT` | Owner only | `user_id = auth.uid()` |
| | `UPDATE` | Owner only | `user_id = auth.uid()` |
| | `DELETE` | Owner only | `user_id = auth.uid()` |
| **`project_members`** | `SELECT` | Owner or Member | `public.is_project_member(project_id) OR user_id = auth.uid() OR lower(invited_email) = lower(auth.jwt()->>'email')` |
| | `INSERT` | Owner only | `public.is_project_owner(project_id)` |
| | `UPDATE` | Owner or Member | `public.is_project_owner(project_id) OR user_id = auth.uid()` |
| | `DELETE` | Owner only | `public.is_project_owner(project_id)` |
| **`project_invitations`** | `SELECT` | Owner | `public.is_project_owner(project_id)` |
| | `INSERT` | Owner only | `public.is_project_owner(project_id)` |
| | `UPDATE` | Owner or Invite Receiver | `public.is_project_owner(project_id) OR lower(invited_email) = lower(auth.jwt()->>'email')` |
| | `DELETE` | Owner only | `public.is_project_owner(project_id)` |
| **`project_comments`** | `SELECT` | Member | `public.is_project_member(project_id)` |
| | `INSERT` | Member | `public.is_project_member(project_id) AND author_id = auth.uid()` |
| | `UPDATE` | Author or Owner | `public.is_project_member(project_id) AND (author_id = auth.uid() OR public.is_project_owner(project_id))` |
| | `DELETE` | Author or Owner | `public.is_project_member(project_id) AND (author_id = auth.uid() OR public.is_project_owner(project_id))` |
| **`project_updates`** | `SELECT` | Member | `public.is_project_member(project_id)` |
| | `INSERT` | Owner only | `public.is_project_owner(project_id) AND author_id = auth.uid()` |
| | `UPDATE` | Owner only | `public.is_project_owner(project_id)` |
| | `DELETE` | Owner only | `public.is_project_owner(project_id)` |
| **`project_notifications`**| `SELECT` | Recipient | `recipient_user_id = auth.uid()` |
| | `INSERT` | System / Member | `auth.uid() IS NOT NULL` |
| | `UPDATE` | Recipient | `recipient_user_id = auth.uid()` |
| | `DELETE` | Recipient | `recipient_user_id = auth.uid()` |

---

## 4. Security Verification Checklist

- [x] Unauthenticated requests cannot read any tables (`auth.uid() IS NULL` returns 0 rows).
- [x] External clients cannot query tasks where `client_visible = false`.
- [x] External clients cannot insert, edit, or delete tasks or project records.
- [x] Revoked members immediately lose read and comment access via RLS.
- [x] Invitation tokens use 24 random bytes (192 bits of entropy) and are validated via SHA-256 hashes.
- [x] Cross-tenant isolation guarantees that Client Bob cannot view Client Alice's projects.
