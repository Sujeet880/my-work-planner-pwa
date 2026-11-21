# My Work Planner — Native macOS Mini Focus Timer Architecture

This document details the architectural design, window management, multi-Space behavior, authentication flow, and synchronization engine for the native macOS companion application: **My Work Planner — Mini Focus Timer**.

---

## 1. System Overview & Technology Stack

The companion app is built as a genuine native macOS application located in `native/MyWorkPlannerMiniTimer/`. It is engineered specifically to provide a non-intrusive, floating focus chip that remains visible while working in any desktop application (Figma, VS Code, Google Chrome, Safari, Photoshop, Xcode, Finder, etc.) across multiple macOS Spaces and full-screen apps.

### Core Stack
- **Language & Runtime:** Swift 6.0 (`Apple Swift version 6.4`), macOS 14.0+ (Sonoma, Sequoia)
- **UI Frameworks:** SwiftUI + AppKit (`NSPanel`, `NSApplicationDelegate`, `NSStatusBar`)
- **Backend / Database Client:** `supabase-swift` v2.55+ (PostgREST, Auth, Realtime)
- **Credential Storage:** macOS Native Keychain Services (`Security.framework`)
- **Inter-App Deep Linking:** Custom URL Scheme `myworkplanner-minitimer://` via `NSAppleEventManager`

```
┌────────────────────────────────────────────────────────────────────────┐
│                        macOS Desktop Environment                       │
│                                                                        │
│   ┌────────────────────────────────┐   ┌───────────────────────────┐   │
│   │ Full-Screen IDE / Chrome / App │   │ Mission Control Spaces    │   │
│   └───────────────┬────────────────┘   └─────────────┬─────────────┘   │
│                   │                                  │                 │
│                   ▼                                  ▼                 │
│         ┌──────────────────────────────────────────────────┐           │
│         │     FloatingTimerPanel (NSPanel Level: .floating)│           │
│         │   CollectionBehavior: [.canJoinAllSpaces,        │           │
│         │                        .fullScreenAuxiliary]     │           │
│         │  HidesOnDeactivate: false | Non-Activating Pill  │           │
│         └─────────────────────────┬────────────────────────┘           │
│                                   │                                    │
│         ┌─────────────────────────┴────────────────────────┐           │
│         │                 TimerService                     │           │
│         │  - 1s Local UI Tick Counter (Zero DB Load)       │           │
│         │  - 5s Background Reconciliation Polling          │           │
│         │  - PosgreSQL Atomic RPC Engine                   │           │
│         └─────────────────────────┬────────────────────────┘           │
│                                   │                                    │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ HTTPS / REST RPC
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             Supabase PostgreSQL Database                │
       │                                                         │
       │  active_timers (Single Source of Truth)                 │
       │    ├── rpc_start_timer                                  │
       │    ├── rpc_pause_timer                                  │
       │    ├── rpc_resume_timer                                 │
       │    └── rpc_stop_timer                                   │
       │  work_sessions (Committed Time Logs)                    │
       │  tasks & projects (Task Metadata & Priority)            │
       └─────────────────────────────────────────────────────────┘
```

---

## 2. Window Hierarchy & Multi-Space Window Management

Standard macOS windows (`NSWindow`) disappear when other applications take focus or when the user switches to a full-screen application or different Space. The Mini Focus Timer overcomes these constraints through specialized `NSPanel` configuration in `Sources/Panel/FloatingPanel.swift`:

### Key Window Properties
1. **Style Mask:**
   ```swift
   styleMask: [.nonactivatingPanel, .borderless, .hudWindow]
   ```
   - `.nonactivatingPanel`: Clicking buttons or interacting with the timer chip does not steal keyboard focus from the active text editor, terminal, or browser.
   - `.borderless`: Removes standard macOS window chrome, title bars, and traffic lights, allowing custom glassmorphism rounded corners.
   - `.hudWindow`: Applies Heads-Up Display window characteristics.

2. **Window Level:**
   ```swift
   self.level = .floating
   ```
   - Sets the panel's z-index above normal application windows (`.normal`) but below modal alerts and screensavers, ensuring it stays visible above Chrome, Figma, and IDE windows.

3. **Collection Behavior (Spaces & Full-Screen Auxiliaries):**
   ```swift
   self.collectionBehavior = [
       .canJoinAllSpaces,       // Follows the user across all virtual desktops / Spaces
       .fullScreenAuxiliary,   // Floats directly over native full-screen applications
       .ignoresCycle           // Excluded from Cmd+Tab or Cmd+` window cycling
   ]
   ```
   - `.canJoinAllSpaces`: Ensures the timer remains anchored in place when switching virtual desktops.
   - `.fullScreenAuxiliary`: Critical for modern macOS productivity; allows the panel to render on top of spaces displaying full-screen apps (e.g. Xcode or Chrome in full-screen mode).

4. **Persistence & Activation:**
   ```swift
   self.isFloatingPanel = true
   self.hidesOnDeactivate = false
   self.becomesKeyOnlyIfNeeded = true
   ```
   - `hidesOnDeactivate = false`: Ensures the timer does not disappear when user clicks away into another application.
   - `becomesKeyOnlyIfNeeded = true`: Prevents key-window focus acquisition unless a text input explicitly demands it.

---

## 3. Position Memory, Multi-Monitor Clamping & Resizing

Window position is handled by `FloatingPanelManager` (`Sources/Panel/FloatingPanelManager.swift`):

- **Default Position:** Screen top-right corner with 24pt padding below menu bar.
- **Position Persistence:** Stored in `UserDefaults` (`FloatingTimerPositionX`, `FloatingTimerPositionY`) on window drag.
- **Monitor Disconnect Clamping:** If an external monitor is disconnected, `clampToScreenBounds()` automatically verifies current coordinates against `NSScreen.main?.visibleFrame` and re-centers the window if it falls off-screen.
- **Dynamic Resizing Animation:**
  - Collapsed Chip: `320 x 58 pt`
  - Expanded Details View: `340 x 165 pt`
  - Smooth animated transitions via `NSAnimationContext.runAnimationGroup(duration: 0.22)`.

---

## 4. Single Source of Truth & Database Synchronization

The native companion strictly enforces the single-source-of-truth architecture established in Milestone 5:

1. **No Direct Row Manipulation:**
   - The native app never executes direct `INSERT` or `DELETE` on `active_timers`.
   - All state transitions invoke the same verified atomic PostgreSQL RPCs:
     - `rpc_pause_timer(p_user_id)`
     - `rpc_resume_timer(p_user_id)`
     - `rpc_stop_timer(p_user_id)`

2. **Dual-Cadence Ticker Engine (`TimerService.swift`):**
   - **Local 1-Second UI Ticker:** Runs on `Timer.publish(every: 1.0, on: .main, in: .common)`. It increments local display counters strictly from timestamp math (`Date().timeIntervalSince(segmentStartedAt)`) without hitting Supabase or causing network traffic.
   - **5-Second Reconciliation Poller:** Runs on a 5-second interval to fetch current `active_timers` row. Reconciles state when a user starts, pauses, or stops a timer from the Web App, PWA, or another machine.

3. **Clean App Termination:**
   - Quitting the native app (`Cmd+Q` or Menu Bar "Quit") explicitly leaves the server-side timer running.
   - `AppDelegate` clean shutdown does not invoke `rpc_stop_timer`. The active timer segment remains open in Supabase PostgreSQL until stopped by the user.

---

## 5. Menu Bar Status Item (`NSStatusBar.system`)

The app includes an `NSStatusItem` in the macOS Menu Bar:
- Displays a `timer` SF Symbol.
- Dynamically displays the live elapsed time (`00:14:22`) alongside the icon when a timer is running.
- Clicking the item opens a transient `NSPopover` containing:
  - Active task title and project indicator.
  - Formatted elapsed time and timer status.
  - Quick action buttons (Toggle Floating Chip, Pause/Resume, Stop & Log).
  - Web App shortcut (`http://localhost:3000`).
  - Account status and Sign Out / Quit controls.

---

## 6. Authentication & Secure Keychain Token Storage

- **Auth Provider:** Supabase Email Magic Link (`auth.signInWithOTP(email:shouldCreateUser: false)`).
- **Session Tokens:** Access and refresh tokens are stored in the macOS Keychain (`kSecClassGenericPassword`, service: `com.myworkplanner.minitimer`) with `kSecAttrAccessibleAfterFirstUnlock`.
- **Deep Linking Callback:** `myworkplanner-minitimer://auth/callback#access_token=...` is caught by `NSAppleEventManager` in `AppDelegate.swift`, parsed by `SupabaseManager.handleIncomingURL()`, and stored securely in Keychain.
