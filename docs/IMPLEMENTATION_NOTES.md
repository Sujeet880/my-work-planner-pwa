# Implementation Notes — PRD vs. Stitch Reference Resolutions

## Source-of-Truth Precedence

1. `My_Work_Planner_PRD_v1.2.md` — authoritative functional scope, data model, validation rules, and acceptance criteria.
2. Canonical `DESIGN.md` — authoritative visual palette, typography (`Inter` + tabular numerals), shell proportions, spacing, and restraint rules.
3. Stitch HTML & PNG screen exports — layout and visual rhythm reference only; not production code.
4. `Calm_Focused_Productivity_REFERENCE.md` — supplementary guidance only.

## Stitch-vs-PRD Conflicts Identified & Resolved in Milestone 0

| # | Conflict Found in Stitch Screens | PRD / Canonical DESIGN.md Rule | Resolution Implemented |
|---|---|---|---|
| 1 | **Tags / Labels (`#tokens`, `#handoff`) & Subtasks / Checklists** shown in Create Task Drawer & Task Details | PRD §2.2 explicitly lists Subtasks and Tags/Labels as OUT OF SCOPE for MVP | Omitted from `TaskFormDrawer`, `TaskDetailsPage`, and domain models |
| 2 | **Billable ratio (82%), Avg Work Block / Deep focus score, Peak productivity day, and future Fri/Sat/Sun actual hours** shown in S10 Reports | PRD §14.3–14.4 forbid billable ratios, focus scores, and fabricated future actuals | Replaced with strict PRD metrics (Saved Tracked Time, Planned Time, Completed Tasks, Saved Work Sessions) and saved-only date ranges |
| 3 | **Budget Accuracy (84%), Hourly Target / Budget, and Billing Quarter** shown in S11 Projects | PRD §7.4 explicitly excludes project budgets and financial tracking | `ProjectsPage` shows active/completed task counts, Planned time, and Saved Actual time only |
| 4 | **Distraction Blocker, Daily Velocity (+14% efficiency), Focus Efficiency: High** shown in S02 Dashboard & S03 My Tasks | PRD §12.3 excludes focus scores, gamification, and distraction blockers | Removed completely; replaced with accurate Planned vs Tracked reconciliation |
| 5 | **Pro License, Supabase Sync Latency (32ms), AES-GCM Encrypted IndexedDB, Export All Data (.ZIP / JSON), 100% Offline Ready, Sync `[✓]` status** in S12 Settings | PRD §10.5, §16, §19.4 prohibit fake telemetry, license tiers, full workspace ZIP backup, and overclaiming offline sync | Settings reflects honest M0 status, real `Notification.permission`, and truthful PWA/export capabilities |
| 6 | **2-Way Sync Assurance** text in S06 Calendar Variation 3 | PRD §10.1 strictly mandates **One-Way Sync (`My Work Planner → Google Calendar`)** | Enforced one-way sync copy and disconnected state across Drawer, Task Details, and Google Calendar Settings |
| 7 | **"Simulate clicking email link" bypass, prefilled `demo@myworkplanner.app`, and hardcoded `"Alex Rivera"` / `"Alex Morgan"`** in S01 / Shell | PRD §5.3 forbids prefilled demo emails, bypass login buttons, or hardcoded personal identities | Sign-In starts blank with real email validation and honest M0/M1 setup guidance |
| 8 | **"Auto-purge completed: Active (7d)"** in S05 Inbox | PRD §1.4 mandates historical work records never disappear automatically | Removed completely |
| 9 | **Inconsistent time totals in S07 Task Details** (`2h 35m` header vs `45m + 30m + 20m = 1h 35m` listed entries) | PRD §9.6 requires exact non-double-counted reconciliation (`Live Actual = Saved + Active`) | Centralized pure math in `src/lib/timeMath.ts` with unit tests in `src/lib/timeMath.test.ts` |
| 10 | **Mobile HTML disables zoom (`maximum-scale=1.0, user-scalable=no`)** | PRD §17.3 forbids disabling browser zoom | `index.html` uses `width=device-width, initial-scale=1.0, viewport-fit=cover` |
| 11 | **Timezone mismatch (`UTC-7 PDT` / `America/Los_Angeles`)** | PRD §8.2 sets initial default timezone to `Asia/Kolkata` | Default profile timezone set to `Asia/Kolkata` in `previewData.ts` and `SettingsPage` |
| 12 | **Sidebar IA omitted top-level `Projects` in some screens** | Canonical `DESIGN.md` specifies Primary (`Dashboard`, `My Tasks`, `Time Tracker`, `Reports`) + Secondary (`Projects`, `Settings`, Account) | Implemented exact `DESIGN.md` desktop sidebar & mobile bottom navigation structure |
