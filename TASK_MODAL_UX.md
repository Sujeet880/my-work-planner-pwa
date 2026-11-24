# Task Form Modal — UX & Architectural Specification

## 1. Executive Summary

In Milestone 10, My Work Planner evolved its task creation and editing interaction from a right-side drawer (`TaskFormDrawer`) into a centered, Modern Glass dialog modal (`TaskFormModal`).

This upgrade provides a focused, ergonomically centered workspace across desktop, tablet, and mobile viewport sizes, eliminating off-axis visual strain and preventing layout shifts while retaining full compatibility with existing form states, dirty validation checks, timer constraints, and Google Calendar sync workflows.

---

## 2. Design Rationale & Comparison

| Characteristic | Legacy Right-Side Drawer | Centered TaskFormModal |
| :--- | :--- | :--- |
| **Placement** | Pinned to right viewport edge | Centered horizontally & vertically (`inset-0 flex items-center justify-center`) |
| **Max Dimensions** | Fixed width ~480px, 100vh height | Width 640px–720px (`max-w-2xl`), Max Height 85vh (`max-h-[85vh]`) |
| **Visual Hierarchy** | Right margin panel overlay | Elevated floating card with glassmorphism, rounded corners (`rounded-[28px]`), 3D shadow |
| **Backdrop** | Dark dimmed scrim | `backdrop-blur-md bg-[#0F172A]/50` focus trap |
| **Header / Footer** | Header scrollable with body | **Sticky Glass Header** with live dirty indicator + **Sticky Footer** with Action Buttons |
| **Form Scrolling** | Full vertical scroll bar on edge | Dedicated inner scrollable container (`flex-1 overflow-y-auto px-6 py-5`) |
| **Context Retention** | Peripheral vision blocked on right | Centered focus preserves spatial awareness of background workspace |

---

## 3. Structural Anatomy

```
┌────────────────────────────────────────────────────────────────────────┐
│  TaskFormModal (max-w-2xl, max-h-[85vh], rounded-[28px], glass)        │
├────────────────────────────────────────────────────────────────────────┤
│  [Sticky Header]                                                       │
│  Title: "Create New Task" / "Edit Task"              [• Unsaved Changes] [X]│
├────────────────────────────────────────────────────────────────────────┤
│  [Scrollable Body - flex-1 overflow-y-auto]                            │
│                                                                        │
│  Section 1: Basic Details                                             │
│  - Task Title * (auto-focus, placeholder)                              │
│  - Project Selector (with accent color dot)                            │
│  - Priority Segmented Control (Low, Medium, High)                      │
│  - Description (multi-line textarea)                                   │
│                                                                        │
│  Section 2: Schedule & Duration                                        │
│  - Scheduled Date (Quick buttons: Today, Tomorrow, Next Mon, Clear)    │
│  - Start Time (HH:mm, validated against scheduled date)                │
│  - Planned Duration (30m, 45m, 1h, 1h 30m, Custom)                     │
│  - Remaining Estimate (Minutes, displayed for client projects)         │
│                                                                        │
│  Section 3: Task Reminders & Notifications                             │
│  - Reminder Offset (At start time, 5m, 10m, 15m, 30m, 1h before)       │
│                                                                        │
│  Section 4: Collaboration & Integrations                               │
│  - Client Visibility Toggle (Internal Only vs Client Visible)          │
│  - Google Calendar Synchronization Toggle                              │
├────────────────────────────────────────────────────────────────────────┤
│  [Sticky Footer]                                                       │
│  [Cancel / Discard]                            [Save Task / Update]    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Ergonomic & Form Features

### 4.1 Dirty State Tracking & Unsaved Changes Protection
- Form state is deeply tracked against initial values.
- If changes are present, an indicator pill (`Unsaved Changes`) is displayed in the sticky header.
- Attempting to close via the `X` button, backdrop click, or `Escape` key while the form is dirty triggers an explicit discard confirmation dialog:
  > *"You have unsaved changes. Are you sure you want to discard them?"*

### 4.2 Keyboard Accessibility
- **`Escape`**: Safely requests modal close (intercepted by dirty check if unsaved changes exist).
- **`Enter` (Cmd+Enter / Ctrl+Enter)**: Submits the form from anywhere within textarea or inputs.
- **Auto-Focus**: The title input field is automatically focused upon modal mount.
- **Trap Focus**: Focus remains contained within the modal dialog for screen readers and keyboard navigation.

### 4.3 Backward Compatibility
- Existing call sites using `openCreateTaskDrawer` or `openEditTaskDrawer` in `WorkspaceContext` automatically trigger `TaskFormModal` seamlessly.
- `TaskFormDrawer.tsx` is maintained as a re-export of `TaskFormModal` for backward compatibility across existing features.
