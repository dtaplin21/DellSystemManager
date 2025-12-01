import SwiftUI

struct DefectCaptureView: View {
    let project: Project
    @StateObject private var uploadService = ImageUploadService.shared
    @State private var showCamera = false
    @State private var showPhotoLibrary = false
    @State private var selectedImage: UIImage?
    @State private var showMetadataForm = false
    @State private var showUploadResults = false
    @State private var uploadResult: UploadResult?
    
    var body: some View {
        VStack(spacing: 24) {
            // Project Header
            VStack(spacing: 8) {
                Text(project.name)
                    .font(.title2)
                    .fontWeight(.bold)
                if let location = project.location {
                    Text(location)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            
            Spacer()
            
            // Capture Buttons
            VStack(spacing: 16) {
                Button(action: { showCamera = true }) {
                    VStack(spacing: 12) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 48))
                        Text("Take Photo")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                
                Button(action: { showPhotoLibrary = true }) {
                    VStack(spacing: 12) {
                        Image(systemName: "photo.on.rectangle")
                            .font(.system(size: 48))
                        Text("Choose from Library")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
            }
            .padding(.horizontal, 32)
            
            // Upload Status
            if uploadService.isUploading {
                VStack(spacing: 8) {
                    ProgressView(value: uploadService.uploadProgress)
                    Text("Uploading...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 32)
            }
            
            if let error = uploadService.uploadError {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
                    .padding(.horizontal, 32)
            }
            
            Spacer()
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCamera) {
            CameraView(image: $selectedImage)
        }
        .sheet(isPresented: $showPhotoLibrary) {
            PhotoLibraryView(image: $selectedImage)
        }
        .sheet(isPresented: $showMetadataForm) {
            if let image = selectedImage {
                MetadataFormView(
                    image: image,
                    project: project,
                    isPresented: $showMetadataForm,
                    uploadResult: $uploadResult
                )
            }
        }
        .sheet(isPresented: $showUploadResults) {
            if let result = uploadResult {
                UploadResultsView(
                    result: result,
                    project: project,
                    isPresented: $showUploadResults
                )
            }
        }
        .onChange(of: selectedImage) { oldValue, newValue in
            if newValue != nil {
                showMetadataForm = true
            }
        }
        .onChange(of: uploadResult) { oldValue, newValue in
            if newValue != nil {
                showUploadResults = true
            }
        }
    }
}

