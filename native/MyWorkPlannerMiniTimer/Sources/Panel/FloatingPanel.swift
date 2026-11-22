import AppKit
import SwiftUI

public final class FloatingPanel: NSPanel {
    public init(contentRect: NSRect) {
        super.init(
            contentRect: contentRect,
            styleMask: [
                .nonactivatingPanel,
                .titled,
                .fullSizeContentView,
                .utilityWindow
            ],
            backing: .buffered,
            defer: false
        )

        // Essential floating window configuration
        self.isFloatingPanel = true
        self.level = .floating
        self.hidesOnDeactivate = false
        self.becomesKeyOnlyIfNeeded = true
        self.isMovableByWindowBackground = true

        // Multi-Space, Stage Manager & Fullscreen Application Support
        // Using valid, mutually-compatible collection behaviors:
        self.collectionBehavior = [
            .canJoinAllSpaces,
            .canJoinAllApplications,
            .fullScreenAuxiliary,
            .ignoresCycle
        ]

        // Transparent Titlebar & Glass Styling
        self.titlebarAppearsTransparent = true
        self.titleVisibility = .hidden
        self.isOpaque = false
        self.backgroundColor = .clear
        self.hasShadow = true
    }

    public override var canBecomeKey: Bool {
        return false
    }

    public override var canBecomeMain: Bool {
        return false
    }
}
