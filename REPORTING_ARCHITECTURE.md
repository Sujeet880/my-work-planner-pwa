# Reporting & Analytics Architecture — My Work Planner

## 1. Architectural Overview

The Reporting & Analytics system in *My Work Planner* provides precision time tracking analytics, planned versus actual variance monitoring, and multi-format reporting exports.

It is architected according to clean domain-driven principles:
- **Database Layer**: PostgreSQL running on Supabase with strictly enforced Row Level Security (RLS) policies and atomicity.
- **Data Synchronization Layer**: `WorkspaceContext` providing cached, reactive state for tasks, projects, time entries, and active timers.
- **Domain Service Layer**: `reportService.ts`, an isolated, pure TypeScript service responsible for date math, period boundaries, session splitting, variance computation, aggregations, RFC 4180 CSV generation, and SheetJS Excel workbook construction.
- **Presentation Layer**: `ReportsPage.tsx`, adhering to the approved **Modern Liquid Glass UI** design system, rendering interactive SVG/HTML bar charts, glass KPI cards, sortable tables, and responsive export dialogs.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Supabase PostgreSQL                             │
│      [work_sessions]        [tasks]        [projects]   [active_timers]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ RLS-protected queries / Realtime
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        WorkspaceContext                                │
│          timeEntries[], tasks[], projects[], activeTimer               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Pure Domain Transformation
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Domain Service: reportService.ts                     │
│  - getReportDateRange (ISO 8601 Monday-start)                          │
│  - splitSessionByDay (Midnight crossing split)                         │
│  - calculateDailyAggregations                                          │
│  - calculateTaskReportRows & calculateProjectReportRows                │
│  - calculateReportSummary (Reconciled Metrics)                         │
│  - generateReportCSV (RFC 4180)                                        │
│  - buildReportWorkbook (5-sheet XLSX)                                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Presentation: ReportsPage.tsx                        │
│  - Modern Liquid Glass Navigation (< Date Range >)                     │
│  - 5 Core Executive KPI Cards                                          │
│  - Interactive Daily Activity Bar Chart (with hover tooltips)          │
│  - Project Time Distribution Progress Bars                             │
│  - Sortable Task Planned vs. Actual Table                              │
│  - Multi-Format Export Modal (XLSX & CSV)                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Separation of Concerns & Data Invariants

### 2.1 Finalized Work Sessions vs. Active Running Timer
A critical design requirement is that **active running sessions must never be conflated with finalized historical records**:
- Completed sessions stored in `work_sessions` (with `status = 'completed'`) represent finalized historical work.
- An in-progress session tracked in `active_timers` is running live and can still be discarded, paused, or adjusted.
- Reporting summaries and daily aggregations strictly sum only completed sessions.
- When an active timer is running, a prominent informational glass card alerts the user that active elapsed time on the running task is excluded from finalized reporting totals until stopped and saved.

### 2.2 Local Timezone Awareness & Midnight-Crossing Sessions
Because work sessions record ISO 8601 UTC timestamps (`started_at`, `ended_at`), calendar reporting must operate in the user's local timezone:
- A user working from 11:45 PM on Monday to 12:30 AM on Tuesday will have their session automatically split across midnight:
  - 15 minutes (900 seconds) allocated to Monday's daily total.
  - 30 minutes (1800 seconds) allocated to Tuesday's daily total.
- Total tracked seconds across both days equal the exact session duration (2700 seconds) without phantom time or truncation.

### 2.3 Strict Monday-Start Weekly Calendar (ISO 8601)
In accordance with international productivity standards (ISO 8601), weeks begin on **Monday** at 00:00:00 and conclude on **Sunday** at 23:59:59.
The formula computes the distance from the anchor date's JavaScript day (`0` = Sun, `1` = Mon ... `6` = Sat) to Monday:
$$\text{distanceToMonday} = (\text{dayOfWeek} + 6) \pmod 7$$
$$\text{Monday} = \text{anchorDate} - \text{distanceToMonday}$$
$$\text{Sunday} = \text{Monday} + 6\text{ days}$$

---

## 3. Component Hierarchy

1. **`ReportsPage`**: Top-level route container.
   - **Header**: Title, subtitle, bell indicator, and primary "Export Report" trigger button.
   - **Period Control Bar**: Pill selector for `Daily`, `Weekly`, `Monthly`, and `Custom Range`, paired with `<` and `>` period navigation buttons, dynamic date range indicator, and project/status filter dropdowns.
   - **Active Timer Notice**: Reactive alert banner when `activeTimer !== null`.
   - **Metric Cards Grid**: 5 executive KPIs rendered with liquid glass styling and tabular typography.
   - **Activity Bar Chart**: Responsive SVG/HTML bar chart displaying daily tracked time distribution with interactive hover tooltips.
   - **Project Distribution Card**: Horizontal breakdown of project time allocation with percentage bars, client metadata, and task completion counts.
   - **Task Planned vs. Actual Table**: Sortable table with clickable task links, priority badges, status badges, planned duration, actual tracked duration, and colored variance badges.
   - **Export Modal**: Accessible glass modal presenting one-click download buttons for 5-sheet Excel workbooks and RFC 4180 CSV files.
