# Google Calendar Integration — Developer & DevOps Setup Guide

This document preserves the internal architecture, configuration instructions, environment secrets, and mapping rules for the Google Calendar Integration in My Work Planner.

---

## 1. Overview & Architecture

My Work Planner implements a **strict one-way synchronization architecture**:
- **Authoritative Source**: My Work Planner (`public.tasks`).
- **Target**: User's connected Google Calendar.
- **Direction**: `My Work Planner → Google Calendar`.
- **Policy**: Tasks scheduled in My Work Planner are pushed to Google Calendar. Changes or deletions made directly inside Google Calendar never alter tasks in My Work Planner. Completing a task in My Work Planner preserves the Google Calendar event without altering its title or schedule.

---

## 2. Scheduled Task Mapping Rules

When a task in My Work Planner is created or updated, it is synchronized to Google Calendar according to the following deterministic rules:

| Scenario | Task Properties in My Work Planner | Google Calendar Event Type | Start Time | End Time |
| :--- | :--- | :--- | :--- | :--- |
| **Case A — Date Only** | `scheduledDate` set, `scheduledStartTime` is `NULL` | **All-Day Event** (`start.date`) | `YYYY-MM-DD` | `YYYY-MM-DD + 1 day` (exclusive per RFC 5545) |
| **Case B & C — Date + Time + Planned Duration** | `scheduledDate` set, `scheduledStartTime` set, `plannedDurationMinutes` set | **Timed Event** (`start.dateTime`) | Task start time in user timezone | Start time + `plannedDurationMinutes` |
| **Case B & D — Date + Time (No Duration)** | `scheduledDate` set, `scheduledStartTime` set, `plannedDurationMinutes` is `NULL` | **Timed Event** (`start.dateTime`) | Task start time in user timezone | Start time + `profile.defaultEventDurationMinutes` (default: 60m) |
| **Case E — Unscheduled Tasks (Inbox)** | `scheduledDate` is `NULL` | **Never Synchronized** | N/A | N/A |
| **Task Completion** | Task status set to `completed` | **Preserved Unaltered** | Unchanged | Unchanged |

---

## 3. Google Cloud Console Setup

### A. Create an OAuth 2.0 Client ID
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Google Cloud Project.
3. Go to **APIs & Services → Credentials**.
4. Click **Create Credentials → OAuth client ID**.
5. Select **Application type**: `Web application`.
6. Add the **Authorized redirect URI**:
   - Production / Hosted Supabase:
     ```
     https://<project-ref>.supabase.co/functions/v1/google-calendar-auth/callback
     ```
     For project `tefxkrigwvyiescuctmb`:
     ```
     https://tefxkrigwvyiescuctmb.supabase.co/functions/v1/google-calendar-auth/callback
     ```

### B. Configure OAuth Consent Screen & Scopes
Required OAuth 2.0 Scopes:
1. `https://www.googleapis.com/auth/calendar.events` (Manage events in user's calendar)
2. `https://www.googleapis.com/auth/userinfo.email` (Identify connected Google account email)

> [!NOTE]
> If your Google Cloud OAuth Consent screen is in **Testing** publishing status, ensure all test Google account emails are added under **Test users**.

---

## 4. Supabase Edge Function Secrets (All 5 Required)

The backend authentication and synchronization Edge Functions (`google-calendar-auth`, `google-calendar-sync`) require 5 environment secrets.

Set them via the Supabase CLI:

```bash
# Production Supabase Project
npx supabase secrets set \
  GOOGLE_CLIENT_ID="<your-google-client-id>.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="<your-google-client-secret>" \
  GOOGLE_REDIRECT_URI="https://<project-ref>.supabase.co/functions/v1/google-calendar-auth/callback" \
  ENCRYPTION_KEY="<32-byte-hex-or-random-string>" \
  APP_BASE_URL="https://my-work-planner-pwa.vercel.app"
```

For local development:
```bash
# Local Development
APP_BASE_URL="http://localhost:3000"
```

### Encryption Key Format
The `ENCRYPTION_KEY` is a secret string (e.g. generated via `openssl rand -hex 32`). The cryptographic implementation in `supabase/functions/_shared/crypto.ts` hashes this key via SHA-256 to derive a 256-bit AES-GCM key used to encrypt OAuth refresh and access tokens before persisting them in `public.google_calendar_integrations`.

---

## 5. Security & Tokens

- **Never** expose `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`, or `service_role` keys in client-side code, `.env.local`, or frontend bundles.
- Client applications only interact with the Edge Functions via authenticated JWTs.
- Tokens stored in the database are AES-GCM encrypted; decrypted tokens exist only in Edge Function memory during sync execution.
