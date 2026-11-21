import SwiftUI
import AppKit

@MainActor
public final class SignInViewModel: ObservableObject {
    @Published public var email: String = ""
    @Published public var linkSent: Bool = false
    @Published public var statusMessage: String? = nil

    public init() {}
}

public struct SignInView: View {
    @ObservedObject private var supabase = SupabaseManager.shared
    @StateObject private var vm = SignInViewModel()

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            // Icon & Header
            VStack(spacing: 6) {
                Image(systemName: "timer.circle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Color.accentColor)

                Text("Sign In to My Work Planner")
                    .font(.headline)
                    .fontWeight(.bold)

                Text("Enter the email address of your existing workspace account. We'll send you an instant Magic Link.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
            }

            // Input Form
            if !vm.linkSent {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Enter your email...", text: $vm.email)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 13))
                        .disabled(supabase.isAuthenticating)

                    if let err = supabase.authError ?? vm.statusMessage {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    Button {
                        Task {
                            vm.statusMessage = nil
                            let res = await supabase.sendMagicLink(email: vm.email)
                            switch res {
                            case .success:
                                vm.linkSent = true
                            case .failure(let err):
                                vm.statusMessage = err.localizedDescription
                            }
                        }
                    } label: {
                        HStack {
                            if supabase.isAuthenticating {
                                ProgressView()
                                    .controlSize(.small)
                            }
                            Text(supabase.isAuthenticating ? "Sending Link..." : "Send Magic Link")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.email.trimmingCharacters(in: .whitespaces).isEmpty || supabase.isAuthenticating)
                }
                .padding(.horizontal, 20)
            } else {
                // Success confirmation state
                VStack(spacing: 10) {
                    Image(systemName: "envelope.badge.shield.half.filled")
                        .font(.system(size: 32))
                        .foregroundColor(.green)

                    Text("Magic Link Sent!")
                        .font(.subheadline)
                        .fontWeight(.bold)

                    Text("We've sent a sign-in link to \(vm.email). Click the link in your email to authenticate the Mini Timer.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)

                    Button("Use a different email") {
                        vm.linkSent = false
                    }
                    .buttonStyle(.link)
                    .font(.caption)
                }
                .padding(.horizontal, 20)
            }

            Divider()

            // Footer
            HStack {
                Button("Cancel") {
                    SignInWindowController.shared.close()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                Button("Open Web App") {
                    NSWorkspace.shared.open(URL(string: "http://localhost:3000")!)
                }
                .buttonStyle(.link)
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 20)
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
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 280),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        newWindow.title = "Sign In"
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
