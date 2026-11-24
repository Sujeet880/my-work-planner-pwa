import Foundation
import Combine
import Supabase

@MainActor
public final class TimerService: ObservableObject {
    public static let shared = TimerService()

    private let supabase = SupabaseManager.shared
    private var cancellables = Set<AnyCancellable>()
    private var tickerTimer: AnyCancellable?
    private var pollTimer: AnyCancellable?

    @Published public var activeTimer: ActiveTimerRecord?
    @Published public var currentTask: TaskRecord?
    @Published public var currentProject: ProjectRecord?
    @Published public var savedSeconds: Int = 0
    @Published public var activeElapsedSeconds: Int = 0
    @Published public var liveTotalSeconds: Int = 0
    @Published public var timerStatus: TimerStatus = .idle
    @Published public var isMutating: Bool = false
    @Published public var errorMessage: String? = nil

    private init() {
        setupSubscriptions()
        startTimers()
    }

    private func setupSubscriptions() {
        supabase.$isAuthenticated
            .sink { [weak self] isAuth in
                guard let self = self else { return }
                if isAuth {
                    Task { await self.refreshActiveTimer() }
                } else {
                    self.resetState()
                }
            }
            .store(in: &cancellables)
    }

    private func startTimers() {
        // 1. Local 1-second UI display counter (does NOT query database)
        tickerTimer = Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.tickLocalTimer()
            }

        // 2. 10-second background reconciliation polling with remote Supabase
        pollTimer = Timer.publish(every: 10.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self, self.supabase.isAuthenticated, !self.isMutating else { return }
                Task { await self.refreshActiveTimer() }
            }
    }

    private func tickLocalTimer() {
        guard timerStatus == .running,
              let startedStr = activeTimer?.segment_started_at,
              let startDate = parseIsoDate(startedStr) else {
            return
        }

        let elapsed = max(0, Int(Date().timeIntervalSince(startDate)))
        self.activeElapsedSeconds = elapsed
        self.liveTotalSeconds = self.savedSeconds + elapsed
    }

    public func refreshActiveTimer() async {
        guard supabase.isAuthenticated else { return }

        do {
            // 1. Fetch active timer
            let timers: [ActiveTimerRecord] = try await supabase.client
                .from("active_timers")
                .select()
                .execute()
                .value

            guard let active = timers.first else {
                if self.activeTimer != nil {
                    self.resetState()
                }
                return
            }

            self.activeTimer = active
            self.timerStatus = active.status

            // 2. Fetch associated task, project, and session details only when task changes
            if self.currentTask?.id != active.task_id {
                let task: TaskRecord = try await supabase.client
                    .from("tasks")
                    .select()
                    .eq("id", value: active.task_id)
                    .single()
                    .execute()
                    .value

                self.currentTask = task

                if let projectId = task.project_id {
                    let project: ProjectRecord? = try? await supabase.client
                        .from("projects")
                        .select()
                        .eq("id", value: projectId)
                        .single()
                        .execute()
                        .value
                    self.currentProject = project
                } else {
                    self.currentProject = nil
                }

                let sessions: [WorkSessionRecord] = (try? await supabase.client
                    .from("work_sessions")
                    .select("id, duration_seconds")
                    .eq("task_id", value: task.id)
                    .execute()
                    .value) ?? []

                let totalSaved = sessions.reduce(0) { $0 + $1.duration_seconds }
                self.savedSeconds = totalSaved
            }

            // 3. Compute live elapsed seconds
            if active.status == .running,
               let startedStr = active.segment_started_at,
               let startDate = parseIsoDate(startedStr) {
                let elapsed = max(0, Int(Date().timeIntervalSince(startDate)))
                self.activeElapsedSeconds = elapsed
                self.liveTotalSeconds = self.savedSeconds + elapsed
            } else {
                self.activeElapsedSeconds = 0
                self.liveTotalSeconds = self.savedSeconds
            }

            self.errorMessage = nil
        } catch {
            // Keep existing state during transient network drops
        }
    }

    // =========================================================================
    // Atomic RPC Actions (Single Source of Truth)
    // =========================================================================

    public func pauseTimer() async {
        guard !isMutating else { return }
        isMutating = true
        errorMessage = nil

        do {
            let res: TimerRPCResponse = try await supabase.client
                .rpc("rpc_pause_timer")
                .execute()
                .value

            if let duration = res.duration_seconds {
                self.savedSeconds += duration
            }
            self.timerStatus = .paused
            self.activeElapsedSeconds = 0
            self.liveTotalSeconds = self.savedSeconds

            await refreshActiveTimer()
        } catch {
            self.errorMessage = "Failed to pause: \(error.localizedDescription)"
        }

        isMutating = false
    }

    public func resumeTimer() async {
        guard !isMutating else { return }
        isMutating = true
        errorMessage = nil

        do {
            let _: TimerRPCResponse = try await supabase.client
                .rpc("rpc_resume_timer")
                .execute()
                .value

            self.timerStatus = .running
            await refreshActiveTimer()
        } catch {
            self.errorMessage = "Failed to resume: \(error.localizedDescription)"
        }

        isMutating = false
    }

    public func stopTimer() async {
        guard !isMutating else { return }
        isMutating = true
        errorMessage = nil

        do {
            let _: TimerRPCResponse = try await supabase.client
                .rpc("rpc_stop_timer")
                .execute()
                .value

            self.resetState()
        } catch {
            self.errorMessage = "Failed to stop: \(error.localizedDescription)"
        }

        isMutating = false
    }

    private func resetState() {
        self.activeTimer = nil
        self.currentTask = nil
        self.currentProject = nil
        self.savedSeconds = 0
        self.activeElapsedSeconds = 0
        self.liveTotalSeconds = 0
        self.timerStatus = .idle
    }

    private func parseIsoDate(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = formatter.date(from: string) { return d }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }

    public func formatTimeHHMMSS(_ totalSeconds: Int) -> String {
        let s = max(0, totalSeconds)
        let hours = s / 3600
        let minutes = (s % 3600) / 60
        let seconds = s % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    /// Adaptive time formatting for compact displays:
    /// - Less than one hour: "34:59" (no leading 00: hours)
    /// - One hour or more (<10h): "1:05:09" (single-digit hour)
    /// - Multiple hours (>=10h): "12:45:09" (double-digit hour)
    /// - Negative values clamped to "00:00"
    public func formatAdaptiveTime(_ totalSeconds: Int) -> String {
        let s = max(0, totalSeconds)
        let hours = s / 3600
        let minutes = (s % 3600) / 60
        let seconds = s % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }
}
