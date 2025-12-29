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
    @State private var showSettings = false
    
    var body: some View {
        NavigationView {
            if let project = selectedProject {
                DefectCaptureView(project: project)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: { showSettings = true }) {
                                Image(systemName: "gearshape.fill")
                            }
                        }
                    }
            } else {
                ProjectListView(selectedProject: $selectedProject)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: { showSettings = true }) {
                                Image(systemName: "gearshape.fill")
                            }
                        }
                    }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }
}

