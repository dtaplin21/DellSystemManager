import Foundation
import Combine

class ProjectService: ObservableObject {
    static let shared = ProjectService()
    
    private let apiClient = APIClient.shared
    
    func getProjects() async throws -> [Project] {
        struct Response: Codable {
            let success: Bool?
            let projects: [Project]
        }
        do {
            let response: Response = try await apiClient.request(
                endpoint: "/api/mobile/projects",
                method: .get
            )
            return response.projects
        } catch {
            print("❌ Error fetching projects: \(error)")
            throw error
        }
    }
    
    func createProject(name: String, description: String?, location: String?) async throws -> Project {
        let request = CreateProjectRequest(
            name: name,
            description: description,
            location: location
        )
        
        let response: CreateProjectResponse = try await apiClient.request(
            endpoint: "/api/mobile/projects",
            method: .post,
            body: request
        )
        
        return response.project
    }
}

