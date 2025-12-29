import Foundation

/// Telemetry service for tracking errors, performance, and analytics
class TelemetryService {
    static let shared = TelemetryService()
    
    private var baseURL: String {
        return ServerSettingsService.shared.serverURL
    }
    
    private var enabled: Bool {
        return UserDefaults.standard.bool(forKey: "telemetry_enabled") != false
    }
    
    private init() {}
    
    /// Track an error
    func trackError(_ error: Error, context: [String: Any]? = nil, userId: String? = nil) {
        guard enabled else { return }
        
        let errorData: [String: Any] = [
            "message": error.localizedDescription,
            "stack": (error as NSError).description,
            "name": String(describing: type(of: error)),
            "context": context ?? [:],
            "environment": "production",
            "userId": userId ?? ""
        ]
        
        sendTelemetry(endpoint: "/api/telemetry/errors", data: ["errors": [errorData]])
    }
    
    /// Track a performance metric
    func trackPerformance(metric: String, value: Double, unit: String = "ms", tags: [String: String]? = nil) {
        guard enabled else { return }
        
        var metricData: [String: Any] = [
            "metricName": metric,
            "metricValue": value,
            "metricUnit": unit,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000)
        ]
        
        if let tags = tags {
            metricData["tags"] = tags
        }
        
        // For now, just log in development
        #if DEBUG
        print("[Telemetry] Performance: \(metric)=\(value)\(unit)")
        #endif
    }
    
    /// Track cost/usage metrics
    func trackCost(userId: String, userTier: String, service: String, cost: Double, model: String? = nil, tokens: Int? = nil) {
        guard enabled else { return }
        
        var costData: [String: Any] = [
            "userId": userId,
            "userTier": userTier,
            "service": service,
            "cost": cost
        ]
        
        if let model = model {
            costData["model"] = model
        }
        
        if let tokens = tokens {
            costData["tokens"] = tokens
        }
        
        sendTelemetry(endpoint: "/api/telemetry/cost", data: ["costs": [costData]])
    }
    
    /// Track an analytics event
    func trackEvent(_ eventName: String, properties: [String: Any]? = nil) {
        guard enabled else { return }
        
        var eventData: [String: Any] = [
            "event": eventName,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "environment": "production"
        ]
        
        if let properties = properties {
            eventData["properties"] = properties
        }
        
        sendTelemetry(endpoint: "/api/telemetry/analytics", data: eventData)
    }
    
    private func sendTelemetry(endpoint: String, data: [String: Any]) {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: data)
            
            URLSession.shared.dataTask(with: request) { _, response, error in
                if let error = error {
                    #if DEBUG
                    print("[Telemetry] Failed to send: \(error.localizedDescription)")
                    #endif
                }
            }.resume()
        } catch {
            #if DEBUG
            print("[Telemetry] Failed to serialize data: \(error.localizedDescription)")
            #endif
        }
    }
}

