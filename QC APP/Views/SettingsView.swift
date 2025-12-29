import SwiftUI

struct SettingsView: View {
    @StateObject private var authService = AuthService.shared
    @State private var serverURL: String = ""
    @State private var showAlert = false
    @State private var alertMessage = ""
    @State private var isTestingConnection = false
    
    private let settingsService = ServerSettingsService.shared
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Server Configuration")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Server URL")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        TextField("http://192.168.1.xxx:8003", text: $serverURL)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                        
                        Text("Current: \(settingsService.serverURL)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    Button(action: testConnection) {
                        HStack {
                            if isTestingConnection {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle())
                            } else {
                                Image(systemName: "network")
                            }
                            Text("Test Connection")
                        }
                    }
                    .disabled(isTestingConnection || serverURL.isEmpty)
                    
                    Button(action: saveServerURL) {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Save Server URL")
                        }
                    }
                    .disabled(serverURL.isEmpty)
                    
                    if settingsService.hasCustomURL {
                        Button(action: resetToDefault) {
                            HStack {
                                Image(systemName: "arrow.clockwise")
                                Text("Reset to Default")
                            }
                            .foregroundColor(.orange)
                        }
                    }
                }
                
                Section(header: Text("Account")) {
                    Button(action: {
                        authService.logout()
                    }) {
                        HStack {
                            Image(systemName: "arrow.right.square")
                            Text("Logout")
                        }
                        .foregroundColor(.red)
                    }
                }
                
                Section(header: Text("About")) {
                    HStack {
                        Text("App Version")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .alert("Server Configuration", isPresented: $showAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(alertMessage)
            }
            .onAppear {
                loadCurrentServerURL()
            }
        }
    }
    
    private func loadCurrentServerURL() {
        serverURL = settingsService.serverURL
    }
    
    private func saveServerURL() {
        // Validate URL format
        guard let url = URL(string: serverURL),
              url.scheme == "http" || url.scheme == "https",
              url.host != nil else {
            alertMessage = "Invalid URL format. Please use format: http://192.168.1.xxx:8003"
            showAlert = true
            return
        }
        
        settingsService.setServerURL(serverURL)
        alertMessage = "Server URL saved successfully!\n\nNew URL: \(serverURL)\n\nYou may need to log in again."
        showAlert = true
        
        // Clear auth token since we're changing servers
        authService.logout()
    }
    
    private func resetToDefault() {
        settingsService.clearCustomServerURL()
        loadCurrentServerURL()
        alertMessage = "Server URL reset to default.\n\nDefault: \(settingsService.serverURL)"
        showAlert = true
        
        // Clear auth token since we're changing servers
        authService.logout()
    }
    
    private func testConnection() {
        isTestingConnection = true
        
        Task {
            do {
                // Try to connect to health endpoint
                let testURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
                guard let url = URL(string: "\(testURL)/api/health") else {
                    throw APIError.invalidURL
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "GET"
                request.timeoutInterval = 5.0
                
                let (_, response) = try await URLSession.shared.data(for: request)
                
                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        await MainActor.run {
                            alertMessage = "✅ Connection successful!\n\nServer is reachable at:\n\(testURL)"
                            showAlert = true
                        }
                    } else {
                        await MainActor.run {
                            alertMessage = "⚠️ Server responded with status \(httpResponse.statusCode)\n\nServer may be running but endpoint not available."
                            showAlert = true
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    alertMessage = "❌ Connection failed\n\nError: \(error.localizedDescription)\n\nPlease check:\n• Server is running\n• Correct IP address\n• Same WiFi network"
                    showAlert = true
                }
            }
            
            isTestingConnection = false
        }
    }
}

