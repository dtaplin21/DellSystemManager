import Foundation

struct DefectMetadata: Codable {
    let location: String?
    let notes: String?
    let defectType: String?
    let latitude: Double?
    let longitude: Double?
    let formType: String?
    let formData: [String: AnyCodable]?
    
    enum CodingKeys: String, CodingKey {
        case location
        case notes
        case defectType = "defect_type"
        case latitude
        case longitude
        case formType = "form_type"
        case formData = "form_data"
    }
    
    init(location: String? = nil,
         notes: String? = nil,
         defectType: String? = nil,
         latitude: Double? = nil,
         longitude: Double? = nil,
         formType: String? = nil,
         formData: [String: Any]? = nil) {
        self.location = location
        self.notes = notes
        self.defectType = defectType
        self.latitude = latitude
        self.longitude = longitude
        self.formType = formType
        self.formData = formData?.mapValues { AnyCodable($0) }
    }
}

// Helper to encode [String: Any] as JSON
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Cannot encode value"))
        }
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

struct Defect: Codable, Identifiable, Equatable {
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

struct DefectPosition: Codable, Equatable {
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

struct UploadResult: Codable, Equatable {
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

