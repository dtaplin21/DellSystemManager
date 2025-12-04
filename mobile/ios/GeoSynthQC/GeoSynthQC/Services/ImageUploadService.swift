import Foundation
import UIKit
import Combine
import Network

class ImageUploadService: ObservableObject {
    static let shared = ImageUploadService()
    
    @Published var uploadProgress: Double = 0.0
    @Published var isUploading = false
    @Published var uploadError: String?
    
    private let apiClient = APIClient.shared
    
    func uploadDefectPhoto(
        image: UIImage,
        projectId: String,
        metadata: DefectMetadata?,
        formType: String? = nil,
        formFields: [String: String]? = nil,
        useOfflineQueue: Bool = true
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
        
        // Check network connectivity
        let monitor = NWPathMonitor()
        let semaphore = DispatchSemaphore(value: 0)
        var isConnected = false
        
        monitor.pathUpdateHandler = { path in
            isConnected = path.status == .satisfied
            semaphore.signal()
        }
        
        let queue = DispatchQueue(label: "NetworkCheck")
        monitor.start(queue: queue)
        semaphore.wait()
        monitor.cancel()
        
        // If offline and queue is enabled, add to queue
        if !isConnected && useOfflineQueue {
            let imageName = "defect_\(UUID().uuidString).jpg"
            OfflineQueueService.shared.addToQueue(
                projectId: projectId,
                image: compressedImageData,
                imageName: imageName,
                metadata: metadata
            )
            
            await MainActor.run {
                self.isUploading = false
                self.uploadProgress = 1.0
            }
            
            // Return a queued result
            return UploadResult(
                success: true,
                defects: [],
                automationStatus: "queued",
                message: "Image queued for upload when connection is restored",
                uploadId: nil
            )
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
        
        if let formType = formType, !formType.isEmpty {
            fields["formType"] = formType
        }
        
        if let formFields = formFields, !formFields.isEmpty {
            if let jsonData = try? JSONSerialization.data(withJSONObject: formFields, options: []),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                fields["formData"] = jsonString
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
