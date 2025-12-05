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
    
    // Extraction state
    @State private var isExtracting = false
    @State private var extractionError: String?
    @State private var extractionAttempted = false
    
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
            .overlay {
                // Loading overlay during extraction
                if isExtracting {
                    ZStack {
                        Color.black.opacity(0.3)
                            .ignoresSafeArea()
                        VStack(spacing: 16) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(1.5)
                            Text("Analyzing image...")
                                .foregroundColor(.white)
                                .font(.headline)
                        }
                        .padding(24)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(12)
                    }
                }
            }
            .alert("Extraction Notice", isPresented: Binding(
                get: { extractionError != nil },
                set: { if !$0 { extractionError = nil } }
            )) {
                Button("OK") {
                    extractionError = nil
                }
            } message: {
                if let error = extractionError {
                    Text(error)
                }
            }
            .onAppear {
                if !extractionAttempted {
                    extractFormFields()
                }
            }
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
    
    private func extractFormFields() {
        guard !extractionAttempted else { return }
        extractionAttempted = true
        isExtracting = true
        extractionError = nil
        
        Task {
            do {
                let extractedFields = try await FormExtractionService.shared.extractFormFields(
                    image: image,
                    projectId: project.id
                )
                
                await MainActor.run {
                    // Populate fields with extracted data
                    if let locationValue = extractedFields.location, !locationValue.isEmpty {
                        location = locationValue
                    }
                    if let defectTypeValue = extractedFields.defectType, !defectTypeValue.isEmpty {
                        defectType = defectTypeValue
                    }
                    if let notesValue = extractedFields.notes, !notesValue.isEmpty {
                        notes = notesValue
                    }
                    if let panelNumberValue = extractedFields.panelNumber, !panelNumberValue.isEmpty {
                        panelNumber = panelNumberValue
                    }
                    if let materialValue = extractedFields.material, !materialValue.isEmpty {
                        material = materialValue
                    }
                    if let thicknessValue = extractedFields.thickness, !thicknessValue.isEmpty {
                        thickness = thicknessValue
                    }
                    if let seamsTypeValue = extractedFields.seamsType, !seamsTypeValue.isEmpty {
                        seamsType = seamsTypeValue
                    }
                    if let formTypeValue = extractedFields.formType, !formTypeValue.isEmpty {
                        // Validate form type before setting
                        if formTypes.contains(where: { $0.id == formTypeValue }) {
                            selectedFormType = formTypeValue
                        }
                    }
                    
                    isExtracting = false
                }
            } catch {
                await MainActor.run {
                    isExtracting = false
                    // Show error but allow manual entry
                    extractionError = "Could not extract form data automatically. Please enter manually."
                    print("Form extraction error: \(error.localizedDescription)")
                }
            }
        }
    }
}
