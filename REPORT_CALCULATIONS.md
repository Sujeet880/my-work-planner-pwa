# Report Calculations & Mathematical Formulations — My Work Planner

This document provides the exhaustive specification of mathematical calculations, date boundary logic, variance formulas, and aggregation algorithms used across the reporting and analytics features.

---

## 1. Date Range & Period Boundary Calculations

All date boundaries are represented as ISO 8601 strings in `YYYY-MM-DD` format corresponding to the user's local calendar day.

### 1.1 Daily Period
- `start` = `getLocalDateISO(anchorDate)`
- `end` = `getLocalDateISO(anchorDate)`

### 1.2 Weekly Period (ISO 8601 Monday Start)
In JavaScript `Date.prototype.getDay()`, Sunday is `0`, Monday is `1`, ..., Saturday is `6`.
The offset to the preceding Monday is:
$$\Delta_{\text{Monday}} = (\text{anchorDate.getDay()} + 6) \pmod 7$$
$$\text{Monday} = \text{Date}(\text{year}, \text{month}, \text{date} - \Delta_{\text{Monday}})$$
$$\text{Sunday} = \text{Date}(\text{year}, \text{month}, \text{date} - \Delta_{\text{Monday}} + 6)$$
- `start` = `getLocalDateISO(Monday)`
- `end` = `getLocalDateISO(Sunday)`

### 1.3 Monthly Period
- `First Day` = `new Date(year, month, 1)`
- `Last Day` = `new Date(year, month + 1, 0)` (0th day of next month is the last day of current month)
- `start` = `getLocalDateISO(First Day)`
- `end` = `getLocalDateISO(Last Day)`

### 1.4 Custom Date Range
Given user inputs `customStart` and `customEnd`:
- If `customStart <= customEnd`:
  - `start = customStart`
  - `end = customEnd`
- If `customStart > customEnd` (user selected an inverted range):
  - Self-corrects: `start = customEnd`, `end = customStart`

---

## 2. Session Splitting & Daily Aggregation

### 2.1 Midnight Splitting Algorithm (`splitSessionByDay`)
For each session with start timestamp $T_{\text{start}}$ and end timestamp $T_{\text{end}}$:
1. Parse local calendar boundaries for the session.
2. If $T_{\text{start}}$ and $T_{\text{end}}$ occur on the same local date:
   $$\text{slice} = \{ \text{date: } D, \text{ seconds: } \text{entry.durationSeconds} \}$$
3. If $T_{\text{end}}$ occurs on a subsequent day:
   - For day $D_0$: slice from $T_{\text{start}}$ to local midnight ($23:59:59.999$).
   - For any intermediate days $D_i$: full 24 hours (86,400 seconds).
   - For concluding day $D_n$: slice from local midnight ($00:00:00.000$) to $T_{\text{end}}$.
4. **Conservation of Duration**:
   $$\sum_{i=0}^n \text{slice}_i.\text{seconds} \equiv \text{entry.durationSeconds}$$

### 2.2 Daily Aggregation (`calculateDailyAggregations`)
Construct an ordered map covering every calendar day from `dateRange.start` through `dateRange.end`.
For each day $D$:
- Initialize $\text{seconds} = 0$, $\text{sessionCount} = 0$.
- For every completed session, determine its slice falling on day $D$.
- If slice exists on day $D$:
  $$\text{day}.\text{seconds} += \text{slice}.\text{seconds}$$
  $$\text{day}.\text{sessionCount} += 1$$

---

## 3. Planned vs. Actual Variance Formulations

Given:
- $P_{\text{minutes}}$: Planned duration in whole minutes (optional on Task)
- $A_{\text{seconds}}$: Actual tracked seconds for the task within the period

Convert planned duration to seconds:
$$P_{\text{seconds}} = \begin{cases} P_{\text{minutes}} \times 60 & \text{if } P_{\text{minutes}} \neq \text{null} \\ \text{null} & \text{otherwise} \end{cases}$$

### 3.1 Delta Calculation
$$\Delta_{\text{seconds}} = \begin{cases} A_{\text{seconds}} - P_{\text{seconds}} & \text{if } P_{\text{seconds}} \neq \text{null} \\ \text{null} & \text{otherwise} \end{cases}$$

### 3.2 Variance Classification
1. **No Estimate**:
   - Condition: $P_{\text{minutes}} \text{ is null}$
   - Status: `'no_estimate'`
   - Label: `"No estimate"`
2. **On Target**:
   - Condition: $|\Delta_{\text{seconds}}| < 60$
   - Status: `'on_target'`
   - Label: `"On target"`
3. **Over Plan**:
   - Condition: $\Delta_{\text{seconds}} \ge 60$
   - Status: `'over_plan'`
   - Label: `"+{formatDuration(deltaSeconds)} over plan"`
4. **Under Plan**:
   - Condition: $\Delta_{\text{seconds}} \le -60$
   - Status: `'under_plan'`
   - Label: `"{formatDuration(|deltaSeconds|)} under plan"`

---

## 4. Project & Executive Aggregations

### 4.1 Project Distribution & Percent Share
For each project $j$:
$$A_j = \sum_{t \in \text{Tasks}_j} A_{t, \text{period}}$$
$$A_{\text{total}} = \sum_{j} A_j$$
$$\text{percentOfTotal}_j = \begin{cases} \text{round}\left(\frac{A_j}{A_{\text{total}}} \times 100\right) & \text{if } A_{\text{total}} > 0 \\ 0 & \text{otherwise} \end{cases}$$

Tasks with `projectId === null` are grouped under `"No Project"` (Personal Workspace) with styling `#9AA6B8`.

### 4.2 Daily Average
Let $N_{\text{days}}$ be the number of calendar days in `[dateRange.start, dateRange.end]`:
$$N_{\text{days}} = \frac{T_{\text{end, date}} - T_{\text{start, date}}}{86,400,000} + 1$$
$$\text{AverageDailySeconds} = \text{round}\left(\frac{\text{TotalTrackedSeconds}}{N_{\text{days}}}\right)$$

---

## 5. Absolute Reconciliation Invariant

The reporting engine guarantees that all views reconcile to the exact second:
$$\text{Total Tracked Seconds} \equiv \sum_{d \in \text{Days}} \text{day.seconds} \equiv \sum_{p \in \text{Projects}} \text{project.actualSeconds} \equiv \sum_{t \in \text{Tasks}} \text{task.actualSeconds in period}$$
