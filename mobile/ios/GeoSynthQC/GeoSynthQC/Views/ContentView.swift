import SwiftUI

struct ContentView: View {
    @StateObject private var authService = AuthService.shared
    
    var body: some View {
        Group {
            if authService.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}

struct MainTabView: View {
    @StateObject private var authService = AuthService.shared
    @State private var selectedProject: Project?
    
    var body: some View {
        NavigationView {
            if let project = selectedProject {
                DefectCaptureView(project: project)
            } else {
                ProjectListView(selectedProject: $selectedProject)
            }
        }
    }
}

