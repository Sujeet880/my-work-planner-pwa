import Foundation
import Combine
import AppKit
import Supabase

@MainActor
public final class SupabaseManager: ObservableObject {
    public static let shared = SupabaseManager()

    public static let supabaseURL = URL(string: "https://tefxkrigwvyiescuctmb.supabase.co")!
    public static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZnhrcmlnd3Z5aWVzY3VjdG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMjk0OTMsImV4cCI6MjExMDgwNTQ5M30.J9sv8aeqeiWVhVPP6WBCJi3NCWvYVb7NbJp-MwuszN4"
    public static let redirectURI = URL(string: "myworkplanner-minitimer://auth/callback")!

    public let client: SupabaseClient
    private let authStorage: CachedKeychainLocalStorage

    @Published public var isAuthenticated: Bool = false
    @Published public var userEmail: String? = nil
    @Published public var userName: String? = nil
    @Published public var userId: UUID? = nil
    @Published public var isAuthenticating: Bool = false
    @Published public var authError: String? = nil

    private init() {
        // High-performance in-memory cached keychain storage:
        // Solves repeated macOS Keychain password prompts by caching the retrieved session in memory
        // across queries while persisting all updates to the Keychain.
        let storage = CachedKeychainLocalStorage(service: "supabase.gotrue.swift")
        self.authStorage = storage

        let options = SupabaseClientOptions(
            auth: .init(
                storage: storage,
                autoRefreshToken: true,
                emitLocalSessionAsInitialSession: true
            )
        )

        self.client = SupabaseClient(
            supabaseURL: Self.supabaseURL,
            supabaseKey: Self.supabaseAnonKey,
            options: options
        )

        Task {
            await self.checkSession()
        }
    }

    /// Automatically restores the authenticated session from macOS Keychain.
    public func checkSession() async {
        do {
            let session = try await client.auth.session
            self.isAuthenticated = true
            self.userEmail = session.user.email
            self.userId = session.user.id
            self.authError = nil

            // Load user profile name
            await self.loadProfileName(userId: session.user.id)
        } catch {
            self.isAuthenticated = false
            self.userEmail = nil
            self.userName = nil
            self.userId = nil
        }
    }

    /// Fetches authentic human display name from public.profiles table.
    private func loadProfileName(userId: UUID) async {
        struct ProfileRow: Decodable {
            let full_name: String?
        }

        do {
            let profile: ProfileRow = try await client
                .from("profiles")
                .select("full_name")
                .eq("id", value: userId)
                .single()
                .execute()
                .value

            let clean = profile.full_name?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let name = clean, !name.isEmpty {
                self.userName = name
            } else {
                self.userName = self.userEmail?.components(separatedBy: "@").first ?? "User"
            }
        } catch {
            self.userName = self.userEmail?.components(separatedBy: "@").first ?? "User"
        }
    }

    /// Opens the dedicated browser account-linking route.
    public func openConnectPage() {
        // Attempt active localhost dev server ports (3001, 3000), falling back to production
        let connectPaths = [
            "http://localhost:3001/settings/native-timer/connect",
            "http://localhost:3000/settings/native-timer/connect",
            "https://my-work-planner-pwa.vercel.app/settings/native-timer/connect"
        ]

        if let targetUrl = URL(string: connectPaths[0]) {
            NSWorkspace.shared.open(targetUrl)
        }
    }

    /// Helper to extract query items and fragment parameters into a key-value dictionary
    private func parseAuthParams(from url: URL) -> [String: String] {
        var params: [String: String] = [:]
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return params
        }

        // Query parameters (?key=value)
        components.queryItems?.forEach { item in
            if let val = item.value {
                params[item.name] = val
            }
        }

        // Fragment parameters (#key=value&key2=value2)
        if let fragment = components.fragment {
            let pairs = fragment.components(separatedBy: "&")
            for pair in pairs {
                let parts = pair.components(separatedBy: "=")
                if parts.count == 2 {
                    let key = parts[0]
                    let val = parts[1].removingPercentEncoding ?? parts[1]
                    params[key] = val
                }
            }
        }

        return params
    }

    /// Handles incoming custom scheme URL:
    /// 1. Pairing code: myworkplanner-minitimer://auth/callback?code=...
    /// 2. Session tokens: myworkplanner-minitimer://auth/callback#access_token=...&refresh_token=...
    /// 3. Direct OAuth callback URL
    public func handleIncomingURL(_ url: URL) async -> Bool {
        guard url.scheme == "myworkplanner-minitimer" else { return false }

        self.isAuthenticating = true
        self.authError = nil

        let params = parseAuthParams(from: url)

        // 1. Check for single-use pairing code (?code=...)
        if let pairingCode = params["code"], !pairingCode.isEmpty {
            return await self.exchangePairingCode(pairingCode)
        }

        // 2. Direct session token handoff (#access_token=...&refresh_token=...)
        if let accessToken = params["access_token"], let refreshToken = params["refresh_token"], !accessToken.isEmpty {
            do {
                let session = try await client.auth.setSession(accessToken: accessToken, refreshToken: refreshToken)
                self.isAuthenticated = true
                self.userEmail = session.user.email
                self.userId = session.user.id
                self.isAuthenticating = false
                self.authError = nil
                await self.loadProfileName(userId: session.user.id)
                await TimerService.shared.refreshActiveTimer()
                return true
            } catch {
                self.isAuthenticating = false
                self.authError = "Session linking failed: \(error.localizedDescription)"
                return false
            }
        }

        // 3. Direct session URL fallback
        do {
            let session = try await client.auth.session(from: url)
            self.isAuthenticated = true
            self.userEmail = session.user.email
            self.userId = session.user.id
            self.isAuthenticating = false
            self.authError = nil
            await self.loadProfileName(userId: session.user.id)
            await TimerService.shared.refreshActiveTimer()
            return true
        } catch {
            self.isAuthenticating = false
            self.authError = "Authentication failed: \(error.localizedDescription)"
            return false
        }
    }

    /// Exchanges short-lived pairing code with server backend for legitimate magiclink token_hash
    private func exchangePairingCode(_ code: String) async -> Bool {
        struct ExchangePayload: Encodable {
            let action: String = "exchange"
            let code: String
        }

        struct ExchangeResponse: Decodable {
            let success: Bool?
            let tokenHash: String?
            let email: String?
            let userId: String?
            let fullName: String?
            let error: String?
        }

        let payload = ExchangePayload(code: code)
        guard let jsonData = try? JSONEncoder().encode(payload) else {
            self.isAuthenticating = false
            self.authError = "Failed to format pairing request"
            return false
        }

        // Target endpoints: Production Supabase Edge Function with local Vite proxy fallback
        let endpoints = [
            "https://tefxkrigwvyiescuctmb.supabase.co/functions/v1/native-timer-pairing",
            "http://localhost:3000/api/native-timer-pairing",
            "http://localhost:3001/api/native-timer-pairing"
        ]

        for endpointStr in endpoints {
            guard let endpointUrl = URL(string: endpointStr) else { continue }
            var request = URLRequest(url: endpointUrl)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(Self.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(Self.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            request.httpBody = jsonData
            request.timeoutInterval = 8.0

            do {
                let (data, httpResponse) = try await URLSession.shared.data(for: request)
                guard let http = httpResponse as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                    continue
                }

                let response = try JSONDecoder().decode(ExchangeResponse.self, from: data)
                guard let tokenHash = response.tokenHash, !tokenHash.isEmpty else {
                    self.isAuthenticating = false
                    self.authError = response.error ?? "Pairing response missing token hash"
                    return false
                }

                // Complete authentication via supported Supabase verifyOTP API
                let authResponse = try await client.auth.verifyOTP(
                    tokenHash: tokenHash,
                    type: .magiclink
                )

                self.isAuthenticated = true
                self.userEmail = authResponse.user.email ?? response.email
                self.userId = authResponse.user.id
                self.userName = response.fullName ?? self.userEmail?.components(separatedBy: "@").first ?? "User"
                self.authError = nil
                self.isAuthenticating = false

                // Synchronize active timer state immediately
                await TimerService.shared.refreshActiveTimer()
                return true
            } catch {
                // Try next endpoint
                continue
            }
        }

        self.isAuthenticating = false
        self.authError = "Failed to connect to pairing service. Please verify server connection."
        return false
    }

    /// Securely signs out of the native session and clears Keychain.
    public func signOut() async {
        do {
            try await client.auth.signOut()
        } catch {
            // Non-fatal if session already expired
        }
        authStorage.clearMemoryCache()
        self.isAuthenticated = false
        self.userEmail = nil
        self.userName = nil
        self.userId = nil
        self.authError = nil
    }
}
