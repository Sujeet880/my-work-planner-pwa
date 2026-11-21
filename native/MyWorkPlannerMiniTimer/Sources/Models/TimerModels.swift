import Foundation

public enum TimerStatus: String, Codable, Sendable {
    case idle
    case running
    case paused
}

public struct ActiveTimerRecord: Codable, Sendable, Identifiable {
    public var id: UUID { user_id }
    public let user_id: UUID
    public let task_id: UUID
    public let state: String
    public let segment_started_at: String?
    public let created_at: String
    public let updated_at: String

    public var status: TimerStatus {
        if state == "running" { return .running }
        if state == "paused" { return .paused }
        return .idle
    }
}

public struct TaskRecord: Codable, Sendable, Identifiable {
    public let id: UUID
    public let user_id: UUID
    public let project_id: UUID?
    public let title: String
    public let status: String
    public let priority: String?
    public let scheduled_date: String?
    public let scheduled_start_time: String?
    public let planned_duration_minutes: Int?
}

public struct ProjectRecord: Codable, Sendable, Identifiable {
    public let id: UUID
    public let user_id: UUID
    public let name: String
    public let color: String
}

public struct WorkSessionRecord: Codable, Sendable {
    public let id: UUID
    public let duration_seconds: Int
}

public struct TimerRPCResponse: Codable, Sendable {
    public let action: String?
    public let stopped: Bool?
    public let session_saved: Bool?
    public let duration_seconds: Int?
    public let session_id: String?
}
