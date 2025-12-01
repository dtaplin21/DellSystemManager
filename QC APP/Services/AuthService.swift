import Foundation
import Combine

class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var authError: String?
    
    private let apiClient = APIClient.shared
    private let keychainService = KeychainService.shared
    
    private init() {
        // Try to restore session from keychain
        if let token = keychainService.getToken() {
            print("🔑 Restored auth token from keychain")
            apiClient.setAuthToken(token)
            Task {
                await loadUser()
            }
        } else {
            print("⚠️ No token found in keychain")
        }
    }
    
    func login(email: String, password: String) async throws {
        let request = LoginRequest(email: email, password: password)
        
        do {
            let response: LoginResponse = try await apiClient.request(
                endpoint: "/api/auth/login",
                method: .post,
                body: request
            )
            
            // Store token
            keychainService.saveToken(response.token)
            apiClient.setAuthToken(response.token)
            print("✅ Login successful - Token stored. User ID: \(response.user.id)")
            
            // Update state
            await MainActor.run {
                self.currentUser = response.user
                self.isAuthenticated = true
                self.authError = nil
            }
        } catch {
            await MainActor.run {
                self.authError = error.localizedDescription
                self.isAuthenticated = false
            }
            throw error
        }
    }
    
    func logout() {
        keychainService.deleteToken()
        apiClient.clearAuthToken()
        
        currentUser = nil
        isAuthenticated = false
        authError = nil
    }
    
    private func loadUser() async {
        // Try to get current user info
        // This would require a /api/auth/me endpoint or similar
        // For now, we'll just check if token exists
        if keychainService.getToken() != nil {
            await MainActor.run {
                self.isAuthenticated = true
            }
        }
    }
}

// Keychain service for secure token storage
class KeychainService {
    static let shared = KeychainService()
    
    private let service = "com.dellsystemmanager.geosynthqc"
    private let tokenKey = "auth_token"
    
    func saveToken(_ token: String) {
        let data = token.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess,
           let data = result as? Data,
           let token = String(data: data, encoding: .utf8) {
            return token
        }
        
        return nil
    }
    
    func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}
