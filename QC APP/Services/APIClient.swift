import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case networkError(Error)
    case serverError(Int, String?)
    case unauthorized
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL. Please check your configuration."
        case .noData:
            return "No data received from server."
        case .decodingError(let error):
            return "Failed to parse server response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription). Please check your internet connection and ensure the server is running."
        case .serverError(let code, let message):
            if let message = message, !message.isEmpty {
                return "Server error (\(code)): \(message)"
            }
            return "Server error (\(code)). Please try again later."
        case .unauthorized:
            return "Authentication failed. Your session may have expired. Please log in again."
        case .unknown:
            return "An unknown error occurred. Please try again."
        }
    }
}

class APIClient {
    static let shared = APIClient()
    
    private let baseURL: String
    private var authToken: String?
    
    // Custom URLSession with extended timeout for long-running operations (AI form extraction)
    private lazy var longTimeoutSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 180.0 // 3 minutes (backend has 2 min, add buffer)
        configuration.timeoutIntervalForResource = 180.0 // 3 minutes
        return URLSession(configuration: configuration)
    }()
    
    init() {
        // Get from Info.plist or use default
        if let apiURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String, !apiURL.isEmpty {
            self.baseURL = apiURL
        } else {
            self.baseURL = "http://localhost:8003"
        }
    }
    
    func setAuthToken(_ token: String) {
        self.authToken = token
    }
    
    func clearAuthToken() {
        self.authToken = nil
    }
    
    private var defaultHeaders: [String: String] {
        var headers: [String: String] = [
            "Content-Type": "application/json"
        ]
        if let token = authToken {
            headers["Authorization"] = "Bearer \(token)"
            print("🔑 Sending request with auth token: \(token.prefix(20))...")
        } else {
            print("⚠️ No auth token available for request")
        }
        return headers
    }
    
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // Set headers
        for (key, value) in defaultHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // Set body if provided
        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.unknown
            }
            
            // Handle errors
            if httpResponse.statusCode == 401 {
                // Try to parse the specific error message from JSON
                var errorMessage: String?
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    errorMessage = message
                }
                // If we have a specific message, use it; otherwise use generic unauthorized
                if let message = errorMessage {
                    throw APIError.serverError(401, message)
                } else {
                    throw APIError.unauthorized
                }
            }
            
            if httpResponse.statusCode >= 400 {
                // Try to parse error message from JSON response
                var errorMessage: String?
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    errorMessage = message
                } else {
                    errorMessage = String(data: data, encoding: .utf8)
                }
                throw APIError.serverError(httpResponse.statusCode, errorMessage)
            }
            
            // Decode response
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
        } catch let error as APIError {
            // Track error via telemetry
            TelemetryService.shared.trackError(error, context: [
                "endpoint": endpoint,
                "method": method.rawValue
            ])
            throw error
        } catch let error as DecodingError {
            let apiError = APIError.decodingError(error)
            TelemetryService.shared.trackError(apiError, context: [
                "endpoint": endpoint,
                "method": method.rawValue,
                "errorType": "decoding"
            ])
            throw apiError
        } catch {
            let apiError = APIError.networkError(error)
            TelemetryService.shared.trackError(apiError, context: [
                "endpoint": endpoint,
                "method": method.rawValue,
                "errorType": "network"
            ])
            throw apiError
        }
    }
    
    func uploadMultipart(
        endpoint: String,
        imageData: Data,
        imageName: String,
        additionalFields: [String: String] = [:]
    ) async throws -> Data {
        print("🌐 [APIClient] uploadMultipart - endpoint: \(endpoint), baseURL: \(baseURL)")
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            print("❌ [APIClient] Invalid URL: \(baseURL)\(endpoint)")
            throw APIError.invalidURL
        }
        
        print("📡 [APIClient] Creating multipart request to: \(url.absoluteString)")
        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        // Set headers
        var headers = defaultHeaders
        headers["Content-Type"] = "multipart/form-data; boundary=\(boundary)"
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // Create multipart body
        var body = Data()
        
        // Add image
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"\(imageName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add additional fields
        for (key, value) in additionalFields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append(value.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        }
        
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        print("📦 [APIClient] Request body size: \(body.count) bytes, fields: \(additionalFields.count)")
        
        do {
            print("🚀 [APIClient] Sending request...")
            // Use longTimeoutSession for multipart uploads (especially AI form extraction which can take 2+ minutes)
            let (data, response) = try await longTimeoutSession.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [APIClient] Invalid response type")
                throw APIError.unknown
            }
            
            print("📥 [APIClient] Response status: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode == 401 {
                print("❌ [APIClient] Unauthorized (401)")
                throw APIError.unauthorized
            }
            
            if httpResponse.statusCode >= 400 {
                // Try to parse error message from JSON response
                var errorMessage: String?
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    errorMessage = message
                } else {
                    errorMessage = String(data: data, encoding: .utf8)
                }
                print("❌ [APIClient] Server error (\(httpResponse.statusCode)): \(errorMessage ?? "Unknown error")")
                throw APIError.serverError(httpResponse.statusCode, errorMessage)
            }
            
            print("✅ [APIClient] Request successful, response size: \(data.count) bytes")
            return data
        } catch let error as APIError {
            print("❌ [APIClient] API Error: \(error.localizedDescription)")
            throw error
        } catch {
            print("❌ [APIClient] Network Error: \(error.localizedDescription)")
            throw APIError.networkError(error)
        }
    }
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

