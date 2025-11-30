import SwiftUI

struct ProjectSetupView: View {
    @Binding var isPresented: Bool
    var onProjectCreated: ((Project) -> Void)?
    @StateObject private var projectService = ProjectService.shared
    @State private var name = ""
    @State private var description = ""
    @State private var location = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Project Information")) {
                    TextField("Project Name", text: $name)
                    TextField("Location (Optional)", text: $location)
                    TextField("Description (Optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("New Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        createProject()
                    }
                    .disabled(isLoading || name.isEmpty)
                }
            }
        }
    }
    
    private func createProject() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let newProject = try await projectService.createProject(
                    name: name,
                    description: description.isEmpty ? nil : description,
                    location: location.isEmpty ? nil : location
                )
                await MainActor.run {
                    onProjectCreated?(newProject)
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
            await MainActor.run {
                isLoading = false
            }
        }
    }
}

