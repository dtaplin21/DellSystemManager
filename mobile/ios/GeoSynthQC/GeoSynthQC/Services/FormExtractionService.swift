import Foundation
import UIKit

struct ExtractedFormFields: Codable {
    let location: String?
    let defectType: String?
    let notes: String?
    let panelNumber: String?
    let material: String?
    let thickness: String?
    let seamsType: String?
    let formType: String?
    
    enum CodingKeys: String, CodingKey {
        case location
        case defectType = "defect_type"
        case notes
        case panelNumber = "panel_number"
        case material
        case thickness
        case seamsType = "seams_type"
        case formType = "form_type"
    }
}

struct FormExtractionResponse: Codable {
    let success: Bool
    let extractedFields: ExtractedFormFields
    let confidence: Double
    let message: String?
    
    enum CodingKeys: String, CodingKey {
        case success
        case extractedFields = "extracted_fields"
        case confidence
        case message
    }
}

enum FormExtractionError: Error, LocalizedError {
    case compressionFailed
    case invalidResponse
    case networkError(Error)
    case serverError(Int, String?)
    
    var errorDescription: String? {
        switch self {
        case .compressionFailed:
            return "Failed to compress image for extraction"
        case .invalidResponse:
            return "Invalid response from extraction service"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message ?? "Unknown error")"
        }
    }
}

class FormExtractionService {
    static let shared = FormExtractionService()
    
    private let apiClient = APIClient.shared
    
    private init() {}
    
    /// Extract form fields from defect image
    func extractFormFields(
        image: UIImage,
        projectId: String
    ) async throws -> ExtractedFormFields {
        // Compress image
        guard let compressedImageData = compressImage(image) else {
            throw FormExtractionError.compressionFailed
        }
        
        // Create endpoint
        let endpoint = "/api/mobile/extract-form-data/\(projectId)"
        
        do {
            // Upload using multipart form
            let data = try await apiClient.uploadMultipart(
                endpoint: endpoint,
                imageData: compressedImageData,
                imageName: "extract_\(UUID().uuidString).jpg",
                additionalFields: [:]
            )
            
            // Decode response
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            let response = try decoder.decode(FormExtractionResponse.self, from: data)
            
            if response.success {
                return response.extractedFields
            } else {
                // Return empty fields if extraction failed
                return ExtractedFormFields(
                    location: nil,
                    defectType: nil,
                    notes: nil,
                    panelNumber: nil,
                    material: nil,
                    thickness: nil,
                    seamsType: nil,
                    formType: nil
                )
            }
        } catch let error as APIError {
            switch error {
            case .serverError(let code, let message):
                throw FormExtractionError.serverError(code, message)
            case .networkError(let err):
                throw FormExtractionError.networkError(err)
            default:
                throw FormExtractionError.invalidResponse
            }
        } catch {
            throw FormExtractionError.networkError(error)
        }
    }
    
    /// Compress image for upload
    private func compressImage(_ image: UIImage, maxSizeKB: Int = 500) -> Data? {
        var compression: CGFloat = 1.0
        var imageData = image.jpegData(compressionQuality: compression)
        
        // Reduce quality until under max size
        while let data = imageData, data.count > maxSizeKB * 1024 && compression > 0.1 {
            compression -= 0.1
            imageData = image.jpegData(compressionQuality: compression)
        }
        
        return imageData
    }
}

