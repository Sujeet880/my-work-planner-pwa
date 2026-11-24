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
    @Published public var alwaysOnTop: Bool = true {
        didSet {
            UserDefaults.standard.set(alwaysOnTop, forKey: alwaysOnTopKey)
            updateWindowLevel()
        }
    }

    public let collapsedSize = CGSize(width: 192, height: 44)
    public let expandedSize = CGSize(width: 268, height: 104)
    public static let edgeMargin: CGFloat = 16.0

    public var panelInstance: FloatingPanel? { panel }

    private let originXKey = "FloatingPanel_OriginX"
    private let originYKey = "FloatingPanel_OriginY"
    private let alwaysOnTopKey = "FloatingPanel_AlwaysOnTop"

    private init() {
        if UserDefaults.standard.object(forKey: alwaysOnTopKey) != nil {
            self.alwaysOnTop = UserDefaults.standard.bool(forKey: alwaysOnTopKey)
        } else {
            self.alwaysOnTop = true
        }
    }

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

        updateWindowLevel()
        setupWindowMoveObserver(floatingPanel)
        setupTimerObservers()
        setupEnvironmentObservers()
    }

    public func updateWindowLevel() {
        guard let panel = panel else { return }
        panel.level = alwaysOnTop ? .floating : .normal
        if isPanelVisible {
            panel.orderFrontRegardless()
        }
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

        // App activation: ensure panel stays above newly focused third-party apps if always-on-top
        NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.didActivateApplicationNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self = self, self.isPanelVisible, self.alwaysOnTop, let panel = self.panel else { return }
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
                }
            }
            .store(in: &cancellables)
    }

    private func setupWindowMoveObserver(_ window: NSWindow) {
        // Debounce window movement by 250ms to snap gently once the user finishes dragging
        NotificationCenter.default.publisher(for: NSWindow.didMoveNotification, object: window)
            .debounce(for: .milliseconds(250), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self = self, self.isPanelVisible else { return }
                self.snapToNearestEdge()
            }
            .store(in: &cancellables)
    }

    public func showPanel() {
        userManuallyHidden = false
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
            context.duration = 0.22
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            panel.animator().setFrame(currentFrame, display: true)
        }

        snapToNearestEdge()
    }

    // =========================================================================
    // Edge Snapping & Positioning
    // =========================================================================

    /// Computes the snapped origin for a given frame within a screen's visible frame,
    /// enforcing 16–24pt margin and supporting all 4 screen edges (Left, Right, Top, Bottom).
    public static func calculateSnappedOrigin(
        for currentFrame: NSRect,
        in visibleFrame: NSRect,
        margin: CGFloat = edgeMargin
    ) -> CGPoint {
        let minX = visibleFrame.minX + margin
        let maxX = max(minX, visibleFrame.maxX - currentFrame.width - margin)
        let minY = visibleFrame.minY + margin
        let maxY = max(minY, visibleFrame.maxY - currentFrame.height - margin)

        // Distances from current position to each of the 4 edges
        let distLeft = abs(currentFrame.minX - minX)
        let distRight = abs(currentFrame.maxX - (visibleFrame.maxX - margin))
        let distBottom = abs(currentFrame.minY - minY)
        let distTop = abs(currentFrame.maxY - (visibleFrame.maxY - margin))

        let minHorizDist = min(distLeft, distRight)
        let minVertDist = min(distTop, distBottom)

        var targetX = currentFrame.origin.x
        var targetY = currentFrame.origin.y

        if minHorizDist < minVertDist {
            // Snap horizontally to left or right edge; clamp vertically inside visible frame
            targetX = (distLeft <= distRight) ? minX : maxX
            targetY = min(max(currentFrame.origin.y, minY), maxY)
        } else {
            // Snap vertically to top or bottom edge; clamp horizontally inside visible frame
            targetY = (distBottom <= distTop) ? minY : maxY
            targetX = min(max(currentFrame.origin.x, minX), maxX)
        }

        return CGPoint(x: targetX, y: targetY)
    }

    /// Detects the nearest screen edge and gently snaps the panel maintaining a 16pt margin.
    /// Supports all 4 edges (Left, Right, Top, Bottom) and respects visibleFrame (Dock/Menu bar).
    public func snapToNearestEdge(margin: CGFloat = edgeMargin) {
        guard let panel = panel else { return }

        let currentFrame = panel.frame
        let center = CGPoint(x: currentFrame.midX, y: currentFrame.midY)
        let screen = NSScreen.screens.first(where: { $0.frame.contains(center) })
                     ?? panel.screen
                     ?? NSScreen.main
                     ?? NSScreen.screens.first

        guard let targetScreen = screen else { return }
        let visibleFrame = targetScreen.visibleFrame

        let targetOrigin = Self.calculateSnappedOrigin(for: currentFrame, in: visibleFrame, margin: margin)

        // Animate gently if moved
        if hypot(targetOrigin.x - currentFrame.origin.x, targetOrigin.y - currentFrame.origin.y) > 1.0 {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.20
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                panel.animator().setFrameOrigin(targetOrigin)
            }
        }

        saveCurrentOrigin()
    }

    /// Programmatically moves the panel by a delta (used for dragging and tests).
    public func movePanel(by delta: CGSize) {
        guard let panel = panel else { return }
        let origin = panel.frame.origin
        panel.setFrameOrigin(CGPoint(x: origin.x + delta.width, y: origin.y + delta.height))
    }

    /// Sets the panel origin directly.
    public func setPanelOrigin(_ origin: CGPoint) {
        guard let panel = panel else { return }
        panel.setFrameOrigin(origin)
    }

    // =========================================================================
    // Multi-Display & Bounds Clamping
    // =========================================================================

    public func loadSavedOrigin() -> CGPoint {
        let x = UserDefaults.standard.double(forKey: originXKey)
        let y = UserDefaults.standard.double(forKey: originYKey)

        if x > 0 && y > 0 {
            let candidate = CGPoint(x: x, y: y)
            return validateOrigin(candidate, size: collapsedSize)
        }

        // Default: Bottom-Right of Main Screen with 16pt margin (per requirements)
        if let screen = NSScreen.main ?? NSScreen.screens.first {
            let screenFrame = screen.visibleFrame
            let defaultX = screenFrame.maxX - collapsedSize.width - Self.edgeMargin
            let defaultY = screenFrame.minY + Self.edgeMargin
            return CGPoint(x: defaultX, y: defaultY)
        }

        return CGPoint(x: 200, y: 100)
    }

    public func saveCurrentOrigin() {
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

    public func validateOrigin(_ origin: CGPoint, size: CGSize, margin: CGFloat = edgeMargin) -> CGPoint {
        let targetRect = NSRect(origin: origin, size: size)

        // Find which screen intersects the panel
        for screen in NSScreen.screens {
            if screen.visibleFrame.intersects(targetRect) {
                let screenFrame = screen.visibleFrame
                let clampedX = min(max(origin.x, screenFrame.minX + margin), screenFrame.maxX - size.width - margin)
                let clampedY = min(max(origin.y, screenFrame.minY + margin), screenFrame.maxY - size.height - margin)
                return CGPoint(x: clampedX, y: clampedY)
            }
        }

        // Fallback: If monitor was unplugged, reposition to main screen bottom-right
        if let mainScreen = NSScreen.main ?? NSScreen.screens.first {
            let screenFrame = mainScreen.visibleFrame
            let x = screenFrame.maxX - size.width - margin
            let y = screenFrame.minY + margin
            return CGPoint(x: x, y: y)
        }

        return origin
    }
}
