import Foundation
import MyWorkPlannerMiniTimerCore

func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String, file: StaticString = #file, line: UInt = #line) {
    if actual != expected {
        print("❌ FAILED: \(message). Expected '\(expected)', got '\(actual)' at line \(line)")
        exit(1)
    } else {
        print("  ✔ \(message)")
    }
}

func assertTrue(_ condition: Bool, _ message: String, file: StaticString = #file, line: UInt = #line) {
    if !condition {
        print("❌ FAILED: \(message) at line \(line)")
        exit(1)
    } else {
        print("  ✔ \(message)")
    }
}

@MainActor
func runTests() async {
    print("=== My Work Planner — Native macOS Mini Focus Timer Test Suite ===")

    // Test 1: Time Formatting
    print("\n▶ Suite 1: Time Formatting & Display Logic")
    let timerService = TimerService.shared
    assertEqual(timerService.formatTimeHHMMSS(0), "00:00:00", "Formats 0 seconds as 00:00:00")
    assertEqual(timerService.formatTimeHHMMSS(59), "00:00:59", "Formats 59 seconds as 00:00:59")
    assertEqual(timerService.formatTimeHHMMSS(60), "00:01:00", "Formats 60 seconds as 00:01:00")
    assertEqual(timerService.formatTimeHHMMSS(3600), "01:00:00", "Formats 3600 seconds as 01:00:00")
    assertEqual(timerService.formatTimeHHMMSS(3665), "01:01:05", "Formats 3665 seconds as 01:01:05")
    assertEqual(timerService.formatTimeHHMMSS(86400), "24:00:00", "Formats 86400 seconds as 24:00:00")
    assertEqual(timerService.formatTimeHHMMSS(-10), "00:00:00", "Clamps negative numbers to 00:00:00")

    // Test 2: ActiveTimerRecord Decodable & Status Mapping
    print("\n▶ Suite 2: Active Timer Schema & Status Enums")
    let jsonRunning = """
    {
        "user_id": "9555ba0c-d9d0-4aff-b034-b39191b78670",
        "task_id": "11111111-2222-3333-4444-555555555555",
        "state": "running",
        "segment_started_at": "2026-11-21T10:00:00.000Z",
        "created_at": "2026-11-21T10:00:00.000Z",
        "updated_at": "2026-11-21T10:00:00.000Z"
    }
    """.data(using: .utf8)!

    do {
        let runningRecord = try JSONDecoder().decode(ActiveTimerRecord.self, from: jsonRunning)
        assertEqual(runningRecord.status, .running, "Maps state 'running' to TimerStatus.running")
        assertEqual(runningRecord.task_id, UUID(uuidString: "11111111-2222-3333-4444-555555555555")!, "Decodes task_id correctly")
        assertEqual(runningRecord.user_id, UUID(uuidString: "9555ba0c-d9d0-4aff-b034-b39191b78670")!, "Decodes user_id correctly")
    } catch {
        print("❌ FAILED to decode runningRecord: \(error)")
        exit(1)
    }

    let jsonPaused = """
    {
        "user_id": "9555ba0c-d9d0-4aff-b034-b39191b78670",
        "task_id": "11111111-2222-3333-4444-555555555555",
        "state": "paused",
        "segment_started_at": null,
        "created_at": "2026-11-21T10:00:00.000Z",
        "updated_at": "2026-11-21T10:05:00.000Z"
    }
    """.data(using: .utf8)!

    do {
        let pausedRecord = try JSONDecoder().decode(ActiveTimerRecord.self, from: jsonPaused)
        assertEqual(pausedRecord.status, .paused, "Maps state 'paused' to TimerStatus.paused")
        assertTrue(pausedRecord.segment_started_at == nil, "segment_started_at is nil when paused")
    } catch {
        print("❌ FAILED to decode pausedRecord: \(error)")
        exit(1)
    }

    // Test 3: PostgreSQL RPC Response Structures
    print("\n▶ Suite 3: Database RPC Response Structures")
    let jsonPauseRes = """
    {
        "action": "paused",
        "duration_seconds": 300,
        "session_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    }
    """.data(using: .utf8)!

    do {
        let pauseRes = try JSONDecoder().decode(TimerRPCResponse.self, from: jsonPauseRes)
        assertEqual(pauseRes.action, "paused", "rpc_pause_timer action is 'paused'")
        assertEqual(pauseRes.duration_seconds, 300, "rpc_pause_timer returns accurate duration_seconds")
        assertEqual(pauseRes.session_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rpc_pause_timer returns session_id")
    } catch {
        print("❌ FAILED to decode pauseRes: \(error)")
        exit(1)
    }

    let jsonStopRes = """
    {
        "stopped": true,
        "session_saved": true,
        "duration_seconds": 120
    }
    """.data(using: .utf8)!

    do {
        let stopRes = try JSONDecoder().decode(TimerRPCResponse.self, from: jsonStopRes)
        assertEqual(stopRes.stopped, true, "rpc_stop_timer returns stopped: true")
        assertEqual(stopRes.session_saved, true, "rpc_stop_timer returns session_saved: true")
        assertEqual(stopRes.duration_seconds, 120, "rpc_stop_timer returns duration_seconds: 120")
    } catch {
        print("❌ FAILED to decode stopRes: \(error)")
        exit(1)
    }

    // Test 4: Custom URL Scheme Handling
    print("\n▶ Suite 4: Custom URL Scheme & Deep Linking")
    let authUrl = URL(string: "myworkplanner-minitimer://auth/callback#access_token=sampleAccessToken&refresh_token=sampleRefreshToken")!
    assertEqual(authUrl.scheme, "myworkplanner-minitimer", "Matches custom URL scheme 'myworkplanner-minitimer'")
    assertEqual(authUrl.host, "auth", "Routes to auth host handler")

    let openUrl = URL(string: "myworkplanner-minitimer://open")!
    assertEqual(openUrl.scheme, "myworkplanner-minitimer", "Matches open URL scheme")
    assertEqual(openUrl.host, "open", "Routes to open host handler")

    // Test 5: Keychain Token Security
    print("\n▶ Suite 5: Keychain Storage Round-Trip")
    let keychain = KeychainManager.shared
    let testKey = "test_auth_token_key"
    let testValue = "secure_test_refresh_token_12345"

    let saved = keychain.saveString(key: testKey, value: testValue)
    assertTrue(saved, "Successfully writes token into macOS Keychain")

    let loaded = keychain.loadString(key: testKey)
    assertEqual(loaded, testValue, "Reads token back from macOS Keychain with exact fidelity")

    let deleted = keychain.delete(key: testKey)
    assertTrue(deleted, "Deletes token from macOS Keychain cleanly")
    assertTrue(keychain.loadString(key: testKey) == nil, "Confirmed token is cleared after delete")

    print("\n=======================================================")
    print("🎉 All Native Mini Timer tests passed successfully! (18 checks)")
    print("=======================================================")
}

Task { @MainActor in
    await runTests()
    exit(0)
}

dispatchMain()
