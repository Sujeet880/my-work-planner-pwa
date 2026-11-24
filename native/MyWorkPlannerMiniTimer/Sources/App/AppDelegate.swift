import AppKit
import SwiftUI
import Combine

@MainActor
public final class AppDelegate: NSObject, NSApplicationDelegate {
    public static let shared = AppDelegate()

    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var cancellables = Set<AnyCancellable>()

    public func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Configure the floating panel manager
        FloatingPanelManager.shared.configure()

        // 2. Setup the macOS menu bar status item
        setupMenuBarItem()

        // 3. Register URL event handler for custom URL scheme
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleGetURL(event:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )

        // 4. Update menu bar title when timer runs
        setupMenuBarTicker()
    }

    private func setupMenuBarItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Focus Timer")
            button.target = self
            button.action = #selector(togglePopover(_:))
        }

        let newPopover = NSPopover()
        newPopover.contentSize = NSSize(width: 260, height: 260)
        newPopover.behavior = .transient
        newPopover.contentViewController = NSHostingController(rootView: MenuBarView())

        self.statusItem = item
        self.popover = newPopover
    }

    private func setupMenuBarTicker() {
        TimerService.shared.$liveTotalSeconds
            .receive(on: DispatchQueue.main)
            .sink { [weak self] totalSeconds in
                guard let self = self, let button = self.statusItem?.button else { return }
                if TimerService.shared.timerStatus == .running {
                    let formatted = TimerService.shared.formatAdaptiveTime(totalSeconds)
                    button.title = " \(formatted)"
                    button.image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Running")
                } else if TimerService.shared.timerStatus == .paused {
                    button.title = " (Paused)"
                    button.image = NSImage(systemSymbolName: "pause.circle.fill", accessibilityDescription: "Paused")
                } else {
                    button.title = ""
                    button.image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Focus Timer")
                }
            }
            .store(in: &cancellables)
    }

    @objc private func togglePopover(_ sender: AnyObject?) {
        guard let button = statusItem?.button, let popover = popover else { return }
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    @objc private func handleGetURL(event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
        guard let urlString = event.paramDescriptor(forKeyword: AEKeyword(keyDirectObject))?.stringValue,
              let url = URL(string: urlString) else {
            return
        }

        handleURL(url)
    }

    public func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            handleURL(url)
        }
    }

    private func handleURL(_ url: URL) {
        if url.host == "auth" || url.path.contains("callback") || url.path.contains("auth") {
            Task {
                let success = await SupabaseManager.shared.handleIncomingURL(url)
                if success {
                    SignInWindowController.shared.close()
                    FloatingPanelManager.shared.showPanel()
                    NSApp.activate(ignoringOtherApps: true)
                }
            }
        } else if url.host == "launch" || url.host == "open" || url.path.contains("launch") || url.path.contains("open") || url.scheme == "myworkplanner-minitimer" {
            FloatingPanelManager.shared.showPanel()
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Mini timer companion lives in the menu bar and floating panel; do not quit on window close
        return false
    }

    public func applicationWillTerminate(_ notification: Notification) {
        // Quitting the companion application does NOT stop the server-side timer!
        // Server state remains intact.
    }
}
