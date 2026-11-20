---
name: Calm Focused Productivity
colors:
  surface: '#FFFFFF'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#444653'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#747684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3555c3'
  primary: '#2d4ebc'
  on-primary: '#ffffff'
  primary-container: '#4968d6'
  on-primary-container: '#f5f4ff'
  inverse-primary: '#b7c4ff'
  secondary: '#595e6a'
  on-secondary: '#ffffff'
  secondary-container: '#dee2f0'
  on-secondary-container: '#5f6470'
  tertiary: '#535865'
  on-tertiary: '#ffffff'
  tertiary-container: '#6b707e'
  on-tertiary-container: '#f4f5ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#143caa'
  secondary-fixed: '#dee2f0'
  secondary-fixed-dim: '#c2c6d4'
  on-secondary-fixed: '#171c25'
  on-secondary-fixed-variant: '#424752'
  tertiary-fixed: '#dee2f3'
  tertiary-fixed-dim: '#c2c6d6'
  on-tertiary-fixed: '#161b27'
  on-tertiary-fixed-variant: '#424754'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
  canvas: '#F6F7F9'
  surface-subtle: '#F0F2F5'
  text-primary: '#202531'
  text-secondary: '#667085'
  text-muted: '#98A2B3'
  border: '#E4E7EC'
  accent: '#4968D6'
  accent-hover: '#3D59BE'
  accent-soft: '#EDF1FF'
  success: '#16845B'
  warning: '#B7791F'
  danger: '#C2414B'
  info: '#3574B8'
  focus: '#7895F2'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  timer-display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  timer-display-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  timer-inline:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is tailored for a single-user productivity workspace and time tracker. The brand personality is grounded, understated, efficient, and mentally calming. The interface functions as an uncluttered personal command center rather than an aggressive, gamified task manager or an enterprise collaboration suite.

The overarching design style is **Minimalist Functionalism**:
- **Clarity over ornament:** Decorative illustrations, heavy backdrop blurs, floating gradients, and oversized hero banners are strictly prohibited.
- **Cognitive ease:** The environment uses structured white card surfaces on a muted cool-gray canvas, establishing clear boundaries without relying on heavy contrast or visual noise.
- **Immediate actionability:** Instant one-click timer triggers, direct inline status adjustments, and high-visibility running states keep the user focused on deep work rather than tool management.

## Colors

The palette is strictly calibrated for a light-mode utilitarian workspace. Visual weight is concentrated on functional states and active work timers rather than brand posturing.

### Roles & Semantic Structure
- **Canvas & Surface:** Application shell background uses `#F6F7F9`, providing soft contrast against pure white `#FFFFFF` cards, drawers, and popovers. Minor secondary groupings use `#F0F2F5`.
- **Text & Hierarchy:** Body and headline copy use `#202531` for high-legibility contrast. Supporting metadata uses `#667085`, and disabled or placeholder states use `#98A2B3`.
- **Brand Accent:** `#4968D6` acts as the focal interaction color for primary triggers, active timer chips, and active nav states. Hover states resolve to `#3D59BE`, while `#EDF1FF` provides a tinted resting background for selected items.
- **Semantic Feedback & Priorities:**
  - `success` (`#16845B`): Completed status, positive delta in planned vs. actual time, and saved notifications.
  - `warning` (`#B7791F`): Medium priority, approaching estimated deadlines, and paused states.
  - `danger` (`#C2414B`): High priority, overdue timers, destructive deletions, and state conflicts.
  - `info` (`#3574B8`): Informational prompts and neutral system updates.
  - `focus` (`#7895F2`): High-visibility keyboard accessibility ring.

Color must never be the sole indicator of state; semantic colors must always be paired with an accompanying label or icon.

## Typography

Typography relies uniformly on **Inter** to ensure maximum legibility and functional density across both text and tabular data:
- **Numerical Regularity:** All active clocks, stopwatch counters, planned vs. actual tables, and duration metrics must enforce `font-feature-settings: 'tnum' on, 'lnum' on` to prevent layout shift during tick cycles.
- **Hierarchy Structure:**
  - Page titles: 26–30px semi-bold (`headline-xl`).
  - Section headers and panels: 18–20px semi-bold (`headline-lg`).
  - Card titles & group dividers: 15–16px semi-bold (`headline-md`).
  - Standard body and interaction controls: 14–15px regular (`body-md`, `body-lg`).
  - Micro-metadata and secondary metrics: 12–13px medium/regular (`body-sm`, `label-md`).
- **Weight Restraint:** Weights below 400 are rejected across the system to maintain AA contrast ratios on light grey backgrounds.

## Layout & Spacing

Layout geometry follows a rigid 4px base increment (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `40px`, `48px`).

### Application Shell Breakdown
- **Desktop (>= 1024px):** Fixed navigation sidebar at `232px`, top application bar at `64px`. Main canvas margin is set to `28px` to `32px` (`1.75rem` - `2rem`). Responsive workspace with maximum content containment where appropriate to prevent wide horizontal scanning fatigue.
- **Tablet (768px - 1023px):** Left sidebar transitions to a drawer or icon rail; grid columns compress from multi-column metrics down to 2-column or stacked layout with `16px` gutters.
- **Mobile (< 768px):** Single-column layout. Top bar is streamlined; primary navigation moves to a fixed bottom bar (`56px`-`64px`). The persistent active timer anchors directly above the bottom bar with an elevated sticky container. Canvas margin compresses to `16px` (`1rem`).

Consistent interior padding:
- Cards: `16px` or `20px` internal padding.
- List items and task rows: `10px` to `12px` vertical padding for touch accessibility without bloating scroll length.

## Elevation & Depth

This design system deliberately eschews deep skeuomorphic shadows and blur-heavy glassmorphism in favor of **tonal containment and 1px structural borders**.

- **Level 0 (Canvas):** `#F6F7F9`. No shadow.
- **Level 1 (Cards, Content Rows, Sidebars):** `#FFFFFF` surfaces separated by a 1px solid border in `#E4E7EC`. A barely perceptible ambient shadow is permitted only to lift cards from the background: `0 1px 3px rgba(32, 37, 49, 0.04)`.
- **Level 2 (Dropdowns, Menus, Popovers, Persistent Timer Bar):** `#FFFFFF` surface with `1px solid #E4E7EC` and elevated utility shadow: `0 4px 12px rgba(32, 37, 49, 0.08)`.
- **Level 3 (Modal Dialogs, Slide-over Drawers):** `#FFFFFF` surface accompanied by a neutral backdrop scrim (`rgba(32, 37, 49, 0.35)` with zero blur filter) and structural shadow: `0 12px 32px rgba(32, 37, 49, 0.12)`.

## Shapes

The geometric radius scale is restrained to create a precise, structured workspace:

- **Buttons, Inputs, and Select Menus:** Strict `8px` corner radius.
- **Small Controls, Badges, and Chips:** `6px` to `8px` corner radius.
- **Task Cards and Content Panels:** `10px` to `12px` corner radius.
- **Drawers, Slide-overs, and Dialog Windows:** `12px` to `16px` corner radius.
- **Pills / Status Dots:** Circular or fully rounded forms (`9999px`) used only for contextual indicator pips and compact priority labels.

## Components

### Buttons
- **Primary:** Background `#4968D6`, text `#FFFFFF`, hover `#3D59BE`, border `transparent`, radius `8px`. Focus ring: `2px solid #7895F2` with 2px offset.
- **Secondary / Outline:** Background `#FFFFFF`, text `#202531`, border `1px solid #E4E7EC`, hover `#F0F2F5`.
- **Ghost:** Background transparent, text `#667085`, hover background `#EDF1FF`, hover text `#4968D6`.
- **Destructive:** Background `#FFFFFF`, text `#C2414B`, border `1px solid #C2414B`, hover background `#FDF2F2`.
- **Disabled:** Background `#F0F2F5`, text `#98A2B3`, border `none`, cursor `not-allowed`.

### Task Row & Task Card
- Task rows are clean, scannable horizontal strips: `1px solid #E4E7EC`, surface `#FFFFFF`, containing a task completion trigger (checkbox), title, metadata chips (project, planned vs. actual), and an immediate timer action.
- Must avoid heavy card nesting; rows should group under single container cards or clean dividers.

### Timer Component (Global & In-Row)
- **Idle:** Outlined play icon button `#667085`, hover `#4968D6`.
- **Running:** Active status tint `#EDF1FF`, text `#4968D6`, glowing tabular numerals, prominent Pause and Stop controls. Persistent global bar must remain anchored when running.
- **Paused:** Muted amber tint with `#B7791F` indicators, displaying a clear "Paused" label and Resume trigger.
- **Recovering:** Banner state notifying the user of an interrupted/restored session with current elapsed time preserved.

### Badges & Chips
- Formed with `6px` radius and `12px` typography.
- **Priority Badges:**
  - High: Text `#C2414B`, Background `#FCE8E9`.
  - Medium: Text `#B7791F`, Background `#FEF3E2`.
  - Low: Text `#3574B8`, Background `#EDF1FF`.
- **Status Badges:**
  - To Do: Text `#667085`, Background `#F0F2F5`.
  - In Progress: Text `#4968D6`, Background `#EDF1FF`.
  - Completed: Text `#16845B`, Background `#E8F5EF`.
  - Overdue: Text `#C2414B`, Background `#FCE8E9`.

### Form Controls & Inputs
- Height `38px` to `42px`, border `1px solid #E4E7EC`, radius `8px`, padding `8px 12px`.
- Active focus state: border `#4968D6`, ring `2px solid #7895F2`.
- Error state: border `#C2414B`, helper text `#C2414B`.

### Modals & Drawers
- Consequential decisions (such as "Save & Switch" when starting a new task while a timer is active) use modal dialogs centered with clear explicit actions.
- Complex task creation and detail views use an off-canvas right drawer on desktop and a bottom sheet or full-screen view on mobile.