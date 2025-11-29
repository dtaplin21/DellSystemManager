import Foundation

struct Project: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let location: String?
    let userId: String
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case location
        case userId = "user_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct ProjectListResponse: Codable {
    let projects: [Project]
}

struct CreateProjectRequest: Codable {
    let name: String
    let description: String?
    let location: String?
}

struct CreateProjectResponse: Codable {
    let project: Project
    let success: Bool
}

