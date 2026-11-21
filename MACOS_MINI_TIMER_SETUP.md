# My Work Planner — Native macOS Mini Focus Timer Setup & User Guide

This guide describes how to build, test, configure, and launch the native companion app: **My Work Planner — Mini Focus Timer**.

---

## 1. System Requirements

- **Operating System:** macOS 14.0 (Sonoma) or macOS 15.0+ (Sequoia)
- **Architecture:** Apple Silicon (M1/M2/M3/M4) or Intel x86_64
- **Toolchain:** Swift 6.0+ (`swift --version` >= 6.0)
- **Backend:** Configured Supabase project with active timer RPC migrations (`20261121000002_timer_rpcs.sql`)

---

## 2. Directory Structure

```
native/MyWorkPlannerMiniTimer/
├── Package.swift               # SPM package manifest (Swift 6.0)
├── Package.resolved            # Dependency lockfile (supabase-swift v2.55.7)
├── Resources/
│   └── Info.plist             # Bundle metadata, LSUIElement, and URL scheme
├── Sources/                   # Core application library (MyWorkPlannerMiniTimerCore)
│   ├── App/
│   │   └── AppDelegate.swift  # Menu bar, URL scheme listener, lifecycle
│   ├── Models/
│   │   └── TimerModels.swift  # ActiveTimerRecord, TaskRecord, ProjectRecord
│   ├── Panel/
│   │   ├── FloatingPanel.swift        # NSPanel (.floating, .canJoinAllSpaces)
│   │   └── FloatingPanelManager.swift  # Position persistence & animations
│   ├── Services/
│   │   ├── KeychainManager.swift      # macOS Security framework storage
│   │   ├── SupabaseManager.swift      # Supabase Swift client & auth
│   │   └── TimerService.swift         # 1s ticker, 5s poll, atomic RPCs
│   └── Views/
│       ├── FloatingTimerChipView.swift # SwiftUI glassmorphic HUD pill
│       ├── MenuBarView.swift          # Menu bar popup & controls
│       └── SignInView.swift           # Native Magic Link auth view
├── AppLauncher/
│   └── main.swift             # Native app entry point
├── TestsRunner/
│   └── main.swift             # Standalone test runner (18 automated tests)
├── scripts/
│   └── build_app.sh           # Standalone .app bundle packager & code signer
└── dist/
    └── MyWorkPlannerMiniTimer.app  # Self-contained macOS application bundle
```

---

## 3. Building and Testing

### A. Run Automated Unit & Integration Tests
The standalone test runner executes 18 assertions covering time formatting, schema decoding, RPC responses, URL schemes, and macOS Keychain storage:

```bash
cd native/MyWorkPlannerMiniTimer
swift run MiniTimerTestsRunner
```

Expected Output:
```
=== My Work Planner — Native macOS Mini Focus Timer Test Suite ===

▶ Suite 1: Time Formatting & Display Logic
  ✔ Formats 0 seconds as 00:00:00
  ✔ Formats 59 seconds as 00:00:59
  ✔ Formats 60 seconds as 00:01:00
  ✔ Formats 3600 seconds as 01:00:00
  ✔ Formats 3665 seconds as 01:01:05
  ✔ Formats 86400 seconds as 24:00:00
  ✔ Clamps negative numbers to 00:00:00

▶ Suite 2: Active Timer Schema & Status Enums
  ✔ Maps state 'running' to TimerStatus.running
  ✔ Decodes task_id correctly
  ✔ Decodes user_id correctly
  ✔ Maps state 'paused' to TimerStatus.paused
  ✔ segment_started_at is nil when paused

▶ Suite 3: Database RPC Response Structures
  ✔ rpc_pause_timer action is 'paused'
  ✔ rpc_pause_timer returns accurate duration_seconds
  ✔ rpc_pause_timer returns session_id
  ✔ rpc_stop_timer returns stopped: true
  ✔ rpc_stop_timer returns session_saved: true
  ✔ rpc_stop_timer returns duration_seconds: 120

▶ Suite 4: Custom URL Scheme & Deep Linking
  ✔ Matches custom URL scheme 'myworkplanner-minitimer'
  ✔ Routes to auth host handler
  ✔ Matches open URL scheme
  ✔ Routes to open host handler

▶ Suite 5: Keychain Storage Round-Trip
  ✔ Successfully writes token into macOS Keychain
  ✔ Reads token back from macOS Keychain with exact fidelity
  ✔ Deletes token from macOS Keychain cleanly
  ✔ Confirmed token is cleared after delete

=======================================================
🎉 All Native Mini Timer tests passed successfully! (18 checks)
=======================================================
```

### B. Compile and Package `.app` Bundle
Run the packaging script to generate the self-contained macOS app bundle:

```bash
cd native/MyWorkPlannerMiniTimer
./scripts/build_app.sh
```

This script:
1. Compiles the release binary using `swift build -c release`.
2. Assembles `dist/MyWorkPlannerMiniTimer.app/Contents/MacOS/MyWorkPlannerMiniTimer`.
3. Embeds `Resources/Info.plist` with `LSUIElement = true` (accessory menu bar app) and the `myworkplanner-minitimer` URL scheme.
4. Applies ad-hoc local code signing via `codesign --force --deep --sign -`.

---

## 4. Running the Application

### Direct Launch
You can launch the application directly from the command line:

```bash
open native/MyWorkPlannerMiniTimer/dist/MyWorkPlannerMiniTimer.app
```

Or copy the bundle to your user's Applications folder:

```bash
cp -R native/MyWorkPlannerMiniTimer/dist/MyWorkPlannerMiniTimer.app /Applications/
open /Applications/MyWorkPlannerMiniTimer.app
```

---

## 5. Custom URL Scheme Integration

The application registers the `myworkplanner-minitimer://` protocol:

| URL Pattern | Behavior |
|-------------|----------|
| `myworkplanner-minitimer://open` | Brings the floating timer chip to the foreground or toggles visibility |
| `myworkplanner-minitimer://auth/callback#access_token=...` | Consumes Supabase Magic Link auth session and stores token in Keychain |

### Launch from Terminal or Browser:
```bash
open "myworkplanner-minitimer://open"
```

In the Web App (`/settings`), a direct launch link is available under **Native macOS Mini Focus Timer**.

---

## 6. Configuring Launch at Login

To have the Mini Focus Timer automatically start when you log into your Mac:

1. Open **System Settings** on your Mac.
2. Navigate to **General** > **Login Items & Extensions**.
3. Under **Open at Login**, click the **+** (plus) icon.
4. Select `MyWorkPlannerMiniTimer.app` from `/Applications/` or the project `dist/` directory.
5. The application will now start unobtrusively in your Menu Bar whenever your Mac boots.
