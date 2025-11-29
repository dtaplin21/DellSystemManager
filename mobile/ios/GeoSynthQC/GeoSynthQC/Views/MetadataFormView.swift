import SwiftUI

struct MetadataFormView: View {
    let image: UIImage
    let project: Project
    @Binding var isPresented: Bool
    @Binding var uploadResult: UploadResult?
    
    @StateObject private var uploadService = ImageUploadService.shared
    @State private var location = ""
    @State private var notes = ""
    @State private var defectType = ""
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Image Preview")) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxHeight: 200)
                }
                
                Section(header: Text("Defect Information")) {
                    TextField("Location (Optional)", text: $location)
                    TextField("Defect Type (Optional)", text: $defectType)
                    TextField("Notes (Optional)", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("Upload Defect")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Upload") {
                        uploadImage()
                    }
                    .disabled(uploadService.isUploading)
                }
            }
        }
    }
    
    private func uploadImage() {
        let metadata = DefectMetadata(
            location: location.isEmpty ? nil : location,
            notes: notes.isEmpty ? nil : notes,
            defectType: defectType.isEmpty ? nil : defectType,
            latitude: nil,
            longitude: nil
        )
        
        Task {
            do {
                let result = try await uploadService.uploadDefectPhoto(
                    image: image,
                    projectId: project.id,
                    metadata: metadata
                )
                await MainActor.run {
                    uploadResult = result
                    isPresented = false
                }
            } catch {
                // Error is handled by uploadService
            }
        }
    }
}

