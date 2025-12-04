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
    @State private var panelNumber = ""
    @State private var material = ""
    @State private var thickness = ""
    @State private var seamsType = ""
    @State private var selectedFormType = "defect_report"
    
    private let formTypes: [(id: String, label: String)] = [
        ("defect_report", "Defect Report"),
        ("repair_form", "Repair / Patch"),
        ("asbuilt_form", "As-built Record")
    ]
    
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
                
                Section(header: Text("As-Built Form Data")) {
                    Picker("Form Type", selection: $selectedFormType) {
                        ForEach(formTypes, id: \.id) { form in
                            Text(form.label).tag(form.id)
                        }
                    }
                    .pickerStyle(.menu)
                    
                    TextField("Panel Number (Optional)", text: $panelNumber)
                    TextField("Material (Optional)", text: $material)
                    TextField("Thickness (Optional)", text: $thickness)
                    TextField("Seams Type (Optional)", text: $seamsType)
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
        
        var formFields: [String: String] = [:]
        if !panelNumber.isEmpty {
            formFields["panelNumber"] = panelNumber
        }
        if !material.isEmpty {
            formFields["material"] = material
        }
        if !thickness.isEmpty {
            formFields["thickness"] = thickness
        }
        if !seamsType.isEmpty {
            formFields["seamsType"] = seamsType
        }
        if let locationValue = metadata.location {
            formFields["location"] = locationValue
        }
        if let notesValue = metadata.notes {
            formFields["notes"] = notesValue
        }
        if let defectValue = metadata.defectType {
            formFields["defectType"] = defectValue
        }
        
        let preparedFormFields = formFields.isEmpty ? nil : formFields
        
        Task {
            do {
                let result = try await uploadService.uploadDefectPhoto(
                    image: image,
                    projectId: project.id,
                    metadata: metadata,
                    formType: selectedFormType,
                    formFields: preparedFormFields
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
