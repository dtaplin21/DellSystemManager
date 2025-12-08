import Foundation
import UIKit
import Combine

class ImageUploadService: ObservableObject {
    static let shared = ImageUploadService()
    
    @Published var uploadProgress: Double = 0.0
    @Published var isUploading = false
    @Published var uploadError: String?
    
    private let apiClient = APIClient.shared
    
    func uploadDefectPhoto(
        image: UIImage,
        projectId: String,
        metadata: DefectMetadata?
    ) async throws -> UploadResult {
        print("🔵 [ImageUploadService] Starting upload for project: \(projectId)")
        
        await MainActor.run {
            self.isUploading = true
            self.uploadProgress = 0.0
            self.uploadError = nil
        }
        
        // Compress image
        print("🖼️ [ImageUploadService] Compressing image...")
        guard let compressedImageData = compressImage(image) else {
            print("❌ [ImageUploadService] Image compression failed")
            await MainActor.run {
                self.isUploading = false
                self.uploadError = "Failed to compress image"
            }
            throw ImageUploadError.compressionFailed
        }
        print("✅ [ImageUploadService] Image compressed: \(compressedImageData.count) bytes")
        
        // Create upload endpoint
        let endpoint = "/api/mobile/upload-defect/\(projectId)"
        print("🌐 [ImageUploadService] Upload endpoint: \(endpoint)")
        
        // Prepare additional fields
        var fields: [String: String] = [:]
        if let metadata = metadata {
            print("📋 [ImageUploadService] Processing metadata...")
            if let location = metadata.location {
                fields["location"] = location
            }
            if let notes = metadata.notes {
                fields["notes"] = notes
            }
            if let defectType = metadata.defectType {
                fields["defectType"] = defectType
            }
            if let latitude = metadata.latitude {
                fields["latitude"] = String(latitude)
            }
            if let longitude = metadata.longitude {
                fields["longitude"] = String(longitude)
            }
            if let formType = metadata.formType {
                fields["formType"] = formType
            }
            // Add form data as JSON string
            if let formData = metadata.formData {
                print("📝 [ImageUploadService] Encoding form data: \(formData.count) fields")
                do {
                    // Convert [String: AnyCodable] to [String: Any] for encoding
                    var formDataDict: [String: Any] = [:]
                    for (key, value) in formData {
                        formDataDict[key] = value.value
                    }
                    let jsonData = try JSONSerialization.data(withJSONObject: formDataDict, options: [])
                    if let jsonString = String(data: jsonData, encoding: .utf8) {
                        fields["formData"] = jsonString
                        print("✅ [ImageUploadService] Form data encoded: \(jsonString.prefix(100))...")
                    }
                } catch {
                    print("⚠️ [ImageUploadService] Failed to encode form data: \(error.localizedDescription)")
                }
            }
        }
        
        print("📤 [ImageUploadService] Uploading with \(fields.count) additional fields")
        
        do {
            // Upload using multipart form
            print("🌐 [ImageUploadService] Calling uploadMultipart...")
            let data = try await apiClient.uploadMultipart(
                endpoint: endpoint,
                imageData: compressedImageData,
                imageName: "defect_\(UUID().uuidString).jpg",
                additionalFields: fields
            )
            print("✅ [ImageUploadService] Upload response received: \(data.count) bytes")
            
            // Decode response
            print("🔍 [ImageUploadService] Decoding response...")
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            let result = try decoder.decode(UploadResult.self, from: data)
            
            print("✅ [ImageUploadService] Upload successful! Defects: \(result.defects.count), Message: \(result.message)")
            
            await MainActor.run {
                self.isUploading = false
                self.uploadProgress = 1.0
                self.uploadError = nil
            }
            
            return result
        } catch {
            print("❌ [ImageUploadService] Upload error: \(error.localizedDescription)")
            if let apiError = error as? APIError {
                print("   API Error details: \(apiError)")
            }
            let errorMessage = error.localizedDescription
            await MainActor.run {
                self.isUploading = false
                self.uploadError = errorMessage
            }
            throw error
        }
    }
    
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

enum ImageUploadError: Error {
    case compressionFailed
    case invalidImage
    case uploadFailed(String)
}

