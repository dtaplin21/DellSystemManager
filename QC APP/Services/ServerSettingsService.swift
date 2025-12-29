import Foundation

class ServerSettingsService {
    static let shared = ServerSettingsService()
    
    private let serverURLKey = "custom_server_url"
    
    private init() {}
    
    /// Get the configured server URL, with fallback priority:
    /// 1. User-configured URL (from UserDefaults)
    /// 2. Info.plist API_BASE_URL
    /// 3. Default localhost
    var serverURL: String {
        // First check UserDefaults for custom URL
        if let customURL = UserDefaults.standard.string(forKey: serverURLKey),
           !customURL.isEmpty {
            return customURL
        }
        
        // Fall back to Info.plist
        if let apiURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !apiURL.isEmpty {
            return apiURL
        }
        
        // Default fallback
        return "http://localhost:8003"
    }
    
    /// Set a custom server URL
    func setServerURL(_ url: String) {
        let trimmedURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(trimmedURL, forKey: serverURLKey)
        UserDefaults.standard.synchronize()
        
        // Notify APIClient to update its base URL
        NotificationCenter.default.post(name: .serverURLDidChange, object: nil)
    }
    
    /// Clear custom server URL (revert to Info.plist or default)
    func clearCustomServerURL() {
        UserDefaults.standard.removeObject(forKey: serverURLKey)
        UserDefaults.standard.synchronize()
        NotificationCenter.default.post(name: .serverURLDidChange, object: nil)
    }
    
    /// Check if using custom URL
    var hasCustomURL: Bool {
        return UserDefaults.standard.string(forKey: serverURLKey) != nil
    }
}

extension Notification.Name {
    static let serverURLDidChange = Notification.Name("serverURLDidChange")
}

