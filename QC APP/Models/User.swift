import Foundation

struct User: Codable {
    let id: String
    let email: String
    let displayName: String?
    let company: String?
    let subscription: String?
    let isAdmin: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName = "display_name"
        case company
        case subscription
        case isAdmin = "is_admin"
    }
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let user: User
    let token: String
    let success: Bool?
}

