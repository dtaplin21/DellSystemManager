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
        await MainActor.run {
            self.isUploading = true
            self.uploadProgress = 0.0
            self.uploadError = nil
        }
        
        // Compress image
        guard let compressedImageData = compressImage(image) else {
            throw ImageUploadError.compressionFailed
        }
        
        // Create upload endpoint
        let endpoint = "/api/mobile/upload-defect/\(projectId)"
        
        // Prepare additional fields
        var fields: [String: String] = [:]
        if let metadata = metadata {
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
        }
        
        do {
            // Upload using multipart form
            let data = try await apiClient.uploadMultipart(
                endpoint: endpoint,
                imageData: compressedImageData,
                imageName: "defect_\(UUID().uuidString).jpg",
                additionalFields: fields
            )
            
            // Decode response
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            let result = try decoder.decode(UploadResult.self, from: data)
            
            await MainActor.run {
                self.isUploading = false
                self.uploadProgress = 1.0
            }
            
            return result
        } catch {
            await MainActor.run {
                self.isUploading = false
                self.uploadError = error.localizedDescription
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

