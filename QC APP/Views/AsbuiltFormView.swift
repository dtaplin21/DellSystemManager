import SwiftUI

struct AsbuiltFormView: View {
    let image: UIImage
    let project: Project
    let formType: AsbuiltFormType
    @Binding var isPresented: Bool
    @Binding var uploadResult: UploadResult?
    
    @StateObject private var uploadService = ImageUploadService.shared
    private let extractionService = FormExtractionService.shared
    @State private var formData: [String: Any] = [:]
    @State private var validationErrors: [String: String] = [:]
    @State private var isLoading = false
    @State private var uploadErrorMessage: String?
    @State private var isExtracting = false
    @State private var extractionError: String?
    @State private var extractionAttempted = false
    
    // Cache fields to prevent recalculation on each view update
    private let fields: [AsbuiltFormField]
    
    // Initialize fields once when view is created
    init(image: UIImage, project: Project, formType: AsbuiltFormType, isPresented: Binding<Bool>, uploadResult: Binding<UploadResult?>) {
        self.image = image
        self.project = project
        self.formType = formType
        self._isPresented = isPresented
        self._uploadResult = uploadResult
        self.fields = AsbuiltFormConfig.getFields(for: formType)
    }
    
    var body: some View {
        NavigationView {
            Form {
                // Image Preview Section
                Section(header: Text("Image Preview")) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxHeight: 200)
                }
                
                // Form Type Info
                Section(header: Text("Form Type")) {
                    HStack {
                        Image(systemName: formType.icon)
                            .foregroundColor(colorForFormType(formType))
                        Text(formType.displayName)
                            .font(.headline)
                    }
                }
                
                // AI Extraction Status - Prominent at top
                if isExtracting {
                    Section {
                        HStack(spacing: 12) {
                            ProgressView()
                                .scaleEffect(1.2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("AI Analyzing Image")
                                    .font(.headline)
                                Text("Extracting form data... Please wait.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                    }
                } else if let error = extractionError {
                    Section {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text("Could not auto-fill form: \(error)")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
                } else if extractionAttempted && !formData.isEmpty {
                    Section {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("Form auto-filled from image")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // Dynamic Form Fields
                Section(header: Text("Form Information")) {
                    ForEach(fields, id: \.key) { field in
                        FormFieldView(
                            field: field,
                            value: Binding(
                                get: { getValue(for: field.key) },
                                set: { setValue(for: field.key, value: $0) }
                            ),
                            validationError: validationErrors[field.key],
                            isDisabled: isExtracting
                        )
                    }
                }
                .disabled(isExtracting)
                .opacity(isExtracting ? 0.6 : 1.0)
                
                // Validation Errors
                if !validationErrors.isEmpty {
                    Section {
                        ForEach(Array(validationErrors.keys), id: \.self) { key in
                            if let error = validationErrors[key] {
                                Text(error)
                                    .foregroundColor(.red)
                                    .font(.caption)
                            }
                        }
                    }
                }
                
                // Upload Errors
                if let errorMessage = uploadErrorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Complete Form")
            .navigationBarTitleDisplayMode(.inline)
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
                    .disabled(uploadService.isUploading || isLoading)
                }
            }
        }
    }
    
    // MARK: - Value Management
    private func getValue(for key: String) -> String {
        if let value = formData[key] {
            if let stringValue = value as? String {
                return stringValue
            } else if let numberValue = value as? NSNumber {
                return numberValue.stringValue
            }
        }
        return ""
    }
    
    private func setValue(for key: String, value: String) {
        if value.isEmpty {
            formData.removeValue(forKey: key)
        } else {
            // Try to convert to number if the field type is number
            if let field = fields.first(where: { $0.key == key }),
               field.type == .number,
               let numberValue = Double(value) {
                formData[key] = numberValue
            } else {
                formData[key] = value
            }
        }
        // Clear validation error when user types
        validationErrors.removeValue(forKey: key)
    }
    
    // MARK: - Validation
    private func validateForm() -> Bool {
        validationErrors = [:]
        var isValid = true
        
        for field in fields {
            if field.required {
                let value = getValue(for: field.key)
                if value.isEmpty {
                    validationErrors[field.key] = "\(field.label) is required"
                    isValid = false
                }
            }
        }
        
        return isValid
    }
    
    // MARK: - Upload
    private func uploadImage() {
        print("🔵 [AsbuiltFormView] Upload button tapped")
        
        guard validateForm() else {
            print("⚠️ [AsbuiltFormView] Form validation failed")
            return
        }
        
        print("✅ [AsbuiltFormView] Form validation passed")
        print("📋 [AsbuiltFormView] Form data: \(formData)")
        
        isLoading = true
        uploadErrorMessage = nil
        
        let metadata = DefectMetadata(
            location: nil,
            notes: nil,
            defectType: nil,
            latitude: nil,
            longitude: nil,
            formType: formType.rawValue,
            formData: formData.isEmpty ? nil : formData
        )
        
        print("📤 [AsbuiltFormView] Starting upload for project: \(project.id), formType: \(formType.rawValue)")
        
        Task {
            do {
                let result = try await uploadService.uploadDefectPhoto(
                    image: image,
                    projectId: project.id,
                    metadata: metadata
                )
                print("✅ [AsbuiltFormView] Upload successful: \(result.message)")
                await MainActor.run {
                    uploadResult = result
                    isPresented = false
                }
            } catch {
                print("❌ [AsbuiltFormView] Upload failed: \(error.localizedDescription)")
                let errorMessage: String
                if let apiError = error as? APIError {
                    errorMessage = apiError.localizedDescription
                } else if let uploadError = uploadService.uploadError {
                    errorMessage = uploadError
                } else {
                    errorMessage = error.localizedDescription
                }
                await MainActor.run {
                    uploadErrorMessage = errorMessage
                    isLoading = false
                }
            }
        }
    }
    
    // MARK: - Form Field Extraction
    private func extractFormFields() {
        guard !isExtracting && !extractionAttempted else { return }
        
        isExtracting = true
        extractionError = nil
        extractionAttempted = true
        
        print("🔍 [AsbuiltFormView] Starting form field extraction for form type: \(formType.rawValue)")
        
        Task {
            do {
                let extracted = try await extractionService.extractAsbuiltFormFields(
                    image: image,
                    formType: formType.rawValue,
                    projectId: project.id
                )
                
                print("✅ [AsbuiltFormView] Form field extraction completed")
                print("📋 [AsbuiltFormView] Extracted fields: \(extracted)")
                
                await MainActor.run {
                    populateFormFromExtraction(extracted)
                    isExtracting = false
                }
            } catch {
                print("❌ [AsbuiltFormView] Form field extraction failed: \(error.localizedDescription)")
            await MainActor.run {
                    extractionError = error.localizedDescription
                    isExtracting = false
                }
            }
        }
    }
    
    private func populateFormFromExtraction(_ extracted: ExtractedAsbuiltFormFields) {
        print("📝 [AsbuiltFormView] Populating form from extracted data")
        
        // Map extracted fields to form data based on form type
        switch formType {
        case .panelPlacement:
            if let dateTime = extracted.dateTime { formData["dateTime"] = dateTime }
            if let panelNumber = extracted.panelNumber { formData["panelNumber"] = panelNumber }
            if let locationNote = extracted.locationNote { formData["locationNote"] = locationNote }
            if let weatherComments = extracted.weatherComments { formData["weatherComments"] = weatherComments }
            
        case .panelSeaming:
            if let dateTime = extracted.dateTime { formData["dateTime"] = dateTime }
            if let panelNumbers = extracted.panelNumbers { formData["panelNumbers"] = panelNumbers }
            if let seamLength = extracted.seamLength { formData["seamLength"] = seamLength }
            if let seamerInitials = extracted.seamerInitials { formData["seamerInitials"] = seamerInitials }
            if let machineNumber = extracted.machineNumber { formData["machineNumber"] = machineNumber }
            if let wedgeTemp = extracted.wedgeTemp { formData["wedgeTemp"] = wedgeTemp }
            if let nipRollerSpeed = extracted.nipRollerSpeed { formData["nipRollerSpeed"] = nipRollerSpeed }
            if let barrelTemp = extracted.barrelTemp { formData["barrelTemp"] = barrelTemp }
            if let preheatTemp = extracted.preheatTemp { formData["preheatTemp"] = preheatTemp }
            if let trackPeelInside = extracted.trackPeelInside { formData["trackPeelInside"] = trackPeelInside }
            if let trackPeelOutside = extracted.trackPeelOutside { formData["trackPeelOutside"] = trackPeelOutside }
            if let tensileLbsPerIn = extracted.tensileLbsPerIn { formData["tensileLbsPerIn"] = tensileLbsPerIn }
            if let tensileRate = extracted.tensileRate { formData["tensileRate"] = tensileRate }
            if let vboxPassFail = extracted.vboxPassFail { formData["vboxPassFail"] = vboxPassFail }
            if let weatherComments = extracted.weatherComments { formData["weatherComments"] = weatherComments }
            
        case .nonDestructive:
            if let dateTime = extracted.dateTime { formData["dateTime"] = dateTime }
            if let panelNumbers = extracted.panelNumbers { formData["panelNumbers"] = panelNumbers }
            if let operatorInitials = extracted.operatorInitials { formData["operatorInitials"] = operatorInitials }
            if let vboxPassFail = extracted.vboxPassFail { formData["vboxPassFail"] = vboxPassFail }
            if let notes = extracted.notes { formData["notes"] = notes }
            
        case .trialWeld:
            if let dateTime = extracted.dateTime { formData["dateTime"] = dateTime }
            if let seamerInitials = extracted.seamerInitials { formData["seamerInitials"] = seamerInitials }
            if let machineNumber = extracted.machineNumber { formData["machineNumber"] = machineNumber }
            if let wedgeTemp = extracted.wedgeTemp { formData["wedgeTemp"] = wedgeTemp }
            if let nipRollerSpeed = extracted.nipRollerSpeed { formData["nipRollerSpeed"] = nipRollerSpeed }
            if let barrelTemp = extracted.barrelTemp { formData["barrelTemp"] = barrelTemp }
            if let preheatTemp = extracted.preheatTemp { formData["preheatTemp"] = preheatTemp }
            if let trackPeelInside = extracted.trackPeelInside { formData["trackPeelInside"] = trackPeelInside }
            if let trackPeelOutside = extracted.trackPeelOutside { formData["trackPeelOutside"] = trackPeelOutside }
            if let tensileLbsPerIn = extracted.tensileLbsPerIn { formData["tensileLbsPerIn"] = tensileLbsPerIn }
            if let tensileRate = extracted.tensileRate { formData["tensileRate"] = tensileRate }
            if let passFail = extracted.passFail { formData["passFail"] = passFail }
            if let ambientTemp = extracted.ambientTemp { formData["ambientTemp"] = ambientTemp }
            if let comments = extracted.comments { formData["comments"] = comments }
            
        case .repairs:
            if let date = extracted.date { formData["date"] = date }
            if let repairId = extracted.repairId { formData["repairId"] = repairId }
            if let panelNumbers = extracted.panelNumbers { formData["panelNumbers"] = panelNumbers }
            if let extruderNumber = extracted.extruderNumber { formData["extruderNumber"] = extruderNumber }
            if let operatorInitials = extracted.operatorInitials { formData["operatorInitials"] = operatorInitials }
            if let typeDetailLocation = extracted.typeDetailLocation { formData["typeDetailLocation"] = typeDetailLocation }
            if let vboxPassFail = extracted.vboxPassFail { formData["vboxPassFail"] = vboxPassFail }
            
        case .destructive:
            if let date = extracted.date { formData["date"] = date }
            if let panelNumbers = extracted.panelNumbers { formData["panelNumbers"] = panelNumbers }
            if let sampleId = extracted.sampleId { formData["sampleId"] = sampleId }
            if let testerInitials = extracted.testerInitials { formData["testerInitials"] = testerInitials }
            if let machineNumber = extracted.machineNumber { formData["machineNumber"] = machineNumber }
            if let trackPeelInside = extracted.trackPeelInside { formData["trackPeelInside"] = trackPeelInside }
            if let trackPeelOutside = extracted.trackPeelOutside { formData["trackPeelOutside"] = trackPeelOutside }
            if let tensileLbsPerIn = extracted.tensileLbsPerIn { formData["tensileLbsPerIn"] = tensileLbsPerIn }
            if let tensileRate = extracted.tensileRate { formData["tensileRate"] = tensileRate }
            if let passFail = extracted.passFail { formData["passFail"] = passFail }
            if let comments = extracted.comments { formData["comments"] = comments }
        }
        
        print("✅ [AsbuiltFormView] Form populated with \(formData.count) fields")
    }
    
    private func colorForFormType(_ formType: AsbuiltFormType) -> Color {
        switch formType {
        case .panelPlacement: return .blue
        case .panelSeaming: return .green
        case .nonDestructive: return .orange
        case .trialWeld: return .purple
        case .repairs: return .red
        case .destructive: return .gray
        }
    }
}

// MARK: - Form Field View
struct FormFieldView: View {
    let field: AsbuiltFormField
    @Binding var value: String
    let validationError: String?
    let isDisabled: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(field.label)
                    .font(.subheadline)
                if field.required {
                    Text("*")
                        .foregroundColor(.red)
                }
            }
            
            Group {
            switch field.type {
            case .text:
                TextField("Enter \(field.label)", text: $value)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                        .disabled(isDisabled)
                        .opacity(isDisabled ? 0.6 : 1.0)
                
            case .number:
                TextField("Enter \(field.label)", text: $value)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                        .disabled(isDisabled)
                        .opacity(isDisabled ? 0.6 : 1.0)
                
            case .date:
                DatePicker(
                    field.label,
                    selection: Binding(
                        get: { dateFromString(value) ?? Date() },
                        set: { value = stringFromDate($0, includeTime: false) }
                    ),
                    displayedComponents: .date
                )
                    .disabled(isDisabled)
                    .opacity(isDisabled ? 0.6 : 1.0)
                
            case .datetime:
                DatePicker(
                    field.label,
                    selection: Binding(
                        get: { dateTimeFromString(value) ?? Date() },
                        set: { value = stringFromDate($0, includeTime: true) }
                    ),
                    displayedComponents: [.date, .hourAndMinute]
                )
                    .disabled(isDisabled)
                    .opacity(isDisabled ? 0.6 : 1.0)
                
            case .textarea:
                TextField("Enter \(field.label)", text: $value, axis: .vertical)
                    .lineLimit(3...6)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                        .disabled(isDisabled)
                        .opacity(isDisabled ? 0.6 : 1.0)
                
            case .select:
                if let options = field.options {
                    Picker(field.label, selection: $value) {
                        Text("Select...").tag("")
                        ForEach(options, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                        .disabled(isDisabled)
                        .opacity(isDisabled ? 0.6 : 1.0)
                    }
                }
            }
            
            if let error = validationError {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
            }
        }
    }
    
    // MARK: - Date Helpers
    private func dateFromString(_ string: String) -> Date? {
        if string.isEmpty { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: string)
    }
    
    private func dateTimeFromString(_ string: String) -> Date? {
        if string.isEmpty { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return formatter.date(from: string) ?? dateFromString(string)
    }
    
    private func stringFromDate(_ date: Date, includeTime: Bool) -> String {
        let formatter = DateFormatter()
        if includeTime {
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        } else {
            formatter.dateFormat = "yyyy-MM-dd"
        }
        return formatter.string(from: date)
    }
}

