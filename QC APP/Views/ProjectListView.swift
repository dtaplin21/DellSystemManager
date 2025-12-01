import SwiftUI

struct ProjectListView: View {
    @Binding var selectedProject: Project?
    @StateObject private var projectService = ProjectService.shared
    @StateObject private var authService = AuthService.shared
    @State private var projects: [Project] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showCreateProject = false
    @State private var refreshTrigger = false
    
    var body: some View {
        VStack {
            // Header
            HStack {
                Text("Projects")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button(action: { showCreateProject = true }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                }
                
                Button(action: { authService.logout() }) {
                    Image(systemName: "person.circle")
                        .font(.title2)
                }
            }
            .padding()
            
            // Project List
            if isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if projects.isEmpty {
                Spacer()
                Text("No projects found")
                    .foregroundColor(.secondary)
                Button("Create New Project") {
                    showCreateProject = true
                }
                .buttonStyle(.borderedProminent)
                Spacer()
            } else {
                List(projects) { project in
                    Button(action: {
                        selectedProject = project
                    }) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(project.name)
                                .font(.headline)
                            if let location = project.location {
                                Text(location)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .sheet(isPresented: $showCreateProject) {
            ProjectSetupView(isPresented: $showCreateProject) { newProject in
                projects.append(newProject)
                selectedProject = newProject
            }
        }
        .refreshable {
            await loadProjects()
        }
        .task {
            await loadProjects()
        }
        .onChange(of: refreshTrigger) { oldValue, newValue in
            Task {
                await loadProjects()
            }
        }
    }
    
    private func loadProjects() async {
        isLoading = true
        errorMessage = nil
        do {
            let fetchedProjects = try await projectService.getProjects()
            await MainActor.run {
                projects = fetchedProjects
                print("✅ Loaded \(fetchedProjects.count) projects")
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                print("❌ Error loading projects: \(error.localizedDescription)")
            }
        }
        isLoading = false
    }
}

