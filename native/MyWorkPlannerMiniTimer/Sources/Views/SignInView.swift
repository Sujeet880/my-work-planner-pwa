import SwiftUI
import AppKit

public struct SignInView: View {
    @ObservedObject private var supabase = SupabaseManager.shared

    public init() {}

    public var body: some View {
        VStack(spacing: 18) {
            // Icon & Header
            VStack(spacing: 8) {
                Image(systemName: "timer.circle.fill")
                    .font(.system(size: 44))
                    .foregroundColor(Color.accentColor)

                Text("Connect Mini Focus Timer")
                    .font(.headline)
                    .fontWeight(.bold)

                Text("Authorize the native desktop companion app using your existing My Work Planner web session. No password re-entry required.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }

            if let error = supabase.authError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(.horizontal, 16)
            }

            VStack(spacing: 10) {
                Button {
                    supabase.openConnectPage()
                    SignInWindowController.shared.close()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "globe")
                        Text("Open Connect Page in Browser")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)

                Button("Cancel") {
                    SignInWindowController.shared.close()
                }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundColor(.secondary)
            }
            .padding(.horizontal, 24)
        }
        .padding(.vertical, 24)
        .frame(width: 360)
        .background(Color(NSColor.windowBackgroundColor))
    }
}

@MainActor
public final class SignInWindowController: NSObject {
    public static let shared = SignInWindowController()
    private var window: NSWindow?

    public func show() {
        if let existing = window {
            existing.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 240),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        newWindow.title = "Connect Mini Timer"
        newWindow.center()
        newWindow.isReleasedWhenClosed = false
        newWindow.contentView = NSHostingView(rootView: SignInView())

        self.window = newWindow
        newWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    public func close() {
        window?.close()
        window = nil
    }
}
