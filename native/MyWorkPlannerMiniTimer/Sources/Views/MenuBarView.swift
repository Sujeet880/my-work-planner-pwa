import SwiftUI
import AppKit

public struct MenuBarView: View {
    @ObservedObject private var timerService = TimerService.shared
    @ObservedObject private var supabase = SupabaseManager.shared
    @ObservedObject private var panelManager = FloatingPanelManager.shared

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 1. Header & Profile Section
            VStack(alignment: .leading, spacing: 3) {
                Text("My Work Planner")
                    .font(.system(size: 13, weight: .bold))

                if supabase.isAuthenticated {
                    Text(supabase.userName ?? "Sujit Kumar")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.primary)

                    HStack(spacing: 5) {
                        Circle()
                            .fill(Color(red: 16/255, green: 185/255, blue: 129/255)) // Emerald dot
                            .frame(width: 7, height: 7)

                        Text("Signed in (\(supabase.userEmail ?? ""))")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                } else {
                    Text("Not connected")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.secondary)
                }

                // If active focus timer is running or paused, show current task & clock
                if supabase.isAuthenticated && timerService.timerStatus != .idle, let task = timerService.currentTask {
                    Divider().padding(.vertical, 4)

                    HStack(spacing: 5) {
                        Circle()
                            .fill(timerService.timerStatus == .running ? Color.green : Color.orange)
                            .frame(width: 8, height: 8)

                        Text(task.title)
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                    }

                    Text(timerService.formatAdaptiveTime(timerService.liveTotalSeconds))
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundColor(Color.accentColor)
                }
            }
            .padding(12)

            Divider()

            // 2. Action Section
            Group {
                // Floating mini timer toggle
                Button {
                    panelManager.toggleVisibility()
                } label: {
                    Label(
                        panelManager.isPanelVisible ? "Hide Floating Mini Timer" : "Show Floating Mini Timer",
                        systemImage: panelManager.isPanelVisible ? "eye.slash" : "eye"
                    )
                }
                .keyboardShortcut("h", modifiers: [.command])

                // Always On Top Toggle
                Button {
                    panelManager.alwaysOnTop.toggle()
                } label: {
                    Label(
                        panelManager.alwaysOnTop ? "Always on Top: ON" : "Always on Top: OFF",
                        systemImage: panelManager.alwaysOnTop ? "pin.fill" : "pin.slash"
                    )
                }

                // Focus Timer Actions when connected
                if supabase.isAuthenticated {
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
                            Label("Stop Focus Timer", systemImage: "stop.fill")
                        }
                    }
                }

                // Web App link
                Button {
                    let webUrl = URL(string: "http://localhost:3001") ?? URL(string: "http://localhost:3000")!
                    NSWorkspace.shared.open(webUrl)
                } label: {
                    Label("Open Web App", systemImage: "globe")
                }

                // Account Connection / Disconnection
                if supabase.isAuthenticated {
                    Button {
                        Task {
                            await supabase.signOut()
                            panelManager.hidePanel()
                        }
                    } label: {
                        Label("Disconnect Account", systemImage: "link.badge.minus")
                    }
                } else {
                    Button {
                        supabase.openConnectPage()
                    } label: {
                        Label("Connect My Work Planner Account", systemImage: "link.badge.plus")
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)

            Divider()

            // 3. Quit
            Button {
                NSApp.terminate(nil)
            } label: {
                Label("Quit Mini Focus Timer", systemImage: "power")
            }
            .keyboardShortcut("q", modifiers: [.command])
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
        .frame(width: 270)
    }
}
