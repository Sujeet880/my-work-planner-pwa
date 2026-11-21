import SwiftUI

public struct FloatingTimerChipView: View {
    @ObservedObject private var timerService = TimerService.shared
    @ObservedObject private var supabase = SupabaseManager.shared
    @ObservedObject private var panelManager = FloatingPanelManager.shared

    public init() {}

    public var body: some View {
        ZStack {
            if !supabase.isAuthenticated {
                unauthenticatedView
            } else if timerService.timerStatus == .idle {
                idleTimerView
            } else if panelManager.isExpanded {
                expandedCardView
            } else {
                collapsedPillView
            }
        }
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: panelManager.isExpanded ? 20 : 28, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: panelManager.isExpanded ? 20 : 28, style: .continuous)
                        .stroke(Color.white.opacity(0.22), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.18), radius: 12, x: 0, y: 6)
        )
    }

    // =========================================================================
    // Collapsed Pill View (~320 x 58)
    // =========================================================================

    private var collapsedPillView: some View {
        HStack(spacing: 10) {
            // Left: Status Dot & Timer Icon
            ZStack(alignment: .bottomTrailing) {
                Image(systemName: "timer")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color.accentColor)
                    .frame(width: 32, height: 32)
                    .background(Color.accentColor.opacity(0.12))
                    .clipShape(Circle())

                Circle()
                    .fill(timerService.timerStatus == .running ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
            }

            // Center: Task Title & Live Time
            VStack(alignment: .leading, spacing: 2) {
                Text(timerService.currentTask?.title ?? "Focus Task")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: 130, alignment: .leading)

                Text(timerService.formatTimeHHMMSS(timerService.liveTotalSeconds))
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(timerService.timerStatus == .running ? Color.accentColor : Color.secondary)
            }

            Spacer(minLength: 4)

            // Right: Quick Controls
            HStack(spacing: 6) {
                // Pause / Resume Button
                Button {
                    Task {
                        if timerService.timerStatus == .running {
                            await timerService.pauseTimer()
                        } else {
                            await timerService.resumeTimer()
                        }
                    }
                } label: {
                    Image(systemName: timerService.timerStatus == .running ? "pause.fill" : "play.fill")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 28, height: 28)
                        .foregroundColor(.primary)
                        .background(Color.primary.opacity(0.08))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(timerService.isMutating)

                // Compact Stop Action
                Button {
                    Task { await timerService.stopTimer() }
                } label: {
                    Image(systemName: "square.fill")
                        .font(.system(size: 9, weight: .bold))
                        .frame(width: 26, height: 26)
                        .foregroundColor(.secondary)
                        .background(Color.primary.opacity(0.05))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(timerService.isMutating)

                // Expand Chevron
                Button {
                    panelManager.setExpanded(true)
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .frame(width: 22, height: 22)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
    }

    // =========================================================================
    // Expanded Card View (~340 x 165)
    // =========================================================================

    private var expandedCardView: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header Row: Task Name & Collapse Button
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(timerService.currentTask?.title ?? "Focus Task")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.primary)
                        .lineLimit(2)

                    if let project = timerService.currentProject {
                        HStack(spacing: 5) {
                            Circle()
                                .fill(Color(hex: project.color))
                                .frame(width: 6, height: 6)
                            Text(project.name)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()

                Button {
                    panelManager.setExpanded(false)
                } label: {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 11, weight: .semibold))
                        .frame(width: 24, height: 24)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }

            Divider().opacity(0.4)

            // Metrics Row: Large Timer & Saved Time
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(timerService.formatTimeHHMMSS(timerService.liveTotalSeconds))
                        .font(.system(size: 24, weight: .bold, design: .monospaced))
                        .foregroundColor(timerService.timerStatus == .running ? Color.accentColor : Color.secondary)

                    HStack(spacing: 8) {
                        Text("Saved: \(timerService.formatTimeHHMMSS(timerService.savedSeconds))")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundColor(.secondary)

                        Text(timerService.timerStatus == .running ? "● Running" : "⏸ Paused")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(timerService.timerStatus == .running ? .green : .orange)
                    }
                }

                Spacer()
            }

            // Actions Row
            HStack(spacing: 8) {
                Button {
                    Task {
                        if timerService.timerStatus == .running {
                            await timerService.pauseTimer()
                        } else {
                            await timerService.resumeTimer()
                        }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: timerService.timerStatus == .running ? "pause.fill" : "play.fill")
                        Text(timerService.timerStatus == .running ? "Pause" : "Resume")
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                .disabled(timerService.isMutating)

                Button {
                    Task {
                        await timerService.stopTimer()
                        panelManager.setExpanded(false)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "stop.fill")
                        Text("Stop")
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.red.opacity(0.12))
                    .foregroundColor(.red)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                .disabled(timerService.isMutating)

                // Open in Web App
                Button {
                    if let taskId = timerService.currentTask?.id {
                        NSWorkspace.shared.open(URL(string: "http://localhost:3000/tasks/\(taskId.uuidString)")!)
                    } else {
                        NSWorkspace.shared.open(URL(string: "http://localhost:3000")!)
                    }
                } label: {
                    Image(systemName: "arrow.up.forward.app")
                        .font(.system(size: 11, weight: .semibold))
                        .padding(6)
                        .background(Color.primary.opacity(0.06))
                        .foregroundColor(.primary)
                        .cornerRadius(8)
                }
                .buttonStyle(.plain)
                .help("Open in My Work Planner")
            }
        }
        .padding(12)
    }

    // =========================================================================
    // Idle & Unauthenticated Placeholders
    // =========================================================================

    private var idleTimerView: some View {
        HStack(spacing: 8) {
            Image(systemName: "timer")
                .foregroundColor(.secondary)
            Text("No active timer. Start a task in My Work Planner.")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)
            Spacer()
            Button {
                panelManager.hidePanel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var unauthenticatedView: some View {
        HStack(spacing: 8) {
            Image(systemName: "lock.fill")
                .foregroundColor(.orange)
            Text("Sign in required to link timer")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.primary)
            Spacer()
            Button("Sign In") {
                SignInWindowController.shared.show()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

// Color hex helper
extension Color {
    init(hex: String) {
        let cleanHex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleanHex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch cleanHex.count {
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 73, 104, 214) // Default MWP Indigo
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
