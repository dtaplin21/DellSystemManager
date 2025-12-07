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
        guard let token = keychainService.getToken() else {
            await MainActor.run {
                self.isAuthenticated = false
            }
            return
        }
        
        // Verify token by calling backend
        do {
            struct UserResponse: Codable {
                let user: User
            }
            let response: UserResponse = try await apiClient.request(
                endpoint: "/api/auth/user",
                method: .get
            )
            
            // Token is valid, auto-authenticate
            await MainActor.run {
                self.currentUser = response.user
                self.isAuthenticated = true
                self.authError = nil
            }
            print("✅ Auto-login successful - Token verified. User ID: \(response.user.id)")
        } catch {
            // Token is invalid or expired
            if let apiError = error as? APIError,
               case .serverError(let code, _) = apiError,
               code == 401 {
                // Token expired/invalid - clear it
                print("⚠️ Token expired or invalid - clearing from keychain")
                keychainService.deleteToken()
                apiClient.clearAuthToken()
            } else if let apiError = error as? APIError,
                      case .unauthorized = apiError {
                // Unauthorized - clear token
                print("⚠️ Unauthorized - clearing token from keychain")
                keychainService.deleteToken()
                apiClient.clearAuthToken()
            } else {
                // Network error or other error - keep token but don't auto-login
                print("⚠️ Network error during auto-login - keeping token. Error: \(error.localizedDescription)")
            }
            // For any error, don't auto-authenticate
            await MainActor.run {
                self.isAuthenticated = false
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
