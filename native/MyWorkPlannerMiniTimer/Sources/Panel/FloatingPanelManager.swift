import AppKit
import SwiftUI
import Combine

@MainActor
public final class FloatingPanelManager: ObservableObject {
    public static let shared = FloatingPanelManager()

    private var panel: FloatingPanel?
    private var cancellables = Set<AnyCancellable>()

    @Published public var isExpanded: Bool = false
    @Published public var isPanelVisible: Bool = false
    @Published public var userManuallyHidden: Bool = false

    private let collapsedSize = CGSize(width: 320, height: 58)
    private let expandedSize = CGSize(width: 340, height: 165)

    private let originXKey = "FloatingPanel_OriginX"
    private let originYKey = "FloatingPanel_OriginY"

    private init() {}

    public func configure() {
        guard panel == nil else { return }

        let initialOrigin = loadSavedOrigin()
        let initialRect = NSRect(origin: initialOrigin, size: collapsedSize)
        let floatingPanel = FloatingPanel(contentRect: initialRect)

        // Set SwiftUI root hosting view
        let chipView = FloatingTimerChipView()
        let hostingView = NSHostingView(rootView: chipView)
        hostingView.frame = NSRect(origin: .zero, size: collapsedSize)
        hostingView.autoresizingMask = [.width, .height]

        floatingPanel.contentView = hostingView
        self.panel = floatingPanel

        setupWindowMoveObserver(floatingPanel)
        setupTimerObservers()
        setupEnvironmentObservers()
    }

    private func setupEnvironmentObservers() {
        // Space changes: re-assert front ordering across macOS virtual desktops
        NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.activeSpaceDidChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self = self, self.isPanelVisible, let panel = self.panel else { return }
                panel.orderFrontRegardless()
            }
            .store(in: &cancellables)

        // Screen parameters change (external monitor plugged/unplugged, resolution switch)
        NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self = self else { return }
                self.clampToVisibleScreen()
                if self.isPanelVisible {
                    self.panel?.orderFrontRegardless()
                }
            }
            .store(in: &cancellables)

        // App activation: ensure panel stays above newly focused third-party apps
        NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.didActivateApplicationNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self = self, self.isPanelVisible, let panel = self.panel else { return }
                panel.orderFrontRegardless()
            }
            .store(in: &cancellables)
    }

    private func setupTimerObservers() {
        TimerService.shared.$timerStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard let self = self else { return }
                if status != .idle {
                    if !self.userManuallyHidden {
                        self.showPanel()
                    }
                } else {
                    self.hidePanel()
                }
            }
            .store(in: &cancellables)
    }

    private func setupWindowMoveObserver(_ window: NSWindow) {
        NotificationCenter.default.publisher(for: NSWindow.didMoveNotification, object: window)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.saveCurrentOrigin()
            }
            .store(in: &cancellables)
    }

    public func showPanel() {
        guard let panel = panel else {
            configure()
            panel?.orderFrontRegardless()
            isPanelVisible = true
            return
        }

        clampToVisibleScreen()
        panel.orderFrontRegardless()
        isPanelVisible = true
    }

    public func hidePanel() {
        panel?.orderOut(nil)
        isPanelVisible = false
    }

    public func toggleVisibility() {
        if isPanelVisible {
            userManuallyHidden = true
            hidePanel()
        } else {
            userManuallyHidden = false
            showPanel()
        }
    }

    public func setExpanded(_ expanded: Bool) {
        guard isExpanded != expanded, let panel = panel else { return }
        isExpanded = expanded

        let targetSize = expanded ? expandedSize : collapsedSize
        var currentFrame = panel.frame

        // Anchor top-left so expanding flows downward smoothly
        let heightDelta = targetSize.height - currentFrame.height
        currentFrame.origin.y -= heightDelta
        currentFrame.size = targetSize

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            panel.animator().setFrame(currentFrame, display: true)
        }

        saveCurrentOrigin()
    }

    // =========================================================================
    // Multi-Display & Bounds Clamping
    // =========================================================================

    private func loadSavedOrigin() -> CGPoint {
        let x = UserDefaults.standard.double(forKey: originXKey)
        let y = UserDefaults.standard.double(forKey: originYKey)

        if x > 0 && y > 0 {
            let candidate = CGPoint(x: x, y: y)
            return validateOrigin(candidate, size: collapsedSize)
        }

        // Default: Top-Right of Main Screen with comfortable padding
        if let screen = NSScreen.main {
            let screenFrame = screen.visibleFrame
            let defaultX = screenFrame.maxX - collapsedSize.width - 24
            let defaultY = screenFrame.maxY - collapsedSize.height - 24
            return CGPoint(x: defaultX, y: defaultY)
        }

        return CGPoint(x: 200, y: 500)
    }

    private func saveCurrentOrigin() {
        guard let panel = panel else { return }
        let origin = panel.frame.origin
        UserDefaults.standard.set(origin.x, forKey: originXKey)
        UserDefaults.standard.set(origin.y, forKey: originYKey)
    }

    private func clampToVisibleScreen() {
        guard let panel = panel else { return }
        let validated = validateOrigin(panel.frame.origin, size: panel.frame.size)
        if validated != panel.frame.origin {
            panel.setFrameOrigin(validated)
            saveCurrentOrigin()
        }
    }

    private func validateOrigin(_ origin: CGPoint, size: CGSize) -> CGPoint {
        let targetRect = NSRect(origin: origin, size: size)

        // Find which screen contains the majority of the panel
        for screen in NSScreen.screens {
            if screen.visibleFrame.intersects(targetRect) {
                let screenFrame = screen.visibleFrame
                let clampedX = min(max(origin.x, screenFrame.minX + 8), screenFrame.maxX - size.width - 8)
                let clampedY = min(max(origin.y, screenFrame.minY + 8), screenFrame.maxY - size.height - 8)
                return CGPoint(x: clampedX, y: clampedY)
            }
        }

        // Fallback: If monitor was unplugged, reposition to main screen
        if let mainScreen = NSScreen.main {
            let screenFrame = mainScreen.visibleFrame
            let x = screenFrame.maxX - size.width - 24
            let y = screenFrame.maxY - size.height - 24
            return CGPoint(x: x, y: y)
        }

        return origin
    }
}
