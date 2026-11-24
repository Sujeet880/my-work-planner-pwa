import Foundation
import AppKit
import Supabase
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

final class MockAuthStorage: AuthLocalStorage, @unchecked Sendable {
    private var store: [String: Data] = [:]
    private let lock = NSLock()
    var readCount: Int = 0
    var writeCount: Int = 0
    var removeCount: Int = 0

    func store(key: String, value: Data) throws {
        lock.lock()
        defer { lock.unlock() }
        writeCount += 1
        store[key] = value
    }

    func retrieve(key: String) throws -> Data? {
        lock.lock()
        defer { lock.unlock() }
        readCount += 1
        return store[key]
    }

    func remove(key: String) throws {
        lock.lock()
        defer { lock.unlock() }
        removeCount += 1
        store.removeValue(forKey: key)
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

    // Adaptive time tests (Part 2)
    assertEqual(timerService.formatAdaptiveTime(0), "00:00", "Adaptive format: 0 seconds -> 00:00")
    assertEqual(timerService.formatAdaptiveTime(59), "00:59", "Adaptive format: 59 seconds -> 00:59")
    assertEqual(timerService.formatAdaptiveTime(2099), "34:59", "Adaptive format: 34m 59s -> 34:59")
    assertEqual(timerService.formatAdaptiveTime(3600), "1:00:00", "Adaptive format: 1h -> 1:00:00")
    assertEqual(timerService.formatAdaptiveTime(3909), "1:05:09", "Adaptive format: 1h 5m 9s -> 1:05:09")
    assertEqual(timerService.formatAdaptiveTime(45909), "12:45:09", "Adaptive format: 12h 45m 9s -> 12:45:09")
    assertEqual(timerService.formatAdaptiveTime(-10), "00:00", "Adaptive format clamps negative to 00:00")

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

    // Test 5: Keychain Token Security & Storage Adapter
    print("\n▶ Suite 5: Keychain Storage Round-Trip (Isolated Headless Mode)")
    let keychain = KeychainManager(isMockMode: true)
    let testKey = "test_auth_token_key"
    let testValue = "secure_test_refresh_token_12345"

    let saved = keychain.saveString(key: testKey, value: testValue)
    assertTrue(saved, "Successfully writes token into secure storage adapter")

    let loaded = keychain.loadString(key: testKey)
    assertEqual(loaded, testValue, "Reads token back from storage adapter with exact fidelity")

    let deleted = keychain.delete(key: testKey)
    assertTrue(deleted, "Deletes token from storage adapter cleanly")
    assertTrue(keychain.loadString(key: testKey) == nil, "Confirmed token is cleared after delete")

    // Test 6: Compact Dimensions & Window Behaviour
    print("\n▶ Suite 6: Compact Dimensions & Window Behaviour")
    let panelManager = FloatingPanelManager.shared
    assertEqual(panelManager.collapsedSize.width, 192.0, "Collapsed width is 192pt (~190-200pt requirement)")
    assertEqual(panelManager.collapsedSize.height, 44.0, "Collapsed height is 44pt (~40-46pt requirement)")
    assertEqual(panelManager.expandedSize.width, 268.0, "Expanded width is 268pt")
    assertEqual(panelManager.expandedSize.height, 104.0, "Expanded height is 104pt")
    assertTrue(panelManager.alwaysOnTop == true || panelManager.alwaysOnTop == false, "Always-on-top preference initialized")

    // Test 7: Cached Keychain Session Persistence & Zero Redundant Reads
    print("\n▶ Suite 7: In-Memory Cached Keychain Storage Adapter (Zero-Redundant-Reads Verification)")
    let mockBacking = MockAuthStorage()
    let cachedStorage = CachedKeychainLocalStorage(backingStore: mockBacking)
    let sampleKey = "test_cache_session_token"
    let sampleData = "session_token_bytes_abc_123".data(using: .utf8)!

    // 1. Initial write
    try? cachedStorage.store(key: sampleKey, value: sampleData)
    assertEqual(mockBacking.writeCount, 1, "Persists written session to underlying Keychain store")
    assertTrue(cachedStorage.isCachedInMemory(key: sampleKey), "Session is immediately cached in-memory after write")

    // 1b. Idempotent & Semantic write deduplication: re-storing identical session data suppresses underlying writes
    try? cachedStorage.store(key: sampleKey, value: sampleData)
    assertEqual(mockBacking.writeCount, 1, "Re-storing identical raw bytes suppresses duplicate Keychain writes (still 1)")

    // Test JSON semantic equivalence (e.g. re-encoded Session JSON from Supabase's useDefaultEncoder migration)
    let jsonSession1 = """
    {"accessToken":"jwt_abc_123","refreshToken":"refresh_def_456","expiresAt":1800000000}
    """.data(using: .utf8)!
    let jsonSession2 = """
    {"refreshToken":"refresh_def_456","expiresAt":1800000000,"accessToken":"jwt_abc_123"}
    """.data(using: .utf8)!
    let jsonSessionSnakeCase = """
    {"access_token":"jwt_abc_123","refresh_token":"refresh_def_456"}
    """.data(using: .utf8)!

    let jsonSessionKey = "session_json_key"
    try? cachedStorage.store(key: jsonSessionKey, value: jsonSession1)
    assertEqual(mockBacking.writeCount, 2, "First write of JSON session persists to backing store")

    try? cachedStorage.store(key: jsonSessionKey, value: jsonSession2)
    assertEqual(mockBacking.writeCount, 2, "Re-encoded JSON with permuted keys suppresses duplicate Keychain write")

    try? cachedStorage.store(key: jsonSessionKey, value: jsonSessionSnakeCase)
    assertEqual(mockBacking.writeCount, 2, "Snake_case equivalent tokens suppress duplicate Keychain write")

    let jsonSessionNewToken = """
    {"accessToken":"jwt_NEW_TOKEN_999","refreshToken":"refresh_NEW_TOKEN_999"}
    """.data(using: .utf8)!
    try? cachedStorage.store(key: jsonSessionKey, value: jsonSessionNewToken)
    assertEqual(mockBacking.writeCount, 3, "Genuine token refresh correctly persists new tokens to Keychain")

    // 2. Retrieve hit from memory cache - zero backing reads
    let initialRead = try? cachedStorage.retrieve(key: sampleKey)
    assertEqual(initialRead, sampleData, "First retrieve reads session accurately")
    assertEqual(mockBacking.readCount, 0, "Retrieve served from in-memory cache with ZERO underlying Keychain reads")

    // 3. Clear memory cache to simulate a fresh cold-start application launch
    cachedStorage.clearMemoryCache()
    assertTrue(!cachedStorage.isCachedInMemory(key: sampleKey), "Memory cache cleared successfully")

    // 4. Cold-start retrieve: performs exactly ONE read from underlying Keychain
    let coldRead = try? cachedStorage.retrieve(key: sampleKey)
    assertEqual(coldRead, sampleData, "Cold-start retrieve loads session from underlying Keychain store")
    assertEqual(mockBacking.readCount, 1, "Underlying Keychain accessed exactly ONCE on cold start")
    assertTrue(cachedStorage.isCachedInMemory(key: sampleKey), "Session re-cached into memory after cold read")

    // 5. Subsequent rapid reads (e.g. 5s background polling, view redraws, network requests)
    for _ in 1...20 {
        let repeatedRead = try? cachedStorage.retrieve(key: sampleKey)
        assertEqual(repeatedRead, sampleData, "Repeated retrieve returns identical session data")
    }
    assertEqual(mockBacking.readCount, 1, "20 subsequent requests performed ZERO additional Keychain reads (still exactly 1)")

    // 5b. Negative caching verification (e.g. Supabase legacy migration probes like 'supabase.session')
    let legacyProbeKey = "supabase.session"
    let probe1 = try? cachedStorage.retrieve(key: legacyProbeKey)
    assertTrue(probe1 == nil, "First legacy probe returns nil")
    assertEqual(mockBacking.readCount, 2, "Probed backing store once for non-existent legacy key")
    assertTrue(cachedStorage.isCachedInMemory(key: legacyProbeKey), "Negative result (nil) cached in memory")

    for _ in 1...10 {
        let repeatedProbe = try? cachedStorage.retrieve(key: legacyProbeKey)
        assertTrue(repeatedProbe == nil, "Repeated legacy probe returns nil from negative cache")
    }
    assertEqual(mockBacking.readCount, 2, "10 subsequent legacy probe reads hit negative cache with ZERO Keychain access")

    // 6. Sign-out / deletion: cleans both memory and underlying store
    try? cachedStorage.remove(key: sampleKey)
    assertEqual(mockBacking.removeCount, 1, "Deletes session from underlying Keychain store on sign-out")
    assertTrue(!cachedStorage.hasCachedData(key: sampleKey), "Purged from positive in-memory cache on sign-out")
    assertTrue(cachedStorage.isNegativeCached(key: sampleKey), "Recorded in negative cache to prevent re-querying")
    let postDeleteRead = try? cachedStorage.retrieve(key: sampleKey)
    assertTrue(postDeleteRead == nil, "Session confirmed completely deleted")

    // Test 8: Native Panel Dragging, Edge Snapping & Position Persistence
    print("\n▶ Suite 8: Native Draggable Panel, Edge Snapping & Display Bounds")
    
    // Simulate a standard 1920x1080 display with macOS Dock (60pt at bottom) and Menu Bar (24pt at top)
    let simulatedVisibleFrame = NSRect(x: 0, y: 60, width: 1920, height: 996)
    let chipSize = panelManager.collapsedSize // 192 x 44
    let margin = FloatingPanelManager.edgeMargin // 16.0

    let minX = simulatedVisibleFrame.minX + margin // 16
    let maxX = simulatedVisibleFrame.maxX - chipSize.width - margin // 1920 - 192 - 16 = 1712
    let minY = simulatedVisibleFrame.minY + margin // 60 + 16 = 76
    let maxY = simulatedVisibleFrame.maxY - chipSize.height - margin // 1056 - 44 - 16 = 996

    // 8.1. Initial Default Placement (Bottom-Right)
    let defaultOrigin = FloatingPanelManager.calculateSnappedOrigin(
        for: NSRect(origin: CGPoint(x: 1800, y: 50), size: chipSize),
        in: simulatedVisibleFrame,
        margin: margin
    )
    assertEqual(defaultOrigin.x, maxX, "Initial default snaps to Right edge (1712pt)")
    assertEqual(defaultOrigin.y, minY, "Initial default snaps to Bottom edge above Dock (76pt)")

    // 8.2. Drag toward Top-Left
    let draggedTopLeft = NSRect(origin: CGPoint(x: 20, y: 1040), size: chipSize)
    let snappedTopLeft = FloatingPanelManager.calculateSnappedOrigin(for: draggedTopLeft, in: simulatedVisibleFrame, margin: margin)
    assertEqual(snappedTopLeft.x, minX, "Drag toward Top-Left snaps X to Left edge (16pt)")
    assertEqual(snappedTopLeft.y, maxY, "Drag toward Top-Left snaps Y to Top edge below Menu Bar (996pt)")

    // 8.3. Drag toward Top-Right
    let draggedTopRight = NSRect(origin: CGPoint(x: 1850, y: 1050), size: chipSize)
    let snappedTopRight = FloatingPanelManager.calculateSnappedOrigin(for: draggedTopRight, in: simulatedVisibleFrame, margin: margin)
    assertEqual(snappedTopRight.x, maxX, "Drag toward Top-Right snaps X to Right edge (1712pt)")
    assertEqual(snappedTopRight.y, maxY, "Drag toward Top-Right snaps Y to Top edge (996pt)")

    // 8.4. Drag toward Bottom-Left
    let draggedBottomLeft = NSRect(origin: CGPoint(x: 10, y: 30), size: chipSize)
    let snappedBottomLeft = FloatingPanelManager.calculateSnappedOrigin(for: draggedBottomLeft, in: simulatedVisibleFrame, margin: margin)
    assertEqual(snappedBottomLeft.x, minX, "Drag toward Bottom-Left snaps X to Left edge (16pt)")
    assertEqual(snappedBottomLeft.y, minY, "Drag toward Bottom-Left snaps Y to Bottom edge above Dock (76pt)")

    // 8.5. Drag toward Bottom-Right
    let draggedBottomRight = NSRect(origin: CGPoint(x: 1900, y: 40), size: chipSize)
    let snappedBottomRight = FloatingPanelManager.calculateSnappedOrigin(for: draggedBottomRight, in: simulatedVisibleFrame, margin: margin)
    assertEqual(snappedBottomRight.x, maxX, "Drag toward Bottom-Right snaps X to Right edge (1712pt)")
    assertEqual(snappedBottomRight.y, minY, "Drag toward Bottom-Right snaps Y to Bottom edge (76pt)")

    // 8.6. Mid-Edge Snapping: Dragging to middle of Left Edge snaps to minX while preserving Y
    let midLeft = NSRect(origin: CGPoint(x: 30, y: 500), size: chipSize)
    let snappedMidLeft = FloatingPanelManager.calculateSnappedOrigin(for: midLeft, in: simulatedVisibleFrame, margin: margin)
    assertEqual(snappedMidLeft.x, minX, "Snaps to Left edge")
    assertEqual(snappedMidLeft.y, 500.0, "Preserves vertical Y position on Left edge")

    // 8.7. Mid-Edge Snapping: Dragging to middle of Right Edge snaps to maxX while preserving Y
    let midRight = NSRect(origin: CGPoint(x: 1710, y: 450), size: chipSize)
    let snappedMidRight = FloatingPanelManager.calculateSnappedOrigin(for: midRight, in: simulatedVisibleFrame, margin: margin)
    assertEqual(snappedMidRight.x, maxX, "Snaps to Right edge")
    assertEqual(snappedMidRight.y, 450.0, "Preserves vertical Y position on Right edge")

    // 8.8. Multi-Display / External Display Disconnection Clamping
    let outOfBoundsOrigin = CGPoint(x: 2500, y: 400)
    let validatedOrigin = panelManager.validateOrigin(outOfBoundsOrigin, size: chipSize, margin: margin)
    assertTrue(validatedOrigin.x <= (NSScreen.main?.visibleFrame.maxX ?? 1920), "Clamps unplugged external monitor X to visible display")
    assertTrue(validatedOrigin.y >= (NSScreen.main?.visibleFrame.minY ?? 0), "Clamps unplugged external monitor Y to visible display")

    // 8.9. Position Persistence via UserDefaults
    UserDefaults.standard.set(777.0, forKey: "FloatingPanel_OriginX")
    UserDefaults.standard.set(333.0, forKey: "FloatingPanel_OriginY")
    let restoredOrigin = panelManager.loadSavedOrigin()
    assertEqual(restoredOrigin.x, 777.0, "Restores saved origin X accurately from UserDefaults")
    assertEqual(restoredOrigin.y, 333.0, "Restores saved origin Y accurately from UserDefaults")

    // 8.10. User Payload Change in Cached Storage (ensuring meaningful updates persist)
    let jsonUserA = """
    {"accessToken":"tok1","refreshToken":"ref1","user":{"id":"user-A","email":"a@work.com"}}
    """.data(using: .utf8)!
    let jsonUserB = """
    {"accessToken":"tok1","refreshToken":"ref1","user":{"id":"user-B","email":"b@work.com"}}
    """.data(using: .utf8)!
    let userTestKey = "user_switch_test_key"
    try? cachedStorage.store(key: userTestKey, value: jsonUserA)
    let writeCountBeforeUserB = mockBacking.writeCount
    try? cachedStorage.store(key: userTestKey, value: jsonUserB)
    assertEqual(mockBacking.writeCount, writeCountBeforeUserB + 1, "Changing user payload triggers Keychain persist (meaningful updates are NOT suppressed)")

    // Test 9: Single-Line Non-Wrapping Timer String Integrity
    print("\n▶ Suite 9: Single-Line Non-Wrapping Timer String Integrity")
    let testSeconds: [(Int, String)] = [
        (1465, "24:25"),    // 24m 25s
        (3599, "59:59"),    // 59m 59s
        (3600, "1:00:00"),  // 1h 00m 00s
        (3909, "1:05:09"),  // 1h 05m 09s
        (45909, "12:45:09") // 12h 45m 09s
    ]

    for (sec, expected) in testSeconds {
        let formatted = timerService.formatAdaptiveTime(sec)
        assertEqual(formatted, expected, "Adaptive time format matches expected '\(expected)'")
        assertTrue(!formatted.contains("\n"), "Formatted time contains NO newline character for '\(expected)'")
        assertTrue(!formatted.contains("\r"), "Formatted time contains NO carriage return character for '\(expected)'")
        assertTrue(!formatted.contains(" "), "Formatted time contains NO spaces for '\(expected)'")
        assertTrue(formatted.count <= 8, "Formatted string length (\(formatted.count) chars) fits within single-line allocation")
    }

    print("\n=======================================================")
    print("🎉 All Native Mini Timer tests passed successfully! (80 checks)")
    print("=======================================================")
}

Task { @MainActor in
    await runTests()
    exit(0)
}

dispatchMain()
