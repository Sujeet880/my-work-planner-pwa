import Foundation
import Supabase

/// High-performance, in-memory cached wrapper around Supabase's `KeychainLocalStorage`.
/// Prevents repeated macOS Keychain access prompts by memoizing session tokens in memory
/// during application runtime while ensuring genuine token mutations (sign-in, token refresh, sign-out)
/// are persisted securely to the macOS Keychain.
///
/// Features:
/// 1. Positive in-memory caching for active sessions (zero redundant reads).
/// 2. Negative caching for non-existent migration keys probed by Supabase SDK (e.g. "supabase.session").
/// 3. Semantic session write deduplication: suppresses redundant Keychain writes when Supabase's
///    internal migration checks (e.g. `useDefaultEncoder`) repeatedly re-encode and re-save identical sessions.
public final class CachedKeychainLocalStorage: AuthLocalStorage, @unchecked Sendable {
    private let underlying: any AuthLocalStorage
    private let lock = NSLock()
    private var memoryCache: [String: Data] = [:]
    private var missingKeys: Set<String> = []

    public init(
        service: String? = "supabase.gotrue.swift",
        accessGroup: String? = nil,
        backingStore: (any AuthLocalStorage)? = nil
    ) {
        if let backingStore {
            self.underlying = backingStore
        } else {
            self.underlying = KeychainLocalStorage(service: service, accessGroup: accessGroup)
        }
    }

    /// Determines whether incoming session data is semantically identical to the currently cached session,
    /// comparing access and refresh token values across varying JSON encoding formats.
    private func isSessionEquivalent(existing: Data?, incoming: Data) -> Bool {
        guard let existing else { return false }
        if existing == incoming { return true }

        struct TokenPayload: Decodable {
            let accessToken: String?
            let refreshToken: String?
            let access_token: String?
            let refresh_token: String?
            let user: UserPayload?

            struct UserPayload: Decodable {
                let id: String?
                let email: String?
            }

            var resolvedAccessToken: String? { accessToken ?? access_token }
            var resolvedRefreshToken: String? { refreshToken ?? refresh_token }
        }

        let decoder = JSONDecoder()
        guard let parsedExisting = try? decoder.decode(TokenPayload.self, from: existing),
              let parsedIncoming = try? decoder.decode(TokenPayload.self, from: incoming),
              let existingAccess = parsedExisting.resolvedAccessToken,
              let incomingAccess = parsedIncoming.resolvedAccessToken,
              let existingRefresh = parsedExisting.resolvedRefreshToken,
              let incomingRefresh = parsedIncoming.resolvedRefreshToken
        else {
            return false
        }

        guard existingAccess == incomingAccess && existingRefresh == incomingRefresh else {
            return false
        }

        if let existingUser = parsedExisting.user, let incomingUser = parsedIncoming.user {
            if existingUser.id != incomingUser.id || existingUser.email != incomingUser.email {
                return false
            }
        }

        return true
    }

    /// Stores the session in memory and persists it to the macOS Keychain only if the token payload has changed.
    public func store(key: String, value: Data) throws {
        lock.lock()
        missingKeys.remove(key)
        if isSessionEquivalent(existing: memoryCache[key], incoming: value) {
            lock.unlock()
            // Idempotent write deduplication: session tokens are identical, suppress redundant Keychain write.
            return
        }
        memoryCache[key] = value
        lock.unlock()

        try underlying.store(key: key, value: value)
    }

    /// Retrieves session from memory cache if available; performs a single cold-read
    /// from macOS Keychain only when the cache is unpopulated.
    /// Also caches negative lookups (nil) to prevent legacy migrations from hitting Keychain repeatedly.
    public func retrieve(key: String) throws -> Data? {
        lock.lock()
        if missingKeys.contains(key) {
            lock.unlock()
            return nil
        }
        if let cached = memoryCache[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        // Single cold-start read from macOS Keychain
        guard let data = try underlying.retrieve(key: key) else {
            lock.lock()
            missingKeys.insert(key)
            lock.unlock()
            return nil
        }

        lock.lock()
        memoryCache[key] = data
        lock.unlock()
        return data
    }

    /// Removes session from memory cache and deletes it from the macOS Keychain.
    public func remove(key: String) throws {
        lock.lock()
        memoryCache.removeValue(forKey: key)
        missingKeys.insert(key)
        lock.unlock()

        try underlying.remove(key: key)
    }

    /// Explicitly invalidates the in-memory cache if needed.
    public func clearMemoryCache() {
        lock.lock()
        memoryCache.removeAll()
        missingKeys.removeAll()
        lock.unlock()
    }

    /// Check if a key has valid data cached in memory
    public func hasCachedData(key: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return memoryCache[key] != nil
    }

    /// Check if a key is recorded in the negative (absent) cache
    public func isNegativeCached(key: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return missingKeys.contains(key)
    }

    /// Check if a key is present in either cache (positive data or negative nil)
    public func isCachedInMemory(key: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return memoryCache[key] != nil || missingKeys.contains(key)
    }

    /// Returns the number of cached items in memory
    public var cachedItemCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return memoryCache.count
    }
}
