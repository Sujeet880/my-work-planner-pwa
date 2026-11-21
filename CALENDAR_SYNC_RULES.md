# Calendar Synchronization & Event Mapping Rules — My Work Planner

This document provides the exhaustive specification for how tasks in *My Work Planner* map to Google Calendar events across all lifecycle events.

---

## 1. Event Construction Rules

All event creation is performed in the user's configured timezone (`profiles.timezone` or `user_preferences.timezone`, defaulting to `Asia/Kolkata`).

### Case A — Task with Date Only (No Start Time)
- **Classification**: All-day event.
- **Start Property**: `start: { date: "YYYY-MM-DD" }`
- **End Property**: `end: { date: "YYYY-MM-DD" }`
- **Exclusive Boundary Invariant**: In Google Calendar API v3, an all-day event end date is **exclusive**. Therefore, a 1-day task scheduled on `2026-11-24` must have:
  - `start.date = '2026-11-24'`
  - `end.date = '2026-11-25'`
- **Month Rollover**: On the last day of a month (e.g., `2026-11-30`), the end date safely rolls over to the next month (`2026-12-01`).

### Case B — Task with Date and Start Time
- **Classification**: Timed event.
- **Start Property**: `start: { dateTime: "YYYY-MM-DDTHH:mm:00", timeZone: "Asia/Kolkata" }`

### Case C — Planned Duration Specified
- **Calculation**: End time = Start Time + `plannedDurationMinutes`.
- **Example**:
  - Task: `Finalize Login Flow`
  - Date: `2026-11-24`
  - Start: `10:00`
  - Planned Duration: `90 minutes`
  - Calendar Event: `2026-11-24T10:00:00` to `2026-11-24T11:30:00`.

### Case D — No Planned Duration
- **Calculation**: End time = Start Time + `profile.defaultEventDurationMinutes` (default: 60 minutes).
- **Example**:
  - Start: `14:15`
  - End: `15:15`.

### Case E — Unscheduled Tasks (Inbox)
- **Rule**: If `scheduledDate === null`, **no calendar event is created**.
- **Move to Inbox**: If a previously scheduled task has its date removed, the synchronization engine automatically issues a `DELETE` request to Google Calendar and removes the local mapping.

---

## 2. Task Lifecycle Synchronization Matrix

| Task Action | Google Calendar Action | Local Mapping State | Sync Status |
|:---|:---|:---|:---:|
| **Create Scheduled Task** | `POST /events` | Creates mapping record | `synced` |
| **Create Inbox Task** | *No operation* | *No mapping* | `not_synced` |
| **Edit Task Title** | `PATCH /events/{id}` (updates `summary`) | Keeps existing mapping | `synced` |
| **Reschedule Date / Time** | `PATCH /events/{id}` (updates `start`/`end`) | Keeps existing mapping | `synced` |
| **Change Planned Duration** | `PATCH /events/{id}` (recalculates `end`) | Keeps existing mapping | `synced` |
| **Move Task to Inbox** | `DELETE /events/{id}` | Deletes mapping | `not_synced` |
| **Complete Task** | *No operation* (keeps remote event intact) | Keeps existing mapping | `synced` |
| **Reopen Completed Task** | *No operation* (keeps remote event intact) | Keeps existing mapping | `synced` |
| **Delete Task** | `DELETE /events/{id}` | Deletes mapping | `not_synced` |
| **Disconnect Account** | *No bulk deletion* (preserves events) | Keeps mapping for re-auth | `not_synced` |
