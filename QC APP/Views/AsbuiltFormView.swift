import SwiftUI

struct AsbuiltFormView: View {
    let image: UIImage
    let project: Project
    let formType: AsbuiltFormType
    @Binding var isPresented: Bool
    @Binding var uploadResult: UploadResult?
    
    @StateObject private var uploadService = ImageUploadService.shared
    @State private var formData: [String: Any] = [:]
    @State private var validationErrors: [String: String] = [:]
    @State private var isLoading = false
    
    private var fields: [AsbuiltFormField] {
        AsbuiltFormConfig.getFields(for: formType)
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
                
                // Dynamic Form Fields
                Section(header: Text("Form Information")) {
                    ForEach(fields) { field in
                        FormFieldView(
                            field: field,
                            value: Binding(
                                get: { getValue(for: field.key) },
                                set: { setValue(for: field.key, value: $0) }
                            ),
                            validationError: validationErrors[field.key]
                        )
                    }
                }
                
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
            }
            .navigationTitle("Complete Form")
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
        guard validateForm() else {
            return
        }
        
        isLoading = true
        
        let metadata = DefectMetadata(
            location: nil,
            notes: nil,
            defectType: nil,
            latitude: nil,
            longitude: nil,
            formType: formType.rawValue,
            formData: formData.isEmpty ? nil : formData
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
            await MainActor.run {
                isLoading = false
            }
        }
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
            
            switch field.type {
            case .text:
                TextField("Enter \(field.label)", text: $value)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
            case .number:
                TextField("Enter \(field.label)", text: $value)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
            case .date:
                DatePicker(
                    field.label,
                    selection: Binding(
                        get: { dateFromString(value) ?? Date() },
                        set: { value = stringFromDate($0, includeTime: false) }
                    ),
                    displayedComponents: .date
                )
                
            case .datetime:
                DatePicker(
                    field.label,
                    selection: Binding(
                        get: { dateTimeFromString(value) ?? Date() },
                        set: { value = stringFromDate($0, includeTime: true) }
                    ),
                    displayedComponents: [.date, .hourAndMinute]
                )
                
            case .textarea:
                TextField("Enter \(field.label)", text: $value, axis: .vertical)
                    .lineLimit(3...6)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
            case .select:
                if let options = field.options {
                    Picker(field.label, selection: $value) {
                        Text("Select...").tag("")
                        ForEach(options, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
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

