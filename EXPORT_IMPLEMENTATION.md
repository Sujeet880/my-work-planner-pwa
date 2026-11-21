# Export Implementation Specification — CSV & Excel (.xlsx)

This document details the file generation, standards compliance, encoding, and client-side download architecture for exports in *My Work Planner*.

---

## 1. Overview of Export Capabilities

Users can export their complete reporting data across two primary formats directly from the UI:
1. **RFC 4180 Compliant CSV (`.csv`)**: Clean flat-file export for spreadsheets, accounting software, and external data pipelines.
2. **Multi-Sheet Excel Workbook (`.xlsx`)**: Structured, 5-sheet workbook built with SheetJS (`xlsx`) for executive reporting and comprehensive audits.

Both export formats reflect the currently selected period (`dateRange.start` to `dateRange.end`) and include all finalized work sessions, tasks, and projects.

---

## 2. CSV Specification (RFC 4180)

### 2.1 File Encoding & Structure
- **Format**: Flat CSV file with CRLF (`\r\n`) line terminators.
- **Character Encoding**: UTF-8.
- **Escaping Rules**:
  - Any field containing commas (`,`), double quotes (`"`), or line breaks (`\n`, `\r`) is wrapped in double quotes.
  - Internal double quotes are escaped by doubling them (`""`).
  - Null/undefined values are exported as empty quotes (`""`).

### 2.2 Column Schema
| Column Index | Header Name | Format / Example | Description |
|---|---|---|---|
| 0 | `Session Date` | `YYYY-MM-DD` | Date the session started |
| 1 | `Task Title` | String | Title of associated task or "Unassigned Task" |
| 2 | `Project Name` | String | Name of project or "No Project" |
| 3 | `Client Name` | String | Client or project description |
| 4 | `Entry Type` | `timer` / `manual` | Method by which session was recorded |
| 5 | `Started At` | ISO 8601 UTC string | Timestamp session began |
| 6 | `Ended At` | ISO 8601 UTC string | Timestamp session concluded |
| 7 | `Duration (Seconds)` | Integer | Exact elapsed duration |
| 8 | `Duration (Formatted)`| String (e.g. `1h 30m`) | Formatted duration for humans |
| 9 | `Notes` | String | User notes attached to the session |

---

## 3. Excel (.xlsx) Workbook Specification

The Excel workbook is generated using `xlsx` (SheetJS) and consists of 5 dedicated worksheets:

### Sheet 1: `Summary`
Executive KPI overview containing:
- Document Title & Generation Timestamp
- Reporting Period & Date Range
- Total Tracked Time (Formatted & Raw Seconds)
- Total Planned Time (Formatted & Raw Seconds)
- Time Variance Label
- Completed Tasks Count
- Active Tasks Worked Count
- Average Daily Time

### Sheet 2: `Daily Breakdown`
Chronological daily distribution table:
- Columns: `Date`, `Day of Week`, `Tracked Duration`, `Duration (Seconds)`, `Sessions Count`
- Covers every day in the reporting period (including days with zero recorded work).

### Sheet 3: `Task Breakdown`
Task-level planned vs. actual matrix:
- Columns: `Task Title`, `Project`, `Status`, `Priority`, `Planned Duration`, `Actual Tracked`, `Variance`, `Sessions Count`
- Sorted and categorized to show which tasks exceeded or came under estimated durations.

### Sheet 4: `Project Breakdown`
Project-level allocation summary:
- Columns: `Project Name`, `Client / Description`, `Tracked Duration`, `Duration (Seconds)`, `Tasks Worked`, `Completed Tasks`, `% of Total`
- Includes unassigned tasks grouped under `"No Project"`.

### Sheet 5: `Work Sessions`
Granular historical session log:
- Columns: `Session Date`, `Task Title`, `Project Name`, `Entry Type`, `Started At`, `Ended At`, `Duration`, `Duration (Seconds)`, `Notes`
- Lists every individual work session in the period sorted chronologically.

---

## 4. Client-Side Download Mechanics

Exports are generated entirely client-side without sending data to external third-party servers:

```ts
export function downloadCSVFile(content: string, filename?: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename || 'report.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadWorkbookFile(workbook: XLSX.WorkBook, filename?: string): void {
  XLSX.writeFile(workbook, filename || 'report.xlsx');
}
```

### 4.1 Safety & Memory Management
- `URL.createObjectURL(blob)` is paired with immediate `URL.revokeObjectURL(url)` to prevent memory leaks in long-running PWA sessions.
- Default file naming convention incorporates the selected date range: `my-work-planner-report-YYYY-MM-DD-to-YYYY-MM-DD.xlsx`.
