# Google Calendar Integration Architecture — My Work Planner

## 1. Architectural Overview

The Google Calendar integration in *My Work Planner* is built as a strictly **one-way asynchronous synchronization engine**:

$$\text{My Work Planner (Source of Truth)} \longrightarrow \text{Google Calendar}$$

Events created, rescheduled, or removed in My Work Planner are propagated to Google Calendar. External modifications within Google Calendar never mutate application records.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Client Browser (PWA)                                  │
│  - Settings / GoogleCalendarPage.tsx (Connect, Sync Now, Disconnect)             │
│  - taskService.ts (Enqueues sync jobs on task mutations)                        │
│  - calendarService.ts (Invokes Edge Functions & RPCs)                           │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │ 1. Transactional Outbox (RPC)                 │ 2. Edge Function Invocation
                 ▼                                               ▼
┌──────────────────────────────────────────────────┐   ┌──────────────────────────┐
│              PostgreSQL Database                 │   │ Supabase Edge Functions  │
│  - [google_calendar_connections] (RLS user)      │   │                          │
│  - [google_calendar_event_mappings] (1:1 mapping)│   │  google-calendar-auth    │
│  - [google_calendar_sync_jobs] (Pending Queue)   │◄──┤  google-calendar-sync    │
│  - [google_calendar_tokens] (service_role only)  │   │                          │
└──────────────────────────────────────────────────┘   └────────────┬─────────────┘
                                                                    │
                                                                    │ 3. OAuth 2.0 & REST
                                                                    ▼
                                                       ┌──────────────────────────┐
                                                       │ Google Calendar v3 API   │
                                                       │  POST /events            │
                                                       │  PATCH /events/{id}      │
                                                       │  DELETE /events/{id}     │
                                                       └──────────────────────────┘
```

---

## 2. Security Architecture & Token Encryption

### 2.1 Defense-in-Depth Token Storage
Google OAuth refresh tokens provide long-term access and must never be exposed to browser clients or public APIs:
1. **Isolated Storage**: Tokens are stored in a dedicated table `public.google_calendar_tokens`.
2. **Explicit Privilege Revocation**:
   ```sql
   REVOKE ALL ON public.google_calendar_tokens FROM public, anon, authenticated;
   GRANT ALL ON public.google_calendar_tokens TO service_role;
   ```
   Even if an authenticated user attempts to execute `supabase.from('google_calendar_tokens').select('*')`, Postgres RLS and role permissions deny access with zero rows returned.
3. **AES-GCM 256-bit Encryption at Rest**:
   Tokens are encrypted using the Web Crypto API (`crypto.subtle`) with a server-side `ENCRYPTION_KEY`. Each encrypted record contains a unique, random 12-byte initialization vector (IV) combined with the ciphertext in Base64 format.

### 2.2 Tamper-Proof OAuth State Token
To prevent CSRF and account mix-up attacks during the OAuth 2.0 flow:
- The `state` parameter is an encrypted payload: `{"userId": "...", "nonce": "...", "timestamp": 123456789}`.
- On callback, the Edge Function decrypts the state, validates that `timestamp` is within 15 minutes, and extracts the verified `userId`.

---

## 3. Transactional Outbox & Sync Queue

Synchronization uses an idempotent transactional outbox pattern to guarantee that network failures or browser interruptions never drop calendar events:

1. **Mutation**: When a task is created, updated, scheduled, or deleted, `taskService` calls `public.queue_calendar_sync_job(...)`.
2. **Atomic Replacement**: If an older job is already pending for the same task, it is superseded by the latest state, preventing redundant Google API calls.
3. **Trigger**: The client fires a non-blocking invocation to `google-calendar-sync`.
4. **Execution**:
   - The edge function decrypts the refresh token and acquires a fresh access token from Google.
   - For `upsert`: checks `google_calendar_event_mappings`. Calls `PATCH` if an event already exists or `POST` if new. Updates `tasks.calendar_sync_status = 'synced'`.
   - For `delete`: calls `DELETE /events/{id}` (handling 404/410 gracefully) and unlinks the mapping. Updates `tasks.calendar_sync_status = 'not_synced'`.
5. **Retry Mechanism**: If Google's API returns a 5xx or network error, `retry_count` is incremented. If `retry_count < max_retries`, status remains `pending` with exponential backoff. If max retries are exceeded, status is marked `failed`, and the user can trigger **Retry Failed Sync** from the UI.
