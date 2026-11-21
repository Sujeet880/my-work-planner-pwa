import AppKit
import MyWorkPlannerMiniTimerCore

@MainActor
func run() {
    let app = NSApplication.shared
    let delegate = AppDelegate.shared
    app.delegate = delegate
    app.run()
}

run()
