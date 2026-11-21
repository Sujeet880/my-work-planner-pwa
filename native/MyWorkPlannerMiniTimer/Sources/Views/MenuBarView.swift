import SwiftUI
import AppKit

public struct MenuBarView: View {
    @ObservedObject private var timerService = TimerService.shared
    @ObservedObject private var supabase = SupabaseManager.shared
    @ObservedObject private var panelManager = FloatingPanelManager.shared

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 1. Current Active Task Summary Header
            VStack(alignment: .leading, spacing: 3) {
                if timerService.timerStatus != .idle, let task = timerService.currentTask {
                    HStack {
                        Circle()
                            .fill(timerService.timerStatus == .running ? Color.green : Color.orange)
                            .frame(width: 8, height: 8)

                        Text(task.title)
                            .font(.system(size: 13, weight: .bold))
                            .lineLimit(1)
                    }

                    Text(timerService.formatTimeHHMMSS(timerService.liveTotalSeconds))
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundColor(Color.accentColor)
                } else {
                    Text("My Work Planner")
                        .font(.system(size: 13, weight: .bold))

                    Text(supabase.isAuthenticated ? "No timer running" : "Not signed in")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }
            .padding(12)

            Divider()

            // 2. Primary Actions
            Group {
                Button {
                    panelManager.toggleVisibility()
                } label: {
                    Label(
                        panelManager.isPanelVisible ? "Hide Floating Mini Timer" : "Show Floating Mini Timer",
                        systemImage: panelManager.isPanelVisible ? "eye.slash" : "eye"
                    )
                }
                .keyboardShortcut("m", modifiers: [.command, .shift])

                if timerService.timerStatus == .running {
                    Button {
                        Task { await timerService.pauseTimer() }
                    } label: {
                        Label("Pause Focus Timer", systemImage: "pause.fill")
                    }
                    .keyboardShortcut("p", modifiers: [.command, .shift])
                } else if timerService.timerStatus == .paused {
                    Button {
                        Task { await timerService.resumeTimer() }
                    } label: {
                        Label("Resume Focus Timer", systemImage: "play.fill")
                    }
                    .keyboardShortcut("p", modifiers: [.command, .shift])
                }

                if timerService.timerStatus != .idle {
                    Button {
                        Task { await timerService.stopTimer() }
                    } label: {
                        Label("Stop Timer (Save Session)", systemImage: "stop.fill")
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)

            Divider()

            // 3. Navigation & Account
            Group {
                Button {
                    NSWorkspace.shared.open(URL(string: "http://localhost:3000")!)
                } label: {
                    Label("Open Web App in Browser", systemImage: "globe")
                }

                if supabase.isAuthenticated {
                    Menu("Account: \(supabase.userEmail ?? "User")") {
                        Button("Sign Out of Mini Timer") {
                            Task {
                                await supabase.signOut()
                                panelManager.hidePanel()
                            }
                        }
                    }
                } else {
                    Button {
                        SignInWindowController.shared.show()
                    } label: {
                        Label("Sign In with Magic Link...", systemImage: "key.fill")
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)

            Divider()

            // 4. Quit
            Button {
                NSApp.terminate(nil)
            } label: {
                Label("Quit Mini Focus Timer", systemImage: "power")
            }
            .keyboardShortcut("q")
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
        .frame(width: 260)
    }
}
