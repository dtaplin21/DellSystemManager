import Foundation

struct DefectMetadata: Codable {
    let location: String?
    let notes: String?
    let defectType: String?
    let latitude: Double?
    let longitude: Double?
    
    enum CodingKeys: String, CodingKey {
        case location
        case notes
        case defectType = "defect_type"
        case latitude
        case longitude
    }
}

struct DefectUploadRequest: Codable {
    let imageBase64: String
    let imageType: String
    let metadata: DefectMetadata?
    
    enum CodingKeys: String, CodingKey {
        case imageBase64 = "image_base64"
        case imageType = "image_type"
        case metadata
    }
}

struct Defect: Codable, Identifiable {
    let id: Int
    let type: String
    let location: String
    let size: String
    let severity: String
    let confidence: String
    let description: String
    let action: String
    let estimatedPosition: DefectPosition?
    
    enum CodingKeys: String, CodingKey {
        case id
        case type
        case location
        case size
        case severity
        case confidence
        case description
        case action
        case estimatedPosition = "estimated_position"
    }
}

struct DefectPosition: Codable {
    let xPercent: Double
    let yPercent: Double
    
    enum CodingKeys: String, CodingKey {
        case xPercent = "x_percent"
        case yPercent = "y_percent"
    }
}

struct DefectDetectionResult: Codable {
    let defects: [Defect]
    let overallAssessment: String
    let totalDefects: Int
    let criticalDefects: Int
    let recommendations: [String]
    
    enum CodingKeys: String, CodingKey {
        case defects
        case overallAssessment = "overall_assessment"
        case totalDefects = "total_defects"
        case criticalDefects = "critical_defects"
        case recommendations
    }
}

struct UploadResult: Codable {
    let success: Bool
    let defects: [Defect]
    let automationStatus: String?
    let message: String
    let uploadId: String?
    
    enum CodingKeys: String, CodingKey {
        case success
        case defects
        case automationStatus = "automation_status"
        case message
        case uploadId = "upload_id"
    }
}

