import SwiftUI
import AppKit

/// An AppKit NSViewRepresentable that initiates native macOS window dragging
/// via Apple's standard `window.performDrag(with: event)` API.
public struct NativeDragView: NSViewRepresentable {
    public init() {}

    public func makeNSView(context: Context) -> DragNSView {
        DragNSView()
    }

    public func updateNSView(_ nsView: DragNSView, context: Context) {}
}

public final class DragNSView: NSView {
    public override var mouseDownCanMoveWindow: Bool {
        return true
    }

    public override func mouseDown(with event: NSEvent) {
        guard let window = self.window else {
            super.mouseDown(with: event)
            return
        }
        window.performDrag(with: event)
    }
}

/// Subtle native visual drag grip handle for the floating timer chip
public struct DragHandleView: View {
    public init() {}

    public var body: some View {
        HStack(spacing: 2) {
            Capsule()
                .fill(Color.secondary.opacity(0.38))
                .frame(width: 2.5, height: 12)
            Capsule()
                .fill(Color.secondary.opacity(0.38))
                .frame(width: 2.5, height: 12)
        }
        .contentShape(Rectangle())
        .help("Drag to reposition timer")
    }
}

public struct FloatingTimerChipView: View {
    @ObservedObject private var timerService = TimerService.shared
    @ObservedObject private var supabase = SupabaseManager.shared
    @ObservedObject private var panelManager = FloatingPanelManager.shared

    public init() {}

    public var body: some View {
        ZStack {
            // Layer 1: Native Window Dragging Layer across the entire chip background
            NativeDragView()

            // Layer 2: Chip Content Views
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
        .background(
            RoundedRectangle(cornerRadius: panelManager.isExpanded ? 16 : 22, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: panelManager.isExpanded ? 16 : 22, style: .continuous)
                        .stroke(Color.white.opacity(0.20), lineWidth: 0.8)
                )
                .shadow(color: Color.black.opacity(0.16), radius: 10, x: 0, y: 4)
        )
        .frame(
            width: panelManager.isExpanded ? panelManager.expandedSize.width : panelManager.collapsedSize.width,
            height: panelManager.isExpanded ? panelManager.expandedSize.height : panelManager.collapsedSize.height
        )
    }

    // =========================================================================
    // 1. Compact Pill View (~192 x 44) — Single Horizontal Row (Non-Wrapping)
    // =========================================================================

    private var collapsedPillView: some View {
        HStack(spacing: 5) {
            // A. Dedicated Drag Handle Grip
            DragHandleView()
                .padding(.leading, 6)

            // B. Small Status Dot (non-interactive)
            Circle()
                .fill(timerService.timerStatus == .running ? Color(red: 34/255, green: 197/255, blue: 94/255) : Color(red: 249/255, green: 115/255, blue: 22/255))
                .frame(width: 7, height: 7)
                .allowsHitTesting(false)

            // C. Adaptive Monospaced Elapsed Time (Highest Layout Priority, strictly non-wrapping)
            Text(timerService.formatAdaptiveTime(timerService.liveTotalSeconds))
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .monospacedDigit()
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .minimumScaleFactor(0.85)
                .layoutPriority(1)
                .foregroundColor(.primary)
                .allowsHitTesting(false)

            // D. Task Title (Secondary Layout Priority, cleanly truncating with ellipsis)
            Text(timerService.currentTask?.title ?? "Focus")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
                .layoutPriority(0)
                .allowsHitTesting(false)

            Spacer(minLength: 4)
                .allowsHitTesting(false)

            // E. Pause / Resume Quick Action Button (interactive)
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
                    .font(.system(size: 8, weight: .bold))
                    .frame(width: 22, height: 22)
                    .foregroundColor(.primary)
                    .background(Color.primary.opacity(0.08))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(timerService.isMutating)
            .help(timerService.timerStatus == .running ? "Pause timer" : "Resume timer")

            // F. Expand Control Button (interactive)
            Button {
                panelManager.setExpanded(true)
            } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .frame(width: 18, height: 22)
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .padding(.trailing, 6)
            .help("Expand timer")
        }
    }

    // =========================================================================
    // 2. Expanded Card View (~268 x 104)
    // =========================================================================

    private var expandedCardView: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header Row: Drag Handle, Status Indicator & Collapse Action
            HStack {
                DragHandleView()

                HStack(spacing: 5) {
                    Circle()
                        .fill(timerService.timerStatus == .running ? Color(red: 34/255, green: 197/255, blue: 94/255) : Color(red: 249/255, green: 115/255, blue: 22/255))
                        .frame(width: 6, height: 6)

                    Text(timerService.timerStatus == .running ? "Running" : "Paused")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(timerService.timerStatus == .running ? Color(red: 22/255, green: 132/255, blue: 91/255) : Color(red: 234/255, green: 88/255, blue: 12/255))
                }
                .allowsHitTesting(false)

                Spacer()
                    .allowsHitTesting(false)

                Button {
                    panelManager.setExpanded(false)
                } label: {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 9, weight: .semibold))
                        .frame(width: 20, height: 20)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .help("Collapse to compact chip")
            }

            // Middle Row: Full Task Title (Secondary Layout Priority, truncating)
            Text(timerService.currentTask?.title ?? "Focus Task")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .layoutPriority(0)
                .allowsHitTesting(false)

            // Bottom Row: Large Monospaced Time & Action Controls
            HStack(alignment: .center) {
                Text(timerService.formatAdaptiveTime(timerService.liveTotalSeconds))
                    .font(.system(size: 20, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(1)
                    .foregroundColor(Color.accentColor)
                    .allowsHitTesting(false)

                Spacer()
                    .allowsHitTesting(false)

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
                        HStack(spacing: 4) {
                            Image(systemName: timerService.timerStatus == .running ? "pause.fill" : "play.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text(timerService.timerStatus == .running ? "Pause" : "Resume")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.primary.opacity(0.08))
                        .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                    .disabled(timerService.isMutating)

                    // Stop Timer Button
                    Button {
                        Task { await timerService.stopTimer() }
                    } label: {
                        Image(systemName: "square.fill")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.red)
                            .padding(6)
                            .background(Color.red.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(timerService.isMutating)
                    .help("Stop timer and save work session")
                }
            }
        }
        .padding(10)
    }

    // =========================================================================
    // 3. Idle View (Authenticated, No Active Timer) (~192 x 44)
    // =========================================================================

    private var idleTimerView: some View {
        HStack(spacing: 7) {
            DragHandleView()
                .padding(.leading, 6)

            Image(systemName: "timer")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color.accentColor)
                .allowsHitTesting(false)

            Text("Ready · \(supabase.userName ?? "Planner")")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
                .allowsHitTesting(false)

            Spacer(minLength: 2)
                .allowsHitTesting(false)

            Button {
                panelManager.hidePanel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 8, weight: .bold))
                    .frame(width: 18, height: 18)
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .padding(.trailing, 6)
            .help("Hide mini timer (Cmd+H)")
        }
    }

    // =========================================================================
    // 4. Unauthenticated View (~192 x 44)
    // =========================================================================

    private var unauthenticatedView: some View {
        HStack(spacing: 6) {
            DragHandleView()
                .padding(.leading, 6)

            Image(systemName: "link.circle.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color.accentColor)
                .allowsHitTesting(false)

            Text("Not linked")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)
                .allowsHitTesting(false)

            Spacer(minLength: 2)
                .allowsHitTesting(false)

            Button("Connect") {
                supabase.openConnectPage()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.mini)
            .font(.system(size: 10, weight: .semibold))
            .padding(.trailing, 6)
        }
    }
}
