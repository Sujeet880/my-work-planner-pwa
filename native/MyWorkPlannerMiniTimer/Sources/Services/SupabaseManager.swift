import Foundation
import Combine
import Supabase

@MainActor
public final class SupabaseManager: ObservableObject {
    public static let shared = SupabaseManager()

    public static let supabaseURL = URL(string: "https://tefxkrigwvyiescuctmb.supabase.co")!
    public static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZnhrcmlnd3Z5aWVzY3VjdG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMjk0OTMsImV4cCI6MjExMDgwNTQ5M30.J9sv8aeqeiWVhVPP6WBCJi3NCWvYVb7NbJp-MwuszN4"
    public static let redirectURI = URL(string: "myworkplanner-minitimer://auth/callback")!

    public let client: SupabaseClient

    @Published public var isAuthenticated: Bool = false
    @Published public var userEmail: String? = nil
    @Published public var userId: UUID? = nil
    @Published public var isAuthenticating: Bool = false
    @Published public var authError: String? = nil

    private init() {
        self.client = SupabaseClient(
            supabaseURL: Self.supabaseURL,
            supabaseKey: Self.supabaseAnonKey
        )

        Task {
            await self.checkSession()
        }
    }

    public func checkSession() async {
        do {
            let session = try await client.auth.session
            self.isAuthenticated = true
            self.userEmail = session.user.email
            self.userId = session.user.id
            self.authError = nil
        } catch {
            self.isAuthenticated = false
            self.userEmail = nil
            self.userId = nil
        }
    }

    public func sendMagicLink(email: String) async -> Result<Void, Error> {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty, trimmed.contains("@") else {
            let err = NSError(domain: "Auth", code: 400, userInfo: [NSLocalizedDescriptionKey: "Please enter a valid email address."])
            self.authError = err.localizedDescription
            return .failure(err)
        }

        self.isAuthenticating = true
        self.authError = nil

        do {
            try await client.auth.signInWithOTP(
                email: trimmed,
                redirectTo: Self.redirectURI,
                shouldCreateUser: false
            )
            self.isAuthenticating = false
            return .success(())
        } catch {
            self.isAuthenticating = false
            self.authError = error.localizedDescription
            return .failure(error)
        }
    }

    public func handleIncomingURL(_ url: URL) async -> Bool {
        guard url.scheme == "myworkplanner-minitimer" else { return false }

        self.isAuthenticating = true
        self.authError = nil

        do {
            let session = try await client.auth.session(from: url)
            self.isAuthenticated = true
            self.userEmail = session.user.email
            self.userId = session.user.id
            self.isAuthenticating = false
            return true
        } catch {
            self.isAuthenticating = false
            self.authError = "Authentication failed: \(error.localizedDescription)"
            return false
        }
    }

    public func signOut() async {
        do {
            try await client.auth.signOut()
        } catch {
            // Non-fatal if session already expired
        }
        self.isAuthenticated = false
        self.userEmail = nil
        self.userId = nil
        self.authError = nil
    }
}
