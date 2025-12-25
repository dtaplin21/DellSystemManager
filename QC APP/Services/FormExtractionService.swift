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

struct ExtractedAsbuiltFormFields: Codable {
    // Common fields
    let dateTime: String?
    let date: String?
    
    // Panel fields
    let panelNumber: String?
    let panelNumbers: String?
    
    // Location/Notes
    let locationDescription: String?
    let locationNote: String?
    let weatherComments: String?
    let notes: String?
    let comments: String?
    
    // Seaming fields
    let seamLength: Double?
    let seamerInitials: String?
    let machineNumber: String?
    let wedgeTemp: Double?
    let nipRollerSpeed: String?
    let barrelTemp: Double?
    let preheatTemp: Double?
    let trackPeelInside: Double?
    let trackPeelOutside: Double?
    let tensileLbsPerIn: Double?
    let tensileRate: String?
    let vboxPassFail: String?
    
    // Operator/Tester fields
    let operatorInitials: String?
    let testerInitials: String?
    
    // Repair fields
    let repairId: String?
    let extruderNumber: String?
    let typeDetailLocation: String?
    
    // Structured location fields
    let placementType: String?
    let locationDistance: Double?
    let locationDirection: String?
    
    // Testing fields
    let sampleId: String?
    let passFail: String?
    let ambientTemp: Double?
    
    enum CodingKeys: String, CodingKey {
        case dateTime
        case date
        case panelNumber
        case panelNumbers
        case locationDescription
        case locationNote
        case weatherComments
        case notes
        case comments
        case seamLength
        case seamerInitials
        case machineNumber
        case wedgeTemp
        case nipRollerSpeed
        case barrelTemp
        case preheatTemp
        case trackPeelInside
        case trackPeelOutside
        case tensileLbsPerIn
        case tensileRate
        case vboxPassFail
        case operatorInitials
        case testerInitials
        case repairId
        case extruderNumber
        case typeDetailLocation
        case placementType
        case locationDistance
        case locationDirection
        case sampleId
        case passFail
        case ambientTemp
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

struct AsbuiltFormExtractionResponse: Codable {
    let success: Bool
    let extractedFields: ExtractedAsbuiltFormFields
    let confidence: Double
    let message: String?
    let formType: String?
    
    enum CodingKeys: String, CodingKey {
        case success
        case extractedFields = "extracted_fields"
        case confidence
        case message
        case formType = "form_type"
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
    
    /// Extract as-built form fields from image
    func extractAsbuiltFormFields(
        image: UIImage,
        formType: String,
        projectId: String
    ) async throws -> ExtractedAsbuiltFormFields {
        // Compress image
        guard let compressedImageData = compressImage(image) else {
            throw FormExtractionError.compressionFailed
        }
        
        // Create endpoint
        let endpoint = "/api/mobile/extract-form-data/\(projectId)"
        
        do {
            // Upload using multipart form with formType
            let additionalFields = ["formType": formType]
            let data = try await apiClient.uploadMultipart(
                endpoint: endpoint,
                imageData: compressedImageData,
                imageName: "extract_\(UUID().uuidString).jpg",
                additionalFields: additionalFields
            )
            
            // Decode response
            let decoder = JSONDecoder()
            // Note: Not using .convertFromSnakeCase because:
            // 1. Top-level response uses explicit CodingKeys (extracted_fields -> extractedFields)
            // 2. Nested ExtractedAsbuiltFormFields has camelCase keys from AI service matching property names
            let response: AsbuiltFormExtractionResponse
            do {
                response = try decoder.decode(AsbuiltFormExtractionResponse.self, from: data)
            } catch let decodingError as DecodingError {
                print("❌ [FormExtractionService] Decoding error: \(decodingError)")
                if case .keyNotFound(let key, let context) = decodingError {
                    print("   Missing key: \(key.stringValue), path: \(context.codingPath)")
                }
                if case .typeMismatch(let type, let context) = decodingError {
                    print("   Type mismatch: expected \(type), path: \(context.codingPath)")
                }
                if case .valueNotFound(let type, let context) = decodingError {
                    print("   Value not found: expected \(type), path: \(context.codingPath)")
                }
                // Try to print the raw response for debugging
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("   Raw response: \(jsonString.prefix(500))")
                }
                throw FormExtractionError.invalidResponse
            }
            
            if response.success {
                return response.extractedFields
            } else {
                // Return empty fields if extraction failed
                return ExtractedAsbuiltFormFields(
                    dateTime: nil,
                    date: nil,
                    panelNumber: nil,
                    panelNumbers: nil,
                    locationDescription: nil,
                    locationNote: nil,
                    weatherComments: nil,
                    notes: nil,
                    comments: nil,
                    seamLength: nil,
                    seamerInitials: nil,
                    machineNumber: nil,
                    wedgeTemp: nil,
                    nipRollerSpeed: nil,
                    barrelTemp: nil,
                    preheatTemp: nil,
                    trackPeelInside: nil,
                    trackPeelOutside: nil,
                    tensileLbsPerIn: nil,
                    tensileRate: nil,
                    vboxPassFail: nil,
                    operatorInitials: nil,
                    testerInitials: nil,
                    repairId: nil,
                    extruderNumber: nil,
                    typeDetailLocation: nil,
                    placementType: nil,
                    locationDistance: nil,
                    locationDirection: nil,
                    sampleId: nil,
                    passFail: nil,
                    ambientTemp: nil
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

