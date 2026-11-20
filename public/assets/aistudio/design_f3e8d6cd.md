# My Work Planner — Design System

## Product context
My Work Planner is a personal productivity and time-tracking PWA. It helps one person plan daily and future tasks, track actual working time through task-based timers, and compare planned time with actual time. The interface should feel like a calm, well-organized personal workspace—not an enterprise project-management suite.

## Design principles
- Clarity before decoration.
- Fast task creation and one-action timer controls.
- Keep the active timer globally visible while it is running.
- Use restrained visual hierarchy and comfortable information density.
- Prefer reusable components and consistent interaction patterns.
- Desktop-first, fully responsive on tablet and mobile.
- Never communicate status using colour alone; pair colour with text or an icon.

## Visual direction
Use a clean, light-mode interface with a neutral background, white surfaces, dark readable typography, subtle borders, restrained shadows, and one muted blue accent. Avoid heavy gradients, decorative illustrations, excessive colours, glassmorphism, and oversized marketing-style hero sections. This is a functional productivity workspace.

## Colour tokens
These are starter tokens for the first design exploration and may be refined after reviewing the first Stitch screens.

- `background`: `#F6F7F9` — application canvas
- `surface`: `#FFFFFF` — cards, drawers, menus
- `surface-subtle`: `#F0F2F5` — quiet secondary regions
- `text-primary`: `#202531` — primary text
- `text-secondary`: `#667085` — supporting text
- `text-muted`: `#98A2B3` — low-emphasis text
- `border`: `#E4E7EC` — dividers and control borders
- `accent`: `#4968D6` — primary actions and selected navigation
- `accent-hover`: `#3D59BE` — primary action hover
- `accent-soft`: `#EDF1FF` — selected and highlighted surfaces
- `success`: `#16845B` — completed and positive feedback
- `warning`: `#B7791F` — medium priority and caution
- `danger`: `#C2414B` — high priority, destructive actions, overdue warnings
- `info`: `#3574B8` — informational states
- `focus`: `#7895F2` — visible keyboard focus ring

Do not introduce additional accent colours for individual screens. Semantic status colours should be used consistently.

## Typography
- Primary typeface: Inter or a visually equivalent neutral sans-serif.
- Use clear hierarchy: page title 26–30 px; section title 18–20 px; card title 15–16 px; body 14–15 px; helper text 12–13 px.
- Timer values and tabular metrics should use tabular numerals.
- Avoid overly light font weights for small text.

## Spacing and geometry
Use a 4 px base spacing scale. Common spacing values are 4, 8, 12, 16, 24, 32, 40 and 48 px.

- Small controls: 6–8 px radius.
- Buttons and inputs: 8 px radius.
- Cards: 10–12 px radius.
- Drawers and dialogs: 12–16 px radius.
- Use subtle 1 px borders for surface separation.
- Use shadows sparingly and only to indicate elevation.
- Avoid nested cards and inconsistent padding.

## Application shell
### Desktop
- Fixed left sidebar approximately 232 px wide.
- Compact top bar approximately 64 px high.
- Main content padding approximately 28–32 px.
- Primary navigation: Dashboard, My Tasks, Time Tracker, Reports.
- Secondary navigation: Projects, Settings, Account.
- Keep the active timer visible in a persistent global component while it is running.

### Tablet
- Collapsible sidebar.
- Reduced grid columns and compact list rows.

### Mobile
- Single-column layout.
- Fixed bottom navigation: Dashboard, Tasks, Timer, Reports.
- Use full-screen task forms or bottom sheets where appropriate.
- Keep the active timer accessible in a sticky compact component above bottom navigation.
- Ensure touch targets are comfortable and controls are not crowded.

## Navigation and hierarchy
- The Dashboard is the default landing screen after sign-in.
- My Tasks contains Today, Upcoming, Inbox, All Tasks and Completed views.
- Use a consistent page header, contextual filters, clear section headings and a primary action.
- Keep secondary settings out of the main task workflow.

## Core component patterns
### Buttons
Create primary, secondary, ghost/text, destructive and icon-only variants. Include default, hover, pressed, disabled, loading and focus states. Icon-only buttons require accessible labels.

### Task row / task card
Show task title, optional project, priority, status, planned duration, actual duration and a direct timer action. Provide compact and expanded variants. Avoid making every task row look like a separate large dashboard card.

### Priority badges
- High: restrained danger treatment.
- Medium: restrained warning treatment.
- Low: muted neutral or blue treatment.
Always show the priority label.

### Status badges
- To Do: neutral.
- In Progress: accent blue.
- Completed: success green.
- Overdue: danger red.
Always show the status label.

### Timer component
Required visual states: Idle, Running, Paused, Stopped and Recovering.
- Running: show elapsed time prominently and provide Pause and Stop.
- Paused: show a clear Paused label and Resume action.
- Idle: show Start action in task context.
- Recovering: explain that a previously running timer was restored and show the current elapsed time.
Do not hide timer controls inside overflow menus.

### Forms
Use consistent labels, help text, validation and focus states. Keep task title and essential scheduling fields prominent. Put optional details in a secondary section. Use a right-side drawer on desktop and a full-screen form or bottom sheet on mobile.

### Dialogs
Use confirmation dialogs only for consequential actions such as switching an active timer, completing a task while a timer runs, destructive deletion and discarding unsaved changes. Clearly name the consequence in the dialog text.

### Feedback
Use small, non-blocking success messages for saved tasks and completed actions. Provide clear inline validation and actionable error messages.

## Task and timer interaction rules
- Task creation should be possible through a lightweight quick-add action.
- A task can be in the Inbox or have a scheduled date.
- Planned duration is optional.
- Only one timer may run at a time.
- Starting a different task while a timer is running requires a Save & Switch confirmation.
- Pause saves the current work entry and leaves the task resumable.
- Resume creates a new work entry for the same task.
- Stop saves the current work entry but does not complete the task.
- Completing a task while its timer runs must save the current entry first.
- Multiple work entries contribute to the task's total actual time.
- Manual entries must be visibly labelled Manual.

## Screen composition guidance
### Dashboard
Prioritize today's task list, a compact summary of tasks and planned/actual hours, upcoming tasks and the active timer. Avoid oversized charts and decorative hero sections.

### My Tasks
Use a compact, scannable list with simple filters for Today, Upcoming, Inbox, All and Completed. Keep completion and timer actions accessible directly from each row.

### Task creation
Use a short title-first form. Defaults should reduce typing. Planned duration, project, date, priority and reminder should be easy to enter without making the form feel long.

### Task details
Show task metadata, planned-versus-actual summary, timer controls and chronological work-entry history in clearly separated sections.

### Time Tracker
Make the active timer prominent and show recent work entries in a readable chronological list or table.

### Reports
Lead with a date-range filter and summary metrics. Use a small number of legible charts and a detailed table. Keep Excel/CSV export easy to find.

## Empty, loading and error states
Design explicit states for:
- No tasks today.
- Empty Inbox.
- No upcoming tasks.
- No active timer.
- No work-session history.
- No report data for the selected period.
- Loading task lists and reports.
- Failed save or sync.
- Offline / waiting to sync.
- Notification permission denied or unavailable.

Every empty state should explain what is missing and provide one useful next action.

## Accessibility
- Target WCAG AA colour contrast.
- Maintain visible keyboard focus.
- Support keyboard navigation.
- Provide accessible names for icon-only controls.
- Do not use colour alone to communicate priority or status.
- Respect reduced-motion preferences.
- Keep mobile touch targets comfortable.
- Use clear form labels and validation messages.

## Avoid
- Dark mode as the initial design direction.
- Heavy gradients and glassmorphism.
- Excessive cards, pills and badges.
- Large decorative illustrations.
- Marketing landing-page patterns inside the logged-in app.
- Unnecessary charts on the Dashboard.
- Hidden timer controls.
- Different visual styles between screens.
- Shrinking the desktop layout instead of designing a purposeful mobile adaptation.
