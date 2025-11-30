import Foundation
import SwiftData

@Model
final class UploadQueueItem {
    var id: String
    var projectId: String
    var imageData: Data
    var imageName: String
    var location: String?
    var notes: String?
    var defectType: String?
    var latitude: Double?
    var longitude: Double?
    var status: String // "pending", "uploading", "completed", "failed"
    var retryCount: Int
    var lastError: String?
    var createdAt: Date
    var updatedAt: Date
    
    init(
        projectId: String,
        imageData: Data,
        imageName: String,
        location: String? = nil,
        notes: String? = nil,
        defectType: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.id = UUID().uuidString
        self.projectId = projectId
        self.imageData = imageData
        self.imageName = imageName
        self.location = location
        self.notes = notes
        self.defectType = defectType
        self.latitude = latitude
        self.longitude = longitude
        self.status = "pending"
        self.retryCount = 0
        self.lastError = nil
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}

